-- ════════════════════════════════════════════════════════════════════
-- 065_partner_leads_table.sql
-- 파트너(업체) 랜딩 상담신청 리드 수집 + 관리자 승인 프로세스 — Partner Landing v1.1
--
-- 목적: /partner 랜딩에서 비로그인 업체가 상담을 신청하면 partner_leads 에
--   저장하고, 관리자(파트너 상담관리)가 PENDING→CONTACTED→APPROVED/REJECTED
--   로 상태 관리한다. 문자/이메일/토스 발송 없음 — 상태값만 관리.
--
-- 구조(기존 패턴 준수):
--   · 테이블 + anon insert RLS(015 의 MVP anon 허용 패턴 — 운영 앱은 Supabase
--     Auth 세션이 없어 auth.uid()=null 이므로 anon 제출 허용).
--   · 조회/상태변경은 SECURITY DEFINER + admin sentinel('admin') / DB role=admin
--     검증 RPC 로만(058 admin_project_flow_list 패턴 그대로).
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행. notify 포함.
-- 기존 테이블/RPC/프론트 변경 없음.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1. 테이블 ────────────────────────────────────────────────────────
create table if not exists public.partner_leads (
  id                uuid primary key default gen_random_uuid(),
  company_name      text not null,
  owner_name        text,
  phone             text not null,
  business_number   text,
  service_area      text,
  specialty         text,
  insurance_status  text,                       -- '가입'/'미가입'/'확인필요' 등 자유값(표시용)
  memo              text,                        -- 신청자가 남긴 문의 내용
  status            text not null default 'PENDING'
                      check (status in ('PENDING','CONTACTED','APPROVED','REJECTED')),
  admin_note        text,                        -- 관리자 메모
  approved_at       timestamptz,                 -- 승인(또는 최종 상태) 처리 일시
  approved_by       text,                        -- 처리 담당 관리자(uuid 또는 'admin' sentinel)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.partner_leads is '파트너(업체) 랜딩 상담신청 리드 + 승인 상태 — Partner Landing v1.1';

create index if not exists idx_partner_leads_status  on public.partner_leads (status, created_at desc);
create index if not exists idx_partner_leads_created on public.partner_leads (created_at desc);

-- ── 2. RLS ───────────────────────────────────────────────────────────
alter table public.partner_leads enable row level security;

-- 멱등 적용
drop policy if exists "partner_leads: anon insert" on public.partner_leads;

-- 비로그인 업체의 상담신청 제출 허용(운영 앱은 Supabase Auth 세션 없음 = anon).
-- 조회/수정 정책은 부여하지 않음 = service_role / SECURITY DEFINER RPC 로만 접근.
create policy "partner_leads: anon insert" on public.partner_leads
  for insert with check (true);

-- ── 3. RPC: 상담신청 제출(anon 호출 가능) ────────────────────────────
-- 프론트(/partner)에서 직접 호출. 최소 필드 검증 후 1행 insert, 생성 id 반환.
create or replace function public.partner_lead_submit(
  p_company_name     text,
  p_phone            text,
  p_owner_name       text default null,
  p_business_number  text default null,
  p_service_area     text default null,
  p_specialty        text default null,
  p_insurance_status text default null,
  p_memo             text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_id uuid;
begin
  if nullif(trim(coalesce(p_company_name, '')), '') is null then
    return jsonb_build_object('error', 'COMPANY_NAME_REQUIRED');
  end if;
  if nullif(trim(coalesce(p_phone, '')), '') is null then
    return jsonb_build_object('error', 'PHONE_REQUIRED');
  end if;

  insert into public.partner_leads (
    company_name, owner_name, phone, business_number,
    service_area, specialty, insurance_status, memo
  ) values (
    trim(p_company_name),
    nullif(trim(coalesce(p_owner_name, '')), ''),
    trim(p_phone),
    nullif(trim(coalesce(p_business_number, '')), ''),
    nullif(trim(coalesce(p_service_area, '')), ''),
    nullif(trim(coalesce(p_specialty, '')), ''),
    nullif(trim(coalesce(p_insurance_status, '')), ''),
    nullif(trim(coalesce(p_memo, '')), '')
  )
  returning id into v_id;

  return jsonb_build_object('status', 'PENDING', 'id', v_id);
end;
$fn$;

grant execute on function public.partner_lead_submit(text, text, text, text, text, text, text, text) to anon, authenticated;

-- ── 4. sentinel uuid 변환 헬퍼(없으면 생성, 멱등) ────────────────────
create or replace function public._safe_uuid(p text)
returns uuid language plpgsql immutable as $fn$
begin
  return p::uuid;
exception when others then
  return null;
end;
$fn$;

-- ── 5. RPC: 상담신청 목록(관리자) ────────────────────────────────────
-- admin sentinel('admin') 또는 DB role=admin uuid 만 허용(058 패턴).
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
      'id',               l.id,
      'company_name',     l.company_name,
      'owner_name',       l.owner_name,
      'phone',            l.phone,
      'business_number',  l.business_number,
      'service_area',     l.service_area,
      'specialty',        l.specialty,
      'insurance_status', l.insurance_status,
      'memo',             l.memo,
      'status',           l.status,
      'admin_note',       l.admin_note,
      'approved_at',      l.approved_at,
      'approved_by',      l.approved_by,
      'created_at',       l.created_at,
      'updated_at',       l.updated_at
    ) as row_json, l.created_at
    from public.partner_leads l
    where v_status is null or l.status = v_status
    limit v_limit
  ) sub;

  return v_result;
end;
$fn$;

grant execute on function public.partner_leads_list(text, text, int) to anon, authenticated;

-- ── 6. RPC: 상담신청 상태변경 + 메모/승인담당/승인일시(관리자) ───────
create or replace function public.partner_lead_set_status(
  p_admin_id   text,
  p_lead_id    uuid,
  p_status     text,
  p_admin_note text default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_admin_uuid uuid;
  v_is_final   boolean;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY: uuid % is not admin', p_admin_id;
    end if;
  elsif lower(coalesce(trim(p_admin_id), '')) <> 'admin' then
    raise exception 'ADMIN_ONLY: got %', coalesce(p_admin_id, '(null)');
  end if;

  if p_status not in ('PENDING','CONTACTED','APPROVED','REJECTED') then
    return jsonb_build_object('error', 'INVALID_STATUS', 'got', p_status);
  end if;

  -- 승인/반려(최종 처리) 시 처리 담당자/일시 기록. 그 외 상태는 보존.
  v_is_final := p_status in ('APPROVED','REJECTED');

  update public.partner_leads
     set status      = p_status,
         admin_note  = coalesce(nullif(trim(coalesce(p_admin_note, '')), ''), admin_note),
         approved_at = case when v_is_final then now() else approved_at end,
         approved_by = case when v_is_final then p_admin_id else approved_by end,
         updated_at  = now()
   where id = p_lead_id;

  if not found then
    return jsonb_build_object('error', 'NOT_FOUND', 'id', p_lead_id);
  end if;

  return jsonb_build_object('status', p_status, 'id', p_lead_id);
end;
$fn$;

grant execute on function public.partner_lead_set_status(text, uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
