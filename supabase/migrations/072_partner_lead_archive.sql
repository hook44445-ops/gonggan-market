-- ════════════════════════════════════════════════════════════════════
-- 072_partner_lead_archive.sql
-- 파트너 상담관리 보관함(soft archive) — Partner Landing
--
-- 목적: 테스트 신청 / 처리 완료된 불필요 항목 / 오래된 상담 리드를 '삭제하지 않고'
--   기본 목록에서 정리할 수 있도록 보관(soft archive) 상태를 추가한다.
--   보관은 status('PENDING/CONTACTED/APPROVED/REJECTED')와 무관한 별도 플래그.
--
-- 원칙(회귀 금지 · hard delete 금지):
--   · partner_leads 컬럼 3개만 추가(additive). 기존 컬럼/제약/인덱스/status 무변경.
--   · 보관/해제는 별도 admin-gated RPC(partner_lead_set_archive)로만 토글.
--     기존 가입/승인/반려/온보딩/파일/서약 RPC 및 RLS·Storage 전부 무변경.
--   · partner_leads_list 는 071 버전 그대로 + 보관 3개 키만 추가(additive).
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(071 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1. 컬럼 추가 (additive · idempotent) ──────────────────────────────
alter table public.partner_leads add column if not exists is_archived boolean not null default false;
alter table public.partner_leads add column if not exists archived_at timestamptz;
alter table public.partner_leads add column if not exists archived_by text;

comment on column public.partner_leads.is_archived is '보관(soft archive) 여부 — 기본 목록에서 숨김. hard delete 아님.';
comment on column public.partner_leads.archived_at is '보관 처리 일시';
comment on column public.partner_leads.archived_by is '보관 처리 관리자(uuid 또는 admin sentinel)';

create index if not exists idx_partner_leads_archived on public.partner_leads (is_archived, created_at desc);

-- ── 2. 보관/해제 토글 RPC(관리자) ────────────────────────────────────
-- admin sentinel('admin') 또는 DB role=admin uuid 만 허용(기존 패턴). status 는 건드리지 않는다.
create or replace function public.partner_lead_set_archive(
  p_admin_id text,
  p_lead_id  uuid,
  p_archived boolean default true
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_admin_uuid uuid;
  v_row        public.partner_leads;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY: uuid % is not admin', p_admin_id;
    end if;
  elsif lower(coalesce(trim(p_admin_id), '')) <> 'admin' then
    raise exception 'ADMIN_ONLY: got %', coalesce(p_admin_id, '(null)');
  end if;

  if p_lead_id is null then return jsonb_build_object('error', 'LEAD_REQUIRED'); end if;

  update public.partner_leads set
    is_archived = coalesce(p_archived, false),
    archived_at = case when coalesce(p_archived, false) then now() else null end,
    archived_by = case when coalesce(p_archived, false) then p_admin_id else null end,
    updated_at  = now()
  where id = p_lead_id
  returning * into v_row;

  if v_row.id is null then return jsonb_build_object('error', 'NOT_FOUND', 'id', p_lead_id); end if;
  return jsonb_build_object('id', v_row.id,
                            'is_archived', v_row.is_archived,
                            'archived_at', v_row.archived_at,
                            'archived_by', v_row.archived_by);
end; $fn$;

grant execute on function public.partner_lead_set_archive(text, uuid, boolean) to anon, authenticated;

-- ── 3. 상담관리 목록 RPC — 보관 3개 키 추가(071 기준 · additive) ───────
create or replace function public.partner_leads_list(
  p_admin_id text,
  p_status   text default null,
  p_limit    int  default 300
) returns jsonb
language plpgsql stable security definer
set search_path = public, extensions
as $fn$
declare
  v_admin_uuid uuid;
  v_limit      int;
  v_status     text;
  v_result     jsonb;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY: uuid % is not admin', p_admin_id;
    end if;
  elsif lower(coalesce(trim(p_admin_id), '')) <> 'admin' then
    raise exception 'ADMIN_ONLY: got %', coalesce(p_admin_id, '(null)');
  end if;

  v_limit  := least(greatest(coalesce(p_limit, 300), 1), 1000);
  v_status := nullif(trim(coalesce(p_status, '')), '');

  select coalesce(jsonb_agg(row_json order by created_at desc), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'id',                l.id,
      'company_name',      l.company_name,
      'owner_name',        l.owner_name,
      'phone',             l.phone,
      'business_number',   l.business_number,
      'service_area',      l.service_area,
      'specialty',         l.specialty,
      'insurance_status',  l.insurance_status,
      'memo',              l.memo,
      'status',            l.status,
      'admin_note',        l.admin_note,
      'processed_at',      l.processed_at,
      'processed_by',      l.processed_by,
      'created_at',        l.created_at,
      'updated_at',        l.updated_at,
      'insurance_yn',      l.insurance_yn,
      'guarantee_grade',   l.guarantee_grade,
      'guarantee_amount',  l.guarantee_amount,
      'onboarding_status', l.onboarding_status,
      'deposit_bank',      l.deposit_bank,
      'deposit_account',   l.deposit_account,
      'deposit_owner',     l.deposit_owner,
      'deposit_confirmed_at', l.deposit_confirmed_at,
      'approved_at',       l.approved_at,
      'order_id',          l.order_id,
      'company_id',        l.company_id,
      -- 070 파일 url(additive)
      'business_license_url', l.business_license_url,
      'insurance_file_url',   l.insurance_file_url,
      -- 071 운영준수서약(additive)
      'pledge_agreed',     l.pledge_agreed,
      'pledge_agreed_at',  l.pledge_agreed_at,
      -- 072 보관(soft archive · additive)
      'is_archived',       l.is_archived,
      'archived_at',       l.archived_at,
      'archived_by',       l.archived_by
    ) as row_json, l.created_at
    from public.partner_leads l
    where v_status is null or l.status = v_status
    limit v_limit
  ) sub;

  return v_result;
end;
$fn$;

grant execute on function public.partner_leads_list(text, text, int) to anon, authenticated;

notify pgrst, 'reload schema';
