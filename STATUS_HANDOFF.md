# 공간마켓 — STATUS HANDOFF (다음 작업자 인계용)

브랜치: `claude/stabilize-google-play-4kcK5` → squash-merge to `main`
프로덕션: https://gonggan-market-qkdh.vercel.app
최신 production SHA: **`49cc5696`** (PR #120)

---

## 0. 변하지 않는 제약 (반드시 준수)
- 기능 삭제 금지. 현재 구조 유지 + 안정화 + 실제 운영준비가 목표.
- 자동송금/자동환불 구현 금지.
- 결제/에스크로/입찰/업체 status 관련은 보수적으로만 수정.
- GPS: 앱 마운트/실행 시 위치요청 금지. "현재 위치로 보기/설정" 탭할 때만 1회 getCurrentPosition. watchPosition/background GPS 금지.
- region: 기존 `region text` 컬럼 제거 금지(phased migration). 신규 jsonb 병행.
- Kakao fallback(MockMap) 제거 금지. real map 성공 시에만 fallback 숨김.

---

## 1. 현재 완료된 작업
- **PR #120 / production SHA `49cc5696`** 까지 머지·배포 완료
- migration **010**(`supabase/migrations/010_region_multi.sql`) + **011**(`011_region_multi_defaults.sql`) 코드 준비 완료
  - 010: `users.activity_regions` / `companies.service_regions` (jsonb, 최대 2 CHECK)
  - 011: `users.default_activity_region_id` / `companies.default_service_region_id` (text) + GIN 인덱스
- **사용자가 Supabase SQL Editor에서 migration SQL을 직접 실행함** (적용 완료 보고받음)
- 데이터 모델 반영 예정:
  - `users.activity_regions` : RegionEntry[] (고객 활동지역, 최대 2)
  - `companies.service_regions` : RegionEntry[] (업체 영업지역, 최대 2)
  - `RegionEntry = { id, sido, sigungu, label, lat, lng, radiusKm, city, district, is_primary, added_at }`
- 업체 영업지역 **2곳 선택 UI** 구현됨 (`CompanyOnboarding.jsx` + `RegionSelectSheet`)
- 지역 **fallback UX** 구현됨 (exact → legacy text → 같은 시/도 → 전국, 배너/배지/"내 지역만 보기" 토글)
- 지역 UI 표시됨: 고객 지역 탭에 **강서구 / 부평구** 정상 표시
- **QA 체크리스트** 생성됨: `docs/RELEASE_QA_CHECKLIST.md`
- 저장 fallback 구현됨: jsonb 저장 실패 시 `region text`로 폴백 (`src/lib/supabase.js`의 `updateUserActivityRegions` / `updateCompanyServiceRegions`)
- KakaoMap: https SDK src + onerror 상세 진단 배지 (PR #119)
- 브랜드 아이콘/OG → "01 공간·연결형" 교체 (PR #119)

---

## 2. 현재 문제 (CORE ISSUE)
**지역 탭은 강서구/부평구로 보이는데, 지도 화면 업체 리스트는 여전히 "전국 기준 / 전국 업체 fallback"으로 나옴.**

매칭 흐름(`src/utils/regionMatching.js` → `getMatchedCompaniesWithTier`):
- tier 1 exact: 고객 `activity_regions` ∩ 업체 `service_regions` 의 구/시 키 교집합
- tier 2 legacy: 기존 `region text` 문자열 매칭
- tier 3 city: 같은 시/도 확장 (isFallback=true)
- tier 4 all: **전국 전체** (isFallback=true) ← 지금 여기로 떨어지는 중

→ tier 4까지 내려간다는 건 **고객 지역 세트 또는 업체 지역 세트 중 최소 하나가 비어 있다**는 뜻.

### 원인 후보
- **(a)** 고객 `users.activity_regions`가 실제 DB에 저장 안 됨 (UI 탭은 로컬 state만일 수 있음)
- **(b)** 테스트 업체 `companies.service_regions`가 비어 있음 (대부분 유력)
- **(c)** `service_regions`가 비어 있을 때 legacy `region text` fallback 매칭이 안 됨
- **(d)** 저장은 됐지만 fetch/normalize에서 새 필드를 안 읽음
  - 참고: `getUser`/`getCompany`/`getCompanies`는 `select("*")`이므로 컬럼은 내려옴.
  - `getActivityRegions`/`getServiceRegions`(`src/constants/regions.js`)는
    배열이 비면 `region text`를 파싱해 1개 엔트리로 fallback → (c)가 사실이라면 여기 로직/데이터 확인.

---

## 3. 다음 확인 순서 (이 순서대로)
1. Supabase에서 `users.activity_regions` 값 확인 (→ `scripts/verify_010_region_multi.sql` 쿼리 4·6)
2. Supabase에서 `companies.service_regions` 값 확인 (→ 쿼리 5·6)
3. 테스트 업체에 `service_regions`를 **강서구 또는 부평구**로 직접 주입(쿼리 7) 후
   지도 화면이 "지역 기준"으로 바뀌는지 확인
4. 앱에서 **+지역 추가/삭제 → 새로고침** 후 유지되는지 확인 (고객)
5. 업체 **온보딩/마이페이지에서 service_regions 저장 → 새로고침** 후 유지되는지 확인
6. `getMatchedCompaniesWithTier`에서 `activity_regions ∩ service_regions`가 실제로 사용되는지
   (tier 1 도달 여부) — `mapFallbackTier` 값을 화면/로그로 확인
7. legacy `region text` fallback(tier 2) 정상 작동 여부 확인

---

## 4. 확인용 SQL (이미 추가됨)
`scripts/verify_010_region_multi.sql` — 다음 쿼리 포함:
- 1) 신규 컬럼 4개 존재 여부
- 2) 최대 2개 CHECK 제약 2개
- 3) GIN 인덱스 2개
- 4) 고객 활동지역 저장 샘플
- 5) 업체 영업지역 저장 샘플
- **6) 전체 스냅샷** (users/companies 20행씩 — 요청한 쿼리 반영)
- **7) 테스트 업체 service_regions 주입 UPDATE 예시** (강서구/부평구, 주석 처리 — 실제 id는 직접 입력)
- **8) 테스트 고객 activity_regions 주입 UPDATE 예시** (주석 처리)

> ⚠️ 컬럼 주의: 이 코드베이스 고객 테이블은 `public.users` (= `profiles` 아님).
> 사용자가 요청한 예시의 `default_activity_region_id`/`default_service_region_id` 컬럼은 migration 011에 포함.

---

## 5. 저장 진단 로그/토스트 추가 제안 (아직 미구현 — 다음 작업)
지역 저장 시 다음을 추가하면 (a)/(d) 원인 즉시 판별 가능:
- 저장 **성공 toast** / 저장 **실패 toast**
- `console.warn`에 `table / field / error.code / error.message` 출력
  - (현재 `supabase.js`는 실패 시 `console.warn`만 있고 성공 경로 로그/토스트 없음)
- 저장 직후 **다시 fetch 해서 실제 DB 값**을 console.debug로 확인하는 라운드트립 로그
- 위치: `src/lib/supabase.js`(`updateUserActivityRegions`/`updateCompanyServiceRegions`)
  및 호출부(`MainApp.jsx` 지역 저장 핸들러, `CompanyOnboarding.jsx` submit)

---

## 6. KakaoMap 남은 작업 (PC에서 사용자가 해야 함 — 코드로 불가)
현재 debug badge:
```
env: present
sdk: failed
script_inserted: true
navigator.online: true
fallback_reason: sdk-load-error[onerror:error]
```
→ 키/네트워크 문제 아님. script 태그는 삽입됐고 온라인인데 **dapi.kakao.com 응답이 onerror**
→ **도메인 미등록**이 가장 유력.

사용자(PC) 액션:
- Kakao Developers → 내 앱 → 앱 설정 → 플랫폼 → **Web 사이트 도메인** 등록:
  - production: `https://gonggan-market-qkdh.vercel.app`
  - preview: 현재 Vercel preview URL (배포마다 바뀜 — 고정 필요 시 production 우선)
- (JavaScript 키 사용 중인지 확인 — REST 키 아님)
- 카카오 공유 디버거에서 production URL **재스크랩** (OG 썸네일 캐시 갱신)
- 등록 후 모바일에서 badge 재확인 → `sdk: loaded / mode: real` 나와야 성공
- 만약 등록 후에도 `sdk-load-error`면: 모바일 in-app webview(카톡 등)의 외부 스크립트 차단 가능성 → 일반 브라우저(Chrome/Safari)에서 재확인

---

## 7. 남은 작업 우선순위 요약
1. **[코드]** 지역 저장 성공/실패 toast + 저장 후 재fetch 진단 로그 (§5) → (a)/(d) 판별
2. **[유저·Supabase]** verify SQL 6번으로 실제 DB 값 확인 → 7번으로 테스트 업체 주입 → 지역기준 전환 확인
3. **[유저·PC]** Kakao Developers 도메인 등록 + 공유 디버거 재스크랩 (§6)
4. **[코드, 필요 시]** legacy region text fallback(tier 2) 매칭 보강 (§2-c 확인 결과에 따라)
5. (낮음) Phase 3 MEDIUM 나머지
