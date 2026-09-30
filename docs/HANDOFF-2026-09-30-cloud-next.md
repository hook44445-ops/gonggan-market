# 인계 지시서 — 저장소(클라우드) Claude · 09-29~30 작업과 다음 순서

받는 사람: 이 저장소에서 새로 이어받는 Claude 세션. **이 문서 하나로 시작**하고, 자세한 건 아래 «함께 읽을 문서»에서 찾는다.

---

## 0. 규칙 (대표와 약속 — 바꾸지 않는다)

- 보고는 **한국어** · 쉬운 말 · 대표는 «트루 N개»(SQL 확인 칸이 true), «다음진행», «머지후 다음진행»으로 답한다
- **운영 SQL·키·환경변수·머지 결정은 대표** — Claude 는 SQL 파일을 만들고 **전체 원문 + 확인 칸 수**를 채팅에 준다(대표가 Supabase SQL Editor 에 붙임)
- 영구 삭제 금지(숨김·표시만) · 맨 `git stash` 금지 · 서버 비밀 키를 `VITE_` 로 만들지 않는다 · 서명 키 비밀번호 출력 금지
- 없는 기능·없는 숫자 약속 금지(안전결제는 `PAYMENTS_LIVE` 전이라 말하지 않는다 · «1등 앱» 같은 문구 금지)
- 광고성 알림은 **동의자에게만 «(광고)» · 한국 9~20시 · 수신거부 안내**
- 커밋·PR 에 모델 이름 넣지 않는다

### 작업 한 바퀴(매번 같은 순서)
1. 지정 브랜치에서 구현 → `npm test`(새 테스트 파일은 `package.json` 의 `test` 목록 맨 앞에 추가) → `npm run build`
2. 커밋 → `git push -u origin <브랜치>` → GitHub MCP 로 PR 만들기 → **squash 머지(expectedHeadSha 는 40자 전체)**
3. `git fetch origin main && git merge origin/main` → 일반 push(강제 push 금지)
4. SQL 이 있으면 원문 전체 + 확인 칸 수 + «먼저 할 것(배포·재로그인)» + «실행 뒤 폰 확인»을 채팅으로

### SQL 파일 관례 (`supabase/migrations/NNN_*.sql`)
- 맨 위 주석: 무엇 · «여러 번 실행해도 안전» · 되돌리기 한 줄 · 확인 칸 수
- `set search_path = public, extensions;` · 정책은 이름을 몰라도 **조건으로 찾아 drop**(180·182 방식) · 새 정책 이름은 `gNNN_` 접두
- 운영 스키마가 저장소 `schema.sql` 과 다르다(예: `bids.selected`·`requests.updated_at` 없음) → 칸 읽기는 `to_jsonb(row) ->> '칸'`, 없는 칸 쓰기는 `exception when undefined_column`, 표가 없을 수 있으면 `to_regclass` 로 감싼다
- 트리거 알림은 `exception when others then null` 로 **원래 저장을 절대 막지 않는다**
- 맨 아래 `select … as 확인칸` (true 면 끝)
- 로컬 검증: Postgres 16 (`/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgs/data -o '-p 55432' start` · `psql -h localhost -p 55432 -U postgres -d g`) — `auth.uid()` 는 `request.jwt.claim.sub` 를 읽는 가짜. 세션이 바뀌면 없을 수 있다 → 없으면 `supabase/schema.sql` + 가짜 `auth` 로 새로 만든다. **두 번 실행 · 익명/다른 사람/본인/관리자** 로 확인

---

## 1. 지금 구조 — 꼭 알아야 할 것

### 로그인 토큰(서버가 서명한 JWT)
- 인증번호 로그인 때 받는 토큰으로만 `auth.uid()` 가 산다. 클라이언트: `src/lib/session.js` `authedDb(userId)` · `src/lib/supabase.js` `userDb()`(토큰 없으면 익명 연결) · `adminDb()` · `chatDb`
- **180·182 뒤로 쓰기는 전부 토큰 연결**(`userDb()`). 익명 연결(`supabase.from(...).insert/update`)로 새 쓰기를 만들지 않는다
- 토큰 없는 옛 로그인: 읽기 화면은 `TokenNeededNote`(«한 번만 다시 로그인»), 쓰기는 `asLoginRequired(res)`(42501 → 확인창 → `gonggan:reauth` 이벤트 → App 이 인증번호 화면)
- 서버 함수(RPC)는 `TOKEN_RPCS` 에 있어야 토큰을 싣는다 · 166 이후 함수는 `p_actor_id := auth.uid()`(넘긴 값 무시)

### 푸시
- `push_logs` 에 `queued` 로 넣으면 `api/push/dispatch.js`(매일 18:00 KST cron + `wakePushDispatcher`)가 FCM 으로 보낸다 · 유니크 (user_id, type, related_id)
- 알림 종류 추가 시 함께: `src/utils/notify.js NOTIF_META` · `src/lib/notifyStats.js NOTIFY_LABELS` · `MainApp.jsx openNotificationTarget`
- 푸시 딥링크: `App.jsx` 가 `/?open=invite|review-card` 를 읽는다(새 값은 거기에 추가)
- **아이폰 앱(Expo gonggan-ios)은 아직 푸시 없음** — 웹·안드로이드(TWA)만

### 공유(다운로드 바퀴) — 캔버스 카드 + QR(`src/lib/qr.js qrMatrix/qrSvgPath`) + 초대 코드(`myRefCode`)
- 👨‍👩‍👧 `BidShareCard`(견적 3개부터 큰 배너 · 요청마다 한 번) · 📸 `BeforeAfterCard` · ⭐ `ReviewShareCard` · 간단 견적서 · 명함 QR
- 초대 링크: `src/lib/referral.js` `inviteUrl(code, isCompany)` · 고객→사장님 `proInviteMessage` · 가족 `familyMessage`

---

## 2. 09-29~30 에 한 것 (전부 main · SQL 은 대표 실행 완료)

| 묶음 | PR | SQL |
|---|---|---|
| 보안 S1~S5: 토큰의 사용자로만 판단 · 업체 칸 보호 · 대화 당사자만 · 업체 서류 주인만 · 운영 스키마 맞춤 | #862~#865 | 166~169 ✅ |
| 가격 데이터(평수·건물 유형·지역 코드·자재 등급) · 우리 동네 평당 시세 | #866 · #883 | 170 · 176 ✅ |
| 재방문: 집 관리 수첩 · 하자보수 끝나기 전 알림 · 출석 · 오늘의 한 줄 · 우리 동네 이번 주 · 견적 비교 넛지 · 고객이 견적 확인 · 업체 월요일 동네 요청 · 라운지 주간 인기 글 · 최근 완공 사진 · 찜한 업체 새 사례 · 알림 켜기 입구 | #857~#861 · #867 · #869~#875 · #879 · #885~#887 · #890 | 162~165 · 171~174 · 177 · 179 ✅ |
| 다운로드: 전·후 카드 · 견적 비교표 · 후기 카드 | #868 · #877 · #878 | — |
| 관리자 숫자: 알림별 읽음률 · 가격 데이터 쌓임 · 푸시 받는 사람 | #880 · #883 · #888 | 175 · 176 · 178 ✅ |
| 토큰 없는 로그인 안내 | #881 · #882 | — |
| 조용한 실패 고침(주인만 쓰는 표 → 토큰 연결 · **업체 가입은 토큰 먼저**) | #891 | — |
| 열린 정책 닫기(알림·후기·결제 주문·푸시 설정·댓글 수정) | #892 | 180 ✅ |
| 공유 순간: 견적 3개 배너 · 별 5개 후기 → 업체 «후기 카드» 알림 | #894 | 181 ✅ |
| 업체 초대: 고객 «🔧 아는 사장님 초대하기» | #895 · #899 | — |
| 남 이름 쓰기 닫기(요청·입찰·라운지 글·댓글·좋아요) | #897 | 182 ✅ |

---

## 3. 대표 확인 대기 (답이 오면 거기부터)

- [ ] **182 뒤 폰 확인**: 고객 견적 요청 · 업체 입찰 → 입찰 수정 · 라운지 글·댓글·좋아요 · 다음 날 라운지 자동 글이 올라오는지
- [ ] Vercel 에 `SUPABASE_SERVICE_ROLE_KEY` 있는지(없으면 자동 글 `api/trend/check-trends.js` · `serverAutonomousCycle.js` 가 익명으로 떨어져 182 뒤 막힌다)
- [ ] 180 뒤 폰 확인: 알림함 · 후기 쓰기 · 업체 답글 · 푸시 설정 켜고 끄기 · 라운지 댓글 고치기
- 막힌 표가 있으면 되돌리기 한 줄: `create policy gNNN_undo_<표> on public.<표> for insert with check (true);` 을 주고 → 원인(대개 토큰 없는 쓰기 경로)을 찾아 `userDb()` 로 고친 뒤 되돌리기 정책을 다시 지운다

---

## 4. 다음 할 일 — 순서대로

1. **폰 확인에서 막힌 곳부터**(3절) — 새 기능보다 먼저
2. **아이폰 푸시 받기**(로컬 Claude 가 규격 확정 뒤 · `docs/PLAN-2026-09-30-no1-download-revisit.md` 4절에 «확정» 이 적히면)
   - 웹: WebView 메시지 `{ type: "gonggan:push-token", token, platform: "ios_expo" }` 수신 → `upsertFcmToken`(토큰 연결) · 아이폰 앱에서 «알림 켜기» → `{ type: "gonggan:push-ask" }` 를 앱으로
   - 발송기: `api/push/dispatch.js` 안에서 `platform = 'ios_expo'` 는 Expo Push API(`https://exp.host/--/api/v2/push/send`, `{ to, title, body, data: { url } }`) — **서버리스 함수 개수 늘리지 않기** · 광고(event_promo)는 지금처럼 동의·시간 확인 뒤
3. **아이폰 로그인 유지 문제**가 로컬 QA(`docs/QA-2026-09-30-ios.md`)에 나오면 웹 쪽 보완(예: 토큰을 앱에 백업·복원하는 메시지) — 로컬과 규격 맞추기
4. **업체 «동료 초대» 순위** — 보상은 대표 결정 전까지 문구만(«보상» 약속 금지)
5. ✅(09-30 · SQL 184 — 결제 기록·시드 라운지 글·옛 표 2개 닫기 · 본인 요청 마감·만료·숨기기 = `request_owner_state` · 관리자 요청 고치기 정책. 일부러 누구나 쓰기로 둔 것: activity_logs · user_visits · partner_leads) **남은 보안 거리 점검**: 대표에게 `select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' order by 1,3;` 결과를 받아 `true` 로 열린 UPDATE/DELETE 가 남았는지 본다(예: `requests` UPDATE 는 운영에 `auth.uid() = customer_id` 만 있어 **본인 요청 만료·마감·보관이 조용히 실패**할 수 있다 — 상태 바꾸기는 보안 함수로 옮기는 쪽을 먼저 검토)
6. **주간 루프**(월요일): 관리자 숫자 → `docs/WEEKLY-YYYY-MM-DD.md` → 가장 약한 숫자 하나만 올리는 일(지시서 5절). 읽음률 20% 미만 알림은 문구·시각 조정

---

## 5. 함께 읽을 문서

- `docs/PLAN-2026-09-30-no1-download-revisit.md` — 1등 다운로드·재방문 목표·빈 곳(G1~G7)·주간 루프
- `docs/HANDOFF-2026-09-29-security-revisit.md` — 보안 S1~S5 · 폰 확인 목록 · 숫자 보는 곳
- `docs/HANDOFF-2026-09-30-local-higgsfield.md` · `docs/HANDOFF-2026-09-30-local-addendum.md` — 로컬 Claude 몫(힉스필드·아이폰 푸시·스토어)
