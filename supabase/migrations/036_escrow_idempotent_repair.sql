-- ════════════════════════════════════════════════════════════════════
-- 036_escrow_idempotent_repair.sql
-- 에스크로 중복 생성 차단(멱등화) + 깨진 진행건(selected 값 누락) 복구.
--
-- 배경(Supabase 실데이터 확인):
--   · requests.status='in_progress' 인데 selected_company_id / selected_bid_id 가
--     NULL 인 row 다수 — 업체 선택/현장방문/에스크로 진입 경로가 status 만 바꾸고
--     선택값(SSOT)을 확정하지 않아 발생.
--   · escrow_payments 가 같은 request_id 로 여러 건 중복 insert 됨 — 결제/현장방문/
--     재진입 시 기존 에스크로 조회 없이 반복 insert 한 것이 원인.
--
-- 처리:
--   1) 중복 escrow 정리 — 같은 request_id 의 활성 에스크로는 "가장 진행된 1건"만 남기고
--      나머지는 transaction_status='CANCELLED' 로 void(hard delete 금지, 정산건 보호).
--   2) selected_company_id / selected_bid_id 백필 — 활성 에스크로 + 선택입찰에서 역추적.
--   3) partial unique index — 향후 같은 request_id 활성 에스크로 중복 생성 원천 차단.
--   4) escrow_get_or_create RPC — advisory lock + select-then-insert 멱등 생성.
--   5) request_mark_in_progress 보강 — 전이 시 selected_company_id / selected_bid_id 동시 확정.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ────────────────────────────────────────────────────────────────────
-- 1. 중복 escrow_payments 정리 (hard delete 금지 → CANCELLED void)
--    같은 request_id 별로 "가장 진행된 1건"을 active 로 남기고 나머지 void.
--    정산(SETTLED)된 행은 금전 정합상 절대 건드리지 않는다.
-- ────────────────────────────────────────────────────────────────────
with ranked as (
  select id,
         row_number() over (
           partition by request_id
           order by
             -- 진행 단계가 더 앞선(완료/정산에 가까운) 행을 우선 보존
             case transaction_status
               when 'SETTLED'         then 0
               when 'COMPLETED'       then 1
               when 'MID_INSPECTION'  then 2
               when 'STARTED'         then 3
               when 'CONTRACTED'      then 4
               when 'COMPANY_SELECTED'then 5
               else 6
             end asc,
             current_step desc nulls last,
             created_at   desc
         ) as rn
    from public.escrow_payments
)
update public.escrow_payments e
   set transaction_status = 'CANCELLED', updated_at = now()
  from ranked
 where e.id = ranked.id
   and ranked.rn > 1
   and e.transaction_status not in ('SETTLED', 'CANCELLED');

-- ────────────────────────────────────────────────────────────────────
-- 2. selected_company_id / selected_bid_id 백필
--    진행 상태인데 선택값이 비어있는 요청을 활성 에스크로 + 선택입찰에서 역추적.
-- ────────────────────────────────────────────────────────────────────
update public.requests r
   set selected_company_id = coalesce(r.selected_company_id, sub.company_id),
       selected_bid_id     = coalesce(r.selected_bid_id,     sub.bid_id),
       updated_at          = now()
  from (
    select e.request_id,
           e.company_id as company_id,
           b.id         as bid_id
      from public.escrow_payments e
      left join lateral (
        select id from public.bids
         where request_id = e.request_id and selected = true
         order by created_at desc
         limit 1
      ) b on true
     where e.transaction_status not in ('CANCELLED', 'SETTLED')
  ) sub
 where r.id = sub.request_id
   and (r.selected_company_id is null or r.selected_bid_id is null)
   and r.status in ('site_visit','final_quote_submitted','escrow_pending','contracting','in_progress');

-- ────────────────────────────────────────────────────────────────────
-- 3. 향후 중복 방지 — request_id 당 활성 에스크로 1건 partial unique index
--    (CANCELLED/SETTLED 는 여러 건 허용 — 종결/취소 이력 보존)
-- ────────────────────────────────────────────────────────────────────
create unique index if not exists escrow_payments_active_request_uniq
  on public.escrow_payments (request_id)
  where transaction_status not in ('CANCELLED', 'SETTLED');

-- ────────────────────────────────────────────────────────────────────
-- 4. 멱등 에스크로 확보 RPC — 같은 request_id 동시 호출도 같은 행을 반환.
--    advisory lock 으로 직렬화 후 활성 에스크로 조회 → 없으면 1건만 insert.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.escrow_get_or_create(
  p_request_id uuid, p_company_id uuid, p_total_amount integer
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.escrow_payments;
begin
  if p_request_id is null then raise exception 'NO_REQUEST_ID'; end if;

  -- 같은 요청에 대한 동시 진입을 직렬화(트랜잭션 종료 시 자동 해제)
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  select * into v_row from public.escrow_payments
   where request_id = p_request_id
     and transaction_status not in ('CANCELLED', 'SETTLED')
   order by created_at desc
   limit 1;

  if v_row.id is not null then
    return jsonb_build_object('row', to_jsonb(v_row), 'created', false);
  end if;

  insert into public.escrow_payments (
    request_id, company_id, total_amount,
    transaction_status, status, current_step, step1_deposited_at, created_at, updated_at
  ) values (
    p_request_id, p_company_id, coalesce(p_total_amount, 0),
    'CONTRACTED', 'deposited', 1, now(), now(), now()
  )
  returning * into v_row;

  return jsonb_build_object('row', to_jsonb(v_row), 'created', true);
end; $$;

grant execute on function public.escrow_get_or_create(uuid, uuid, integer) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 5. request_mark_in_progress 보강 — in_progress 전이 시 선택값 동시 확정.
--    (status 만 바꾸고 selected 값을 비우는 경로 제거 — broken 진행건 재발 방지)
-- ────────────────────────────────────────────────────────────────────
create or replace function public.request_mark_in_progress(p_request_id uuid)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_esc public.escrow_payments; v_bid uuid; v_new text;
begin
  -- 활성(정산/취소 아님) 에스크로가 실제로 있을 때만 전이.
  select * into v_esc from public.escrow_payments
   where request_id = p_request_id
     and coalesce(transaction_status, '') not in ('SETTLED', 'CANCELLED', 'REFUNDED')
   order by created_at desc
   limit 1;

  if v_esc.id is null then
    return null;  -- 에스크로 없으면 전이하지 않음(임의 in_progress 방지)
  end if;

  -- 선택된 입찰(있으면) — selected_bid_id 백필용
  select id into v_bid from public.bids
   where request_id = p_request_id and selected = true
   order by created_at desc
   limit 1;

  update public.requests
     set status              = 'in_progress',
         selected_company_id = coalesce(selected_company_id, v_esc.company_id),
         selected_bid_id     = coalesce(selected_bid_id,     v_bid),
         updated_at          = now()
   where id = p_request_id
     and status in ('open', 'escrow_pending', 'site_visit', 'final_quote_submitted')
   returning status into v_new;

  return v_new;  -- 전이 시 'in_progress', 이미 진행/완료 등이면 null
end; $$;

grant execute on function public.request_mark_in_progress(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
