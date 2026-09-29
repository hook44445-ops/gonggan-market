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
