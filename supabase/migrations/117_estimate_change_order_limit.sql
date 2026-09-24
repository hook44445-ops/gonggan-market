-- ============================================================
--  Migration 117: 한도 뒷문 둘 닫기 — 최종 견적서 · 추가견적
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경 (총점검 09-24 5차 창에서 발견)
--    공사 1건 한도(101 partner_bid_limit_manwon)는 «입찰»에만 걸려 있었다.
--      · 290만원으로 입찰해 선택된 뒤 최종 견적서를 900만원으로 보내면 결제는 최종 견적 금액으로 간다.
--      · 추가견적은 원계약과 따로 정산돼, 여러 번 나눠 붙이면 한도를 넘을 수 있었다.
--    → 둘 다 입찰과 같은 한도 함수로 본다. 입찰 규칙(가입만 300 …)은 그대로다(대표: 「입찰은 지금처럼」).
--  원칙은 101 과 같다: 업체를 못 찾으면 통과(fail-open), 새로 넣거나 금액을 바꿀 때만 본다(이미 있는 행은 그대로).
-- ============================================================

set search_path = public, extensions;

-- 1) 최종 견적서 --------------------------------------------------------------------
create or replace function public.enforce_estimate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_price numeric := coalesce(new.total_price, 0);
begin
  if v_price >= 100000 then v_price := v_price / 10000.0; end if;   -- 원으로 들어오면 만원으로
  v_limit := public.partner_bid_limit_manwon(new.company_id);
  if v_limit is not null and v_price > v_limit then
    raise exception 'ESTIMATE_OVER_LIMIT: 이 업체의 공사 1건 한도는 %만원입니다 (견적 %만원)', v_limit, round(v_price)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_estimate_limit on public.estimates;
create trigger trg_enforce_estimate_limit
  before insert or update of total_price on public.estimates
  for each row execute function public.enforce_estimate_limit();

-- 2) 추가견적 ----------------------------------------------------------------------
create or replace function public.enforce_change_order_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_total   numeric;
  v_extra   numeric;
  v_limit   integer;
begin
  if coalesce(new.amount, 0) <= 0 or new.status = 'REJECTED' then return new; end if;   -- 감액·반려는 안 본다

  select e.company_id, e.total_amount into v_company, v_total
    from public.escrow_payments e where e.id = new.contract_id;
  if v_company is null then return new; end if;                                        -- fail-open
  if coalesce(v_total, 0) >= 100000 then v_total := v_total / 10000.0; end if;

  select coalesce(sum(co.amount), 0) into v_extra
    from public.change_orders co
   where co.contract_id = new.contract_id
     and co.id is distinct from new.id
     and co.status <> 'REJECTED'
     and co.amount > 0;

  v_limit := public.partner_bid_limit_manwon(v_company);
  if v_limit is not null and v_limit > 0 and coalesce(v_total, 0) + v_extra + new.amount > v_limit then
    raise exception 'CHANGE_ORDER_OVER_LIMIT: 원계약과 추가견적을 합치면 이 업체의 공사 1건 한도(%만원)를 넘어요', v_limit
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_change_order_limit on public.change_orders;
create trigger trg_enforce_change_order_limit
  before insert or update of amount on public.change_orders
  for each row execute function public.enforce_change_order_limit();

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from pg_trigger where tgname = 'trg_enforce_estimate_limit')     as estimate_limit_ok,
  exists (select 1 from pg_trigger where tgname = 'trg_enforce_change_order_limit') as change_order_limit_ok;
