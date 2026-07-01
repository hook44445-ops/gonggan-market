-- ════════════════════════════════════════════════════════════════════
-- 089_resolve_contract_id_rpc.sql
-- 고객이 등록한 추가견적(change order)이 '업체 화면'에 연결되지 않던 원인 수정.
--
-- 원인:
--   · 추가견적은 contract_id(= escrow_payments.id) 로 저장/조회된다.
--   · 업체가 공사 안전 결제(EscrowScreen)에 진입할 때 contract_id 를 알아야
--     ChangeOrderPanel 이 렌더되고 change_orders_for_contract 로 요청을 볼 수 있다.
--   · 그런데 contract_id 해석 경로(getEscrowByRequest / getPaymentOrderByRequest 등)는
--     escrow_payments·payment_orders 의 auth.uid() 기반 RLS 에 막힌다(이 앱은 anon key +
--     Twilio OTP → auth.uid() 항상 NULL). 특히 대시보드에서 진입한 업체는 contract_id 를
--     prop 으로도 못 받아 resolvedContractId 가 null → 패널 자체가 렌더되지 않았다.
--
-- 수정:
--   · resolve_contract_id(p_request_id, p_actor_id) — security-definer 로 RLS 를 우회하되,
--     호출자(actor)가 해당 계약의 '의뢰인' 또는 '업체 소유자'일 때만 계약 정보를 돌려준다
--     (change_orders 의 _change_order_role 과 동일한 당사자 검증 방식).
--   · 반환은 jsonb — { contract_id, customer_id, company_owner_id }. 업체가 대시보드로
--     진입해 request/customer 정보가 없을 때도 고객에게 상태변경 알림을 보낼 수 있게 한다.
--   · 결제/에스크로 금액·구조·기존 RLS 무변경(조회 헬퍼 1개만 추가, additive).
--
-- Supabase SQL Editor 에서 1회 실행(088 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.resolve_contract_id(p_request_id uuid, p_actor_id uuid)
returns jsonb language sql stable security definer
set search_path = public, extensions as $$
  select jsonb_build_object(
           'contract_id',      ep.id,
           'customer_id',      r.user_id,
           'company_owner_id', c.owner_id
         )
    from public.escrow_payments ep
    left join public.requests  r on r.id = ep.request_id
    left join public.companies c on c.id = ep.company_id
   where ep.request_id = p_request_id
     and p_actor_id is not null
     and (r.user_id = p_actor_id or c.owner_id = p_actor_id)
   order by ep.created_at desc
   limit 1;
$$;

grant execute on function public.resolve_contract_id(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
