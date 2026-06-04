-- ════════════════════════════════════════════════════════════════════
-- 034_change_order_payment_admin.sql  (3차 PR — 추가견적 결제 연결 + 관리자 조회)
-- 추가견적(Change Order) 실제 결제 연동 준비 + 관리자 조회 RPC.
--
-- 배경(033 이후):
--   추가견적 결제는 MVP 에서 change_order_mark_paid(approved→paid) 만으로 처리했고
--   결제주문(payment_order)이 없었다. 이번엔 원계약 escrow 결제와 분리된 결제주문을
--   남긴다(payment_source='change_order', change_order_id). 결제주문 컬럼은 031 에서
--   이미 추가됨(provider/payment_source/change_order_id/fee_amount/net_amount/raw_response/paid_at).
--
-- 본 마이그레이션:
--   1) payment_orders(change_order_id) 부분 인덱스 — 추가견적 결제주문 조회 가속.
--   2) admin_change_orders_for_contract(p_admin_id, p_contract_id) — 관리자 전용 조회 RPC.
--      · 기존 change_orders_for_contract 는 계약 당사자용. 관리자 화면(계약/분쟁/정산 상세)은
--        admin 만 조회 가능해야 하므로 role='admin' 을 함수 내부에서 검증한다.
--      · operator(라운지 운영자)는 admin 이 아니므로 0행 반환(추가견적/결제/정산 상세 조회 불가).
--
-- 멱등 · 추가 전용 · 자동 송금/환불/정산 없음. Supabase SQL Editor 에서 1회 실행(033 다음).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1) 추가견적 결제주문 조회 인덱스 ─────────────────────────────────
create index if not exists payment_orders_change_order_id_idx
  on public.payment_orders (change_order_id)
  where change_order_id is not null;

-- ── 2) 관리자 전용 추가견적 조회 (role=admin 검증, operator 차단) ─────
create or replace function public.admin_change_orders_for_contract(
  p_admin_id uuid, p_contract_id uuid
) returns setof public.change_orders language sql stable security definer
set search_path = public, extensions as $$
  select co.* from public.change_orders co
   where co.contract_id = p_contract_id
     and exists (select 1 from public.users u where u.id = p_admin_id and u.role = 'admin')
   order by co.created_at desc;
$$;

grant execute on function public.admin_change_orders_for_contract(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
