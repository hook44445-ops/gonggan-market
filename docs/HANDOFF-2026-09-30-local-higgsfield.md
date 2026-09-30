# 로컬 지시서 — 09-29~30 작업 구조 정리 · 힉스필드로 함께 만들 부분 (2026-09-30)

받는 사람: 로컬 PC 의 다음 Claude 세션(힉스필드 연결된 곳). 대표 김태웅, 호칭 「대표」, 보고 한국어.
앞 문서: `docs/HANDOFF-2026-09-29-security-revisit.md`(무엇이 바뀌었나 · SQL 166~179 · 폰 확인 목록) · `docs/HANDOFF-2026-09-28-company-page-astro.md`(업체 페이지 Astro).
작업 폴더: 워크트리 `D:\project\gonggan-fix-…`(origin/main 에서 새 브랜치). 메인 폴더 금지 · 맨 `git stash` 금지 · 커밋·PR 에 모델 이름 넣지 않기.

---

## 0. 한 장 요약 — 이틀 동안 무엇을 쌓았나(층으로)

```
 ┌──────────────── 측정 층(관리자 대시보드) ────────────────┐
 │ 🔔 알림별 읽음률(175) · 📱 푸시 받는 사람(178) · 📊 가격 데이터 쌓임(176) │
 └───────────────────────────────────────────────────────────┘
 ┌──────── 공유 이미지 층(다운로드 — 링크·QR 로 퍼진다) ────────┐
 │ 고객: 📸 전·후 사진 카드(#868) · 👨‍👩‍👧 견적 비교표(#877)         │
 │ 업체: ⭐ 후기 카드(#878) · (이전) 명함 QR · 간단 견적서          │
 │  → 모두 캔버스로 그림 · 아래 QR = 초대 링크 / 업체 페이지(/p/…)  │
 └───────────────────────────────────────────────────────────┘
 ┌──────── 재방문 층(서버가 때 맞춰 알림함 + 푸시) ────────┐
 │ 고객: 하자보수 끝나기 전(#867·#869) · 수첩 30초 설정(#872)         │
 │       견적 비교해 보셨나요(172) · 찜한 업체 새 사례(179)           │
 │       홈 «우리 동네 최근 완공»(177)                                 │
 │ 업체: 월요일 우리 동네 새 요청(171) · 고객이 견적 확인(173)         │
 │ 라운지: 월요일 지난주 인기 글(174)                                   │
 │ 입구: «🔔 알림 켜기»(#886 고객 · #887 업체 · 14일에 한 번)           │
 └───────────────────────────────────────────────────────────┘
 ┌──────── 데이터 층 ────────┐
 │ 요청: 평수 m²·건물 유형·시도 코드 / 견적: 자재 등급(170) → 시세표 → 견적 비교 «📊 우리 동네 평당 시세»(표본 5건+) │
 └───────────────────────────┘
 ┌──────── 보안 층(바닥) ────────┐
 │ 앱이 보낸 사용자 ID 대신 로그인 토큰의 사용자(166) · 업체 칸 보호(167) │
 │ 대화 당사자만(168) · 업체 서류 주인만(169) · 주인 표는 토큰 연결(#891) │
 │ 열린 정책 닫기(180 — 대표 실행 대기) · 토큰 없으면 «한 번만 다시 로그인»(#881·#882) │
 └───────────────────────────┘
```

코드 위치(한 번씩 열어 보면 구조가 보인다)
| 층 | 파일 |
|---|---|
| 보안 | `src/lib/session.js`(TOKEN_RPCS · authedDb) · `src/lib/supabase.js`(`userDb`·`chatDb`·`adminDb`) · `src/components/TokenNeededNote.jsx` · `supabase/migrations/166~169,180` |
| 데이터 | `src/lib/priceData.js` · `src/lib/priceIndex.js` · `src/components/PriceIndexLine.jsx` · `170,176` |
| 재방문 | `src/lib/homeCare.js` · `src/components/WarrantyCareOffer.jsx` · `src/screens/HomeCareScreen.jsx` · `src/components/RegionDonePhotos.jsx` · `src/components/PushAskCard.jsx` · `api/push/dispatch.js`(월요일·매일 due 함수 부름) · `171~174,177,179` |
| 공유 이미지 | `src/components/BeforeAfterCard.jsx` · `BidShareCard.jsx` · `ReviewShareCard.jsx` · `src/lib/beforeAfter.js` · `bidShare.js` · `reviewShare.js` · `src/lib/qr.js` |
| 측정 | `src/screens/AdminScreen.jsx`(AdminNotifyStatsPanel · AdminPriceDataPanel) · `src/lib/notifyStats.js` · `175,176,178` |

---

## 1. 힉스필드로 함께 만들 부분 (우선순위 순)

공통 규칙(앞 지시서와 같다)
- **그림에 글자를 넣지 않는다**(AI 글자 없음). 글자는 코드가 브랜드 글꼴로 얹는다.
- 색: 깊은 초록 `#1D3D2F` · 브랜드 초록 `#2E5F4B` · 금 `#D6A756` · 아이보리 `#F4EFE4`/`#F6F3EE` · 먹 `#1F2A24`. 점토(clay)·종이 질감 계열 — 기존 `public/images/emblem`·`growth` 와 같은 결.
- 형식 webp · 파일 하나 150KB 이하(카드 배경은 300KB 이하) · 파일명 소문자-하이픈.
- 사람 얼굴·실제 브랜드·실제 집 주소처럼 보이는 것 금지.

### 1-1. 공유 카드 배경 3종 ★가장 먼저 — 링크로 퍼지는 얼굴
지금은 단색 캔버스. 배경 한 장만 깔아도 «공유하고 싶은» 카드가 된다.

| 파일 | 크기 | 어디에 | 그림 |
|---|---|---|---|
| `public/images/cards/before-after-bg.webp` | 1080×1350 | 📸 전·후 사진 카드(`BeforeAfterCard.drawBeforeAfter`) | 아이보리 리넨 종이 · 가장자리에 옅은 목재·타일 질감 · **가운데 두 사진 칸(40,140 1000×470 / 40,630 1000×470)과 아래 띠(0,1120 1080×230)는 비워 둔다** |
| `public/images/cards/bid-compare-bg.webp` | 1080×(가변 · 1200 기준) | 👨‍👩‍👧 견적 비교표(`BidShareCard.drawBidShare`) | 아이보리 종이 · 위쪽에 줄자·견본 칩 몇 개(작게, 오른쪽 위 구석) · 표 영역(64~1016 가로)은 깨끗하게 |
| `public/images/cards/review-bg.webp` | 1080×1350 | ⭐ 후기 카드(`ReviewShareCard.drawReviewCard`) | 깊은 초록 · 금 가는 선 테두리 · 오른쪽 아래 창가 빛 한 줄기 · 글이 놓이는 왼쪽 80~1000 × 380~900 은 어둡고 평평하게 |

코드 연결(로컬 Claude 가 작게): 세 `draw*` 함수 맨 앞에서 배경 그림을 `loadImage` 로 읽어 `drawImage(bg, 0, 0, W, H)` — **실패하면 지금 단색 그대로**(오프라인·느린 망). `BeforeAfterCard.jsx` 의 `loadImage` 를 `src/lib/canvasImage.js` 로 옮겨 셋이 같이 쓴다. QR 판독이 되는지 `scratchpad` 에서 jsQR 로 한 번(QR 뒤는 흰 바탕 유지).

### 1-2. 재방문 화면 그림 4장
| 파일 | 크기 | 어디에 | 그림 |
|---|---|---|---|
| `public/images/empty/home-care.webp` | 720×480 | 내 집 관리 수첩 «⏱ 30초 설정» 카드 위(`HomeCareScreen.jsx` 빈 수첩) | 점토 수첩 + 보일러·에어컨·실리콘 건 작은 소품 |
| `public/images/emblem/warranty-sm.webp` | 160×160 | «🛠 하자보수는 ○○까지» 카드(`WarrantyCareOffer.jsx`) 왼쪽 | 금 테 방패 + 달력 한 장 |
| `public/images/intro/push-bell.webp` | 160×160 | «🔔 알림 켜기»(`PushAskCard.jsx` · `RequestSentSheet.jsx`) 🔔 자리 | 점토 종 + 작은 집 |
| `public/images/emblem/lock-sm.webp` | 120×120 | «🔒 한 번만 다시 로그인»(`TokenNeededNote.jsx`) 🔒 자리 | 금 자물쇠 + 열쇠(겁주지 않게 둥글게) |

코드 연결: 이모지를 `<img src=… width=… onError={숨기고 이모지}>` 로 — 그림이 안 와도 지금처럼 이모지.

### 1-3. 스토어 스크린샷 v2 (App Store 6.7" · Play)
`store/shots-raw/` 에 새 기능 화면을 폰으로 캡처 → 힉스필드 배경 + 브랜드 글꼴 문구로 6장. 문구 초안(없는 기능 약속 금지 · 안전결제는 PAYMENTS_LIVE 전이라 말하지 않는다):
1. «같은 조건으로 받은 견적, 한눈에 비교» — 견적 비교 화면 + 👨‍👩‍👧 비교표
2. «공사 전·후, 한 장으로 자랑» — 전·후 카드
3. «하자보수 끝나기 전에 알려 드려요» — 수첩 + 🛠
4. «우리 동네 최근 완공» — 홈 사진 줄
5. (업체) «받은 후기를 홍보물로» — 후기 카드
6. (업체) «우리 동네 새 요청을 폰으로» — 업체 홈
`store/APPSTORE-ko.md` · `store/ASO-ko.md` 문구도 같은 순서로 갱신.

### 1-4. (선택) 알림함 아이콘 6장 — 뒤로 미뤄도 된다
`public/images/notif/{home-care,region,compare,viewed,saved,lounge}.webp` 64×64 · `src/utils/notify.js NOTIF_META` 에 `img` 칸을 더하고 `NotificationInbox.jsx` 가 있으면 그림, 없으면 이모지.

---

## 2. 로컬에서 해야 하는 코드 일(클라우드에서 못 하는 것)

### 2-1. 아이폰 앱 푸시 (gonggan-ios · Expo) ★재방문의 빈 곳
지금 재방문 알림은 웹·안드로이드(TWA)만 폰으로 간다. 아이폰 앱 사용자는 앱 안 알림함에만 쌓인다.
- 대표: Apple Developer → Keys → APNs 키(.p8) 만들기 → EAS credentials 에 올리기(키 파일·비밀번호는 출력·커밋 금지)
- 앱(gonggan-ios): `expo-notifications` 로 권한 → `getExpoPushTokenAsync()` → WebView 로
  `window.postMessage(JSON.stringify({ type: "gonggan:push-token", token, platform: "ios_expo" }))`
- 웹(이 저장소 · 클라우드 세션이 받는다): 위 메시지를 받으면 `upsertFcmToken({ userId, token, platform: "ios_expo" })`(토큰 연결 — 180 뒤엔 본인만 저장) · `PushAskCard` 는 아이폰 앱에서 «알림 켜기» 누르면 앱에 `gonggan:push-ask` 를 보내 권한 창을 띄우게
- 발송기(`api/push/dispatch.js` · 클라우드 세션): `platform = 'ios_expo'` 토큰은 FCM 대신 Expo Push API(`https://exp.host/--/api/v2/push/send`)로. 서버리스 개수 늘리지 않고 같은 파일 안에서.
- 순서: 앱 쪽 메시지 규격(위 JSON)을 먼저 확정해 이 문서에 적어 두면, 클라우드 세션이 웹·발송기를 붙인다.

### 2-2. 업체 페이지 Astro(`pages-astro/`) — 새 입구와 맞추기
이번에 `/p/…` 로 들어오는 길이 늘었다: ⭐ 후기 카드 QR(`/p/slug?ref=코드`) · 💚 찜한 업체 알림(`/p/업체id`) · 홈 «우리 동네 최근 완공» 사진(`/p/slug` 또는 id).
- `[ref].astro` 가 uuid·slug 둘 다 받고 `?ref` 를 보관(RefStash)하는지 확인
- 후기 구역: 공간마켓 안 후기만 · 별 4개 이상이 먼저(후기 카드와 같은 기준 `src/lib/reviewShare.js shareableReviews`)
- 하단 CTA 옆에 «💚 찜하기» — 앱으로 넘겨 찜(로그인 필요). 찜 저장은 #890 부터 토큰 연결.

---

## 3. 대표 할 일 (순서)

1. [ ] **SQL 180 실행** — 앱 #891 배포 확인 → 앱에서 인증번호로 다시 로그인 → 180 → 확인 칸 3개 true
   (알림·후기·결제 주문·푸시 설정·댓글 수정이 누구나 열려 있던 것을 닫는다. 파일: `supabase/migrations/180_close_open_policies.sql`)
2. [ ] 180 뒤 폰: 알림함이 보이는지 · 후기 쓰기 · 업체 답글 · 푸시 설정 켜고 끄기 · 라운지 댓글 고치기
3. [ ] 10/1 저녁 6시쯤 초대왕 시작 푸시(광고 동의자) · 11/1 뒤 관리자 «상품 지급(한 번만)»
4. [ ] APNs 키(2-1)
5. [ ] 한두 주 뒤 관리자 «🔔 알림별 읽음률 · 📱 푸시 받는 사람» 숫자를 보고 효과 없는 알림 문구 조정

## 4. 아직 열려 있는 보안 거리(다음에 · 지금은 동작 유지가 먼저)
운영 정책에 아직 «누구나 쓰기(true)»가 남은 곳 — 남 이름으로 쓰기(사칭)가 된다:
`requests` INSERT · `bids` INSERT · `lounge_posts` INSERT · `lounge_comments` INSERT · `lounge_post_likes` INSERT.
쓰기를 서버 함수(토큰의 사용자)로 옮긴 뒤 닫는다 — 180 처럼 «앱 먼저, SQL 나중».
