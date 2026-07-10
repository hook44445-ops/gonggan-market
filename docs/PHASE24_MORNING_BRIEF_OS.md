# Phase 24 — Morning Brief + Autonomous Editorial OS

핵심 철학: **뉴스는 뉴스로, 공간마켓 글은 공간 관점으로, 연재는 연재로.** 모든 글을 억지로 공간
관점으로 연결하지 않는다. 관리자는 자동발행 설정·예산·품질·비율만 관리하고, AI 편집국이 수집·
분류·생성·검수·발행·비용기록·공유성 평가를 수행한다. 전부 additive · localStorage · Regression Zero.

## 신규 엔진 (localStorage/pure · DB/Migration/Cron/서버리스 없음)

- **contentTypes.js** — 콘텐츠 타입 체계(qt/astrology/morning_brief/breaking/space_market/series/
  trend_past·present·future) + 타입별 `spacePerspective` 플래그(공간관점 적용 여부) +
  `classifyContentType`(주제→타입) + `dailyComposition`(시간대별 편성표, 상한 11) +
  `shouldApplySpacePerspective`(Space Perspective Rule).
- **morningBrief.js** — 11개 신문사설/주요신문 헤드라인(경제·금융·기업·부동산·사회·국제)/매-세-지
  5요약. 제목 형식 고정(《…11개 신문사설 주요내용》/★★…헤드라인★★/매-세-지). SEO 우선 ·
  AI 의견·공간관점·감성 해석 금지 · 신문사/날짜/제목 유지. 생성 프롬프트·제목·공유 카피 조립.
- **todayWord.js** — 오늘 큐티 말씀(말씀→묵상→기도→적용). 말씀형(공간관점 미적용).
- **indianAstrology.js** — 1~12월생 월별 운세(개인 차트 없음, 쉽고 짧고 재미있게, 공유형).
- **timeTrend.js** — Past/Present/Future 3후보. Present 는 TrendDiscovery 재사용. 시간축 인사이트.
- **shareability.js** — Read/Save/Shareability 점수 + 공유 카드 메타(shareTitle/Subtitle/Summary/
  ImageText) + 타입별 공유 카피. 결정론적 순수 함수.

## 확장

- **autoStrategy.js** — 콘텐츠 타입별 프롬프트/Temperature 매핑(item 15 표: morning_brief raw/v1/0.35,
  qt voice/0.55, astrology voice/0.75, breaking raw/0.45, space_market space/v3/0.75, series voice/v3/1.0,
  time trend past/present/future). **Space Perspective Rule 반영** — 뉴스/큐티/운세/연재/트렌드는
  공간관점 미적용, 공간마켓만 적용. 기존 수동 동작 보존(회귀 없음).
- **autoPublish.js** — DEFAULT_CFG: dailyLimit 11 · testMode 기본 OFF · 콘텐츠 타입 편성 토글 6종 ·
  approvedRequired · minReadMinutes. `typeToggles()` → dailyComposition 연동.
- **autoPublishGate.js** — 테스트모드: Quality 70 · Confidence/중복/Review 는 경고(warnings)만(발행 허용),
  운영모드는 기존 90/90/48h/검사 유지. dupHours 0=OFF 지원. gate 결과에 `warnings` 추가.
- **usageDashboard.js**(기존) + **activityLog.js** — `contentMixSummary`(타입별 발행 비율 +
  Shareability 평균). 워크벤치 생성 시 contentType·shareabilityScore 를 Activity Log 에 기록.

## 관리자 UI (AdminScreen.jsx)

- **자동 편성** 탭(신규) — 오늘의 편성표(타입/슬롯/상한/공간관점 배지) · 아침 고정 콘텐츠
  (모닝브리핑/큐티/인도점성술) 프롬프트 복사 · Time Trend 3후보 프롬프트 · 콘텐츠 믹스+Shareability.
- **자동발행** 설정 패널 — 콘텐츠 타입 토글 6종 + approvedRequired 추가.
- **Usage Dashboard** — 콘텐츠 믹스 비율 + Shareability 평균 라인 추가.

> 생성·발행은 기존 AI 콘텐츠 공장(generateForWorkbench)·기존 스토리/예약 발행 흐름을 재사용한다.
> 아침 콘텐츠는 프롬프트를 복사해 공장에서 생성·검수·발행하는 방식(새 서버리스/Cron 없음).

## 관리자 수정/삭제 RLS (item 17)

Phase 24(이전 · #616)에서 확정 수정 완료: Soft Delete UPDATE 방식 확인 · 096(삭제/복구/수정) +
097(전체 필드 수정) SECURITY DEFINER RPC · 프론트가 admin RPC 경로 사용(본인 글/일반 사용자 경로
무변경 · Hard Delete 없음). Supabase SQL Editor 에서 096·097 1회 실행 필요.

## Regression Zero

- 신규: contentTypes/morningBrief/todayWord/indianAstrology/timeTrend/shareability.js.
- 수정: autoStrategy/autoPublish/autoPublishGate/editorWorkbench/activityLog(+usageDashboard 표시) ·
  AdminScreen(자동 편성 탭·설정 토글). 기본값=기존 동작(테스트모드 OFF·게이트 90/90) 유지.
- 무변경: 견적·입찰·계약·채팅·결제·에스크로·GPS·프로젝트증빙·리뷰·로그인·인증·댓글·좋아요·조회수·
  기존 API·기존 Cron·vercel.json·package.json·DB Schema·Migration(신규 없음)·다른 테이블 RLS.
  서버리스 함수 12개 불변. 사용자 화면 AI 용어 미도입(관리자 전용).
