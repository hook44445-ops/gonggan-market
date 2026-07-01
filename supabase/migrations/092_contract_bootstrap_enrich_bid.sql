-- 092_contract_bootstrap_enrich_bid.sql
-- 091 후속 보강. 업체가 계약 알림(contract_id만)으로 에스크로 진입 시
-- '시공 현황을 불러오지 못했습니다'(=화면의 !resolvedBid) 를 근본적으로 없앤다.
--
-- [배경] 화면(EscrowScreen)은 총 계약금액을 resolvedBid.price 로 표시하고, resolvedBid
--   가 없으면 에러 화면을 띄운다. 알림 진입 시 resolvedBid 는 getBidsForRequest 결과에서
--   계약 업체 입찰을 매칭해 복원하는데, 그 요청에 매칭 입찰 행이 없거나(데이터 엣지)
--   매칭이 애매하면 복원에 실패한다.
--
-- [수정] contract_bootstrap 이 계약 당사자 검증(security-definer) 후, 계약의 업체 입찰
--   (request_id + company_id 로 매칭)까지 함께 반환한다. 화면은 입찰목록 매칭 실패 시
--   이 반환값(bid_id/price/period/material/comment)으로 resolvedBid 를 복원한다.
--   금액 계산/에스크로/결제 로직은 변경하지 않는다(반환 데이터만 확장).

create or replace function public.contract_bootstrap(p_contract_id uuid, p_actor_id uuid)
returns jsonb language sql stable security definer
set search_path = public, extensions as $$
  select jsonb_build_object(
           'request_id',       ep.request_id,
           'company_id',       ep.company_id,
           'customer_id',      r.user_id,
           'company_owner_id', c.owner_id,
           -- 계약 업체 입찰(추가 반환) — 화면 resolvedBid 복원용(price 포함)
           'bid_id',           b.id,
           'bid_price',        b.price,
           'bid_period',       b.period_days,
           'bid_material',     b.material_note,
           'bid_comment',      b.comment,
           'bid_selected',     b.selected
         )
    from public.escrow_payments ep
    left join public.requests  r on r.id = ep.request_id
    left join public.companies c on c.id = ep.company_id
    left join public.bids      b on b.request_id = ep.request_id
                                and b.company_id = ep.company_id
   where ep.id = p_contract_id
     and p_actor_id is not null
     and (r.user_id = p_actor_id or c.owner_id = p_actor_id)
   limit 1;
$$;

grant execute on function public.contract_bootstrap(uuid, uuid) to anon, authenticated;
