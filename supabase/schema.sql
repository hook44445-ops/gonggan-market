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
  interests   text[],
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Migration: add interests column if upgrading from earlier schema
alter table public.users add column if not exists interests text[];

-- Migration: add customer_grade column
alter table public.users add column if not exists customer_grade text not null default '새집'
  check (customer_grade in ('새집','우리집','드림하우스','홈마스터'));
alter table public.users add column if not exists completed_jobs integer not null default 0;

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
                 check (status in ('open','in_progress','completed','cancelled','closed')),
  urgent       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.requests is '의뢰인이 등록한 견적 요청';

-- Migration: add 'closed' to requests status check (run once on existing projects)
alter table public.requests
  drop constraint if exists requests_status_check;
alter table public.requests
  add constraint requests_status_check
    check (status in ('open','in_progress','completed','cancelled','closed'));

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
  -- 어드민 숨김/소프트삭제 (migration 008 참고)
  is_hidden     boolean not null default false,
  hidden_at     timestamptz,
  hidden_reason text,
  is_deleted    boolean not null default false,
  deleted_at    timestamptz,
  deleted_by    uuid,
  status        text,
  updated_at    timestamptz default now(),
  -- 사진 후기
  image_urls         text[],
  before_image_urls  text[],
  after_image_urls   text[],
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

-- ── fee_config ─────────────────────────────────────────────────────────────────
create table if not exists public.fee_config (
  id           uuid primary key default gen_random_uuid(),
  customer_rate numeric(5,4) not null default 0.03,
  company_rate  numeric(5,4) not null default 0.04,
  vat_rate      numeric(5,4) not null default 0.10,
  updated_at    timestamptz not null default now()
);
insert into public.fee_config (customer_rate, company_rate, vat_rate)
  values (0.03, 0.04, 0.10)
  on conflict do nothing;

-- ── admin_logs ─────────────────────────────────────────────────────────────────
create table if not exists public.admin_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.users(id),
  action      text not null,
  target_type text not null check (target_type in ('company','customer','user','dispute','settlement','lounge','report')),
  target_id   uuid,
  before_val  jsonb,
  after_val   jsonb,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ── companies: early partner columns ─────────────────────────────────────────
alter table public.companies add column if not exists is_early_partner boolean not null default false;
alter table public.companies add column if not exists early_partner_joined_at timestamptz;
alter table public.companies add column if not exists early_partner_benefit_until timestamptz;
alter table public.companies add column if not exists fee_rate numeric(5,4) not null default 0.04;

-- ============================================================
--  STEP 19-27 — 운영/분쟁/기록 구조 고도화
-- ============================================================

-- ── STEP 19: Transaction State Machine ───────────────────────────────────────
-- escrow_payments 에 통합 거래 상태 컬럼 추가
alter table public.escrow_payments
  add column if not exists transaction_status text not null default 'REQUESTED'
    check (transaction_status in (
      'REQUESTED','BIDDING','COMPANY_SELECTED','CONTRACTED',
      'STARTED','MID_INSPECTION','COMPLETED','SETTLED',
      'DISPUTE','CANCELLED'
    ));

-- ── STEP 22: Company Status System ───────────────────────────────────────────
-- 업체 운영 상태 (doc_status 와 별개, 운영 제재용)
alter table public.companies
  add column if not exists company_status text not null default 'PENDING'
    check (company_status in ('PENDING','ACTIVE','PAUSED','SUSPENDED','BLACKLISTED'));

-- ── STEP 24: Company KPI columns ─────────────────────────────────────────────
alter table public.companies add column if not exists avg_response_hours  numeric(6,2) not null default 0;
alter table public.companies add column if not exists response_rate       integer not null default 0;  -- %
alter table public.companies add column if not exists conversion_rate     integer not null default 0;  -- %
alter table public.companies add column if not exists completion_rate     integer not null default 0;  -- %
alter table public.companies add column if not exists dispute_rate        integer not null default 0;  -- %

-- ── STEP 25: Dispute Status Granularization ───────────────────────────────────
alter table public.escrow_payments
  add column if not exists dispute_status text
    check (dispute_status in (
      'DISPUTE_OPEN','UNDER_REVIEW','WAITING_CUSTOMER','WAITING_COMPANY',
      'RESOLVED','REFUNDED','PARTIAL_REFUND'
    ));

-- ── STEP 20: Activity Logs ───────────────────────────────────────────────────
create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  role        text check (role in ('consumer','company','admin','system')),
  action      text not null,
  target_type text,   -- 'request' | 'bid' | 'contract' | 'escrow' | 'dispute' | 'review' | 'company' | 'user'
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_logs_target_idx on public.activity_logs (target_type, target_id, created_at desc);
create index if not exists activity_logs_user_idx   on public.activity_logs (user_id, created_at desc);

comment on table public.activity_logs is '모든 주요 행동 기록 — 기록 기반 신뢰 플랫폼의 핵심 로그';

alter table public.activity_logs enable row level security;

-- 관리자 전체 조회 / 본인 기록 조회
create policy "activity_logs: own read" on public.activity_logs
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
create policy "activity_logs: insert" on public.activity_logs
  for insert with check (auth.uid() = user_id or user_id is null);

-- ── STEP 21: Notification System ────────────────────────────────────────────
-- 실제 적용: supabase/migrations/001_notifications.sql 을 SQL Editor에서 실행
create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null,
  type         text        not null,
  title        text,
  message      text,
  related_id   uuid,
  related_type text,
  is_read      boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id);

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

comment on table public.notifications is '앱 내부 알림 — 라운지 좋아요/댓글/답글/전문가 답변 + 거래 알림';

alter table public.notifications enable row level security;

create policy "notifications: own select" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifications: own update" on public.notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications: authenticated insert" on public.notifications
  for insert with check (auth.role() = 'authenticated');

-- 라운지 알림 type 값:
--   post_like      내 글에 좋아요
--   post_comment   내 글에 댓글
--   comment_reply  내 댓글에 답글
--   expert_answer  전문가가 내 글에 답변
--   popular_post   관심 카테고리 인기글 (서버사이드 예정)

-- ── STEP 23: Review protection — escrow_payment_id 연결 ─────────────────────
alter table public.reviews
  add column if not exists escrow_payment_id uuid references public.escrow_payments(id) on delete set null;

-- 리뷰는 COMPLETED 상태인 에스크로 계약에서만 작성 가능
-- (애플리케이션 레이어에서 강제, RLS 보조)
create policy "reviews: only on completed contracts" on public.reviews
  for insert with check (
    auth.uid() = user_id
    and (
      escrow_payment_id is null  -- 레거시 호환
      or exists (
        select 1 from public.escrow_payments ep
        where ep.id = escrow_payment_id
          and ep.transaction_status in ('COMPLETED','SETTLED')
      )
    )
  );

-- 기존 insert 정책 제거 후 위 정책으로 교체
drop policy if exists "reviews: consumer write" on public.reviews;

-- ── STEP 26-1: Change Orders ─────────────────────────────────────────────────
create table if not exists public.change_orders (
  id                   uuid primary key default gen_random_uuid(),
  contract_id          uuid not null references public.escrow_payments(id) on delete cascade,
  requested_by         uuid references public.users(id) on delete set null,
  requested_by_role    text check (requested_by_role in ('consumer','company')),
  description          text not null,
  amount               integer not null default 0,   -- 만원 단위 (음수 가능: 감액)
  status               text not null default 'PENDING'
                         check (status in ('PENDING','APPROVED','REJECTED')),
  approved_by_customer boolean not null default false,
  approved_at          timestamptz,
  reject_reason        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists change_orders_contract_idx on public.change_orders (contract_id, created_at desc);

comment on table public.change_orders is '추가금(변경 지시) 요청 및 승인 기록';

create or replace trigger change_orders_updated_at
  before update on public.change_orders
  for each row execute procedure public.set_updated_at();

alter table public.change_orders enable row level security;

create policy "change_orders: contract parties read" on public.change_orders
  for select using (
    exists (
      select 1 from public.escrow_payments ep
      join public.requests r on r.id = ep.request_id
      join public.companies c on c.id = ep.company_id
      where ep.id = contract_id
        and (auth.uid() = r.user_id or auth.uid() = c.owner_id)
    )
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "change_orders: parties write" on public.change_orders
  for all using (
    exists (
      select 1 from public.escrow_payments ep
      join public.requests r on r.id = ep.request_id
      join public.companies c on c.id = ep.company_id
      where ep.id = contract_id
        and (auth.uid() = r.user_id or auth.uid() = c.owner_id)
    )
  );

-- ── STEP 26-2: Contract Scope ────────────────────────────────────────────────
create table if not exists public.contract_scopes (
  id               uuid primary key default gen_random_uuid(),
  contract_id      uuid not null unique references public.escrow_payments(id) on delete cascade,
  included_items   text[],    -- 포함 공정
  excluded_items   text[],    -- 제외 공정
  material_scope   text,      -- 자재 범위
  work_scope       text,      -- 공사 범위
  schedule_scope   text,      -- 일정 범위
  special_notes    text,      -- 특이사항
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.contract_scopes is '계약 범위 고정 기록 — "말이 달랐다" 분쟁 예방';

create or replace trigger contract_scopes_updated_at
  before update on public.contract_scopes
  for each row execute procedure public.set_updated_at();

alter table public.contract_scopes enable row level security;

create policy "contract_scopes: public read" on public.contract_scopes
  for select using (
    exists (
      select 1 from public.escrow_payments ep
      join public.requests r on r.id = ep.request_id
      join public.companies c on c.id = ep.company_id
      where ep.id = contract_id
        and (auth.uid() = r.user_id or auth.uid() = c.owner_id)
    )
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "contract_scopes: parties write" on public.contract_scopes
  for all using (
    exists (
      select 1 from public.escrow_payments ep
      join public.requests r on r.id = ep.request_id
      join public.companies c on c.id = ep.company_id
      where ep.id = contract_id
        and (auth.uid() = r.user_id or auth.uid() = c.owner_id)
    )
  );

-- ── STEP 26-3: Phase Photos ──────────────────────────────────────────────────
create table if not exists public.phase_photos (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references public.escrow_payments(id) on delete cascade,
  step          integer not null check (step between 1 and 5),
  photos        text[] not null default '{}',
  uploaded_by   uuid references public.users(id) on delete set null,
  uploader_role text check (uploader_role in ('consumer','company')),
  caption       text,
  created_at    timestamptz not null default now()
);

create index if not exists phase_photos_contract_step_idx on public.phase_photos (contract_id, step, created_at desc);

comment on table public.phase_photos is '단계별 공사 사진 기록 — 분쟁 증빙 및 공사 진행 기록';

alter table public.phase_photos enable row level security;

create policy "phase_photos: parties read" on public.phase_photos
  for select using (
    exists (
      select 1 from public.escrow_payments ep
      join public.requests r on r.id = ep.request_id
      join public.companies c on c.id = ep.company_id
      where ep.id = contract_id
        and (auth.uid() = r.user_id or auth.uid() = c.owner_id)
    )
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "phase_photos: company upload" on public.phase_photos
  for insert with check (
    exists (
      select 1 from public.escrow_payments ep
      join public.companies c on c.id = ep.company_id
      where ep.id = contract_id and auth.uid() = c.owner_id
    )
  );

-- ── STEP 27: Contract Notes (양방향 기록) ────────────────────────────────────
create table if not exists public.contract_notes (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.escrow_payments(id) on delete cascade,
  author_id    uuid not null references public.users(id) on delete set null,
  author_role  text not null check (author_role in ('consumer','company','admin')),
  type         text not null check (type in ('customer_note','company_note','admin_note')),
  content      text not null,
  images       text[] default '{}',
  is_deleted   boolean not null default false,
  edit_history jsonb[] default '{}',   -- [{content, edited_at}]
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists contract_notes_contract_idx on public.contract_notes (contract_id, created_at asc);

comment on table public.contract_notes is '고객/업체 양방향 기록 — 분쟁 타임라인 증빙';

create or replace trigger contract_notes_updated_at
  before update on public.contract_notes
  for each row execute procedure public.set_updated_at();

alter table public.contract_notes enable row level security;

create policy "contract_notes: parties read" on public.contract_notes
  for select using (
    is_deleted = false
    and (
      exists (
        select 1 from public.escrow_payments ep
        join public.requests r on r.id = ep.request_id
        join public.companies c on c.id = ep.company_id
        where ep.id = contract_id
          and (auth.uid() = r.user_id or auth.uid() = c.owner_id)
      )
      or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
    )
  );

create policy "contract_notes: author write" on public.contract_notes
  for insert with check (auth.uid() = author_id);

-- 수정은 허용하되 edit_history 강제 (애플리케이션 레이어에서 처리)
create policy "contract_notes: author update" on public.contract_notes
  for update using (auth.uid() = author_id and is_deleted = false);

-- 삭제는 소프트 삭제만 (is_deleted = true)
-- hard delete 정책 없음 — 기록 보존 원칙

-- ============================================================
--  STEP H — 결제 준비 구조
-- ============================================================

-- ── payment_orders ────────────────────────────────────────────────────────────
create table if not exists public.payment_orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.users(id) on delete set null,
  request_id     uuid references public.requests(id) on delete set null,
  bid_id         uuid references public.bids(id) on delete set null,
  contract_id    uuid references public.escrow_payments(id) on delete set null,
  amount         integer not null,
  customer_fee   integer not null default 0,
  vat            integer not null default 0,
  total_amount   integer not null,
  payment_method text,
  status         text not null default 'PENDING'
    check (status in ('PENDING','READY','PAID','FAILED','CANCELLED','REFUNDED')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace trigger payment_orders_updated_at
  before update on public.payment_orders
  for each row execute procedure public.set_updated_at();

alter table public.payment_orders enable row level security;
create policy "payment_orders: owner read" on public.payment_orders
  for select using (auth.uid() = user_id);
create policy "payment_orders: owner insert" on public.payment_orders
  for insert with check (auth.uid() = user_id);

-- ── payment_transactions ──────────────────────────────────────────────────────
create table if not exists public.payment_transactions (
  id               uuid primary key default gen_random_uuid(),
  payment_order_id uuid references public.payment_orders(id) on delete cascade,
  pg_provider      text not null default 'toss',
  pg_payment_key   text,
  method           text,
  amount           integer not null,
  status           text not null default 'PENDING',
  approved_at      timestamptz,
  raw_response     jsonb,
  created_at       timestamptz not null default now()
);

alter table public.payment_transactions enable row level security;
create policy "payment_transactions: public read own" on public.payment_transactions
  for select using (
    exists (select 1 from public.payment_orders po where po.id = payment_order_id and auth.uid() = po.user_id)
  );

-- ── escrow_payouts ────────────────────────────────────────────────────────────
create table if not exists public.escrow_payouts (
  id           uuid primary key default gen_random_uuid(),
  escrow_id    uuid references public.escrow_payments(id) on delete cascade,
  company_id   uuid references public.companies(id) on delete cascade,
  stage        integer not null check (stage between 1 and 4),
  percent      integer not null,
  amount       integer not null,
  platform_fee integer not null default 0,
  vat          integer not null default 0,
  net_amount   integer not null,
  status       text not null default 'PENDING'
    check (status in ('PENDING','READY','APPROVED','HELD','PAID_MANUALLY','CANCELLED')),
  approved_by  uuid references public.users(id) on delete set null,
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.escrow_payouts enable row level security;
create policy "escrow_payouts: company read" on public.escrow_payouts
  for select using (
    exists (select 1 from public.companies c where c.id = company_id and auth.uid() = c.owner_id)
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ── webhook_logs ──────────────────────────────────────────────────────────────
create table if not exists public.webhook_logs (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_type   text not null,
  payment_key  text,
  payload      jsonb,
  processed    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Accessible only via service role (backend only)
alter table public.webhook_logs enable row level security;

-- ── RLS: admin can read/write users (needed for admin dashboard) ──────────────
-- NOTE: Apply this migration to enable admin customer management
-- create policy "users: admin read all" on public.users
--   for select using (
--     exists (select 1 from public.users where id = auth.uid() and role = 'admin')
--   );

-- ============================================================
--  STEP 15 — 카카오맵 위도/경도 컬럼
-- ============================================================
alter table public.companies add column if not exists lat  numeric(10,7);
alter table public.companies add column if not exists lng  numeric(10,7);

-- STEP 17 — 업체 총 거래액 컬럼
alter table public.companies add column if not exists total_transaction_volume integer not null default 0;

-- ============================================================
--  STEP M — fee_snapshot (계약 시점 수수료 고정)
-- ============================================================
alter table public.escrow_payouts   add column if not exists fee_snapshot jsonb;
alter table public.payment_orders   add column if not exists fee_snapshot jsonb;

-- ============================================================
--  STEP O — 운영 Emergency Switch
-- ============================================================
create table if not exists public.ops_config (
  id                  uuid primary key default gen_random_uuid(),
  pause_new_payments  boolean not null default false,
  pause_new_bids      boolean not null default false,
  pause_new_approvals boolean not null default false,
  updated_by          uuid references public.users(id) on delete set null,
  updated_at          timestamptz not null default now()
);
insert into public.ops_config (pause_new_payments, pause_new_bids, pause_new_approvals)
  values (false, false, false)
  on conflict do nothing;

alter table public.ops_config enable row level security;
create policy "ops_config: admin read" on public.ops_config
  for select using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
create policy "ops_config: admin write" on public.ops_config
  for all using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- ============================================================
--  STEP R — Notification 우선순위
-- ============================================================
alter table public.notifications
  add column if not exists priority text not null default 'NORMAL'
    check (priority in ('LOW','NORMAL','HIGH','CRITICAL'));

create index if not exists notifications_priority_idx on public.notifications (user_id, priority, created_at desc);

-- ============================================================
--  STEP S — TEMP_RESTRICTED 활동 제한 상태
-- ============================================================
alter table public.companies
  drop constraint if exists companies_company_status_check;
alter table public.companies
  add constraint companies_company_status_check
    check (company_status in ('PENDING','ACTIVE','PAUSED','SUSPENDED','BLACKLISTED','TEMP_RESTRICTED'));

-- ============================================================
--  STEP L — 고객/업체 보호 (customer_reports)
-- ============================================================
create table if not exists public.customer_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid references public.users(id) on delete set null,
  reported_id  uuid references public.users(id) on delete cascade,
  report_type  text not null check (report_type in ('반복취소','욕설','무리한요구','허위리뷰시도','기타')),
  description  text,
  contract_id  uuid references public.escrow_payments(id) on delete set null,
  status       text not null default 'PENDING'
    check (status in ('PENDING','REVIEWED','RESOLVED')),
  admin_note   text,
  created_at   timestamptz not null default now()
);

alter table public.customer_reports enable row level security;
create policy "customer_reports: admin read" on public.customer_reports
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
create policy "customer_reports: authenticated insert" on public.customer_reports
  for insert with check (auth.uid() = reporter_id);

-- ============================================================
--  Admin Dashboard 실운영화 — 사용자/라운지/신고 구조 추가
-- ============================================================

-- User account_status + space economy columns
alter table public.users add column if not exists account_status text not null default 'NORMAL'
  check (account_status in ('NORMAL','TEMP_RESTRICTED','SUSPENDED','BLACKLISTED'));
alter table public.users add column if not exists space_temp    numeric(4,1) not null default 36.5;
alter table public.users add column if not exists space_tokens  integer      not null default 0;

-- ── lounge_posts ──────────────────────────────────────────────────────────────
create table if not exists public.lounge_posts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.users(id) on delete set null,
  anonymous_nickname text not null,
  category           text not null default 'daily',
  title              text,
  content            text not null,
  view_count         integer not null default 0,
  like_count         integer not null default 0,
  comment_count      integer not null default 0,
  is_hidden          boolean not null default false,
  hidden_reason      text,
  region             text,
  gender             text,
  age_group          text,
  has_badge          boolean not null default false,
  is_story           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.lounge_posts enable row level security;
create policy "lounge_posts: public read" on public.lounge_posts
  for select using (
    is_hidden = false
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
create policy "lounge_posts: owner insert" on public.lounge_posts
  for insert with check (auth.uid() = user_id);
create policy "lounge_posts: admin update" on public.lounge_posts
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy if not exists "payment_transactions: admin read" on public.payment_transactions
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
create policy if not exists "payment_transactions: owner insert" on public.payment_transactions
  for insert with check (
    exists (select 1 from public.payment_orders po where po.id = payment_order_id and auth.uid() = po.user_id)
  );

-- ── Migration: payment_orders admin management columns ───────────────────────
alter table public.payment_orders add column if not exists admin_note text;

-- ── Migration: admin RLS on payment_orders ───────────────────────────────────
create policy if not exists "payment_orders: admin read all" on public.payment_orders
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
create policy if not exists "payment_orders: admin update" on public.payment_orders
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ── lounge_comments ───────────────────────────────────────────────────────────
create table if not exists public.lounge_comments (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid not null references public.lounge_posts(id) on delete cascade,
  user_id            uuid references public.users(id) on delete set null,
  parent_id          uuid references public.lounge_comments(id) on delete cascade,
  anonymous_nickname text not null,
  content            text not null,
  like_count         integer not null default 0,
  is_expert_reply    boolean not null default false,
  is_hidden          boolean not null default false,
  hidden_reason      text,
  created_at         timestamptz not null default now()
);

alter table public.lounge_comments enable row level security;
create policy "lounge_comments: public read" on public.lounge_comments
  for select using (
    is_hidden = false
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
create policy "lounge_comments: owner insert" on public.lounge_comments
  for insert with check (auth.uid() = user_id);
create policy "lounge_comments: admin update" on public.lounge_comments
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ── lounge_reports ────────────────────────────────────────────────────────────
create table if not exists public.lounge_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid references public.users(id) on delete set null,
  target_type  text not null check (target_type in ('post','comment','story','user')),
  target_id    uuid not null,
  reason       text not null,
  description  text,
  status       text not null default 'pending'
    check (status in ('pending','reviewing','resolved','dismissed')),
  admin_note   text,
  created_at   timestamptz not null default now()
);

alter table public.lounge_reports enable row level security;
create policy "lounge_reports: admin read" on public.lounge_reports
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
create policy "lounge_reports: authenticated insert" on public.lounge_reports
  for insert with check (auth.uid() = reporter_id);
create policy "lounge_reports: admin update" on public.lounge_reports
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- escrow_payouts: allow admin to update (for settlement management)
create policy "escrow_payouts: admin update" on public.escrow_payouts
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- escrow_payments: allow admin to update dispute_status
create policy "escrow_payments: admin update" on public.escrow_payments
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- users: allow admin to update account_status / space fields
create policy "users: admin update" on public.users
  for update using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- ============================================================
--  STEP DOC — company_documents (서류 관리 시스템)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  document_type text        NOT NULL,
  file_name     text,
  file_url      text,
  file_size     int,
  mime_type     text,
  checklist     jsonb,
  review_status text        NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft','submitted','reviewing','approved','held','rejected')),
  review_reason text,
  reviewed_by   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, document_type)
);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

-- 이 앱은 anon key + Twilio OTP 구조라 auth.uid()=NULL (048/052 참조).
-- auth.uid() 기반 정책은 anon 클라 읽기/쓰기를 막아 서류센터가 동작하지 않는다.
-- companies(public read) 와 동일하게 anon 접근을 허용한다. (migration 054 와 일치)
CREATE INDEX IF NOT EXISTS idx_company_documents_company_id    ON public.company_documents (company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_user_id       ON public.company_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_review_status ON public.company_documents (review_status);

DROP POLICY IF EXISTS "company_documents: owner read"   ON public.company_documents;
DROP POLICY IF EXISTS "company_documents: owner insert" ON public.company_documents;
DROP POLICY IF EXISTS "company_documents: owner update" ON public.company_documents;
DROP POLICY IF EXISTS "company_documents: admin all"    ON public.company_documents;

CREATE POLICY "company_documents: anon read" ON public.company_documents
  FOR SELECT USING (true);
CREATE POLICY "company_documents: anon insert" ON public.company_documents
  FOR INSERT WITH CHECK (true);
CREATE POLICY "company_documents: anon update" ON public.company_documents
  FOR UPDATE USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.company_documents TO anon, authenticated;

-- ── extend admin_logs target_type for all domains ────────────────────────────
ALTER TABLE public.admin_logs DROP CONSTRAINT IF EXISTS admin_logs_target_type_check;
ALTER TABLE public.admin_logs ADD CONSTRAINT admin_logs_target_type_check
  CHECK (target_type IN ('company','customer','user','dispute','settlement','payment','lounge','report','document'));

-- ============================================================
--  STEP SYNC-1 — Request TTL & Repost
-- ============================================================

alter table public.requests add column if not exists expires_at     timestamptz;
alter table public.requests add column if not exists reposted_at    timestamptz;
alter table public.requests add column if not exists exposure_count integer not null default 0;

alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check
  check (status in ('open','in_progress','completed','cancelled','closed','expired'));

create table if not exists public.request_reposts (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.requests(id) on delete cascade,
  user_id        uuid references public.users(id) on delete set null,
  reposted_at    timestamptz not null default now(),
  exposure_count integer not null default 1
);

alter table public.request_reposts enable row level security;
create policy "request_reposts: owner read" on public.request_reposts
  for select using (auth.uid() = user_id);
create policy "request_reposts: owner insert" on public.request_reposts
  for insert with check (auth.uid() = user_id);

-- ============================================================
--  STEP SYNC-2 — Lounge Posts & Comments
-- ============================================================

--  라운지 시스템 — Lounge Community Tables
-- ============================================================

-- ── lounge_posts (일반 게시글 + is_story=true 이면 스토리) ────────────────────
create table if not exists public.lounge_posts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.users(id) on delete set null,
  anonymous_nickname text not null,
  category           text not null,
  title              text,
  content            text not null,
  image_urls         text[]      not null default '{}',
  gender             text,
  age_group          text,
  region             text,
  is_story           boolean     not null default false,
  story_expires_at   timestamptz,
  is_seed            boolean     not null default false,  -- true: 플랫폼 seed 글 (real 글이 없을 때 초기 화면용)
  view_count         integer     not null default 0,
  like_count         integer     not null default 0,
  comment_count      integer     not null default 0,
  has_badge          boolean     not null default false,
  boost_until        timestamptz,
  is_deleted         boolean     not null default false,
  deleted_at         timestamptz,
  deleted_by         uuid references public.users(id) on delete set null,
  is_hidden          boolean     not null default false,
  hidden_by          uuid references public.users(id) on delete set null,
  hidden_reason      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.lounge_posts is '라운지 게시글 및 스토리 (is_story=true이면 스토리)';
create index if not exists lounge_posts_category_idx on public.lounge_posts (category, created_at desc);
create index if not exists lounge_posts_created_idx  on public.lounge_posts (created_at desc);
create index if not exists lounge_posts_story_idx    on public.lounge_posts (is_story, created_at desc);
create index if not exists lounge_posts_popular_idx  on public.lounge_posts (view_count desc, like_count desc);

create or replace trigger lounge_posts_updated_at
  before update on public.lounge_posts
  for each row execute procedure public.set_updated_at();

alter table public.lounge_posts enable row level security;

-- 누구나 삭제/숨김되지 않은 글 조회 가능
create policy "lounge_posts: public read" on public.lounge_posts
  for select using (is_deleted = false and is_hidden = false);

-- 본인 글 직접 조회 (마이페이지용, 숨김 포함 가능)
create policy "lounge_posts: owner read own" on public.lounge_posts
  for select using (auth.uid() = user_id);

-- 로그인 사용자 게시글 작성
create policy "lounge_posts: auth insert" on public.lounge_posts
  for insert with check (auth.uid() = user_id);

-- 본인 글만 수정 (소프트 삭제 포함)
create policy "lounge_posts: owner update" on public.lounge_posts
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── lounge_comments ───────────────────────────────────────────────────────────
create table if not exists public.lounge_comments (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid not null references public.lounge_posts(id) on delete cascade,
  parent_id          uuid references public.lounge_comments(id) on delete cascade,
  user_id            uuid references public.users(id) on delete set null,
  anonymous_nickname text not null,
  content            text not null,
  image_urls         text[]      not null default '{}',
  is_expert_reply    boolean     not null default false,
  like_count         integer     not null default 0,
  is_deleted         boolean     not null default false,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.lounge_comments is '라운지 댓글 및 대댓글';

alter table public.lounge_comments enable row level security;

create policy "lounge_comments: public read" on public.lounge_comments
  for select using (is_deleted = false);

create policy "lounge_comments: auth insert" on public.lounge_comments
  for insert with check (auth.uid() = user_id);

create policy "lounge_comments: owner update" on public.lounge_comments
  for update using (auth.uid() = user_id);

-- ── lounge_post_likes (중복 방지 unique 좋아요) ───────────────────────────────
create table if not exists public.lounge_post_likes (
  post_id    uuid not null references public.lounge_posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.lounge_post_likes enable row level security;
create policy "lounge_post_likes: auth read" on public.lounge_post_likes
  for select using (auth.uid() = user_id);
create policy "lounge_post_likes: auth insert" on public.lounge_post_likes
  for insert with check (auth.uid() = user_id);
create policy "lounge_post_likes: auth delete" on public.lounge_post_likes
  for delete using (auth.uid() = user_id);

-- ── lounge_comment_likes ──────────────────────────────────────────────────────
create table if not exists public.lounge_comment_likes (
  comment_id uuid not null references public.lounge_comments(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.lounge_comment_likes enable row level security;
create policy "lounge_comment_likes: auth insert" on public.lounge_comment_likes
  for insert with check (auth.uid() = user_id);
create policy "lounge_comment_likes: auth delete" on public.lounge_comment_likes
  for delete using (auth.uid() = user_id);

-- ── lounge_saves (저장한 글) ──────────────────────────────────────────────────
create table if not exists public.lounge_saves (
  post_id    uuid not null references public.lounge_posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.lounge_saves enable row level security;
create policy "lounge_saves: owner read" on public.lounge_saves
  for select using (auth.uid() = user_id);
create policy "lounge_saves: owner insert" on public.lounge_saves
  for insert with check (auth.uid() = user_id);
create policy "lounge_saves: owner delete" on public.lounge_saves
  for delete using (auth.uid() = user_id);

-- ── lounge_reports ────────────────────────────────────────────────────────────
create table if not exists public.lounge_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  target_type text not null check (target_type in ('post','comment','story','user')),
  target_id   text not null,
  reason      text not null,
  created_at  timestamptz not null default now()
);

alter table public.lounge_reports enable row level security;
create policy "lounge_reports: auth insert" on public.lounge_reports
  for insert with check (auth.uid() = reporter_id);
create policy "lounge_reports: admin read" on public.lounge_reports
  for select using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- ── lounge_blocks ─────────────────────────────────────────────────────────────
create table if not exists public.lounge_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.lounge_blocks enable row level security;
create policy "lounge_blocks: owner rw" on public.lounge_blocks
  for all using (auth.uid() = blocker_id);

-- ── lounge_chat_requests ──────────────────────────────────────────────────────
create table if not exists public.lounge_chat_requests (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.lounge_posts(id) on delete cascade,
  requester_id uuid references public.users(id) on delete cascade,
  target_id   uuid references public.users(id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending','accepted','rejected','expired')),
  token_charged boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.lounge_chat_requests enable row level security;
create policy "lounge_chat_requests: owner read" on public.lounge_chat_requests
  for select using (auth.uid() = requester_id or auth.uid() = target_id);
create policy "lounge_chat_requests: auth insert" on public.lounge_chat_requests
  for insert with check (auth.uid() = requester_id);
create policy "lounge_chat_requests: target update" on public.lounge_chat_requests
  for update using (auth.uid() = target_id or auth.uid() = requester_id);


-- ── Storage: lounge-images 버킷 ───────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lounge-images',
  'lounge-images',
  true,
  5242880,
  array['image/jpeg','image/jpg','image/png','image/gif','image/webp']
) on conflict (id) do nothing;

-- 공개 읽기 (누구나 이미지 조회 가능)
create policy "lounge-images: public read" on storage.objects
  for select using (bucket_id = 'lounge-images');

-- 로그인 사용자 업로드 (본인 폴더만)
create policy "lounge-images: auth upload" on storage.objects
  for insert with check (
    bucket_id = 'lounge-images' and
    auth.uid() is not null and
    split_part(name, '/', 2) = auth.uid()::text
  );

-- 본인 파일 삭제
create policy "lounge-images: owner delete" on storage.objects
  for delete using (
    bucket_id = 'lounge-images' and
    split_part(name, '/', 2) = auth.uid()::text
  );
