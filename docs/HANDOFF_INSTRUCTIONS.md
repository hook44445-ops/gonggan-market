# 공간마켓 — 인계지시서 (성과 이후 다음 작업자용)

> 작성일 2026-08-07 · 함께 읽을 문서: `GONGGAN_MARKET_ACHIEVEMENTS.md`(현재까지 성과), `GONGGAN_PRODUCT_DEFINITION.md`(제품 정의·설계안).
> 이 문서는 "지금까지 무엇이 됐나"가 아니라 **"이제 무엇을, 어떤 순서로 해야 하나"** 를 지시한다.

---

## 0. 시작 전 30분 — 반드시 이 순서로

1. `GONGGAN_MARKET_ACHIEVEMENTS.md` 통독 → 무엇이 이미 있는지 파악. **없는 걸 새로 만들지 말고 있는 걸 쓴다.**
2. `GONGGAN_PRODUCT_DEFINITION.md` §0(실제 구조)·§3(도메인)·§4(MVP) 통독.
3. 이 문서 §1(불변 제약)을 읽고 시작. 이걸 어기면 운영 중 서비스가 깨진다.

---

## 1. 불변 제약 (위반 시 회귀·사고) — 협상 불가

- **기능 삭제 금지.** 현 구조 유지 + 안정화가 목표. (실험적 기능이라도 임의 제거 금지)
- **자동 송금·자동 환불 구현 금지.** 결제/에스크로/입찰/업체 status는 **보수적으로만** 수정.
- **GPS**: 앱 마운트/실행 시 위치요청 금지. "현재 위치로 보기" 탭할 때만 1회 `getCurrentPosition`. `watchPosition`/백그라운드 GPS 금지.
- **region text 컬럼 제거 금지**(phased migration). 신규 jsonb와 병행.
- **Kakao MockMap 폴백 제거 금지.** real map 성공 시에만 폴백 숨김.
- **민감 데이터·키 커밋 금지.** (env·토큰·키스토어)
- **Prubi 코드/저장소 건드리지 않음.** (별도 운영)

---

## 2. 최우선 — 미해결 핵심 버그: 지역 매칭 전국 폴백 (BLOCKER)

**증상**: 고객 지역 탭은 강서구/부평구로 보이는데, 지도 리스트는 전국(tier-4) 폴백으로 나옴 → 지역 매칭이 사실상 작동 안 함. **실사용/마케팅 전 반드시 해결.**

원인 후보: (a) `users.activity_regions` 실제 미저장 (b) 테스트 업체 `companies.service_regions` 비어 있음(유력) (c) legacy `region text` 폴백 매칭 누락 (d) fetch/normalize에서 새 필드 미사용.

**작업 순서**
1. **[코드]** 지역 저장 성공/실패 toast + 저장 직후 재fetch 진단 로그 추가 → (a)/(d) 즉시 판별.
   - 위치: `src/lib/supabase.js`(`updateUserActivityRegions`/`updateCompanyServiceRegions`) 및 호출부(`MainApp.jsx` 지역 저장 핸들러, `CompanyOnboarding.jsx` submit).
2. **[유저·Supabase]** `scripts/verify_010_region_multi.sql` 쿼리 6으로 실제 DB 값 확인 → 쿼리 7로 테스트 업체 `service_regions` 주입(강서구/부평구) → 지도 리스트가 "지역 기준"으로 바뀌는지 확인.
3. **[유저·PC]** Kakao Developers → Web 도메인 등록(production URL). 등록 후 `sdk: loaded / mode: real` 확인.
4. **[코드, 필요 시]** legacy `region text` tier-2 폴백 매칭 보강(`getMatchedCompaniesWithTier`).

---

## 3. 그다음 — 도메인·브랜드 이행 (gonggansai.com 확보 반영)

설계안(`GONGGAN_PRODUCT_DEFINITION.md` §3) 확정 방향:
- 마켓·라운지·매거진은 **같은 origin(서브디렉터리)** 유지. **DB는 현행 단일 유지**(억지 3분할 금지).
- 매거진은 `/magazine`, 라운지는 `/lounge`(딥링크 이미 존재).

작업:
1. `index.html`의 Organization JSON-LD `url`을 (Prubi 값이 남아 있으면) **gonggansai.com** 기준으로 교체. Prubi 저장소 값은 건드리지 않음.
2. Prubi의 `src/lib/seo.ts` "**기본 noindex + 명시적 index**" 패턴을 이식(현 저장소는 JS → `seo.js`). 매거진·라운지 공개 글만 명시적 index.
3. gonggansai.com DNS/Vercel 도메인 연결, `sitemap`/`robots`/OG 도메인 갱신.

---

## 4. 출시 정리 — 마켓 임계경로만 남기고 비핵심 축 분리

목표: 12함수 압박·1인 유지보수 부담 감소. (삭제가 아니라 **비활성/분리**)

- **출시 임계경로(유지)**: 업체 온보딩 · 요청→견적→채팅 · 안전결제(수수료 수취) · 리뷰 · 지역 매칭 · 법적 고지 · 단일 로그인.
- **분리/비활성 후보**(마켓 배포에서 빼면 함수 여유): 매거진 자동발행/신디케이션(`api/trend/check-trends.js`, `blogPublisher`), 트렌드 파이프라인, 푸시 dispatch/enqueue(초기엔 문자/이메일로 대체), AI Executive Office, 토큰 스토어, prerender, `api/admin/seed-posts.js`(실데이터 전환 후 제거).
- 자세한 근거: `GONGGAN_PRODUCT_DEFINITION.md` §4-2.

---

## 5. 사용자(대표)가 결정해줘야 진행되는 것 — 확정 요청

코드로 알 수 없어 임의로 채우지 않은 항목. 확정되면 문서/코드에 반영:
1. **수수료율·정산 방식** (`fee_config` 구조와 연결). 자동송금 금지 원칙 하에서.
2. **성공 지표 수치 목표** (제품별 1차 지표는 정의됨 — 숫자만 필요).
3. **공간마켓 목표 출시 시점** (로드맵 날짜는 임의로 채우지 않음).

---

## 6. 환경 · 보안 점검

- **필요 환경변수(값 아님, 이름만)**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TOSS_SECRET_KEY`, `VITE_TOSS_CLIENT_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `VITE_KAKAO_MAP_KEY`, `VITE_LLM_PROVIDER`, `VITE_LLM_MODEL`, `VITE_LLM_API_KEY`, `VITE_SAFE_MODE`. (`.env.local.example` 참조)
- **⚠️ 보안**: `android-twa/gonggan-release.keystore`(앱 서명 키)가 저장소에 포함돼 있음. 유출 시 앱 위조 서명 위험 → **키스토어를 저장소에서 분리하고 이력 정리(BFG/filter-repo) 여부를 대표와 협의.** 이 문서에서 임의로 제거하지 않음(배포 서명 영향).
- **cron**: 푸시 09:00, 트렌드/자율 06:00(`vercel.json`). 비핵심 축 분리 시 cron도 함께 정리.

---

## 7. 법무 확인 목록 실행 (출시 전)

`GONGGAN_PRODUCT_DEFINITION.md` §5 기준:
- 중개업: 부동산 아님 → 공인중개사법 대상 아님. **통신판매중개자 지위 고지**(당사자 아님) 확인.
- 집수리=건설 관련: 소규모 수선 무등록 범위·하자/AS 책임 주체(업체) 고지.
- 통신판매업: 신고번호(2026-성남중원-0463) 게시·청약철회/분쟁 기준. 에스크로 정산은 전자금융거래법 검토.
- 개인정보: 신분증(민감정보) 암호화·보관기간·파기 정책 필수. 처리방침 게시·동의 분리.

---

## 8. 작업 규율 (Prubi에서 검증된 원칙)

- 1인 개발. 마이크로서비스·컴포넌트 라이브러리·디자인 시스템 패키지 만들지 말 것.
- 과설계 금지. 지금 필요 없는 추상화 미리 만들지 말 것.
- Mock과 실제 명확히 구분. 가짜로 동작하는 것처럼 보이게 하지 말 것.
- 커밋은 작고 목적이 분명하게. 배포 전 `npm test`(자동화 축 유닛 테스트) 통과 확인.

---

### 요약 한 줄
**먼저 지역 매칭 버그(§2)를 잡아 마켓을 실제로 작동시키고 → 도메인 이행(§3)과 출시 정리(§4)를 하되 → 불변 제약(§1)을 절대 어기지 말 것. 사업 파라미터(§5)는 대표 확정을 기다린다.**
