-- ════════════════════════════════════════════════════════════════════
-- 017_bidirectional_reviews_saved_companies.sql
-- Part 2: 양방향 신뢰평가 + 구조화 후기 + 관심 업체(위시리스트)
--
-- 멱등(IF NOT EXISTS) · 추가 전용 · 기존 데이터/흐름 영향 없음.
-- 참고: 013_ai_training_data 에서 schedule_score/communication_score/
--       quality_score 가 이미 추가됨 → IF NOT EXISTS 로 중복 무해.
-- ════════════════════════════════════════════════════════════════════

-- 1) reviews — 양방향 평가 + 구조화 후기 컬럼
alter table public.reviews
  -- 양방향 평가 (업체 → 고객)
  add column if not exists reviewer_role       text
    check (reviewer_role in ('customer','company')),
  add column if not exists target_role         text
    check (target_role  in ('customer','company')),
  add column if not exists target_user_id      uuid references public.users(id) on delete set null,
  add column if not exists contract_compliance int  check (contract_compliance between 1 and 5),
  add column if not exists response_score      int  check (response_score      between 1 and 5),
  add column if not exists dispute_history     boolean default false,
  -- 구조화 후기 (고객 → 업체)
  add column if not exists budget_score        int  check (budget_score        between 1 and 5),
  add column if not exists schedule_score      int  check (schedule_score      between 1 and 5),
  add column if not exists communication_score int  check (communication_score between 1 and 5),
  add column if not exists quality_score       int  check (quality_score       between 1 and 5),
  add column if not exists would_recontract    boolean,
  add column if not exists review_photos       jsonb default '[]'::jsonb;

comment on column public.reviews.reviewer_role is 'Part2 양방향 — 평가 주체 역할';
comment on column public.reviews.target_role   is 'Part2 양방향 — 평가 대상 역할';
comment on column public.reviews.target_user_id is 'Part2 양방향 — 업체→고객 평가 시 대상 고객 id';

create index if not exists idx_reviews_target_user
  on public.reviews (target_user_id, target_role);

-- 2) saved_companies — 관심 업체(위시리스트)
create table if not exists public.saved_companies (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.users(id)     on delete cascade,
  company_id  uuid references public.companies(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (customer_id, company_id)
);

comment on table public.saved_companies is '고객이 저장한 관심 업체 — 추후 AI 추천 활용';

create index if not exists idx_saved_companies_customer
  on public.saved_companies (customer_id, created_at desc);

alter table public.saved_companies enable row level security;

drop policy if exists "saved_companies: owner read"   on public.saved_companies;
drop policy if exists "saved_companies: owner write"  on public.saved_companies;

-- 본인이 저장한 목록만 조회/수정
create policy "saved_companies: owner read" on public.saved_companies
  for select using (auth.uid() = customer_id);

create policy "saved_companies: owner write" on public.saved_companies
  for all using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
