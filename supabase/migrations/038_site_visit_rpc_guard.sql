-- ════════════════════════════════════════════════════════════════════
-- 038_site_visit_rpc_guard.sql
-- request_mark_site_visit RPC 보강:
--   · open → site_visit 정상 전이 (기존)
--   · site_visit 재호출 → 멱등(상태 재기록 없음, selected_* 만 backfill)
--   · in_progress 등 깨진 진행건 → status 변경 없이 selected_* 백필만
--   · 다른 업체가 이미 selected_company_id 로 확정됐으면 COMPANY_MISMATCH 오류
--   · terminal 상태(completed/cancelled/settled 등)에는 진입 차단
--
-- site_visits 중복 방지:
--   · site_visit_create 가 bid_id 당 1행만 허용하도록 partial unique index 추가
--     (status != 'cancelled' 활성 방문만. 취소 이력 보존)
--
-- 멱등·추가 전용. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ────────────────────────────────────────────────────────────────────
-- 1. request_mark_site_visit 보강
--    반환형은 기존 text 유지(호출부 호환). 내부 로직만 교체.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.request_mark_site_visit(
  p_request_id uuid, p_bid_id uuid, p_company_id uuid, p_actor_id uuid
) returns text language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_req        record;
  v_new_status text;
begin
  -- actor 소유권 검증(의뢰인만 허용)
  if not public._actor_owns_request(p_request_id, p_actor_id) then
    raise exception 'NOT_REQUEST_OWNER';
  end if;

  -- 현재 요청 행을 FOR UPDATE 로 잠근다(동시 호출 직렬화)
  select id, status, selected_company_id, selected_bid_id
    into v_req
    from public.requests
   where id = p_request_id
     for update;

  if v_req.id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  -- 다른 업체가 이미 확정된 경우: 덮어쓰기 금지
  if v_req.selected_company_id is not null
     and p_company_id is not null
     and v_req.selected_company_id != p_company_id then
    raise exception 'COMPANY_MISMATCH: already selected %', v_req.selected_company_id;
  end if;

  -- terminal 상태는 진입 차단(깨진 데이터도 terminal 이면 건드리지 않음)
  if v_req.status in (
    'completed','settled','cancelled','closed','expired','done','finished','refunded'
  ) then
    raise exception 'TERMINAL_STATUS: %', v_req.status;
  end if;

  -- 선택 입찰 단일화 — 같은 요청의 다른 입찰은 해제
  if p_bid_id is not null then
    update public.bids
       set selected = (id = p_bid_id)
     where request_id = p_request_id;
  end if;

  -- 상태 결정:
  --   open / site_visit → site_visit(정상 전이·멱등)
  --   in_progress / escrow_pending / final_quote_submitted / contracting 등 →
  --     status 는 변경하지 않고 selected_* backfill 만.
  if v_req.status in ('open', 'site_visit') then
    v_new_status := 'site_visit';
  else
    v_new_status := v_req.status;   -- 상태 변경 없이 backfill 만
  end if;

  -- selected_* 는 null 일 때만 채운다(이미 있으면 유지)
  update public.requests
     set status              = v_new_status,
         selected_company_id = coalesce(selected_company_id, p_company_id),
         selected_bid_id     = coalesce(selected_bid_id, p_bid_id),
         updated_at          = now()
   where id = p_request_id;

  return v_new_status;
end; $$;

grant execute on function public.request_mark_site_visit(uuid, uuid, uuid, uuid) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 2. site_visits 중복 방지 — bid_id 당 활성 방문 1건 partial unique index
--    (status = 'cancelled' 인 취소 이력은 여러 건 허용)
-- ────────────────────────────────────────────────────────────────────
create unique index if not exists site_visits_active_bid_uniq
  on public.site_visits (bid_id)
  where status != 'cancelled';

-- ────────────────────────────────────────────────────────────────────
-- 3. 기존 깨진 요청 백필 — in_progress 인데 selected_* 가 null 인 행
--    활성 escrow / bids.selected 에서 역추적해 채운다.
--    (037 리셋 실행 환경에서는 대상 0건으로 무해)
-- ────────────────────────────────────────────────────────────────────
update public.requests r
   set selected_company_id = coalesce(r.selected_company_id, sub.company_id),
       selected_bid_id     = coalesce(r.selected_bid_id,     sub.bid_id),
       updated_at          = now()
  from (
    -- 활성 escrow + selected bid 에서 역추적
    select
      e.request_id,
      e.company_id,
      b.id as bid_id
    from public.escrow_payments e
    left join lateral (
      select id from public.bids
       where request_id = e.request_id and selected = true
       order by created_at desc
       limit 1
    ) b on true
    where e.transaction_status not in ('CANCELLED','SETTLED')
  ) sub
 where r.id = sub.request_id
   and (r.selected_company_id is null or r.selected_bid_id is null)
   and r.status not in ('completed','settled','cancelled','closed','expired','done','finished');

notify pgrst, 'reload schema';
