# Phase 22 — Editorial OS (관리자 삭제 RLS 확정 수정 + 발행 우선순위)

병렬 세션에서 Phase 18/19/19.5(OpenRouter·Humanization·Admin Actions)가 이미 main 에 들어와
있어(내 Phase 20.6 은 그 과정에서 대체됨), 이번 Phase 22 는 **확인된 프로덕션 버그(관리자 삭제)**를
확정 수정하고, **가장 중요한 신규 기능(발행 우선순위 엔진)**을 추가하는 데 집중한다.

## 1. 관리자 수정/삭제 RLS — 확정 수정 (스크린샷 버그)

증상: 관리자 삭제 시 `new row violates row-level security policy for table "lounge_posts"`.
원인: 관리자 패널의 인증 방식(anon 키 / role 매칭)에 따라 UPDATE RLS 를 통과 못 하는 환경.

확정 수정 — **SECURITY DEFINER RPC**(리뷰 어드민 패턴과 동일):
`supabase/migrations/096_admin_lounge_post_delete_rpc.sql`
- `admin_soft_delete_lounge_post(p_id, p_admin_id, p_reason)` — 내부에서 admin 검증 후 RLS 우회 soft delete + admin_logs 기록
- `admin_restore_lounge_post`, `admin_update_lounge_post` 동반
- **Soft Delete 유지 · 물리 삭제 없음** · anon/authenticated 모두 execute 허용(내부 admin 검증)

앱 연동(`src/lib/supabase.js`): `adminSoftDeleteLoungePost`/`adminRestoreLoungePost` 가 RPC 를
먼저 호출하고, **RPC 미배포 환경에서는 기존 직접 update 로 폴백**(회귀 없음).

> ⚠️ 적용: Supabase SQL Editor 에서 `096_...sql` 1회 실행 → 관리자 삭제 정상화.

## 2. Publishing Priority Engine (신규 · `src/lib/publishingPriority.js`)

예약 발행만 하지 않는다. 긴급 뉴스가 오면 먼저 나간다.
- **P1 긴급(Breaking)** → **P2 Trending** → **P3 예약(Evergreen)** + **⭐ 연재 슬롯**
- Evergreen 힌트(AI·경제·공간·인테리어·라이프·창업·건강·신앙…) / Breaking 힌트(금리·발표·정책·전쟁·재난·선거·엔비디아·삼성·OpenAI·Claude…)
- 관리자가 **Evergreen:Breaking 비율(5:5 / 7:3 / 8:2)** 변경 가능(localStorage)
- 긴급 후보가 없으면 예약·Evergreen 으로 채운다. 하루 총량 기본 10(연재 1 포함)
- 지향점: 속도 50 / Evergreen 40 / 연재 10
- TrendDiscovery 를 호출만(엔진 무수정). 실제 발행은 기존 발행 흐름/크론 재사용 — 편성/시각화만.
- 관리자 → 콘텐츠 → **발행 우선순위** 탭

## Regression Zero

- 수정: `src/lib/supabase.js`(관리자 삭제/복구 2함수 — RPC+폴백), `src/screens/AdminScreen.jsx`(발행 우선순위 탭 추가)
- 신규: `src/lib/publishingPriority.js`, `supabase/migrations/096_admin_lounge_post_delete_rpc.sql`
- 무변경: 견적·입찰·계약·채팅·결제·에스크로·GPS·프로젝트증빙·리뷰·로그인·인증·`api/`·`vercel.json`·Cron·
  기존 Lounge·기존 편집국 엔진(editorialEngine/humanizationEngine 등). 서버리스 함수 12개 불변.
- 삭제 함수는 RPC 실패 시 기존 동작으로 폴백 → 마이그레이션 미적용이어도 회귀 없음.

## 이번 Phase 에서 다루지 않은 항목(후속)

병렬 세션이 편집국/관리자 파일을 활발히 수정 중이라 충돌 위험이 커서, 아래는 별도 PR 로 분리 권장:
- Usage Dashboard(토큰/비용) · Activity Log(실시간 로그) · Story Engine(연재·Story Bible)
- GPT 문체 자동 감지·Rewrite(현재 editorialEngine/humanizationEngine 담당 — 병렬 수정 중)
- 사용자 화면 "AI" 단어 제거는 이미 Phase 19.5 에서 "✨ Editor's Pick"으로 반영됨(스크린샷 확인).

이 순서(확정 버그 수정 → 우선순위 엔진 → 이후 대시보드/연재)가 충돌·회귀 위험을 최소화한다.
