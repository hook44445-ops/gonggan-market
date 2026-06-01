-- ============================================================
-- 012_direct_deal_reports.sql
-- 직거래 의심 감지/추적 기록 테이블
-- ============================================================

create table if not exists public.direct_deal_reports (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid references public.requests(id)  on delete set null,
  company_id    uuid references public.companies(id) on delete set null,
  customer_id   uuid references public.users(id)     on delete set null,
  trigger_type  text not null check (trigger_type in (
                  'keyword_detected',
                  'no_estimate_72h',
                  'no_contract_7d',
                  'chat_blackout',
                  'manual_report'
                )),
  trigger_detail jsonb,
  status        text not null default 'pending' check (status in (
                  'pending',
                  'investigating',
                  'confirmed',
                  'dismissed'
                )),
  detected_at   timestamptz not null default now(),
  resolved_at   timestamptz,
  admin_note    text
);

comment on table public.direct_deal_reports is '직거래 유도/이탈 의심 자동 감지 기록 — 키워드/실측후 미계약 추적';

create index if not exists idx_ddr_status     on public.direct_deal_reports (status, detected_at desc);
create index if not exists idx_ddr_trigger    on public.direct_deal_reports (trigger_type, detected_at desc);
create index if not exists idx_ddr_company    on public.direct_deal_reports (company_id, detected_at desc);
create index if not exists idx_ddr_request    on public.direct_deal_reports (request_id, detected_at desc);

alter table public.direct_deal_reports enable row level security;

-- 인증된 사용자(거래 당사자)는 의심 기록 생성 가능 — 증거 보존 목적
create policy "ddr: authenticated insert" on public.direct_deal_reports
  for insert with check (auth.uid() is not null);

-- 조회/수정은 관리자만
create policy "ddr: admin read" on public.direct_deal_reports
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "ddr: admin update" on public.direct_deal_reports
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
