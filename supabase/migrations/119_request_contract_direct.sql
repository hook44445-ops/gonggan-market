-- ════════════════════════════════════════════════════════════════════
-- 119_request_contract_direct.sql  (총점검 09-24 6차 — 대표: 「현장방문 없이 계약 시행 버튼」)
--
-- 도배처럼 작은 공사는 현장방문 → 최종 견적서를 거치지 않고 «입찰 금액 그대로» 바로 계약할 수 있게 한다.
--   의뢰인이 입찰 하나를 골라 「현장방문 없이 이 금액으로 계약」을 누르면:
--     requests: selected_bid_id · selected_company_id(업체 ID) · status = 'escrow_pending'(= 결제 대기)
--     bids    : 고른 입찰 'selected'
--   → 116 트리거가 selected_at 을 찍고, 사업자 확인 전 업체면 업체·관리자에게 알림(계약은 사업자부터).
--   → 결제 금액의 기준은 이 입찰가(api/confirm-payment 가 결제 금액이 이보다 적으면 승인하지 않는다).
--   입찰 금액은 입찰 때 이미 업체 한도(101)를 통과했다 — 한도를 새로 넘길 길이 없다.
--
-- 안에서 단단하게: 요청 주인만, 그 요청의 입찰만, 아직 계약 전(열림·현장방문 단계)일 때만.
-- 추가 전용 · 재실행 안전. Supabase SQL Editor 에서 한 번 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.request_contract_direct(
  p_request_id uuid, p_bid_id uuid, p_actor_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_req public.requests; v_bid public.bids; v_co uuid;
begin
  if not public._actor_owns_request(p_request_id, p_actor_id) then
    raise exception 'NOT_REQUEST_OWNER';
  end if;

  select * into v_req from public.requests where id = p_request_id for update;
  if coalesce(v_req.status, 'open') not in ('open','bidding','site_visit','site_visiting','visit_requested','selected') then
    raise exception 'NOT_CONTRACTABLE: %', v_req.status;
  end if;
  if exists (select 1 from public.escrow_payments e where e.request_id = p_request_id) then
    raise exception 'ALREADY_CONTRACTED';
  end if;

  select * into v_bid from public.bids where id = p_bid_id and request_id = p_request_id;
  if v_bid.id is null then raise exception 'BID_NOT_FOUND'; end if;
  if coalesce(v_bid.price, 0) <= 0 then raise exception 'BID_NO_PRICE'; end if;

  -- bids.company_id 는 업체 ID 일 수도, 업체 주인 사용자 ID 일 수도 있다 → 선택 칸엔 업체 ID(방 ID 규칙과 같게).
  select c.id into v_co from public.companies c
   where c.id = v_bid.company_id or c.owner_id = v_bid.company_id
   order by (c.id = v_bid.company_id) desc limit 1;
  if v_co is null then raise exception 'COMPANY_NOT_FOUND'; end if;

  update public.requests
     set selected_bid_id     = p_bid_id,
         selected_company_id = v_co,
         status              = 'escrow_pending'
   where id = p_request_id;

  -- 입찰 표시는 부가 정보 — 운영 제약에 걸려도 계약 선택을 되돌리지 않는다(선택의 원본은 requests.selected_bid_id).
  begin
    update public.bids set status = 'selected' where id = p_bid_id;
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'request_id', p_request_id, 'bid_id', p_bid_id,
                            'company_id', v_co, 'price', v_bid.price, 'status', 'escrow_pending');
end; $$;
grant execute on function public.request_contract_direct(uuid,uuid,uuid) to anon, authenticated;

-- 결제 승인 서버(api/confirm-payment)의 금액 검사용 — 이 공사의 계약 금액(만원).
--   최종 견적서(제출·승인) 총액이 있으면 그것, 없으면 선택한 입찰가. 견적서는 RLS 로 anon 에 안 보여서 definer 로 읽는다.
--   돌려주는 건 금액 하나뿐(요청 ID 를 아는 경우만).
create or replace function public.contract_base_price(p_request_id uuid)
returns numeric language sql stable security definer
set search_path = public, extensions as $$
  select coalesce(
    (select e.total_price from public.estimates e
      where e.request_id = p_request_id and e.status in ('submitted','accepted') and coalesce(e.total_price, 0) > 0
      order by e.created_at desc limit 1),
    (select b.price from public.requests r join public.bids b on b.id = r.selected_bid_id
      where r.id = p_request_id)
  );
$$;
grant execute on function public.contract_base_price(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from pg_proc where proname = 'request_contract_direct') as contract_direct_ok,
  exists (select 1 from pg_proc where proname = 'contract_base_price')     as base_price_ok;
