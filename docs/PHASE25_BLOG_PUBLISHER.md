# Phase 25 — JAFA1 Blog Auto Publish

Space Lounge 글을 JAFA1 네이버 블로그용으로 자동 변환·배포 준비한다: 검색 유입 → Space Lounge →
회원가입 선순환. 관리자는 자동발행 ON/OFF·품질·예산·비율만 관리하고, AI 가 HTML/SEO/태그/공유메타/
Space Lounge 링크까지 자동 생성한다. 전부 additive · localStorage · Regression Zero.

## 신규 — `src/lib/blogPublisher.js`

- **Provider 레지스트리** — 초기 NAVER(JAFA1, blogId=jafa1). Tistory/Wordpress/Brunch 확장 가능 구조.
- **HTML 생성**(`buildBlogHtml`) — Markdown 금지, HTML 자동 변환. 제목(h1) → 대표이미지 → 본문
  (소제목 h2~h4/문단/리스트) → 소제목 뒤 이미지 삽입 → 마무리 → Space Lounge 링크 푸터.
- **SEO 자동 생성**(`buildBlogSeo`) — seoTitle · description · keywords · tags · category.
- **Space Lounge URL 자동 첨부**(`spaceLoungeFooter`) — "더 다양한 콘텐츠는 Space Lounge에서…"
  + ▶ Space Lounge 링크(관리자 설정 URL) + #공간라운지 #SpaceLounge #공간마켓.
- **공유 메타**(`buildBlogPost.shareMeta`) — shareTitle/Subtitle/Summary/ImageText(shareability 재사용).
- **발행 실행**(`publishToBlog`) — executor 주입 또는 설정된 endpoint(웹훅/프록시)로 전송, Retry(설정).
  endpoint 미설정 시 **'준비(prepared/임시저장)'** 상태로 기록(회귀 없음 · 나중에 endpoint 만 연결).
- **Usage**(`blogUsageStats`) — 오늘/이번주/이번달/누적 업로드 · 성공률 · 실패 · Retry · 평균 업로드 시간.
- **대상 판별**(`isBlogEligible`) — 타입 토글(모닝브리핑/큐티/인도점성술/공간마켓/연재/타임트렌드 ON,
  긴급뉴스 기본 OFF).

## 관리자 — `src/screens/AdminScreen.jsx` → 콘텐츠 → **블로그 발행** 탭(신규)

- ON/OFF · 설정 패널(임시저장/즉시발행/테스트모드/Retry/대표이미지/SEO/태그/URL첨부/하루 최대/타입 토글/
  Space Lounge URL/업로드 endpoint) · Usage 타일 · 발행 대상 대기열(타입 통과분) · HTML 미리보기 ·
  발행 버튼 · 블로그 발행 로그(상태/URL).
- `activityLog.js` — 블로그 이벤트 종류 추가(blog_start/html/prepared/url/published/drafted/retry/failed).

## 설정 기본값

자동발행 OFF · 임시저장 ON · 즉시발행 OFF · 테스트모드 OFF · Retry 3 · 하루 최대 8 ·
대표이미지/SEO/태그/URL첨부 ON · 긴급뉴스 대상 OFF.

## 실제 업로드 경계(정직한 한계 · Phase 26 예정)

네이버 블로그는 공개 클라이언트 쓰기 API 가 없고(인증/프록시 필요), 서버리스 12함수·Cron·vercel.json
제약이 있어 **브라우저에서 직접 네이버로 POST 할 수 없다.** 따라서 이 엔진은 발행 준비물(HTML/SEO/
태그/공유메타)을 완성하고, **executor 주입 또는 관리자 설정 endpoint(웹훅/프록시)** 로 전송한다.
endpoint 를 넣으면 그대로 업로드되고, 없으면 '준비(임시저장)'로 안전하게 기록된다. 실시간 뉴스 수집·
Scheduler(05/06/07시 자동실행)는 지시서대로 이번 Phase 제외(Phase 26).

## Regression Zero

- 신규: `src/lib/blogPublisher.js` · `docs/PHASE25_BLOG_PUBLISHER.md`.
- 수정: `src/lib/activityLog.js`(블로그 이벤트 종류 추가) · `src/screens/AdminScreen.jsx`(블로그 발행 탭).
- 무변경: 견적·입찰·계약·채팅·결제·에스크로·GPS·프로젝트증빙·리뷰·로그인·인증·기존 라운지·기존 자동발행·
  DB Schema·Migration·Cron·vercel.json·package.json·다른 테이블 RLS. 서버리스 함수 12개 불변.
  사용자 화면 AI 용어 미도입(관리자 전용).
