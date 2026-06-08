-- 041_request_site_visit_rpc.sql
-- 의뢰인 [현장방문 요청하기] — 프론트 직접 update 가 RLS(auth.uid()=null, OTP 커스텀 인증)에 막혀 실패.
-- requests/bids/site_visits 전이를 단일 SECURITY DEFINER RPC 로 처리해 RLS 우회.
-- 입력: p_request_id, p_bid_id, p_company_id(= companies.id, resolve 완료된 값).

create or replace function public.request_site_visit(
  p_request_id uuid,
  p_bid_id uuid,
  p_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_bid record;
  v_visit record;
begin
  select *
  into v_request
  from public.requests
  where id = p_request_id;

  if not found then
    raise exception 'request not found';
  end if;

  select *
  into v_bid
  from public.bids
  where id = p_bid_id
    and request_id = p_request_id;

  if not found then
    raise exception 'bid not found';
  end if;

  update public.requests
  set
    status = 'site_visiting',
    selected_bid_id = p_bid_id,
    selected_company_id = p_company_id
  where id = p_request_id
  returning * into v_request;

  update public.bids
  set status = 'site_visiting'
  where id = p_bid_id
  returning * into v_bid;

  insert into public.site_visits (
    request_id,
    bid_id,
    company_id,
    status
  )
  values (
    p_request_id,
    p_bid_id,
    p_company_id,
    'requested'
  )
  on conflict do nothing;

  select *
  into v_visit
  from public.site_visits
  where request_id = p_request_id
    and bid_id = p_bid_id
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'bid_id', p_bid_id,
    'company_id', p_company_id,
    'request_status', v_request.status,
    'bid_status', v_bid.status,
    'site_visit_id', v_visit.id
  );
end;
$$;

grant execute on function public.request_site_visit(uuid, uuid, uuid) to authenticated;
grant execute on function public.request_site_visit(uuid, uuid, uuid) to anon;
