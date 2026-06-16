-- ════════════════════════════════════════════════════════════════════
-- 077_seed_lounge_seeding_enhance.sql
-- 라운지 시딩 고도화 (LOUNGE-SEEDING-v1.0)
--   seed_lounge_posts 운영 콘텐츠 인프라 강화를 위한 컬럼 추가.
--   · region            지역(별도 컬럼 저장 — 제목/본문 추출 아님)
--   · seed_type         작성자/글 유형(운영/의뢰인/업체/전문가) — enum 아님, text(확장 대비)
--   · is_recommended    추천글 여부(노출 순서 sort_order 와 분리)
--   · is_expert         전문가(업체) 글 여부
--   · expert_company_name / expert_badge / expert_job  전문가 표시 확장용(향후 배지·업체답변·공간사이 추천)
--
-- 멱등(idempotent) · 추가 전용 · 기존 데이터/RLS 불변 · hard delete 없음.
-- RLS: 004_seed_lounge_posts.sql 의 anon_read / admin_all(for all) 정책 그대로 유지(변경 없음).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

alter table public.seed_lounge_posts
  add column if not exists region              text,
  add column if not exists seed_type           text    not null default '운영',
  add column if not exists is_recommended       boolean not null default false,
  add column if not exists is_expert            boolean not null default false,
  add column if not exists expert_company_name  text,
  add column if not exists expert_badge         text,
  add column if not exists expert_job           text;

-- 피드/관리자 정렬: 추천 우선 → 순서 → 최신 (추천 여부와 순서를 분리해 관리)
create index if not exists idx_seed_lounge_posts_order
  on public.seed_lounge_posts (is_recommended desc, sort_order asc, created_at desc);

-- 확인 로그
do $$
begin
  raise notice '077 seed_lounge_seeding_enhance: seed_type/region/is_recommended/is_expert columns ensured (rows=%)',
    (select count(*) from public.seed_lounge_posts);
end $$;
