-- ════════════════════════════════════════════════════════════════════
-- 071_partner_lead_pledge.sql
-- 업체 운영준수서약 제출 이력 저장 — Partner Landing (정식 서비스 반영)
--
-- 목적: 가입 신청 시 필수 동의하는 '업체 운영준수서약'을 제출 이력으로 저장하고
--   관리자(파트너 상담관리)에서 동의 여부 + 동의 일시를 확인할 수 있게 한다.
--   향후 업체 심사 / 분쟁 / 제재 / 법적 증빙 / 감사 로그 기준 데이터로 활용.
--
-- 원칙(회귀 금지):
--   · partner_leads 컬럼 2개만 추가(additive). 기존 컬럼/제약/인덱스 무변경.
--   · 기존 partner_lead_submit 시그니처는 건드리지 않는다(제출 흐름 안전).
--     서약 저장은 별도 best-effort RPC(partner_lead_set_pledge)로 제출 직후 기록.
--     → 마이그레이션 적용 전/후 어느 시점이든 기존 가입 제출은 정상 동작.
--   · partner_leads_list 는 070 버전 그대로 + 서약 2개 키만 추가(additive).
--   · 069/070 의 온보딩·파일 RPC, 승인/반려 로직, RLS, Storage 무변경.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(070 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1. 컬럼 추가 (additive · idempotent) ──────────────────────────────
alter table public.partner_leads add column if not exists pledge_agreed    boolean;
alter table public.partner_leads add column if not exists pledge_agreed_at timestamptz;

comment on column public.partner_leads.pledge_agreed    is '업체 운영준수서약 동의 여부(가입 신청 시 필수 동의)';
comment on column public.partner_leads.pledge_agreed_at is '업체 운영준수서약 동의 일시';

-- ── 2. 서약 기록 RPC (anon) — 제출 직후 best-effort 호출 ───────────────
-- 가입 제출 흐름과 분리(별도 호출) → 본 함수 미존재/실패가 제출을 막지 않는다.
-- p_agreed_at 미지정 시 서버 now() 사용. 이미 동의 기록이 있으면 보존(최초 동의 유지).
create or replace function public.partner_lead_set_pledge(
  p_lead_id   uuid,
  p_agreed    boolean default true,
  p_agreed_at timestamptz default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare v_row public.partner_leads;
begin
  if p_lead_id is null then raise exception 'LEAD_REQUIRED'; end if;

  update public.partner_leads set
    pledge_agreed    = coalesce(p_agreed, pledge_agreed, false),
    pledge_agreed_at = case
                         when coalesce(p_agreed, false)
                           then coalesce(pledge_agreed_at, p_agreed_at, now())  -- 최초 동의 시각 보존
                         else pledge_agreed_at
                       end,
    updated_at       = now()
  where id = p_lead_id
  returning * into v_row;

  if v_row.id is null then raise exception 'LEAD_NOT_FOUND: %', p_lead_id; end if;
  return jsonb_build_object('id', v_row.id,
                            'pledge_agreed', v_row.pledge_agreed,
                            'pledge_agreed_at', v_row.pledge_agreed_at);
end; $fn$;

grant execute on function public.partner_lead_set_pledge(uuid, boolean, timestamptz) to anon, authenticated;

-- ── 3. 상담관리 목록 RPC — 서약 2개 키 추가(070 기준 · additive) ───────
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
      'pledge_agreed_at',  l.pledge_agreed_at
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
