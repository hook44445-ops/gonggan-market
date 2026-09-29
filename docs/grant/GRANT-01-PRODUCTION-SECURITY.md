# Phase 2 — 로컬 운영 확인 (2026-09-29 20:29~20:34 KST)

이 절이 아래 Phase 1 기록보다 우선한다. 저장소 기준 e02d055, PR #862 원본 2128ad4. 운영 DB 변경·결제·가입·타 사용자 쓰기·파일 다운로드 없음. 메시지/문서/사진 본문과 식별자 행을 가져오지 않았다.

## Production Truth

| 항목 | 판정 | 직접 근거 / 한계 |
|---|---|---|
| Production URL | https://gongganmarket.com / HTTP 200 | 공개 HTML 직접 읽기 |
| Vercel Production | CONFIGURED | x-vercel-id + GitHub deployment 6727844103 success |
| Production SHA | 5a8cb7b1501fa17ed5c18f3896453c302da0c50f | 운영 JS의 VITE_VERCEL_GIT_COMMIT_SHA와 GitHub deployment 일치 |
| Supabase | CONFIGURED | 공개 번들 프로젝트와 기존 로컬 설정의 프로젝트 일치; URL/키 값 미공개 |
| APP_MODE | CONFIGURED — beta | 내려온 번들의 beta 상수/조건 확인, Vercel 비밀 환경변수 목록은 미접근 |
| PAYMENTS_LIVE | 프런트 false(베타 게이트) | release.js와 컴파일된 조건 대조. 서버 PG 운영 가능 여부는 UNKNOWN |
| Kakao Map | CONFIGURED(공개 SDK 참조) | 지도 렌더·도메인 허용·할당량은 미검증 |
| Toss/PG secret·payout 연동 | UNKNOWN | 기존 로컬 설정에 없음; 서버 비밀 환경에 접근하지 않음 |
| migration 전체 적용 상태 | UNKNOWN | 파일 번호나 대표 실행 이력으로 전체 적용을 단정하지 않음 |

기존 로컬 환경 파일에는 Supabase URL/anon 키/SAFE_MODE만 CONFIGURED. Vercel 인증 파일·Supabase 관리 토큰·직접 DB 연결을 확인하지 못했다. 브라우저 콘솔 연결은 두 번 시간 초과. 공개 OpenAPI 루트는 HTTP 401. 따라서 pg_policies, relrowsecurity, pg_get_functiondef, grants, storage 정책 원문을 읽지 못했다. 자격 증명을 새로 만들거나 우회하지 않았다.

## 운영 읽기 증거 (anon, HEAD, select=id&limit=0, Prefer=count=exact)

| 대상 | 응답 / 익명에게 보이는 건수 | RLS enabled / SELECT 원문 / INSERT / UPDATE / DELETE / RPC definer·auth.uid |
|---|---|---|
| chats | 206 / 25 | 전부 UNKNOWN; 익명 SELECT의 건수 노출만 직접 확인 |
| company_documents | 206 / 13 | 전부 UNKNOWN; 익명 SELECT의 건수 노출만 직접 확인 |
| companies | 206 / 1 | 전부 UNKNOWN; 공개 프로필 읽기 자체는 의도된 기능 |
| project_checkpoints | 200 / 0 | 전부 UNKNOWN; 0은 빈 테이블/정책 필터를 구별하지 못함 |
| estimates | 200 / 0 | 전부 UNKNOWN; actor 검증 여부를 입증하지 못함 |
| phase_photos | 206 / 27 | 전부 UNKNOWN; 쓰기 RPC의 안전성과 별개로 익명 읽기 범위 확인 필요 |
| escrow_payments | 206 / 8 | 전부 UNKNOWN; 익명 계약 장부 건수 노출 |
| escrow_payouts | 206 / 32 | 전부 UNKNOWN; 익명 지급 장부 건수 노출, 실제 송금 증거 아님 |

건수는 해당 역할에 보이는 행 수이며 전체 고객·거래량·매출로 사용할 수 없다. SELECT 응답 성공은 INSERT/UPDATE 허용이나 전체 본문 노출을 입증하지 않는다. 악성 actor·타 room 조회/쓰기 시험은 하지 않았다. Storage 파일과 signed URL은 열지 않았다.

## Security Matrix

| 항목 | Repository suspicion | Production actual | Severity | Exploit condition / affected data | Required fix | App / DB 필요 | Rollback |
|---|---|---|---|---|---|---|---|
| S1 chats | 081/093 anon 광범위 정책 | VULNERABLE: 익명 SELECT 건수 25 노출. INSERT·다른 room 본문은 UNKNOWN | 높은 우선순위, 본문 영향 미확정 | 공개 anon으로 건수 접근; 대화 내용·room 구성은 읽지 않음 | 실제 room participant 정책 확보 후 읽기·쓰기·realtime 함께 제한 | App 필요 예상 / DB 필요 예상, 정의 확보 전 확정 금지 | 실제 운영 정의 스냅샷 확보 전 작성 불가; open 정책 복구를 안전한 rollback으로 보지 않음 |
| S2 documents | 054 anon select/insert/update | VULNERABLE: 익명 SELECT 건수 13 노출. 변경·파일 접근은 UNKNOWN | 높은 우선순위, 파일 영향 미확정 | 비로그인 metadata 집계; 실제 문서 미열람 | owner/admin metadata + 승인 필드 권한 + private storage 확인 | App/DB 필요 예상 | 실제 정책/함수/Storage 스냅샷 필요 |
| S3 companies | owner FOR ALL로 관리자 필드 수정 의심 | UNKNOWN: 실제 정책·column grant·trigger 미확보 | 잠재적 높음 | owner 토큰·직접 update가 가능한 경우 verified/badge 신뢰 영향 | owner 허용 필드 분리 + admin RPC 경로 검증 | UNKNOWN | 운영 정의 확보 후 설계 |
| S4 GPS/estimate | 082/067/043/045가 p_actor_id를 신뢰 | UNKNOWN: 실제 함수 정의 미확보; 쓰기 시험 금지 준수 | 잠재적 높음 | definer가 actor를 신뢰할 때 작성자·프로젝트 위조 위험 | auth.uid + project membership + 연관 request/contract/company 일치 | App TOKEN_RPCS + DB 예상, 아직 적용 금지 | 배포된 함수 signature/body 확보 후 설계 |

최종 상태: S1 BLOCKED(읽기 노출 확인, 수정 미완료), S2 BLOCKED(동일), S3 UNKNOWN, S4 UNKNOWN. FIXED/SAFE로 판정한 항목 없음.

일반 room은 고객ID_업체ID, 라운지는 lounge_대화요청ID 구조(저장소). 실제 participant 정의·admin 예외·system 메시지 경로·Realtime JWT를 확보해야 S1을 닫을 수 있다. 업체 문서는 제출과 승인 권한을 구분해야 하며 단순 owner UPDATE 정책만으로는 부족하다.

136의 escrow_action/_escrow_party/phase_photos_add와 관리자 함수는 코드상 auth.uid를 사용한다. phase_photos_add의 uploaded_by도 auth.uid로 고정한다. 그러나 운영 함수 정의가 같다는 증거는 없으므로 SAFE 판정 대신 CODE_READY. 사진/장부 읽기 노출은 이 쓰기 패턴으로 해결되지 않는다.

## 수정 Gate / 테스트

현재는 실제 정책·함수·grants·triggers·Storage 원문과 staging/test-account 검증 기반이 없어 안전한 migration/rollback을 완성할 수 없다. 취약점을 숨기지 않되 저장소의 옛 정책을 운영 정책으로 가정해 수정하지 않는다. 이번 변경은 Evidence 문서뿐이며 앱/DB 수정 0건.

SEC1~SEC12는 미실행(NOT_RUN). anon/무관 사용자/당사자/admin 채팅, 문서 foreign/owner/admin, owner self-verify/admin 승인, forged actor/실actor/outsider checkpoint의 허용·거절을 staging에서 검증해야 한다. 운영에서는 쓰기 테스트를 하지 않는다. 전체 앱 tests/build를 이번에 실행했다고 주장하지 않는다(런타임 변경 없음).

다음 자동 작업: 읽기 전용 관리 연결이 사용 가능해지면 정책·함수·열 권한·trigger·Storage만 수집 → 운영에서 확인된 취약점만 앱+SQL+rollback+SEC1~12+전체 tests/build 준비 → 대표의 Production migration 승인 직전 STOP. 현 단계에서는 불완전한 SQL 승인 요청을 올리지 않는다.

로컬 증거: C:/Users/hook4/Documents/Codex/gonggan-security-evidence/production-summary.json, schema-summary.json. 원본 공개 번들 사본은 로컬에만 보관하고 키/사용자 내용은 PR에 넣지 않는다.

---
## 아래는 Phase 1 당시 기록(미확정 표현은 위 판정으로 대체)

# 정부지원사업 준비 1 — 운영 확인 · 보안(P0) 점검 (2026-09-29)

기준: `hook44445-ops/gonggan-market` main `e02d055` · 작성: 코드/SQL 읽기 전용 점검 · **운영 DB·운영 사이트는 이 작업 환경에서 접속 불가(네트워크 정책)** → 운영값은 모두 UNKNOWN.
원칙: SQL 파일만 보고 «운영이 취약하다»고 단정하지 않는다. 아래 보안 항목은 **SUSPECTED(저장소 기준)** 이며, 운영 정책 조회로 확정한다.

---

## 1. Production Truth

| 항목 | 값 | 근거 / 확인 방법 |
|---|---|---|
| Production URL | gongganmarket.com (코드상 정식 도메인) | `src/utils/siteSeo.js` canonicalSite · `api/sitemap.js` |
| Production SHA | **UNKNOWN** | 운영 번들의 `__GIT_SHA__`(vite.config) 로 확인 가능 — 사이트 접속 필요 |
| Hosting | Vercel (`vercel.json` crons 2 · rewrites) · 서버 함수 12개 한도 | `vercel.json`, `api/` |
| Supabase 프로젝트 연결 | **UNKNOWN** (주소는 환경변수 `VITE_SUPABASE_URL`, 저장소에 없음) | 운영 번들에서 확인 가능 |
| APP_MODE | 코드 기본 `beta` · 운영 값 **UNKNOWN**(Vercel 환경변수) | `src/constants/release.js:35` |
| PAYMENTS_LIVE | `!SHOW_BETA_UI` → 베타면 false · 운영 **UNKNOWN**(대표 대화상 결제 미오픈) | `release.js:42` |
| 회원가입 | 코드 READY · 운영 **UNKNOWN** | `api/send-otp.js`·`verify-otp.js` |
| 견적 요청 | 코드 READY · 운영 **UNKNOWN** | `createRequest` (`src/lib/supabase.js:283`) |
| 업체 입찰 | 코드 READY · 운영 **UNKNOWN** | `addBid` (MainApp) · 124·128 |
| 채팅 | 코드 READY · 운영 **UNKNOWN** | `chats` · `ChatScreen.jsx` |
| GPS checkpoint | 코드 READY · 운영 **UNKNOWN** | `project_checkpoints` 032·034·067·082 |

운영 사실로 쓸 수 있는 간접 근거(대화 기록): 대표가 09-28~29 운영 Supabase 에서 SQL 155~165 를 실행하고 확인값 true 를 보고함 → «운영 DB 가 존재하고 최신 스키마가 적용됨»까지만. 사용자·거래·매출: **NO_DATA**.

### 운영 확인에 필요한 것(한 번)
작업 환경 네트워크 허용: `gongganmarket.com` · 운영 Supabase 호스트(`<project>.supabase.co`).
→ 허용되면 AI 가 수행: 운영 번들 SHA·APP_MODE 확인 · anon 키(공개값)로 아래 «블랙박스 점검»(행 내용 없이 **건수만**) · 공개 화면 캡처.
정책 원문(pg_policies)까지 보려면 읽기 전용 DB 접속 정보가 추가로 필요(대표 결정).

---

## 2. RLS / 권한 P0 점검 (저장소 기준 SUSPECTED)

| # | 대상 | 저장소의 현재 정책 | 위험 | 판정 |
|---|---|---|---|---|
| S1 | `chats` (채팅 메시지) | 081·093: `select using(true)` · `insert with check(true)` (anon 포함) — 081 주석 «운영 DB 확인됨» | anon 키(앱에 공개)만으로 모든 대화 읽기·아무 방에 쓰기 | **P0 SUSPECTED** |
| S2 | `company_documents` (업체 서류 기록) | 054: anon `select/insert/update using(true)` | 남의 서류 기록 읽기·상태(review_status) 바꾸기(파일 자체는 비공개 버킷 + 10분 서명 주소) | **P0 SUSPECTED** |
| S3 | `companies` | `schema.sql:199` «owner write» `for all using (auth.uid() = owner_id)` — 이후 좁힌 흔적 없음 | 업체 주인이 로그인 토큰으로 자기 행의 `verified`·`has_insurance`·`license_verified`·보증 칸을 직접 켤 수 있음 → **업체 검증 우회** | **P0 SUSPECTED** |
| S4 | GPS·견적 서버 함수 `project_checkpoint_save` · `project_contract_checkpoint_save` · `estimate_upsert` | 앱이 보낸 `p_actor_id` 를 신뢰(138 이 관리자 함수만 토큰으로 바꿈, 이 셋은 제외) · 업체 주인 ID 는 공개(`companies` select true) | 남의 프로젝트에 **가짜 GPS 체크포인트·견적** 기록 가능 → «GPS 증빙» 신뢰 붕괴 | **P0 SUSPECTED** |
| S5 | Storage `chat-photos` | 088: anon `insert/select` 버킷 전체 | 채팅 사진 누구나 올리기·보기 | P1 SUSPECTED |
| S6 | `requests`·`bids` | 공개 읽기(081 주석) | 요청 설명·지역이 공개 — 주소·연락처가 없는지 확인 필요 | P2 확인 |

양호(저장소 기준): 단계 사진 `phase_photos_add`·계약 단계 `escrow_action` 은 **토큰의 사용자(auth.uid)** 로 당사자 판정(136) · 관리자 함수 전부 토큰 게이트(131·138) · 업체 서류 파일은 비공개 버킷 + 서명 주소(`docs/PRIVATE_DOCS.md`) · 체크포인트 좌표는 관리자만(조회 RPC 마스킹).

### 운영 블랙박스 점검(네트워크 허용 뒤 AI 수행 · 읽기 · 건수만)
```
GET /rest/v1/chats?select=id&limit=1            (anon)  → 행이 보이면 S1 확정
GET /rest/v1/company_documents?select=id&limit=1 (anon)  → 행이 보이면 S2 읽기 확정
POST /rest/v1/rpc/project_checkpoint_save …      → 실행하지 않는다(쓰기). S4 는 정책 원문/함수 정의로만 확정
```
쓰기 시험은 하지 않는다(운영 데이터 오염 금지).

---

## 3. 수정안 (확정 뒤 · 대표 승인 게이트)

모든 수정은 **앱 코드 + SQL 을 한 PR 로** — 정책만 닫으면 기존 화면이 깨진다(앱이 채팅을 토큰 없는 anon 연결로 읽고 씀: `src/lib/supabase.js:486~650`).
순서: ① 앱이 토큰 연결로 읽고 쓰게 배포 → ② 대표 재로그인으로 토큰 확인 → ③ SQL 실행(되돌리기 SQL 동봉) — 131 과 같은 절차.

### S4 (가장 먼저) — 증빙 함수의 «누가»를 토큰으로
- 원인: 함수가 `p_actor_id`(앱이 보낸 값)로 업체 당사자 판정.
- 목표: `v_actor := auth.uid()` · `p_actor_id` 는 이름만 남김(앱 호환, 138 과 같은 방식) · 토큰 없으면 `LOGIN_REQUIRED`.
- 앱: `TOKEN_RPCS`(src/lib/session.js)에 `project_checkpoint_save`, `project_contract_checkpoint_save`, `estimate_upsert`, `estimate_submit` 추가.
- 되돌리기: 이전 함수 정의(082·067·043 본문)를 그대로 다시 실행.
- 시험: ① 토큰 있는 업체 주인 — 착공 보고 저장 성공 ② 다른 사람 토큰 — `NOT_PROJECT_COMPANY` ③ 토큰 없음 — `LOGIN_REQUIRED` ④ 고객 계약 GPS 저장 성공.
- 회귀 위험: 토큰이 없는 옛 로그인 기기 → 재로그인 안내(이미 있는 `onReauthenticate` 흐름).

### S3 — 업체 검증 칸은 관리자 함수로만
- 목표: `companies` 에 BEFORE UPDATE 트리거 — `verified`·`has_insurance`·`license_verified`·`badge`·보증·`is_direct` 가 바뀌는데 호출자가 관리자(`_is_admin_uid(auth.uid())`)나 security definer 서버 함수가 아니면 예전 값으로 되돌림(또는 오류).
- 앱 영향: 업체가 프로필(이름·소개·지역)을 고치는 흐름은 그대로.
- 되돌리기: `drop trigger … on public.companies`.
- 시험: 업체 토큰으로 `verified=true` 수정 → 값 안 바뀜 · 관리자 승인(118) → 켜짐 · 업체 소개 수정 → 성공.

### S1 — 채팅은 당사자 + 관리자만
- 방 번호 규칙(코드): `고객ID_업체ID` (ChatScreen.jsx:129) · `lounge_라운지대화요청ID` (MainApp.jsx:2511).
- 목표 정책(토큰 연결):
  - `고객ID_업체ID`: auth.uid() = 앞 ID, 또는 auth.uid() = (업체ID 의 owner_id), 또는 관리자.
  - `lounge_…`: 그 라운지 대화 요청의 신청자·상대, 또는 관리자.
  - insert 는 위 조건 + `sender_id = auth.uid()`(system 메시지는 서버 함수로).
- 앱: 채팅 읽기·쓰기·실시간 구독을 `authedDb(userId)` 로(실시간도 토큰이 붙어야 RLS 통과).
- 관리자 대화 현황(`supabase.js:4112`)은 관리자 토큰 연결로.
- 되돌리기: 081 정책 두 줄 재생성.
- 시험: 고객·업체·제3자·관리자·비로그인 5경우 × 읽기/쓰기/실시간.

### S2 — 업체 서류 기록은 그 업체 + 관리자만
- 목표: select/insert/update — `company_id` 의 owner_id = auth.uid() 또는 관리자. `review_status` 를 `approved/held/rejected` 로 바꾸는 건 관리자 함수(118)만(트리거로 막기).
- 앱: 서류 목록·제출(`supabase.js:2639~2676`)을 토큰 연결로.
- 되돌리기: 054 정책 재생성. 시험: 업체 제출 → submitted · 업체가 approved 로 → 거절 · 관리자 승인 → approved · 다른 업체 → 안 보임.

### S5 — chat-photos 버킷
- 목표: 비공개 버킷 + 당사자만 서명 주소(업체 서류와 같은 방식). 기존 공개 주소 사진의 이전 계획 포함(삭제 금지).

---

## 요약
- 운영 사실 확정: 불가(네트워크) → UNKNOWN.
- 저장소 기준 P0 의심 4건(S1·S2·S3·S4) — **S4·S3 은 «GPS 증빙»·«업체 검증» 주장 자체를 무너뜨리므로 지원서 제출 전 필수 수정**.
- 수정은 앱+SQL 한 묶음, 운영 SQL 은 대표 승인 뒤.
