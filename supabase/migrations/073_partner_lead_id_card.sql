-- ─────────────────────────────────────────────────────────────────────
-- 073_partner_lead_id_card.sql
-- 대표자 신분증(선택) 업로드 저장 + 관리자 상담관리 조회. 전부 additive.
--   1) partner_leads.id_card_url 컬럼 추가
--   2) partner_lead_attach_files RPC 에 p_id_card_url 파라미터 추가(하위호환)
--   3) partner_leads_list RPC JSON 에 id_card_url 키 추가(072 본문 + 1키)
-- 기존 서류(사업자등록증/보험증권) 저장·조회 동작은 그대로.
-- ─────────────────────────────────────────────────────────────────────
set search_path = public, extensions;

-- ── 1. 컬럼 추가 (additive) ───────────────────────────────────────────
alter table public.partner_leads add column if not exists id_card_url text;

-- ── 2. 파일 첨부 RPC — p_id_card_url 추가 ─────────────────────────────
-- 오버로드 모호성 방지: 기존 3-arg 시그니처 제거 후 4-arg 재생성.
-- 3개 url 파라미터 모두 default null 이라 기존 호출부(사업자/보험만 전송)도 그대로 매칭된다.
drop function if exists public.partner_lead_attach_files(uuid, text, text);
create or replace function public.partner_lead_attach_files(
  p_lead_id              uuid,
  p_business_license_url text default null,
  p_insurance_file_url   text default null,
  p_id_card_url          text default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare v_row public.partner_leads;
begin
  if p_lead_id is null then raise exception 'LEAD_REQUIRED'; end if;

  update public.partner_leads set
    business_license_url = coalesce(nullif(trim(p_business_license_url), ''), business_license_url),
    insurance_file_url   = coalesce(nullif(trim(p_insurance_file_url),   ''), insurance_file_url),
    id_card_url          = coalesce(nullif(trim(p_id_card_url),          ''), id_card_url),
    updated_at = now()
  where id = p_lead_id
  returning * into v_row;
  if v_row.id is null then raise exception 'LEAD_NOT_FOUND: %', p_lead_id; end if;

  -- insurance_yn 을 보험증권 파일 존재 기준으로 동기화(기존 070 동작 유지).
  update public.partner_leads set
    insurance_yn = (insurance_file_url is not null),
    updated_at   = now()
  where id = p_lead_id
  returning * into v_row;

  return to_jsonb(v_row);
end; $fn$;

grant execute on function public.partner_lead_attach_files(uuid, text, text, text) to anon, authenticated;

-- ── 3. 상담관리 목록 RPC — id_card_url 키 추가(072 본문 + 1키) ─────────
create or replace function public.partner_leads_list(
  p_admin_id text,
  p_status   text default null,
  p_limit    int  default 300
) returns jsonb
language plpgsql security definer
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
      -- 073 대표자 신분증(additive)
      'id_card_url',          l.id_card_url,
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
