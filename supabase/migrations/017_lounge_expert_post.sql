-- ════════════════════════════════════════════════════════════════════
-- 017_lounge_expert_post.sql
-- 라운지 전문가(업체) 글 — 충성도 4/6 STEP3
--   · lounge_posts.is_expert (업체 계정 작성 글) + expert_company_name
--   · 전문가 글은 프로필 카드 자동 연결 + 상단 노출 우선순위 부여(앱 정렬)
-- 추가 전용 · 멱등. NULL/false 기본이라 기존 글 영향 없음.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

alter table public.lounge_posts
  add column if not exists is_expert boolean not null default false,
  add column if not exists expert_company_name text;
