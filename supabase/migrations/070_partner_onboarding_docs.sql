-- ════════════════════════════════════════════════════════════════════
-- 070_partner_onboarding_docs.sql
-- Partner Onboarding V1.3 — 가입상담(partner_leads)에 사업자등록증/보험증권
--   업로드 + 보험 '파일 존재' 기준 예치금 + 사업자등록증 없으면 APPROVE 불가.
--
-- 원칙(지시서 확정):
--   · partner_leads 컬럼 2개만 추가(additive). companies 선생성 금지.
--   · 069 파일은 수정하지 않고, 여기서 create-or-replace 로 RPC override.
--   · 068(companies guarantee)·company_status·doc_status·badge·deposit_amount·
--     company_documents 무변경.
--   · 예치금 보험판정 = 보험증권 파일 존재 여부(단순 선택값 아님). 파일 없으면 2배.
--
-- 안전성(회귀 금지): 컬럼 추가 + RPC create-or-replace. 멱등.
-- Supabase SQL Editor 에서 1회 실행(069 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1. 컬럼 추가 (additive) ───────────────────────────────────────────
alter table public.partner_leads add column if not exists business_license_url text;
alter table public.partner_leads add column if not exists insurance_file_url    text;

-- ── 2. 파일 첨부 RPC (anon) — 제출 직후 업로드 url 저장 + insurance_yn 동기화 ─
-- insurance_yn 을 '보험증권 파일 존재' 기준으로 맞춘다(이후 등급선택/복사 일관성).
create or replace function public.partner_lead_attach_files(
  p_lead_id              uuid,
  p_business_license_url text default null,
  p_insurance_file_url   text default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare v_row public.partner_leads;
begin
  if p_lead_id is null then raise exception 'LEAD_REQUIRED'; end if;

  update public.partner_leads set
    business_license_url = coalesce(nullif(trim(p_business_license_url), ''), business_license_url),
    insurance_file_url   = coalesce(nullif(trim(p_insurance_file_url),   ''), insurance_file_url),
    updated_at = now()
  where id = p_lead_id
  returning * into v_row;
  if v_row.id is null then raise exception 'LEAD_NOT_FOUND: %', p_lead_id; end if;

  update public.partner_leads set
    insurance_yn = (insurance_file_url is not null),
    updated_at   = now()
  where id = p_lead_id
  returning * into v_row;

  return to_jsonb(v_row);
end; $fn$;

grant execute on function public.partner_lead_attach_files(uuid, text, text) to anon, authenticated;

-- ── 3. 등급 선택 — 보험판정을 '보험증권 파일 존재' 기준으로(파일 없으면 2배) ──
-- 069 와 동일하되 v_insured 만 파일 기준(시그니처/그랜트 호환 유지, p_insurance_yn 무시).
create or replace function public.partner_lead_select_grade(
  p_lead_id      uuid,
  p_grade        text,
  p_insurance_yn boolean default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_row     public.partner_leads;
  v_base    integer;
  v_amount  integer;
  v_insured boolean;
begin
  if p_lead_id is null then raise exception 'LEAD_REQUIRED'; end if;
  if p_grade not in ('BASIC','STANDARD','PREMIUM','MASTER','SIGNATURE') then
    raise exception 'INVALID_GRADE: %', coalesce(p_grade, '(null)');
  end if;

  select * into v_row from public.partner_leads where id = p_lead_id;
  if v_row.id is null then raise exception 'LEAD_NOT_FOUND: %', p_lead_id; end if;

  if v_row.onboarding_status not in ('PENDING_DOCS','PENDING_DEPOSIT') then
    raise exception 'ONBOARDING_LOCKED: %', v_row.onboarding_status;
  end if;

  v_insured := (v_row.insurance_file_url is not null);   -- V1.3: 실제 보험증권 파일 기준
  v_base    := public._partner_base_amount(p_grade);
  v_amount  := v_base * (case when v_insured then 1 else 2 end);  -- 보험파일 없으면 2배

  update public.partner_leads set
    insurance_yn      = v_insured,
    guarantee_grade   = p_grade,
    guarantee_amount  = v_amount,
    onboarding_status = 'PENDING_DEPOSIT',
    deposit_bank      = '국민은행',
    deposit_account   = '123456-78-123456',
    deposit_owner     = '공간마켓',
    order_id          = coalesce(order_id,
                          'PL-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(id::text,'-',''),1,8)),
    updated_at        = now()
  where id = p_lead_id
  returning * into v_row;

  return to_jsonb(v_row);
end; $fn$;

grant execute on function public.partner_lead_select_grade(uuid, text, boolean) to anon, authenticated;

-- ── 4. 관리자 온보딩 전이 — APPROVE 시 사업자등록증 필수(없으면 승인 불가) ──
create or replace function public.partner_lead_onboarding_set(
  p_admin_id text,
  p_lead_id  uuid,
  p_action   text
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

  if p_action not in ('CONFIRM_DEPOSIT','APPROVE','REJECT') then
    raise exception 'INVALID_ACTION: %', coalesce(p_action, '(null)');
  end if;

  select * into v_row from public.partner_leads where id = p_lead_id;
  if v_row.id is null then raise exception 'LEAD_NOT_FOUND: %', p_lead_id; end if;

  if p_action = 'CONFIRM_DEPOSIT' then
    if v_row.onboarding_status <> 'PENDING_DEPOSIT' then
      raise exception 'BAD_TRANSITION: % -> AWAITING_APPROVAL', v_row.onboarding_status;
    end if;
    update public.partner_leads set
      onboarding_status   = 'AWAITING_APPROVAL',
      deposit_confirmed_at = now(),
      updated_at          = now()
    where id = p_lead_id returning * into v_row;

  elsif p_action = 'APPROVE' then
    if v_row.onboarding_status <> 'AWAITING_APPROVAL' then
      raise exception 'BAD_TRANSITION: % -> APPROVED', v_row.onboarding_status;
    end if;
    if v_row.guarantee_grade is null or v_row.guarantee_amount is null then
      raise exception 'APPROVE_REQUIRES_GRADE_AND_AMOUNT';
    end if;
    if v_row.business_license_url is null then            -- V1.3: 사업자등록증 필수
      raise exception 'APPROVE_REQUIRES_BUSINESS_LICENSE';
    end if;
    update public.partner_leads set
      onboarding_status = 'APPROVED',
      status            = 'APPROVED',
      approved_at       = now(),
      processed_at      = now(),
      processed_by      = p_admin_id,
      updated_at        = now()
    where id = p_lead_id returning * into v_row;

  else -- REJECT
    update public.partner_leads set
      onboarding_status = 'REJECTED',
      status            = 'REJECTED',
      processed_at      = now(),
      processed_by      = p_admin_id,
      updated_at        = now()
    where id = p_lead_id returning * into v_row;
  end if;

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, after_val, reason)
    values (v_admin_uuid, 'PARTNER_ONBOARDING_' || p_action, 'partner_lead', p_lead_id,
            jsonb_build_object('onboarding_status', v_row.onboarding_status,
                               'status', v_row.status), null);
  exception when others then null;
  end;

  return to_jsonb(v_row);
end; $fn$;

grant execute on function public.partner_lead_onboarding_set(text, uuid, text) to anon, authenticated;

-- ── 5. 최초 로그인 브릿지 claim — 파일 url 2개 추가 반환(company 복사용) ────
create or replace function public.partner_lead_claim_for_company(
  p_phone text
) returns jsonb
language plpgsql stable security definer
set search_path = public, extensions as $fn$
declare
  v_phone text;
  v_row   public.partner_leads;
begin
  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  if v_phone is null then return null; end if;

  select * into v_row from public.partner_leads l
   where regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = v_phone
     and l.onboarding_status = 'APPROVED'
     and l.company_id is null
   order by l.approved_at desc nulls last, l.created_at desc
   limit 1;

  if v_row.id is null then return null; end if;

  return jsonb_build_object(
    'lead_id',              v_row.id,
    'company_name',         v_row.company_name,
    'owner_name',           v_row.owner_name,
    'business_number',      v_row.business_number,
    'service_area',         v_row.service_area,
    'specialty',            v_row.specialty,
    'insurance_yn',         v_row.insurance_yn,
    'guarantee_grade',      v_row.guarantee_grade,
    'guarantee_amount',     v_row.guarantee_amount,
    'business_license_url', v_row.business_license_url,
    'insurance_file_url',   v_row.insurance_file_url
  );
end; $fn$;

grant execute on function public.partner_lead_claim_for_company(text) to anon, authenticated;

-- ── 6. 상담관리 목록 RPC — 파일 url 2개 키 추가(관리자 서류 보기용) ───────
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
      'insurance_file_url',   l.insurance_file_url
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
