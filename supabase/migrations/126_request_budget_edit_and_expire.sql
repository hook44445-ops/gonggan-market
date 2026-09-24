-- ============================================================
--  Migration 126: 입찰 0건이면 예산도 고치기(E7) · 기간 지난 open 요청 만료(E4)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경 (총점검 09-25)
--    E7  의뢰인이 예산을 잘못 골라도(예: 300만원 공사를 1,000만원으로) 고칠 길이 없었다.
--        요청 수정(108 request_update_by_owner)은 공간·평형·스타일·설명만 바꿨다.
--        입찰이 하나라도 들어오면 업체가 본 조건이 달라지므로 그때부터는 막는다.
--    E4  기간(7일)이 지난 요청이 DB 에 status='open' 으로 남아(6·8월 3건) 의뢰인 새 요청 막힘·통계·
--        관리자 목록을 흐린다. 화면은 시간으로 숨기지만 DB 는 그대로였다.
--
--  하는 일
--    1) request_update_by_owner 8칸 판 — 예산(만원, 하한·상한). 입찰이 있으면 BUDGET_LOCKED_HAS_BIDS.
--       (6칸 판은 그대로 둔다 — 예전 앱도 계속 동작)
--    2) requests_expire_stale() — open 이면서 업체 선택 전이고 만든 지 7일(expires_at 이 있으면 그 시각)이
--       지난 요청을 expired 로. pg_cron 이 켜져 있으면 매일 03:17 에 돈다. 지금 한 번 돌린다.
--  확인 칸 3개(아래 select).
-- ============================================================

set search_path = public, extensions;

-- 1) 예산까지 고치는 요청 수정 --------------------------------------------------------
create or replace function public.request_update_by_owner(
  p_request_id uuid, p_actor_id uuid,
  p_space_type text, p_size text, p_style text, p_description text,
  p_budget_min int, p_budget_max int)
returns public.requests language plpgsql security definer
set search_path = public, extensions as $$
declare v_req public.requests; v_bids int;
begin
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_req.user_id is distinct from p_actor_id then
    raise exception 'NOT_REQUEST_OWNER' using errcode = '42501';
  end if;
  if v_req.status not in ('open') then
    raise exception 'REQUEST_LOCKED' using errcode = 'P0001';
  end if;

  -- 예산을 바꾸려 할 때만 입찰 수를 본다(예산 칸이 비면 예전과 같다)
  if (p_budget_min is not null or p_budget_max is not null)
     and (coalesce(p_budget_min, -1) is distinct from coalesce(v_req.budget_min, -1)
          or coalesce(p_budget_max, -1) is distinct from coalesce(v_req.budget_max, -1)) then
    select count(*) into v_bids from public.bids where request_id = p_request_id;
    if v_bids > 0 then
      raise exception 'BUDGET_LOCKED_HAS_BIDS' using errcode = 'P0001';
    end if;
  end if;

  update public.requests
     set space_type  = coalesce(p_space_type, space_type),
         size        = coalesce(p_size, size),
         style       = coalesce(p_style, style),
         description = coalesce(p_description, description),
         budget_min  = case when p_budget_min is null and p_budget_max is null then budget_min else nullif(p_budget_min, 0) end,
         budget_max  = case when p_budget_min is null and p_budget_max is null then budget_max else nullif(p_budget_max, 0) end
   where id = p_request_id
  returning * into v_req;
  return v_req;
end; $$;
grant execute on function public.request_update_by_owner(uuid, uuid, text, text, text, text, int, int) to anon, authenticated;

-- 2) 기간 지난 open 요청 만료 ----------------------------------------------------------
create or replace function public.requests_expire_stale()
returns int language plpgsql security definer
set search_path = public, extensions as $$
declare v_n int;
begin
  update public.requests r
     set status = 'expired'
   where r.status = 'open'
     and r.selected_company_id is null
     and r.selected_bid_id is null
     and coalesce((to_jsonb(r) ->> 'expires_at')::timestamptz, r.created_at + interval '7 days') < now();
  get diagnostics v_n = row_count;
  return v_n;
end; $$;
grant execute on function public.requests_expire_stale() to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'requests_expire_daily';
    perform cron.schedule('requests_expire_daily', '17 3 * * *', 'select public.requests_expire_stale()');
  end if;
end $$;

-- 지금 한 번 — 몇 건이 만료됐는지 아래 확인 칸의 expired_now 로 보인다
create temporary table if not exists _expire_once (n int);
truncate _expire_once;
insert into _expire_once select public.requests_expire_stale();

notify pgrst, 'reload schema';

-- 확인: 앞 두 칸 true, expired_now = 방금 만료한 건수(0 이상)
select
  exists (select 1 from pg_proc where proname = 'request_update_by_owner' and pronargs = 8) as budget_edit_ok,
  exists (select 1 from pg_proc where proname = 'requests_expire_stale') as expire_fn_ok,
  (select n from _expire_once) as expired_now;
