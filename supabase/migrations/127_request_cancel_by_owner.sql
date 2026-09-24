-- ============================================================
--  Migration 127: 의뢰인이 요청을 취소하는 서버 함수 (E15, 총점검 09-25)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경
--    지금 화면(v3)에는 의뢰인이 요청을 고치거나 취소할 입구가 없었다(옛 v2 홈에만 있었다).
--    옛 취소(closeRequest)는 표를 직접 고쳐서, 로그인 세션이 없는 앱에선 조용히 0건이었다(RLS).
--
--  하는 일
--    request_cancel_by_owner(요청, 의뢰인, 사유) — 본인 요청이고 «업체를 고르기 전(open)»일 때만 취소.
--    업체를 고른 뒤의 취소는 A4(번복 · 공간온도, 114 트리거) 결정과 함께 따로 연다 → AFTER_SELECT_NOT_YET.
--  확인 칸 1개(아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

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
    return v_req.status;   -- 이미 끝난 요청 — 그대로
  end if;
  if v_req.status <> 'open' or v_req.selected_company_id is not null or v_req.selected_bid_id is not null then
    raise exception 'AFTER_SELECT_NOT_YET' using errcode = 'P0001';
  end if;

  update public.requests
     set status = 'cancelled',
         hidden_reason = coalesce(nullif(trim(p_reason), ''), hidden_reason)
   where id = p_request_id;
  return 'cancelled';
end; $$;
grant execute on function public.request_cancel_by_owner(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'request_cancel_by_owner') as cancel_fn_ok;
