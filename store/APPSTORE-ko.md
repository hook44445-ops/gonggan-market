# 공간마켓 App Store 문안 — 2026-09-28 (첫 등록용)

대표 09-28: 「오늘내일 애플 앱도 등록 · 1등 다운로드 앱이 될 수 있게」.

App Store 검색은 **앱 이름 · 부제 · 키워드** 세 칸만 읽는다(설명은 검색에 안 쓴다).
세 칸에 같은 낱말을 두 번 쓰면 자리만 버린다 — 이름·부제에 있는 낱말은 키워드에 넣지 않았다.
글자 수는 `src/utils/storeCopy.test.js` 가 검사한다(칸 이름 · 값 줄을 바꿀 땐 테스트도 같이).

규칙(Play 문안 `ASO-ko.md` 와 같음)
- 없는 기능은 쓰지 않는다. 앱 안 안전결제(에스크로)는 정식 오픈 뒤에만.
- 다른 회사 이름(숨고·오늘의집 등)은 키워드에 넣지 않는다 — Apple 심사 반려 사유(가이드라인 2.3.7).

---

## 앱 이름 (30자)

공간마켓 - 인테리어·집수리 견적

## 부제 (30자)

리모델링부터 수전 교체까지 업체 비교

## 키워드 (100자 · 쉼표, 띄어쓰기 없이)

도배,장판,바닥,욕실,주방,타일,필름,변기,실리콘,누수,방수,샷시,창호,중문,몰딩,조명,전기,페인트,줄눈,탄성코트,아파트,원룸,오피스텔,상가,카페,시공,공사,하자보수,동네,후기

## 프로모션 텍스트 (170자 · 심사 없이 언제든 바꿀 수 있음)

수전 교체·실리콘 같은 작은 수리도 괜찮아요. 확인된 업체 견적을 나란히 비교하고, 공사 사진과 대화가 한 건에 남습니다. 가입비 0원, 견적 무료.

## 설명 (4000자)

`store/ASO-ko.md` 의 「자세한 설명」을 그대로 붙여 넣는다(두 스토어 설명을 한 곳에서 관리 — 갈라지면 한쪽에 옛 모델이 남는다).
`**굵게**` 표시는 App Store 가 지원하지 않으니 별표만 지우고 붙인다.

## 이번 버전의 새로운 기능

공간마켓 첫 출시입니다.
· 인테리어·집수리 견적을 여러 업체에서 받아 나란히 비교
· 업체가 확인받은 증빙(사업자·시공보험·보증금)을 엠블럼으로 확인
· 공사 단계별 사진과 대화 기록

## 카테고리 · 그 밖

- 기본 카테고리: 라이프스타일 · 보조: 비즈니스
- 연령 등급: 4+
- 지원 URL: https://gongganmarket.com · 개인정보처리방침: https://gongganmarket.com/privacy
- 스크린샷: `store/apple-ko/*.png` 10장(이미 App Store Connect 에 올림 — 09-24)

---

## 등록 뒤 할 일 (순위에 직접 작용)

1. **App Store 앱 번호**(App Store Connect › 앱 정보 › Apple ID, 숫자)를 Vercel 환경변수 `VITE_APP_STORE_ID` 에 넣고 Redeploy
   → 고객이 후기에 별 4~5개를 주면 «스토어 별점 남기기»가 뜬다(`src/lib/storeRating.js` · 90일에 한 번 · 평생 3번).
2. 첫 2주 설치가 몰릴수록 검색 순위가 오른다 — 지인·테스터에게 설치 링크를 한꺼번에(같은 주에) 보낸다.
3. 프로모션 텍스트는 심사 없이 바뀐다 — 계절 문구(«겨울 결로·곰팡이 실리콘» 등)로 한 달에 한 번 바꾼다.
4. `VITE_APP_STORE_ID` 를 넣으면 아이폰 사파리 방문자 위에 **Apple 스마트 앱 배너**(«받기»)도 같이 켜진다(`src/components/AppInstallBanner.jsx`).
   안드로이드 브라우저 방문자에게는 지금도 맨 위 «앱으로 보기» 띠가 보인다(비공개 테스트 중엔 /download, `VITE_PLAY_PUBLIC=1` 뒤엔 Play).

---

## 심사 제출 전 꼭 (반려 막기 · 09-29)

### 1) 심사관 로그인 — 가이드라인 2.1 (가장 흔한 반려)
해외 심사관은 한국 번호로 문자를 받을 수 없다. 심사용 번호 하나를 정해 인증번호를 고정한다(`src/lib/reviewLogin.js`).

1. Vercel › Settings › Environment Variables (Production) — **서버 전용, `VITE_` 붙이지 않는다**
   - `APP_REVIEW_PHONE` = `+8210XXXXXXXX` (대표·관리자 번호 말고, 안 쓰는 번호 · 형식 +8210…)
   - `APP_REVIEW_CODE` = 6자리(000000·123456 같은 쉬운 번호는 꺼짐)
2. **Redeploy** 한 번.
3. 공간마켓 웹에서 그 번호로 **고객**으로 한 번 가입해 둔다(문자는 안 오고, 정한 6자리를 넣으면 된다). 요청 하나쯤 올려 두면 심사관이 화면을 보기 쉽다.
4. App Store Connect › 앱 › 앱 심사 정보 › 로그인 필요 ✔
   - 사용자 이름: `010-XXXX-XXXX` · 암호: 6자리
   - 메모(영문 그대로 붙여 넣기):

```
This app uses Korean phone-number login (SMS code). For review, please use:
Phone: 010-XXXX-XXXX  →  tap "인증번호 받기" (Get code). No SMS is sent to this review number.
Code: XXXXXX  →  enter it and tap "확인" (Confirm).
You can also browse without logging in via "둘러보기" (Browse).
Account deletion: My page (마이) > 회원탈퇴 (Delete account).
User-generated posts (Lounge) can be reported and users can be blocked from each post menu.
Digital tokens are not sold inside the iOS app; they are earned for free through in-app activities.
Contact: biz@gonggansai.com / +82-70-7954-2740
```

5. 심사 통과 뒤 두 값을 지우고 Redeploy 하면 꺼진다(계속 두려면 번호·코드를 남에게 알리지 않는다).

### 2) 앱 안 결제 — 가이드라인 3.1.1
- 공간토큰(디지털)은 **아이폰 앱 안에서 팔지 않는다** — 앱 쉘(window.ReactNativeWebView + 아이폰) 안에서는 «토큰 구매» 탭·충전 버튼이 숨고 «무료 미션»만 보인다(`isIosAppShell` · `tokenSalesOpen` · `src/constants/release.js`).
- 공사 대금(실물 서비스) 결제는 해당 없음. 앱 안에서 «웹에서 사세요» 같은 안내도 하지 않는다.

### 3) 이미 되어 있는 것
- 계정 삭제: 마이 › 회원탈퇴 → /delete-account (5.1.1(v))
- 게시글 신고·사용자 차단(라운지) (1.2)
- 소셜 로그인 없음(전화번호만) → «Apple로 로그인» 의무 아님 (4.8)
