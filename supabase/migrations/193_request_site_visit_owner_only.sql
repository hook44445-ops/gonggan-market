-- ============================================================
--  Migration 193: 업체 선택(현장견적 요청) request_site_visit — 요청 주인만 · 그 입찰의 업체로만
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(request_site_visit 를 로그인 토큰으로 부르는 버전) → 이 SQL.
--
--  왜(10-01 점검 — 192 와 같은 종류):
--    · request_site_visit(041)는 정의자 권한 + anon 실행 + 확인 없음 — 로그인 안 한 누구나 남의 요청 ID 와
--      그 요청의 아무 입찰 ID 로 부르면 요청이 «현장견적 중»으로 바뀌고 selected_company_id 가
--      «넘긴 아무 업체 ID»로 채워졌다 → 남의 견적 요청을 다른 업체로 가로챌 수 있었다.
--  바꾼 뒤
--    · 로그인 토큰 필요(없으면 42501 LOGIN_REQUIRED)
--    · 요청 주인(requests.user_id) 또는 관리자만 — 아니면 {"ok":false,"error":"NOT_OWNER"}
--    · 넘긴 업체가 그 입찰의 업체여야(bids.company_id 가 업체 id 또는 주인 id) — 아니면 {"ok":false,"error":"COMPANY_MISMATCH"}
--    · 나머지(요청·입찰 상태 · site_visits 한 줄 · 돌려주는 값)는 041 그대로
--  되돌리기: 041 의 request_site_visit 를 다시 실행한다(«grant … to anon» 포함).
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

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
  v_uid uuid := auth.uid();
  v_request record;
  v_bid record;
  v_visit record;
begin
  if v_uid is null then
    raise exception 'LOGIN_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_request
  from public.requests
  where id = p_request_id;

  if not found then
    raise exception 'request not found';
  end if;

  -- 193: 요청 주인(또는 관리자)만
  if v_request.user_id is distinct from v_uid and not coalesce(public.is_admin(), false) then
    return jsonb_build_object('ok', false, 'error', 'NOT_OWNER');
  end if;

  select *
  into v_bid
  from public.bids
  where id = p_bid_id
    and request_id = p_request_id;

  if not found then
    raise exception 'bid not found';
  end if;

  -- 193: 넘긴 업체 = 그 입찰의 업체(bids.company_id 가 업체 id 또는 주인 id)
  if not exists (
    select 1 from public.companies c
     where c.id = p_company_id
       and v_bid.company_id in (c.id, c.owner_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'COMPANY_MISMATCH');
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

revoke execute on function public.request_site_visit(uuid, uuid, uuid) from public, anon;
grant execute on function public.request_site_visit(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① owner_only: 요청 주인만 · 그 입찰의 업체로만
--  ② no_anon: 로그인 안 한 사람(anon)은 부를 수 없다
select
  position('NOT_OWNER' in pg_get_functiondef('public.request_site_visit(uuid,uuid,uuid)'::regprocedure)) > 0
  and position('COMPANY_MISMATCH' in pg_get_functiondef('public.request_site_visit(uuid,uuid,uuid)'::regprocedure)) > 0 as owner_only,
  not has_function_privilege('anon', 'public.request_site_visit(uuid,uuid,uuid)', 'execute') as no_anon;
