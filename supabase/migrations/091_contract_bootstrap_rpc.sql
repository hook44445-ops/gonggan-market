-- ════════════════════════════════════════════════════════════════════
-- 091_contract_bootstrap_rpc.sql
-- 에스크로 안전정산 화면이 '계약 정보를 불러올 수 없습니다'로 빠지던 문제 수정.
--
-- 원인:
--   · 추가견적/계약 알림(related_type='contract')의 related_id 는 '계약(escrow.id)'인데,
--     알림 라우팅이 이를 requestId 로 오인해 전달 → EscrowScreen 이 request/bid/contract
--     를 아무것도 못 잡고 fallback('계약 정보를 불러올 수 없습니다')로 빠졌다.
--   · 라우팅은 앱에서 contractId 로 정확히 넘기도록 고쳤고(notify/openNotificationTarget),
--     이제 업체가 contract_id 만 들고 진입해도 화면이 계약을 복원할 수 있어야 한다.
--   · 그러나 escrow_payments 는 auth.uid() 기반 RLS(이 앱은 anon+OTP → NULL)에 막혀
--     클라이언트에서 escrow.id → request_id 역방향 조회가 불가.
--
-- 수정:
--   · contract_bootstrap(p_contract_id, p_actor_id) — security-definer 로 당사자
--     (의뢰인/업체 소유자) 검증 후 { request_id, company_id, customer_id,
--     company_owner_id } 반환. 화면은 이 request_id 로 bids(public read)를 조회해
--     계약 정보를 정상 복원한다.
--   · 결제/에스크로 금액·구조·기존 RLS 무변경(조회 헬퍼 1개만 추가, additive).
--
-- Supabase SQL Editor 에서 1회 실행(090 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.contract_bootstrap(p_contract_id uuid, p_actor_id uuid)
returns jsonb language sql stable security definer
set search_path = public, extensions as $$
  select jsonb_build_object(
           'request_id',       ep.request_id,
           'company_id',       ep.company_id,
           'customer_id',      r.user_id,
           'company_owner_id', c.owner_id
         )
    from public.escrow_payments ep
    left join public.requests  r on r.id = ep.request_id
    left join public.companies c on c.id = ep.company_id
   where ep.id = p_contract_id
     and p_actor_id is not null
     and (r.user_id = p_actor_id or c.owner_id = p_actor_id)
   limit 1;
$$;

grant execute on function public.contract_bootstrap(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
