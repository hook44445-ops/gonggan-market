-- ════════════════════════════════════════════════════════════════════
-- 072_settlement_admin_state.sql
-- 정산관리 고도화(ADMIN V2.2) — 거래(계약) 단위 정산 관리상태 + 메모 저장.
--
-- 목적: 관리자가 "업체에게 얼마를 지급해야 하는지"를 거래 단위로 관리.
--       지급승인/지급보류/완료수동표시/정산취소 상태와 메모(보류사유·지급완료·
--       내부)를 저장한다. 조회/표시 중심이며 실제 송금·환불·출금은 없다.
--
-- 계약(거래) 식별자 = escrow_payments.id
--   (admin_project_flow_list 의 escrow.id 와 동일 — RPC 미수정, 참조만).
--
-- 원칙:
--  · 표시/상태/메모만 저장 — 실제 자동송금/환불/PG지급/계좌출금 없음.
--  · DB hard delete 없음(취소는 status='CANCELLED' 소프트 표시).
--  · 기존 escrow_payments / escrow_payouts / admin_project_flow_list 미수정.
--  · admin(role='admin') 만 호출 성공. RLS 직접접근 차단 → security definer RPC 경유.
--  · 파생 상태(READY/PAID/CANCELLED/DISPUTE)는 escrow 단계값에서 프론트 파생.
--    이 테이블은 관리자 '오버라이드' 상태(APPROVED/HELD/PAID/CANCELLED)와 메모만 보관.
--  · 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(071 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1) 테이블 ──────────────────────────────────────────────────────────
create table if not exists public.settlement_admin_state (
  contract_id   uuid primary key,        -- = escrow_payments.id
  status        text not null default 'READY'
                check (status in ('READY','APPROVED','HELD','PAID','CANCELLED')),
  hold_reason   text,
  paid_memo     text,
  internal_memo text,
  updated_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS 활성화 + 정책 미생성 → 클라이언트 직접 접근 차단, security definer RPC 만 접근.
alter table public.settlement_admin_state enable row level security;

-- ── 2) 목록 조회(admin 전용) ───────────────────────────────────────────
create or replace function public.settlement_admin_list(p_admin_id uuid)
returns table (
  contract_id uuid, status text, hold_reason text, paid_memo text,
  internal_memo text, updated_by uuid, updated_at timestamptz
)
language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  return query
    select s.contract_id, s.status, s.hold_reason, s.paid_memo,
           s.internal_memo, s.updated_by, s.updated_at
      from public.settlement_admin_state s;
end; $$;

-- ── 3) 상태 변경(지급승인/보류/완료수동/취소/대기) ─────────────────────
create or replace function public.settlement_admin_set_status(
  p_admin_id uuid, p_contract_id uuid, p_status text, p_reason text default null
)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_prev text;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  if p_status not in ('READY','APPROVED','HELD','PAID','CANCELLED') then
    raise exception 'INVALID_STATUS';
  end if;
  if p_contract_id is null then raise exception 'CONTRACT_REQUIRED'; end if;

  select status into v_prev from public.settlement_admin_state where contract_id = p_contract_id;

  insert into public.settlement_admin_state (contract_id, status, hold_reason, updated_by, updated_at)
  values (p_contract_id, p_status,
          case when p_status = 'HELD' then p_reason else null end,
          p_admin_id, now())
  on conflict (contract_id) do update
     set status      = excluded.status,
         hold_reason = case when excluded.status = 'HELD' then excluded.hold_reason
                            else public.settlement_admin_state.hold_reason end,
         updated_by  = excluded.updated_by,
         updated_at  = now();

  -- 감사 로그(best-effort — 실패해도 상태 변경은 유지)
  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, before_val, after_val, reason)
    values (p_admin_id, 'SETTLEMENT_SET_STATUS', 'settlement', p_contract_id,
            jsonb_build_object('status', v_prev),
            jsonb_build_object('status', p_status),
            p_reason);
  exception when others then null;
  end;

  return jsonb_build_object('contract_id', p_contract_id, 'status', p_status);
end; $$;

-- ── 4) 메모 저장(보류사유/지급완료/내부) ───────────────────────────────
create or replace function public.settlement_admin_save_memo(
  p_admin_id uuid, p_contract_id uuid,
  p_hold_reason text default null, p_paid_memo text default null, p_internal_memo text default null
)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  if p_contract_id is null then raise exception 'CONTRACT_REQUIRED'; end if;

  insert into public.settlement_admin_state
    (contract_id, hold_reason, paid_memo, internal_memo, updated_by, updated_at)
  values (p_contract_id, p_hold_reason, p_paid_memo, p_internal_memo, p_admin_id, now())
  on conflict (contract_id) do update
     set hold_reason   = excluded.hold_reason,
         paid_memo     = excluded.paid_memo,
         internal_memo = excluded.internal_memo,
         updated_by    = excluded.updated_by,
         updated_at    = now();

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, after_val, reason)
    values (p_admin_id, 'SETTLEMENT_SAVE_MEMO', 'settlement', p_contract_id,
            jsonb_build_object('hold_reason', p_hold_reason, 'paid_memo', p_paid_memo, 'internal_memo', p_internal_memo),
            null);
  exception when others then null;
  end;

  return jsonb_build_object('contract_id', p_contract_id, 'saved', true);
end; $$;

grant execute on function public.settlement_admin_list(uuid)                         to anon, authenticated;
grant execute on function public.settlement_admin_set_status(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.settlement_admin_save_memo(uuid, uuid, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
