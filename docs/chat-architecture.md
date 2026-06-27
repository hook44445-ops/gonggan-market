# 공간마켓 채팅 아키텍처 설계 문서

> 상태: **설계 검토(리뷰)용**. 본 문서의 스키마/마이그레이션은 *제안*이며, 운영 DB
> 적용은 별도 승인 후 단계적으로 진행한다. 결제/에스크로/OTP/푸시/회원탈퇴/로그인/
> 라운지 토큰 차감 등 핵심 로직은 변경하지 않는다.

---

## 1. 현재 구조 (as-is, 코드 기준)

### 1.1 채팅
- **`chats`** = 메시지 로그 테이블. 대화는 **`room_id`(text)** 문자열로 그룹화.
  - 거래(업체/견적/계약/에스크로) 채팅: `room_id = "{user.id}_{company.id}"`
  - 라운지 채팅: `room_id = "lounge_{lounge_chat_request_id}"`
  - 별도의 "대화방(room/conversation) 1급 엔티티 없음."
- **`lounge_chat_requests`** = 라운지 대화 신청 메타.
  - 컬럼: `id, post_id, requester_id, target_id, status('pending'|'accepted'|'rejected'|'expired'), token_charged, accepted_at, source_comment_id, requester_left_at, target_left_at`
  - RPC: `request_comment_chat`(신청, 멱등 — 기존 accepted/pending 재사용), `accept_lounge_chat`(**수락 시 요청자 20토큰 1회 차감**, `token_charged` 플래그로 멱등), `reject_lounge_chat`, `leave_lounge_chat`(soft-leave).
  - 방은 첫 메시지 전송 시 `room_id="lounge_{request_id}"`로 지연 생성.

### 1.2 프로젝트 / 증빙
- **`requests`** = 견적/프로젝트 spine. `status('open'|'in_progress'|'completed'|'cancelled'|'closed')`.
- **`escrow_payments`** = 에스크로. `transaction_status`(REQUESTED→…→COMPLETED/SETTLED), `request_id` 참조.
- **`project_checkpoints`** = 증빙(GPS/사진). `checkpoint_type('site_visit'|'contract'|'construction_start'|'mid_inspection'|'completion'…)`, `request_id`/`contract_id` 참조. **후보/공식 상태값 없음.**

### 1.3 관리자 (이미 존재하는 자산)
- 테이블: `admin_logs`, `direct_deal_reports`(직거래 의심), `customer_reports`, `lounge_reports`.
- 헬퍼: `getAdminLogs()`, `getDirectDealReports({status,triggerType})`, `getCustomerReports()`, `getLoungeReports()`, `getProjectChatSummary()`, `getChatsForProject()`, `getChatMessages()`, `getAdminProjectFlow()`, `getAdminContractDetail()`.
- 컴포넌트: `ProjectEvidenceManagement.jsx`(증빙 대시보드), `AdminContractDetail.jsx`, `AdminLogView.jsx`, AdminScreen GPS 체크포인트 탭.
- 조회 우회: `buildRoomIdCandidates()` — room_id 저장 순서/식별자가 경로별로 달랐던 이력 때문에 "가능한 room_id 후보를 모두" 조회하는 보정 코드.

---

## 2. 문제점

1. **`chats.room_id` 문자열 기반** — 방이 1급 엔티티가 아님. 무결성/조인/정렬이 약함.
2. **거래 vs 라운지 room_id 규칙 상이** (`{user}_{company}` vs `lounge_{reqId}`). 거래는 **company.id**, 라운지는 **user.id** 키 → **같은 사람이 두 키로 등장**.
3. **같은 사람과 경로별로 방이 2개 이상** 생길 수 있음(예: 홍길동 라운지 채팅 + 거래 채팅). `buildRoomIdCandidates` 우회가 그 증거.
4. **conversation 1급 엔티티 부재** → 인박스/관리자 조회가 업체 목록/문자열 파싱에 의존.
5. **프로젝트↔채팅 연결 약함** — `requests`/`escrow`/`checkpoints`는 `request_id`로만 묶이고 채팅과 직접 링크 없음.
6. **증빙 후보/공식 구분 부족** — 현장방문(후보) vs 최종계약(공식)을 구분하는 상태값/승격 규칙 없음.

---

## 3. 최종 목표 구조 (to-be)

핵심: **채팅(conversation)이 척추, 프로젝트(requests)가 그 위에 얹히고, 라운지 게이트는 방의 상태값으로 보존.**

```
conversations  (신규, 1급 엔티티)
  id              uuid pk
  user_low        uuid   -- 두 참여자를 정렬 저장(min/max) → 사람 쌍 유니크
  user_high       uuid
  company_id      uuid null     -- 거래 맥락 보조값(사람 키는 owner user_id)
  origin          text          -- 'lounge' | 'trade' | 'request' | 'bid' | 'contract'
  access_status   text          -- 'pending' | 'open' | 'rejected'  (라운지 게이트)
  last_message_at timestamptz   -- 인박스 정렬/미리보기 비정규화
  created_at      timestamptz
  unique (user_low, user_high)  -- ★ 중복 방 원천 차단

chats  (기존 유지, 점진 확장)
  + conversation_id uuid fk      -- 이행기에는 room_id 와 병행
  + layer  text                  -- 'general' | 'project'  (일반대화/증빙 레이어)
  + project_id uuid null         -- 프로젝트 레이어 메시지/증빙

requests  (= 프로젝트, 기존 유지)
  + conversation_id uuid fk      -- 프로젝트를 대화 위에 얹음 (1 대화 : N 프로젝트)

project_checkpoints  (기존 유지)
  + evidence_status text         -- 'candidate' | 'official'
  ( request_id 이미 존재 = 프로젝트 링크 )
```

- **access_status 게이트**: 라운지 신청으로 만든 방은 `pending` → 수락+20토큰 → `open`. 거래로 만든 방은 처음부터 `open`. 이미 `open`인 상대와 라운지에서 다시 만나면 기존 방 재사용(게이트 불필요). → **라운지 토큰 차감 로직 자체는 변경 없이** conversation 상태로만 관리.
- **layer 분리**: 일반대화(상담/일정/가격/문의/직거래근거/신고근거)와 프로젝트 증빙(계약서/GPS/사진/단계승인/변경요청/완료승인/에스크로)을 한 방 안에서 컬럼으로 구분.
- **증빙 승격**: 현장방문 확정 → `evidence_status='candidate'`, 최종계약서 작성 → 후보 일괄 `'official'` 승격 + 이후 단계는 공식 적재.

---

## 4. Phase 전환안 (점진·무중단, 각 단계 독립 롤백 가능)

### Phase 0 — room_id 정규화 (코드, 소규모)
- 신규 **거래** room_id를 항상 정렬·단일 식별자로 생성 → **새 중복 방 발생 중단**.
- 기존 room_id 읽기 호환 유지(`buildRoomIdCandidates` 그대로). 데이터 이전 없음.

### Phase 1 — conversations 신설 + 백필 (마이그레이션 초안 = §6)
- `conversations` 테이블 신설.
- 기존 distinct `room_id` 기준으로 conversation 행 **백필**(사람 쌍 정규화).
- `chats.conversation_id` **이중 기록(dual-write)** 시작. `room_id`는 당분간 유지.

### Phase 2 — 라운지 통합
- 라운지 수락 시 해당 사람 쌍의 **canonical conversation에 attach**(access_status로 게이트).
- 라운지 내 "견적 신청" → 새 방 생성이 아니라 **같은 conversation에 `requests` 1건 연결**.
- 라운지 20토큰 차감 RPC는 **그대로**(상태만 conversation에 반영).

### Phase 3 — 프로젝트/증빙 레이어 + 관리자 표시
- `requests.conversation_id` 연결.
- `project_checkpoints.evidence_status` 추가. 현장방문 확정→`candidate`, 최종계약서→`official` 승격(전용 RPC, 멱등).
- 관리자모드에서 후보/공식 증빙 구분 표시(§5).

### Phase 4 — room_id 폐기 검토
- 모든 읽기/쓰기가 `conversation_id` 경유로 전환된 뒤 `room_id` 문자열 제거 검토.

> 결제/에스크로 핵심 로직은 전 단계에서 **불변**. `request_id` 조인만 추가된다.

---

## 5. 관리자모드 연동 방향 (조회/표시/확인/기록 중심, 자동 제재 없음)

관리자는 **삭제가 아니라 관리(조회·확인·기록)**. 기존 자산을 최대 재사용한다.

### 5.1 채팅 관리 (consolidated 뷰 제안)
- 소스: (현행) `getChatsForProject`/`getProjectChatSummary` + `lounge_chat_requests`. (목표) `conversations` 단일 SELECT.
- 표시: 생성경로(origin: lounge/trade/request/bid/contract), 참여자(고객/업체/라운지 사용자), 상태(일반/라운지/견적상담/현장방문확정/증빙후보/계약/에스크로/완료 — `requests.status`+`escrow.transaction_status`+`checkpoints`로 파생), 최근 메시지, 마지막 시간, 신고여부(`customer_reports`/`lounge_reports`), 직거래 의심(`direct_deal_reports`).

### 5.2 라운지 대화 신청 관리
- 소스: `lounge_chat_requests`(이미 존재). 상태(pending/accepted/rejected/cancelled=left), `token_charged`(20토큰 차감 여부).
- **중복 차감 점검**: `space_token_logs`의 `related_id`(=request id)별 `reason='lounge_chat_accept'` 행이 1건인지 확인하는 관리자 조회(읽기). 1건 초과면 경고 표시.
- 관리자 확인 상태: **신규 필드 필요**(§6 `admin_review`).

### 5.3 프로젝트 증빙 관리 (후보/공식)
- 소스: `project_checkpoints` + `ProjectEvidenceManagement.deriveEvidence`(이미 존재).
- **A. 증빙 후보**: 현장방문 확정 이후 자료(현장 사진/주소/방문일정/실측·하자·범위 대화/계약 전 파일). 현행에선 `checkpoint_type='site_visit'`로 파생, 목표에선 `evidence_status='candidate'`.
- **B. 공식 증빙**: 최종계약서 이후(계약서/견적서/GPS/사진/파일/단계승인/변경요청/완료승인/에스크로). 현행 `checkpoint_type='contract'~'completion'`, 목표 `evidence_status='official'`.

### 5.4 직거래 방지 관리
- 소스: `direct_deal_reports`(이미 존재) + `getDirectDealReports({status,triggerType})`.
- 키워드 예: 카톡/오픈채팅/계좌/현금/직접 연락/전화번호/010/밖에서 하자/수수료 빼고.
- 표시: 의심 메시지, 채팅방, 사용자, 발생시간, 위험도, 처리상태(미확인/확인중/경고/숨김/제재없음).
- **원칙: 자동 제재 없음.** 관리자 확인 기반. 메시지 **hard delete 금지**(숨김/플래그만).

### 5.5 관리자 액션
- 채팅방 상세 보기 / 신고 처리 / 직거래 의심 처리 / 라운지 신청 상태 확인 / 증빙 후보·공식 구분 / **관리자 메모 추가** / `admin_logs` 기록(이미 존재: `getAdminLogs`+insert 헬퍼).
- 메모·확인상태는 **신규 필드 필요**(§6).

---

## 6. 마이그레이션 초안 (★ 리뷰용 — 운영 DB 즉시 적용 금지)

> 아래는 *제안*이다. `supabase/migrations/`에 넣지 않고 본 문서에만 둔다(자동 실행 방지).
> 전부 **가산(additive)** 변경이며 기존 컬럼/데이터/로직을 건드리지 않는다.

```sql
-- [Phase 1] conversations 1급 엔티티
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_low        uuid not null references public.users(id) on delete cascade,
  user_high       uuid not null references public.users(id) on delete cascade,
  company_id      uuid references public.companies(id) on delete set null,
  origin          text check (origin in ('lounge','trade','request','bid','contract')),
  access_status   text not null default 'open'
                    check (access_status in ('pending','open','rejected')),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_low, user_high)
);
alter table public.conversations enable row level security;

-- [Phase 1] chats 확장 (병행 기록; room_id 그대로 유지)
alter table public.chats
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists layer text not null default 'general'
    check (layer in ('general','project')),
  add column if not exists project_id uuid references public.requests(id) on delete set null;

-- [Phase 3] requests(프로젝트) ↔ conversation 연결
alter table public.requests
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null;

-- [Phase 3] 증빙 후보/공식 상태
alter table public.project_checkpoints
  add column if not exists evidence_status text not null default 'candidate'
    check (evidence_status in ('candidate','official'));

-- [관리자 보완] 관리자 확인/메모 (조회·기록 전용, 자동 제재 없음)
create table if not exists public.admin_chat_reviews (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid,          -- 또는 room_id text (이행기 호환)
  room_id         text,
  review_status   text default 'unconfirmed'
                    check (review_status in ('unconfirmed','checking','warned','hidden','no_action')),
  memo            text,
  reviewed_by     uuid,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
alter table public.admin_chat_reviews enable row level security;
```

백필(개념, Phase 1):
```sql
-- distinct room_id → conversations 백필 (사람 쌍 정규화는 애플리케이션에서 수행 권장:
--  '{user}_{company}' 는 company.owner_user_id 로 사람키 환원, 'lounge_{reqId}' 는
--  lounge_chat_requests 의 requester_id/target_id 로 환원).
-- room_id 문자열 파싱은 데이터 품질 이슈가 있어, 백필 스크립트는 리뷰 후 별도 진행.
```

---

## 7. 수정 금지 / 원칙 요약
- 결제/Toss/정산/에스크로, OTP(Solapi), 푸시(FCM), 회원탈퇴, 로그인/세션/권한, 지역/GPS/KakaoMap, **라운지 20토큰 차감 RPC**, 견적/입찰/계약 핵심 플로우 — **불변**.
- room_id 생성 규칙 **즉시 대규모 변경 금지**(Phase 0에서 신규만 정규화).
- 운영 DB 대규모 migration **즉시 적용 금지**(리뷰용 초안).
- 메시지/사용자 데이터 **hard delete 금지**(soft-hide/flag만).
- mock/default 채팅 데이터 **재도입 금지**.
- 관리자모드 = 조회/표시/확인/기록. **자동 제재 없음**, 관리자 확인 기반.
