# 인계 지시서 2 — 저장소(클라우드) Claude · 09-30 오후 작업과 다음 순서

받는 사람: 이 저장소에서 새로 이어받는 Claude 세션.
**규칙·구조는 `docs/HANDOFF-2026-09-30-cloud-next.md` 0~1절 그대로**(이 문서는 그 뒤에 한 것과 다음 순서만). 두 문서를 끝까지 읽고 시작한다.

---

## 0. 규칙 요약 (바뀐 것 없음)

- 보고는 **한국어 · 쉬운 말** · 대표 답은 «트루 N개» · «다음진행» · «머지후 다음진행»
- 운영 SQL·키·환경변수·**머지 결정은 대표** — SQL 은 파일로 만들고 채팅에 «전체 원문 + 확인 칸 수 + 먼저 할 것 + 실행 뒤 폰 확인»
- 영구 삭제 금지 · 맨 `git stash` 금지 · 서버 비밀 키를 `VITE_` 로 만들지 않기 · 없는 기능·숫자 약속 금지(안전결제는 `PAYMENTS_LIVE` 전)
- 광고 알림은 동의자만 «(광고)» · 9~20시 · 수신거부 안내 · 새 쓰기는 반드시 로그인 토큰 연결 `userDb()` · 커밋·PR 에 모델 이름 넣지 않기
- 작업 한 바퀴: 구현 → `npm test`·`npm run build` → 커밋 → PR → squash 머지(expectedHeadSha 40자) → main 을 브랜치에 merge → 일반 push
- 새 서버 함수(쓰기 경로)는 **«앱 먼저 → SQL 나중»**: 앱은 새 RPC 를 먼저 부르고 없으면(PGRST202·42883) 예전 방식으로(184 `requestOwnerState` 참고)

### 로컬 SQL 검증 (이 세션에서 쓴 방법)
```
mkdir -p /var/tmp/pgt && chown postgres /var/tmp/pgt
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/tmp/pgt/data -A trust -U postgres && /usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgt/data -o '-p 55432 -k /tmp' -l /var/tmp/pgt/log start"
psql -h /tmp -p 55432 -U postgres
```
- 가짜 `auth.uid()` = `nullif(current_setting('test.uid', true), '')::uuid` · 가짜 `is_admin()` = `current_setting('test.admin', true) = '1'`(**NULL 이 나올 수 있다 → 함수 안에서 `coalesce(public.is_admin(), false)`**)
- 역할 `anon`·`authenticated` 는 클러스터 단위라 DB 를 새로 만들 때 다시 만들지 않는다 · 서버가 꺼져 있으면 `pg_ctl … start` 다시
- 확인: **두 번 실행 · 익명 / 다른 사람 / 본인 / 관리자**

---

## 1. 09-30 오후에 한 것 (전부 main)

| 묶음 | PR | SQL |
|---|---|---|
| **아이폰 앱 푸시**: 웹 수신(`src/lib/nativePush.js` 규칙 한 곳 · `lib/push.js` 앱 다리) + 발송기 Expo 발송(`api/push/dispatch.js` · `ios_expo`) · 푸시 점검 숫자 칸 버그 고침(`from().eq` → `select` 먼저) · «아이폰 앱 기기» 수 | #902 | — |
| **업체 «동료 초대» 순위**: `peer_invite_board()` — 이번 달(한국) 내 링크로 가입해 업체 등록까지 한 사장님 수 · 업체 주인끼리 · 보상 없음 · 초대 화면(업체)에 칸 | #904 | 183 ✅ |
| **보안 점검 ⑤**: 결제 기록·시드 라운지 글·옛 표 2개 열린 정책 닫기 · 본인 요청 마감·만료·숨기기 = `request_owner_state`(예전엔 정책이 `customer_id` 기준이라 **0건 · 조용한 실패**) · 관리자 요청 고치기 정책 | #905 | 184 ✅ |

### 아이폰 푸시 — 지금 동작 (규격: `docs/PLAN-2026-09-30-no1-download-revisit.md` 4절)
- 앱 안(`window.GongganApp.push === true` + `ReactNativeWebView.postMessage`)이면 기존 «알림 켜기» 6곳이 그대로 앱 권한 창으로(`gonggan:push-ask`)
- 토큰이 **저장까지** 돼야 성공(거절·60초 무응답·저장 실패 = 이유만) · 페이지 뜰 때 오는 조용한 토큰은 로그인(토큰 연결)한 사람만 · «끄기» 한 사람은 다시 켤 때까지 저장 안 함(`localStorage gonggan_native_push_off`)
- 발송기: `ios_expo` 는 Expo(키 없이 · 선택 env `EXPO_ACCESS_TOKEN`) · FCM 이 안 돼도 아이폰은 나감 · 웹 토큰만 있는 알림은 queued 로 남김 · `DeviceNotRegistered` 토큰은 `is_active=false`
- **아직 실제 폰 확인 전** — 아이폰 앱이 EAS 첫 빌드 전이다(대표 터미널 몫)

### Vercel 환경변수 (09-30 대표 화면으로 확인)
- 있음: `FIREBASE_SERVICE_ACCOUNT` · `VITE_FIREBASE_*`(6개로 보임) · `SUPABASE_JWT_SECRET`(5/15 · 철자 맞음) · `SUPABASE_SERVICE_ROLE_KEY` · `SOLAPI_*` 3 · `CRON_SECRET` · `VITE_KAKAO_MAP_KEY` · `VITE_TOSS_CLIENT_KEY`
- 없음(나중에): `APP_REVIEW_PHONE`·`APP_REVIEW_CODE`(심사 제출 전) · `VITE_APP_STORE_ID`(앱스토어 등록 뒤) · `VITE_PLAY_PUBLIC=1`(Play 정식 뒤) · `PORTONE_*` 3(본인인증 열 때) · `EXPO_ACCESS_TOKEN`(선택)
- 안 쓰는 것(그냥 둠): `SUPERBASE_JWT_…`(철자 틀림 · 9/25) · `Authorization` · `TWILIO_*` 3 · 맨 위 «T… Needs Attention»(이름 미확인)
- 대표 결정: JWT 는 **그대로 둔다** — 182 폰 확인(재로그인 → 저장)이 되면 맞는 값

---

## 2. 결제사(PG) — 대표가 알아보는 중 (코드 작업은 답을 받은 뒤)

- **토스 답**(09-30): «판매 상품 최고가 1천만 원 이상은 입점 불가» — 우리는 공사대금 전액을 먼저 보관(최대 1억)하는 구조
- 대표가 보낸 문의(같은 본문 · 한도·가상계좌만 가능한지·지급대행/에스크로·웹훅·수수료·심사): **토스(회신) · 부트페이(프루비 담당자 · 라이트페이 이용 중 · 같은 사업자로 가맹점 추가 문의) · 나이스페이먼츠 · 헥토파이낸셜 · 포트원** — **KG이니시스(1:1 문의 창) · NHN KCP(전화 1544-8662)는 아직**
- 대표 방향: **대부분 가상계좌**(카드 3.7% vs 가상계좌 건당 900원 · 부가세 포함 여부 확인 중) · 1천만 원 이상은 가상계좌·계좌이체만 · 나눠 결제(쪼개기)는 권하지 않음(카드사 규칙 위험)
- 답이 오면: 한도·수수료·지급대행 가능 여부를 **한 표로 비교**해 대표에게 → 대표가 결제사를 고르면 결제 연결(`src/services/payment/providers` 에 공급자 추가 · 토스 연결은 지우지 않음)

### 결제사가 정해지면 할 일 (지금은 하지 않는다)
1. **가상계좌 입금 알림(웹훅)** — 지금 가상계좌는 꺼져 있다(`src/services/payment/constants.js` `available: false` · 입금돼도 공사가 시작되지 않아서). 새 서버리스 함수 없이 **`api/confirm-payment.js` 안에서** 입금 알림을 받아 결제 기록 PAID → 공사 시작
2. **수수료 표 SQL** — `payment_fee_rules` 에 가상계좌·계좌이체가 **임시값 3.7%** 로 들어가 있다(031·113) → 대표가 준 계약 요율로(가상계좌 900원 고정 등). 숫자는 대표에게 받는다
3. 화면 문구 «가상계좌 이용료 660원»(`RequestModal.jsx` · `RequestModalBeta.jsx` · `financeUtils.js` 주석) → 실제 금액으로
4. 1천만 원 이상 공사: 카드 숨기고 계좌 결제만(결제사 답에 맞춰) · 안전결제 안내 페이지(`SafePaymentScreen.jsx` «단건 최고가 1억») 문구
5. **토스 지급대행**(업체에 단계별 실제 송금)은 아직 구현 전 — 지금 «지급»은 `escrow_payouts` 장부 기록뿐

---

## 3. 대표 확인 대기 (답이 오면 거기부터)

- [x] **SQL 184 실행 — 09-30 «트루 3개» 완료**(no_open · req_admin_update · owner_state_fn)
- [ ] **184 폰 확인**: 고객 마이 › 내 요청 **숨기기** → 새로고침해도 안 돌아옴 · 관리자 › 숨긴 요청 **되돌리기** · 요청 **마감** · 결제 기록은 내 것만
- [ ] **182 폰 확인**: 재로그인 → 견적 요청 · 업체 입찰 → 입찰 수정 · 라운지 글·댓글·좋아요 · 다음 날 라운지 자동 글
- [ ] **180 폰 확인**: 알림함 · 후기 쓰기 · 업체 답글 · 푸시 설정 켜고 끄기 · 라운지 댓글 고치기
- [ ] 푸시 폰 확인: 안드로이드 마이 › 푸시 켜기 → 관리자 «푸시 점검» 활성 기기 +1 · FCM 초록불 · «지금 발송» 수신 / 아이폰은 EAS 첫 빌드 뒤 같은 순서 + «아이폰 앱 기기» +1
- [ ] 결제사 답(2절) · 계좌이체 수수료율
- 막힌 표가 있으면: 되돌리기 한 줄(`create policy gNNN_undo_<표> …`)을 주고 → 원인(대개 토큰 없는 쓰기)을 `userDb()` 로 고친 뒤 되돌리기 정책을 다시 지운다

---

## 4. 다음 할 일 — 순서대로

1. **3절에서 막힌 곳부터**(새 기능보다 먼저)
1-1. **남은 열린 정책 전수 확인**(184 뒤 마무리) — 대표에게 아래 결과를 받아 `true` 로 열린
   INSERT/UPDATE/DELETE 가 더 없는지 본다. 일부러 열어 둔 셋(activity_logs · user_visits ·
   partner_leads)만 남아야 정상이다.
   ```sql
   select tablename, policyname, cmd, roles, qual, with_check
     from pg_policies
    where schemaname = 'public'
      and cmd in ('ALL','INSERT','UPDATE','DELETE')
      and (coalesce(qual,'') = 'true' or coalesce(with_check,'') = 'true')
    order by 1, 3;
   ```
2. **아이폰 로그인 유지** — `docs/QA-2026-09-30-ios.md` 가 생기면(로컬 몫) 웹 쪽 보완(예: 토큰을 앱에 백업·복원하는 메시지 · 규격은 로컬과 맞춘다). 아직 파일 없음
3. **⑥ 월요일 주간 숫자 루프** — 관리자 숫자 → `docs/WEEKLY-YYYY-MM-DD.md` → 가장 약한 숫자 하나만 올리는 일(PLAN 5절) · 읽음률 20% 미만 알림은 문구·시각 조정
4. 결제사가 정해지면 2절 «할 일» 1~5
5. 동료 초대 **보상**은 대표 결정 뒤에만(지금은 순위만 · 약속 문구 없음)

---

## 5. 함께 읽을 문서

- `docs/HANDOFF-2026-09-30-cloud-next.md` — **규칙·구조(0~1절)** · 09-29~30 오전 작업
- `docs/PLAN-2026-09-30-no1-download-revisit.md` — 목표·빈 곳(G1~G7) · **4절 아이폰 푸시 규격(웹·발송기 붙임 기록)** · 5절 주간 루프
- `docs/HANDOFF-2026-09-29-security-revisit.md` — 보안 S1~S5 · 폰 확인 목록
- `docs/HANDOFF-2026-09-23-b.md` · `-c.md` — 토스 지급대행(분할 지급) 배경
