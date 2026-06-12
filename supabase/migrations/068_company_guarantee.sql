-- ════════════════════════════════════════════════════════════════════
-- 068_company_guarantee.sql
-- 공간보증(Guarantee) 5단계 + 무인 온보딩 상태머신 — companies 컬럼 추가.
--
-- 목적: 업체 가입 → 공간보증 등급 선택 → 예치금 입금 → 관리자 확인/승인 →
--   공간보증 배지 활성화. (토스/가상계좌/자동입금 없음 — 관리자 수동 확인 기반)
--
-- 설계(지시서 확정):
--   · companies 에 guarantee_* 컬럼만 추가(별도 company_guarantees 테이블 생성 금지).
--   · guarantee_status FSM 은 doc_status / company_status 와 **완전 분리**.
--     기존 입찰 게이트(company_status='ACTIVE')·서류게이트(doc_status)·기존 badge/
--     deposit_amount 컬럼 일절 미변경. guarantee 는 표시/관리용 독립 상태.
--   · 등급별 예치금(만원): BASIC 50 / STANDARD 100 / PREMIUM 200 / MASTER 500 / SIGNATURE 1000.
--
-- 안전성(회귀 금지): 컬럼 추가(additive) + 신규 RPC 2개. 기존 RPC/정책/컬럼 무변경. 멱등.
-- Supabase SQL Editor 에서 1회 실행(067 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1. 컬럼 추가 (additive only) ──────────────────────────────────────
alter table public.companies add column if not exists guarantee_grade         text;
alter table public.companies add column if not exists guarantee_amount        integer;      -- 만원 단위
alter table public.companies add column if not exists guarantee_status        text not null default 'NONE';
alter table public.companies add column if not exists guarantee_badge_visible boolean not null default false;
alter table public.companies add column if not exists guarantee_updated_at     timestamptz;

alter table public.companies drop constraint if exists companies_guarantee_grade_check;
alter table public.companies add constraint companies_guarantee_grade_check
  check (guarantee_grade is null or guarantee_grade in ('BASIC','STANDARD','PREMIUM','MASTER','SIGNATURE'));

alter table public.companies drop constraint if exists companies_guarantee_status_check;
alter table public.companies add constraint companies_guarantee_status_check
  check (guarantee_status in ('NONE','PENDING_DEPOSIT','DEPOSIT_CONFIRMED','AWAITING_APPROVAL','ACTIVE'));

create index if not exists idx_companies_guarantee_status on public.companies (guarantee_status);

-- 등급 → 예치금(만원) 매핑 헬퍼.
create or replace function public._guarantee_amount(p_grade text)
returns integer language sql immutable as $fn$
  select case p_grade
    when 'BASIC'     then 50
    when 'STANDARD'  then 100
    when 'PREMIUM'   then 200
    when 'MASTER'    then 500
    when 'SIGNATURE' then 1000
    else null end;
$fn$;

-- ── 2. 업체 등급 선택 RPC (소유자 전용) ────────────────────────────────
-- 등급 선택 시 예치금 자동 계산 + guarantee_status='PENDING_DEPOSIT'.
-- 입금확인(DEPOSIT_CONFIRMED) 이후에는 변경 불가(관리자 흐름 보호).
create or replace function public.company_guarantee_select(
  p_actor_id   uuid,
  p_company_id uuid,
  p_grade      text
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_row    public.companies;
  v_amount integer;
begin
  if p_actor_id is null or p_company_id is null then
    raise exception 'ACTOR_AND_COMPANY_REQUIRED';
  end if;
  if p_grade not in ('BASIC','STANDARD','PREMIUM','MASTER','SIGNATURE') then
    raise exception 'INVALID_GRADE: %', coalesce(p_grade, '(null)');
  end if;

  -- 소유자 검증.
  select * into v_row from public.companies
   where id = p_company_id and owner_id = p_actor_id;
  if v_row.id is null then raise exception 'NOT_COMPANY_OWNER'; end if;

  -- 입금확인 이후 등급 변경 차단(NONE/PENDING_DEPOSIT 에서만 선택/변경 허용).
  if v_row.guarantee_status not in ('NONE','PENDING_DEPOSIT') then
    raise exception 'GUARANTEE_LOCKED: %', v_row.guarantee_status;
  end if;

  v_amount := public._guarantee_amount(p_grade);

  update public.companies set
    guarantee_grade      = p_grade,
    guarantee_amount     = v_amount,
    guarantee_status     = 'PENDING_DEPOSIT',
    guarantee_updated_at = now()
  where id = p_company_id
  returning * into v_row;

  return to_jsonb(v_row);
end; $fn$;

grant execute on function public.company_guarantee_select(uuid, uuid, text) to anon, authenticated;

-- ── 3. 관리자 상태변경 RPC (admin sentinel — 058/065 패턴) ─────────────
-- 입금확인/승인/배지숨김/출금(NONE) 등 FSM 전이. company_status 와 무관(분리).
--   · p_status: NONE|PENDING_DEPOSIT|DEPOSIT_CONFIRMED|AWAITING_APPROVAL|ACTIVE
--   · p_badge_visible: 명시 시 그 값으로. 미지정 시 ACTIVE→true / NONE→false 자동.
create or replace function public.admin_set_guarantee(
  p_admin_id      text,
  p_company_id    uuid,
  p_status        text    default null,
  p_badge_visible boolean default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_admin_uuid uuid;
  v_row        public.companies;
  v_visible    boolean;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY: uuid % is not admin', p_admin_id;
    end if;
  elsif lower(coalesce(trim(p_admin_id), '')) <> 'admin' then
    raise exception 'ADMIN_ONLY: got %', coalesce(p_admin_id, '(null)');
  end if;

  if p_status is not null and p_status not in
     ('NONE','PENDING_DEPOSIT','DEPOSIT_CONFIRMED','AWAITING_APPROVAL','ACTIVE') then
    raise exception 'INVALID_STATUS: %', p_status;
  end if;

  -- ACTIVE 전환 가드: 등급/예치금 없이 ACTIVE 금지(잘못된 배지 활성화 방지).
  --   guarantee_grade / guarantee_amount 는 admin_set_guarantee 가 바꾸지 않으므로
  --   현재 companies 행 값으로 검증한다.
  if p_status = 'ACTIVE' then
    select * into v_row from public.companies where id = p_company_id;
    if v_row.id is null then raise exception 'COMPANY_NOT_FOUND: %', p_company_id; end if;
    if v_row.guarantee_grade is null or v_row.guarantee_amount is null then
      raise exception 'GUARANTEE_REQUIRES_GRADE_AND_AMOUNT';
    end if;
  end if;

  v_visible := p_badge_visible;
  if v_visible is null and p_status = 'ACTIVE' then v_visible := true;  end if;
  if v_visible is null and p_status = 'NONE'   then v_visible := false; end if;

  update public.companies set
    guarantee_status        = coalesce(p_status, guarantee_status),
    guarantee_badge_visible = coalesce(v_visible, guarantee_badge_visible),
    guarantee_updated_at    = now()
  where id = p_company_id
  returning * into v_row;

  if v_row.id is null then raise exception 'COMPANY_NOT_FOUND: %', p_company_id; end if;

  -- 감사 로그 — best-effort. admin_logs insert 실패가 guarantee 상태변경 자체를
  --   rollback 시키지 않도록 서브트랜잭션으로 격리한다(본 처리 보호).
  --   컬럼/타입은 기존 admin_logs 구조와 동일(admin_id uuid 는 sentinel 'admin' 일 때
  --   NULL — 053 패턴과 일치, nullable).
  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, after_val, reason)
    values (v_admin_uuid, 'SET_GUARANTEE', 'company', p_company_id,
            jsonb_build_object('guarantee_status', v_row.guarantee_status,
                               'guarantee_badge_visible', v_row.guarantee_badge_visible), null);
  exception when others then
    null; -- 로그 실패는 무시
  end;

  return to_jsonb(v_row);
end; $fn$;

grant execute on function public.admin_set_guarantee(text, uuid, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
