-- ════════════════════════════════════════════════════════════════════
-- 033_change_orders_policy.sql
-- 추가견적(Change Order) — 예외 흐름 정책 구현.
--
-- 철학: 기본 흐름(현장방문→최종견적 확정→계약→공사→완료)에서 견적을 최대한 확정.
--   추가견적은 ① 숨은 하자 ② 고객 변경요청 ③ 구조 변경 ④ 불가피한 현장 이슈
--   에만 쓰는 예외 프로세스. 일반 기능처럼 노출하지 않음.
--
-- 본 마이그레이션:
--   · 기존 change_orders(스키마 정의·미사용) 확장 — reason_type/사진/확장 상태/별도 정산 타임스탬프.
--   · 모든 쓰기는 security-definer RPC(OTP 커스텀 인증 auth.uid()=null → 직접 쓰기 RLS 차단).
--     RPC 내부에서 p_actor_id 가 계약의 업체 소유자/의뢰인인지 검증(양방향 생성, 승인은 의뢰인).
--   · 정산: 원계약(10/20/40/30)과 분리. 추가견적은 승인+추가결제+추가공사완료 후 100% (별도).
--   · 신뢰 데이터: companies.change_order_count(발생 건수) 구조 유지(현재 UI 미노출).
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(032 다음).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ────────────────────────────────────────────────────────────────────
-- 0. change_orders 확장 (멱등)
-- ────────────────────────────────────────────────────────────────────
alter table public.change_orders
  add column if not exists reason_type   text,
  add column if not exists photos        text[] default '{}',
  add column if not exists paid_at        timestamptz,
  add column if not exists completed_at   timestamptz,
  add column if not exists settled_at     timestamptz,
  add column if not exists cancelled_at   timestamptz;

-- reason_type 제약 (예외 사유만 허용)
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.change_orders'::regclass and conname = 'change_orders_reason_type_check'
  ) then
    alter table public.change_orders
      add constraint change_orders_reason_type_check check (reason_type is null or reason_type in (
        'hidden_defect','plumbing_issue','electrical_issue','leak_issue',
        'customer_request','material_upgrade','layout_change','etc'
      ));
  end if;
end $$;

-- 상태 확장: PENDING/APPROVED/REJECTED → 소문자 풀 라이프사이클
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.change_orders'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.change_orders drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.change_orders alter column status set default 'requested';

-- 기존 값(있다면) 매핑
update public.change_orders set status = case status
  when 'PENDING'  then 'requested'
  when 'APPROVED' then 'approved'
  when 'REJECTED' then 'rejected'
  else status end
 where status in ('PENDING','APPROVED','REJECTED');

alter table public.change_orders
  add constraint change_orders_status_check check (status in (
    'requested','approved','rejected','payment_pending','paid','completed','cancelled'
  ));

-- 신뢰 데이터(구조만) — 업체별 추가견적 발생 건수
alter table public.companies
  add column if not exists change_order_count integer not null default 0;

-- ────────────────────────────────────────────────────────────────────
-- 1. 검증 헬퍼 — 계약 당사자 역할
-- ────────────────────────────────────────────────────────────────────
create or replace function public._change_order_role(p_contract_id uuid, p_actor_id uuid)
returns text language sql stable security definer
set search_path = public, extensions as $$
  select case
    when p_actor_id is null then null
    when exists (select 1 from public.escrow_payments ep join public.companies c on c.id = ep.company_id
                  where ep.id = p_contract_id and c.owner_id = p_actor_id) then 'company'
    when exists (select 1 from public.escrow_payments ep join public.requests r on r.id = ep.request_id
                  where ep.id = p_contract_id and r.user_id = p_actor_id) then 'consumer'
    else null end;
$$;

-- ────────────────────────────────────────────────────────────────────
-- 2. 생성 (업체/고객 양방향) → requested
-- ────────────────────────────────────────────────────────────────────
create or replace function public.change_order_create(
  p_actor_id uuid, p_contract_id uuid, p_role text, p_reason_type text,
  p_description text, p_amount integer, p_photos text[]
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_role text; v_row public.change_orders;
begin
  v_role := public._change_order_role(p_contract_id, p_actor_id);
  if v_role is null then raise exception 'NOT_CONTRACT_PARTY'; end if;
  if p_role is distinct from v_role then raise exception 'ROLE_MISMATCH'; end if;
  if p_reason_type is null or length(coalesce(p_description,'')) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;

  insert into public.change_orders (
    contract_id, requested_by, requested_by_role, reason_type, description,
    amount, photos, status, created_at, updated_at
  ) values (
    p_contract_id, p_actor_id, p_role, p_reason_type, p_description,
    coalesce(p_amount, 0), coalesce(p_photos, '{}'), 'requested', now(), now()
  ) returning * into v_row;

  -- 신뢰 데이터: 업체별 발생 건수(구조 유지, UI 미노출)
  update public.companies set change_order_count = coalesce(change_order_count, 0) + 1
   where id = (select company_id from public.escrow_payments where id = p_contract_id);

  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 3. 업체 금액 보정 (고객 변경요청에 대한 견적 제시) — requested 상태에서만
-- ────────────────────────────────────────────────────────────────────
create or replace function public.change_order_set_amount(
  p_actor_id uuid, p_id uuid, p_amount integer, p_description text, p_photos text[]
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) <> 'company' then raise exception 'NOT_COMPANY'; end if;

  update public.change_orders set
    amount = coalesce(p_amount, amount),
    description = coalesce(p_description, description),
    photos = coalesce(p_photos, photos),
    updated_at = now()
  where id = p_id and status = 'requested'
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_EDITABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 4. 고객 승인 → approved (확인 체크박스는 클라이언트 필수)
-- ────────────────────────────────────────────────────────────────────
create or replace function public.change_order_approve(p_actor_id uuid, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) <> 'consumer' then raise exception 'NOT_CONSUMER'; end if;

  update public.change_orders set
    status = 'approved', approved_by_customer = true, approved_at = now(), updated_at = now()
  where id = p_id and status = 'requested'
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_APPROVABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 5. 거절 (계약 당사자) — requested/approved 에서
-- ────────────────────────────────────────────────────────────────────
create or replace function public.change_order_reject(p_actor_id uuid, p_id uuid, p_reason text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) is null then raise exception 'NOT_CONTRACT_PARTY'; end if;

  update public.change_orders set
    status = 'rejected', reject_reason = p_reason, updated_at = now()
  where id = p_id and status in ('requested','approved','payment_pending')
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_REJECTABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 6. 추가 결제 완료(고객) → paid
--    MVP: PG 연동 전 결제 성공 시점 호출(별도 결제). 원계약 정산과 분리.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.change_order_mark_paid(p_actor_id uuid, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) <> 'consumer' then raise exception 'NOT_CONSUMER'; end if;

  update public.change_orders set
    status = 'paid', paid_at = now(), updated_at = now()
  where id = p_id and status in ('approved','payment_pending')
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_PAYABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 7. 추가공사 완료(업체) → completed + 100% 정산 마커(별도)
-- ────────────────────────────────────────────────────────────────────
create or replace function public.change_order_complete(p_actor_id uuid, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) <> 'company' then raise exception 'NOT_COMPANY'; end if;

  -- 정산 정책: 추가견적은 결제 완료 + 추가공사 완료 후 100% 지급(원계약과 분리).
  update public.change_orders set
    status = 'completed', completed_at = now(), settled_at = now(), updated_at = now()
  where id = p_id and status = 'paid'
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_COMPLETABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 8. 취소 (생성 당사자/계약 당사자) — 결제 전 단계에서만
-- ────────────────────────────────────────────────────────────────────
create or replace function public.change_order_cancel(p_actor_id uuid, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) is null then raise exception 'NOT_CONTRACT_PARTY'; end if;

  update public.change_orders set
    status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_id and status in ('requested','approved','payment_pending')
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_CANCELLABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 9. 조회 — 계약 단위(읽기도 RLS 차단 → definer 노출)
-- ────────────────────────────────────────────────────────────────────
create or replace function public.change_orders_for_contract(p_contract_id uuid)
returns setof public.change_orders language sql stable security definer
set search_path = public, extensions as $$
  select * from public.change_orders where contract_id = p_contract_id order by created_at desc;
$$;

-- ────────────────────────────────────────────────────────────────────
-- 10. 실행 권한
-- ────────────────────────────────────────────────────────────────────
grant execute on function public.change_order_create(uuid,uuid,text,text,text,integer,text[]) to anon, authenticated;
grant execute on function public.change_order_set_amount(uuid,uuid,integer,text,text[])        to anon, authenticated;
grant execute on function public.change_order_approve(uuid,uuid)                               to anon, authenticated;
grant execute on function public.change_order_reject(uuid,uuid,text)                           to anon, authenticated;
grant execute on function public.change_order_mark_paid(uuid,uuid)                             to anon, authenticated;
grant execute on function public.change_order_complete(uuid,uuid)                             to anon, authenticated;
grant execute on function public.change_order_cancel(uuid,uuid)                               to anon, authenticated;
grant execute on function public.change_orders_for_contract(uuid)                             to anon, authenticated;

notify pgrst, 'reload schema';
