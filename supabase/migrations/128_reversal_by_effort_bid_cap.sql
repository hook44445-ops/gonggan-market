-- ============================================================
--  Migration 128: 번복 온도는 업체가 들인 수고만큼 · 고른 뒤 결제 전 취소 · 입찰 최대 5곳 (E1 · E17)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  대표 09-25: 「업체를 골랐다는 건 기본 견적서를 받고 선택한 것 — 3곳까지 받아 상담한 뒤 아님?」
--             「추천으로 가」 「시장논리에 맞게」
--  규칙 (앱 src/lib/reversalRule.js 와 같다 — 숫자를 바꾸면 두 곳을 같이)
--    고르기 전 취소                           → 영향 없음
--    고른 뒤 · 최종 견적 전                    → −0.5
--    최종 견적 받은 뒤(결제 전)                 → −1.0
--    고른 뒤 72시간이 지나도 최종 견적이 없거나, 사업자 확인이 안 된 업체 → 영향 없음(업체 쪽이 멈춤)
--    결제한 뒤                                → 여기서 취소 불가(이의 신청·분쟁)
--    「업체 바꾸기」 버튼은 두지 않는다(비교·상담은 고르기 전에 끝낸다).
--  입찰: 요청 하나당 최대 5곳 — 6번째 입찰은 BID_CAP_REACHED.
--  확인 칸 3개(아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 1) 번복 온도 — 단계별 --------------------------------------------------------------
create or replace function public.trg_request_customer_reversal()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_kind text; v_delta numeric; co public.companies; v_quoted boolean;
begin
  v_quoted := coalesce(old.status, '') in ('final_quote_submitted','escrow_pending');

  -- 업체 쪽이 멈춘 경우 — 고른 뒤 72시간이 지났는데 최종 견적이 없거나, 사업자 확인이 안 된 업체
  if old.selected_company_id is not null
     and old.selected_at is not null
     and old.selected_at < now() - interval '72 hours' then
    if not v_quoted then return new; end if;
    co := public.company_row_of(old.selected_company_id);
    if co.id is not null and not coalesce(co.verified, false) then return new; end if;
  end if;

  if old.selected_company_id is not null
     and new.status in ('cancelled','canceled')
     and coalesce(old.status, '') not in ('cancelled','canceled','completed','expired','closed') then
    v_kind := 'cancel_after_select';
    v_delta := case when v_quoted then -1.0 else -0.5 end;
  elsif old.selected_company_id is not null
     and new.selected_company_id is not null
     and new.selected_company_id <> old.selected_company_id then
    v_kind := 'switch_company'; v_delta := -0.5;
  else
    return new;
  end if;

  if coalesce((to_jsonb(new) ->> 'description'), '') like '[점검%'
     or coalesce((to_jsonb(new) ->> 'desc'), '') like '[점검%' then
    return new;
  end if;

  insert into public.customer_temp_events (request_id, kind, user_id, delta)
  values (new.id, v_kind, new.user_id, v_delta)
  on conflict (request_id, kind) do nothing;
  if found then perform public.customer_temp_add(new.user_id, v_delta); end if;
  return new;
exception when others then
  return new;
end; $$;

-- 2) 의뢰인 취소 — 고른 뒤에도 결제 전까지 -------------------------------------------------
create or replace function public.request_cancel_by_owner(
  p_request_id uuid, p_actor_id uuid, p_reason text default null)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_req public.requests;
begin
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_req.user_id is distinct from p_actor_id then
    raise exception 'NOT_REQUEST_OWNER' using errcode = '42501';
  end if;
  if v_req.status in ('cancelled','canceled','expired','closed','completed') then
    return v_req.status;
  end if;
  -- 결제(에스크로)가 있으면 여기서는 못 한다 — 이의 신청·분쟁 절차
  if v_req.status = 'in_progress' or exists (
       select 1 from public.escrow_payments e
        where e.request_id = p_request_id
          and coalesce(e.transaction_status, '') not in ('CANCELLED','REFUNDED')) then
    raise exception 'PAID_USE_DISPUTE' using errcode = 'P0001';
  end if;

  update public.requests
     set status = 'cancelled',
         hidden_reason = coalesce(nullif(trim(p_reason), ''), hidden_reason)
   where id = p_request_id;
  return 'cancelled';     -- 번복 온도는 1) 트리거가 단계에 맞게
end; $$;
grant execute on function public.request_cancel_by_owner(uuid, uuid, text) to anon, authenticated;

-- 3) 입찰 최대 5곳 ------------------------------------------------------------------
create or replace function public.trg_bid_cap()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if (select count(*) from public.bids where request_id = new.request_id) >= 5 then
    raise exception 'BID_CAP_REACHED' using errcode = 'P0001';
  end if;
  return new;
end; $$;

drop trigger if exists trg_bid_cap on public.bids;
create trigger trg_bid_cap before insert on public.bids
  for each row execute function public.trg_bid_cap();

notify pgrst, 'reload schema';

-- 확인: 셋 다 true 면 끝
select
  exists (select 1 from pg_trigger where tgname = 'trg_request_customer_reversal') as reversal_ok,
  exists (select 1 from pg_proc where proname = 'request_cancel_by_owner')       as cancel_ok,
  exists (select 1 from pg_trigger where tgname = 'trg_bid_cap')                  as bid_cap_ok;
