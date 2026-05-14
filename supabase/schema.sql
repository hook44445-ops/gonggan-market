-- ============================================================
--  공간마켓 (Gonggan Market) — Supabase Schema
--  Run this in the Supabase SQL Editor to create all tables.
-- ============================================================

-- Enable the pgcrypto extension for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ── users ──────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  phone       text unique not null,
  name        text not null,
  role        text not null check (role in ('consumer', 'company', 'admin')),
  region      text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.users is '앱 사용자 (의뢰인 / 업체 대표 / 관리자)';

-- ── companies ─────────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references public.users(id) on delete cascade,
  name              text not null,
  phone             text,
  region            text,
  specialties       text[],
  desc              text,
  badge             text not null default 'basic'
                      check (badge in ('basic','standard','premium','enterprise')),
  deposit_amount    integer not null default 0,        -- 만원 단위
  has_insurance     boolean not null default false,
  biz_cert_url      text,
  insurance_url     text,
  bank_account_url  text,
  id_card_url       text,
  doc_status        text not null default 'draft'
                      check (doc_status in ('draft','pending','approved','rejected')),
  reject_note       text,
  reviewed_at       timestamptz,
  temp              integer not null default 70,       -- 공간온도 0~100
  completed_jobs    integer not null default 0,
  recontract_rate   integer not null default 0,        -- %
  as_rate           integer not null default 0,        -- %
  online            boolean not null default false,
  verified          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.companies is '등록 업체 정보 및 서류 심사 상태';

-- ── requests ──────────────────────────────────────────────────────────────────
create table if not exists public.requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users(id) on delete cascade,
  area         text not null,
  size         text,
  space_type   text,
  budget_min   integer,                -- 만원 단위
  budget_max   integer,
  style        text,
  desc         text,
  status       text not null default 'open'
                 check (status in ('open','in_progress','completed','cancelled')),
  urgent       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.requests is '의뢰인이 등록한 견적 요청';

-- ── bids ──────────────────────────────────────────────────────────────────────
create table if not exists public.bids (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid references public.requests(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  price         integer not null,        -- 만원 단위
  period_days   integer,
  material_note text,
  comment       text,
  selected      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (request_id, company_id)
);

comment on table public.bids is '업체가 제출한 견적 입찰';

-- ── chats ─────────────────────────────────────────────────────────────────────
create table if not exists public.chats (
  id           uuid primary key default gen_random_uuid(),
  room_id      text not null,            -- '{user_id}:{company_id}' 형태
  sender_id    uuid references public.users(id) on delete set null,
  sender_type  text not null check (sender_type in ('consumer','company','system')),
  text         text not null,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists chats_room_id_idx on public.chats (room_id, created_at);

comment on table public.chats is '1:1 채팅 메시지';

-- ── escrow_payments ───────────────────────────────────────────────────────────
create table if not exists public.escrow_payments (
  id                     uuid primary key default gen_random_uuid(),
  request_id             uuid references public.requests(id) on delete cascade,
  company_id             uuid references public.companies(id) on delete cascade,
  total_amount           integer not null,          -- 만원 단위
  current_step           integer not null default 1 check (current_step between 1 and 4),
  status                 text not null default 'deposited'
                           check (status in ('deposited','step1_paid','step2_paid','step3_paid','completed','disputed')),

  -- Step 1: 전액 예치
  step1_deposited_at     timestamptz,

  -- Step 2: 선금 30%
  step2_paid_at          timestamptz,

  -- Step 3: 중도금 40% — photo review
  inspection_photos      text[],                    -- Supabase Storage URLs
  photos_uploaded_at     timestamptz,
  auto_approve_deadline  timestamptz,               -- photos_uploaded_at + 72h
  step3_approved_at      timestamptz,
  step3_disputed         boolean not null default false,
  dispute_reason         text,
  disputed_at            timestamptz,

  -- Step 4: 잔금 30%
  step4_approved_at      timestamptz,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.escrow_payments is '에스크로 안전 정산 단계별 상태';

-- ── updated_at trigger helper ─────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

create or replace trigger companies_updated_at
  before update on public.companies
  for each row execute procedure public.set_updated_at();

create or replace trigger requests_updated_at
  before update on public.requests
  for each row execute procedure public.set_updated_at();

create or replace trigger escrow_payments_updated_at
  before update on public.escrow_payments
  for each row execute procedure public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.users           enable row level security;
alter table public.companies       enable row level security;
alter table public.requests        enable row level security;
alter table public.bids            enable row level security;
alter table public.chats           enable row level security;
alter table public.escrow_payments enable row level security;

-- users: own row only
create policy "users: read own" on public.users
  for select using (auth.uid() = id);
create policy "users: update own" on public.users
  for update using (auth.uid() = id);

-- companies: public read, owner write
create policy "companies: public read" on public.companies
  for select using (true);
create policy "companies: owner write" on public.companies
  for all using (auth.uid() = owner_id);

-- requests: public read, owner write
create policy "requests: public read" on public.requests
  for select using (true);
create policy "requests: owner write" on public.requests
  for all using (auth.uid() = user_id);

-- bids: public read, company owner write
create policy "bids: public read" on public.bids
  for select using (true);
create policy "bids: company write" on public.bids
  for insert with check (
    auth.uid() = (select owner_id from public.companies where id = company_id)
  );

-- chats: participants only
create policy "chats: participants read" on public.chats
  for select using (auth.uid() = sender_id);
create policy "chats: participants insert" on public.chats
  for insert with check (auth.uid() = sender_id);

-- escrow_payments: request owner + company owner
create policy "escrow: request owner" on public.escrow_payments
  for all using (
    auth.uid() = (select user_id from public.requests where id = request_id)
    or
    auth.uid() = (select owner_id from public.companies where id = company_id)
  );

-- ── portfolios ────────────────────────────────────────────────────────────────
create table if not exists public.portfolios (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies(id) on delete cascade,
  title         text not null,
  space_type    text,
  area          text,
  size          text,
  budget        integer,                -- 만원 단위
  before_photos text[],
  after_photos  text[],
  desc          text,
  tags          text[],
  created_at    timestamptz not null default now()
);

comment on table public.portfolios is '업체 시공 포트폴리오';

alter table public.portfolios enable row level security;

create policy "portfolios: public read" on public.portfolios
  for select using (true);
create policy "portfolios: company write" on public.portfolios
  for all using (
    auth.uid() = (select owner_id from public.companies where id = company_id)
  );

-- ── reviews ───────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  request_id  uuid references public.requests(id) on delete set null,
  rating      integer not null check (rating between 1 and 5),
  content     text not null,
  tags        text[],
  amount      text,
  space_type  text,
  user_name   text,
  region      text,
  reply       text,
  created_at  timestamptz not null default now()
);

comment on table public.reviews is '의뢰인이 작성한 업체 시공 후기';

alter table public.reviews enable row level security;

create policy "reviews: public read" on public.reviews
  for select using (true);
create policy "reviews: consumer write" on public.reviews
  for insert with check (auth.uid() = user_id);
create policy "reviews: company reply" on public.reviews
  for update using (
    auth.uid() = (select owner_id from public.companies where id = company_id)
  );
