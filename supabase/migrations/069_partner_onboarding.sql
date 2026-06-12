-- ════════════════════════════════════════════════════════════════════
-- 069_partner_onboarding.sql
-- 업체 무인 온보딩 FSM v2 — partner_leads 에만 추가(068/companies 무접촉).
--
-- 흐름: 업체 랜딩 → 가입상담(partner_lead_submit, 065) → 공간보증 등급 선택 →
--   입금안내(Mock) → 입금대기 → 관리자 입금확인/승인 → (신청자 최초 OTP 로그인 시)
--   companies 자동 생성 + guarantee/insurance 복사 → 068 GuaranteeCard 활성.
--
-- 설계 원칙(지시서 확정):
--   · 온보딩 상태/등급/예치금/보험여부는 partner_leads 에만 저장. companies 선생성 금지.
--   · company 생성은 신청자 최초 로그인 시점 1회(기존 MainApp owner_id 로직 재사용).
--     069 는 그 브릿지용 조회/클레임 RPC만 제공(여기서 companies INSERT 안 함).
--   · 068(guarantee_status/companies)·company_status·doc_status·badge·deposit_amount 무변경.
--   · 예치금 = 등급기본액 × (insurance_yn ? 1 : 2). 보험 미가입 2배.
--   · 입금/토스 실제 연동 없음 — Mock 계좌정보만 저장/표시.
--
-- 안전성(회귀 금지): partner_leads 컬럼 추가(additive) + 신규 RPC 4개 + 목록 RPC 재정의(additive).
--   기존 컬럼/RPC/정책 무변경. 멱등. Supabase SQL Editor 에서 1회 실행(065·068 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1. partner_leads 컬럼 추가 (additive only) ────────────────────────
alter table public.partner_leads add column if not exists insurance_yn       boolean;
alter table public.partner_leads add column if not exists guarantee_grade    text;
alter table public.partner_leads add column if not exists guarantee_amount   integer;     -- 만원 단위(보험 2배 반영 후 최종액)
alter table public.partner_leads add column if not exists onboarding_status  text not null default 'PENDING_DOCS';
alter table public.partner_leads add column if not exists deposit_bank       text;
alter table public.partner_leads add column if not exists deposit_account    text;
alter table public.partner_leads add column if not exists deposit_owner      text;
alter table public.partner_leads add column if not exists deposit_confirmed_at timestamptz;
alter table public.partner_leads add column if not exists approved_at        timestamptz;
alter table public.partner_leads add column if not exists order_id           text;
alter table public.partner_leads add column if not exists company_id         uuid;        -- 브릿지: 최초 로그인 시 생성된 company (중복 복사 차단)

-- ── 2. CHECK 제약 ─────────────────────────────────────────────────────
alter table public.partner_leads drop constraint if exists partner_leads_onboarding_status_check;
alter table public.partner_leads add constraint partner_leads_onboarding_status_check
  check (onboarding_status in ('PENDING_DOCS','PENDING_DEPOSIT','AWAITING_APPROVAL','APPROVED','REJECTED'));

alter table public.partner_leads drop constraint if exists partner_leads_guarantee_grade_check;
alter table public.partner_leads add constraint partner_leads_guarantee_grade_check
  check (guarantee_grade is null or guarantee_grade in ('BASIC','STANDARD','PREMIUM','MASTER','SIGNATURE'));

create index if not exists idx_partner_leads_onboarding on public.partner_leads (onboarding_status, created_at desc);

-- 등급 → 기본 예치금(만원). 068 _guarantee_amount 의존 회피 위해 069 내 인라인.
create or replace function public._partner_base_amount(p_grade text)
returns integer language sql immutable as $fn$
  select case p_grade
    when 'BASIC'     then 50
    when 'STANDARD'  then 100
    when 'PREMIUM'   then 200
    when 'MASTER'    then 500
    when 'SIGNATURE' then 1000
    else null end;
$fn$;

-- ── 3. RPC: 공간보증 등급 선택 (STEP2, anon — 비로그인 신청자) ─────────
-- 가입상담 직후 lead 에 등급/예치금(보험 2배 분기)/보험여부 저장 + Mock 입금정보 생성.
-- onboarding_status PENDING_DOCS/PENDING_DEPOSIT 에서만 선택/변경 허용(입금확인 후 잠금).
create or replace function public.partner_lead_select_grade(
  p_lead_id      uuid,
  p_grade        text,
  p_insurance_yn boolean default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_row      public.partner_leads;
  v_base     integer;
  v_amount   integer;
  v_insured  boolean;
begin
  if p_lead_id is null then raise exception 'LEAD_REQUIRED'; end if;
  if p_grade not in ('BASIC','STANDARD','PREMIUM','MASTER','SIGNATURE') then
    raise exception 'INVALID_GRADE: %', coalesce(p_grade, '(null)');
  end if;

  select * into v_row from public.partner_leads where id = p_lead_id;
  if v_row.id is null then raise exception 'LEAD_NOT_FOUND: %', p_lead_id; end if;

  -- 입금확인(AWAITING_APPROVAL) 이후에는 등급 변경 차단(관리자 흐름 보호).
  if v_row.onboarding_status not in ('PENDING_DOCS','PENDING_DEPOSIT') then
    raise exception 'ONBOARDING_LOCKED: %', v_row.onboarding_status;
  end if;

  -- 보험여부: 인자 우선, 미지정 시 기존 lead 값(없으면 insurance_status='가입' 매핑).
  v_insured := coalesce(p_insurance_yn, v_row.insurance_yn, v_row.insurance_status = '가입', false);

  v_base   := public._partner_base_amount(p_grade);
  v_amount := v_base * (case when v_insured then 1 else 2 end);  -- 보험 미가입 2배

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

-- ── 4. RPC: 관리자 온보딩 전이 (STEP4~5, admin sentinel — 065 패턴) ────
-- p_action: CONFIRM_DEPOSIT(입금확인→AWAITING_APPROVAL) / APPROVE(승인→APPROVED)
--           / REJECT(반려→REJECTED). APPROVE 시 status='APPROVED'(V1.2 로그인 게이트 연동).
-- company 생성은 여기서 하지 않음(최초 로그인 시 브릿지). admin_logs 는 best-effort.
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
    update public.partner_leads set
      onboarding_status = 'APPROVED',
      status            = 'APPROVED',          -- V1.2 승인업체 로그인 게이트 통과 조건
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

  -- 감사 로그 — best-effort(로그 실패가 본 처리를 rollback 시키지 않도록 격리).
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

-- ── 5. RPC: 최초 로그인 브릿지 — 승인된 미클레임 lead 조회 (anon) ──────
-- 신청자 OTP 로그인 시 phone 일치 APPROVED & company_id IS NULL lead 의
-- guarantee/insurance 를 반환(없으면 null). 숫자만 비교(표기차이 무시).
-- 여기서 companies 를 만들지 않는다(생성은 클라이언트 기존 upsertCompany).
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
    'lead_id',          v_row.id,
    'company_name',     v_row.company_name,
    'owner_name',       v_row.owner_name,
    'business_number',  v_row.business_number,
    'service_area',     v_row.service_area,
    'specialty',        v_row.specialty,
    'insurance_yn',     v_row.insurance_yn,
    'guarantee_grade',  v_row.guarantee_grade,
    'guarantee_amount', v_row.guarantee_amount
  );
end; $fn$;

grant execute on function public.partner_lead_claim_for_company(text) to anon, authenticated;

-- ── 6. RPC: 클레임 확정 — company_id 기록(재복사 차단, idempotent) ─────
-- 클라이언트가 company 생성/복사 완료 후 호출. 이미 클레임됐으면 변경 없음.
create or replace function public.partner_lead_mark_claimed(
  p_lead_id    uuid,
  p_company_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_row public.partner_leads;
begin
  if p_lead_id is null or p_company_id is null then
    raise exception 'LEAD_AND_COMPANY_REQUIRED';
  end if;

  update public.partner_leads set
    company_id = p_company_id,
    updated_at = now()
  where id = p_lead_id and company_id is null   -- idempotent: 최초 1회만
  returning * into v_row;

  return jsonb_build_object('claimed', v_row.id is not null, 'lead_id', p_lead_id);
end; $fn$;

grant execute on function public.partner_lead_mark_claimed(uuid, uuid) to anon, authenticated;

-- ── 7. 목록 RPC 재정의 (additive — 온보딩 필드 키 추가, 065 파일 미수정) ─
-- 기존 키 전부 유지 + guarantee/onboarding 필드 추가. 기존 소비자(상담관리 탭)는 추가 키 무시.
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
      -- 069 온보딩 필드(additive)
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
      'company_id',        l.company_id
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
