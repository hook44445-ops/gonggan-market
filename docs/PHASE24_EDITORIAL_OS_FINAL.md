# Phase 24 — Editorial OS Finalization (Production)

관리자는 자동발행 설정과 예산만 관리하고, AI 가 트렌드→생성→검수→예약·발행→사용량/비용
기록까지 수행하는 완전 자동 Editorial OS 를 완성한다. 전부 additive · Regression Zero.

## 1. 관리자 수정/삭제(RLS) 최종 해결 — 최우선

- **원인 규명**: 관리자가 *남의 글/시드 글*을 수정·저장하면 편집 저장이
  `updateLoungePost(id, user_id, …)` → owner-only RLS(WITH CHECK user_id=auth) 를 통과 못 해
  `new row violates row-level security policy` 발생. (삭제는 096 RPC 로 이미 해결됨)
- **확정 수정**:
  - `097_admin_lounge_post_update_fields.sql` — SECURITY DEFINER RPC
    `admin_update_lounge_post_fields(p_id, p_admin_id, p_patch jsonb)`. 내부 admin 검증 후 RLS 우회,
    화이트리스트 필드(title/content/category/region/gender/age_group/image_urls)만 갱신 + admin_logs.
  - `src/lib/supabase.js` `adminUpdateLoungePost` — RPC 우선, 미배포 시 직접 update 폴백,
    두 경로 모두 실패(RLS)면 `error.hint` 로 "097 실행 필요" 안내.
  - `src/screens/LoungeWriteScreen.jsx` — 관리자가 남의 글 편집 시 admin RPC 경로로 저장
    (본인 글은 기존 경로 유지 = 일반 사용자 권한 무변경). 일반 사용자는 자기 글만 수정/삭제,
    Hard Delete 없음 · Soft Delete 유지.

> ⚠️ 적용: Supabase SQL Editor 에서 `096`(미실행 시)·`097` 1회 실행 → 관리자 수정/삭제 정상화.

## 2·3·7. 자동발행 엔진 + 조건 설정 + 완전 자동화

- `src/lib/autoPublish.js` `DEFAULT_CFG` 전체 확장: enabled/testMode/intervalHours/dailyLimit/
  minEditorialScore/minConfidence/minBodyLength/dupHours/humanizationCheck/seoCheck/reviewRequired/
  maxRetry/emergencyInstant/emergencyTrendMin/budgetTodayKRW/budgetMonthKRW. (기본 자동발행 OFF ·
  Editorial 90 · Confidence 90 · 본문 700+ · 중복 48h · Retry 3 · 하루 10개)
- `evaluateGate` 에 cfg 주입(임계치/검사토글 configurable, 기본값=기존 동작 → 회귀 없음).
- `planAutoPublish` 가 설정 임계치를 게이트에 전달 + 예산 상태 계산. `executeAutoPublishPlan` 이
  testMode(계획만)·budget blocked(중지)·maxRetry 를 반영. 실제 발행/예약은 기존 supabase 함수 +
  기존 예약발행 크론 재사용(새 API/Cron 없음). 관리자 탭에 설정 패널·예산 배너 추가.

## 4. Activity Log

- `src/lib/activityLog.js`(신규 · localStorage 런타임 로그, activitySchema.js 설계와 무관).
  트렌드/Draft/OpenRouter/LLM응답/Editorial/Confidence/Humanization/Gate/예약/발행/실패/Retry/비용/연재.
- 배선: `editorWorkbench.saveWorkbenchRecord`(생성/응답/실패 + 모델·토큰·Latency·비용) ·
  `autoPublish.executeAutoPublishPlan`(예약/즉시발행/실패). 자동발행 탭에 실시간 로그 표시.

## 5. Usage Dashboard 고도화

- `src/lib/usageDashboard.js`: `usageByModel`(모델별 요청/토큰/비용) · `usageMoneyOverview`
  (오늘/이번달/누적 비용 · 평균 글당 비용 · 예상 월 비용=이번달 일평균×30 · 모델별). 원화 표시.
- AI 공장 탭 상단 대시보드에 비용 종합 + 모델별 라인 추가.

## 6. Story Engine

- `src/lib/storyEngine.js`(신규): 시리즈·세계관·등장인물·Story Bible·Episode 자동 증가·
  다음 화 힌트·회차 관리·연재 주기·dueSeries(하루 최소 1편 후보). 생성은 기존 AI 공장,
  발행은 기존 스토리 흐름 재사용. 관리자 → 콘텐츠 → **연재 스토리** 탭.

## 11. 예산 보호

- `budgetStatus` 가 usageDashboard 비용 집계와 한도 비교 → 초과 시 `blocked` → 자동발행 실행 차단 +
  탭 배너 알림.

## Regression Zero

- 수정: `src/lib/supabase.js`·`src/screens/LoungeWriteScreen.jsx`(관리자 수정 라우팅) ·
  `src/lib/autoPublish.js`·`src/lib/autoPublishGate.js`(설정/예산 · 기본값 유지) ·
  `src/lib/editorWorkbench.js`(로그 호출 1줄) · `src/lib/usageDashboard.js`(집계 추가) ·
  `src/screens/AdminScreen.jsx`(설정/Activity/연재 UI).
- 신규: `activityLog.js` · `storyEngine.js` · `097_admin_lounge_post_update_fields.sql`.
- 무변경: 견적·입찰·계약·채팅·결제·에스크로·GPS·프로젝트증빙·리뷰·로그인·인증·기존 API·기존 Cron·
  `vercel.json`·`package.json`·다른 테이블 RLS. 서버리스 함수 12개 불변. 일반 사용자 발행/수정 경로 무변경.
