-- ════════════════════════════════════════════════════════════════════
-- 039_site_visit_request_flow.sql
-- 현장견적 요청 흐름 정상화 — 의뢰인 "현장견적 요청" 시 site_visits row 를 실제로 생성.
--
-- 기존 문제:
--   · 의뢰인 버튼은 request_mark_site_visit(요청 상태 전이)만 호출 → site_visits row 미생성.
--   · 그래서 업체 화면에 "현장견적 요청 도착/수락/거절"이 뜨지 않음.
--
-- 처리:
--   1) site_visits.status 에 'requested'/'accepted'/'rejected' 추가.
--   2) site_visit_request RPC — 의뢰인이 site_visits(status='requested') 생성(+요청 전이/입찰 선택).
--      같은 request+bid+company 조합이 이미 있으면(비종료) 재사용(중복 생성 금지).
--   3) site_visit_respond RPC — 업체 수락(accepted)/거절(rejected).
--   4) site_visit_create 를 upsert 로 — 업체 '실측 일정 잡기' 시 기존 요청 row 를 scheduled 로
--      갱신(중복 row 방지). 기존 호출부(createSiteVisit) 시그니처 유지.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(031 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ────────────────────────────────────────────────────────────────────
-- 1. status 값 확장 (requested/accepted/rejected 추가)
-- ────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.site_visits'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.site_visits drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.site_visits
  add constraint site_visits_status_check check (status in (
    'requested','accepted','rejected',
    'created','scheduled','checked_in','completed','estimate_submitted','cancelled'
  ));

-- ────────────────────────────────────────────────────────────────────
-- 2. 의뢰인 현장견적 요청 → site_visits(requested) 생성 + 요청 전이 + 입찰 선택
-- ────────────────────────────────────────────────────────────────────
create or replace function public.site_visit_request(
  p_actor_id uuid, p_request_id uuid, p_bid_id uuid, p_company_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits;
begin
  -- 요청 소유자(의뢰인)만 현장견적 요청 가능
  if not public._actor_owns_request(p_request_id, p_actor_id) then
    raise exception 'NOT_REQUEST_OWNER';
  end if;

  -- 중복 방지: 같은 request+bid+company 의 비종료 site_visit 이 있으면 재사용
  select * into v_row from public.site_visits
   where request_id = p_request_id and bid_id = p_bid_id and company_id = p_company_id
     and status not in ('rejected','cancelled')
   order by created_at desc
   limit 1;

  if v_row.id is null then
    insert into public.site_visits (request_id, bid_id, company_id, status, created_at, updated_at)
    values (p_request_id, p_bid_id, p_company_id, 'requested', now(), now())
    returning * into v_row;
  end if;

  -- 입찰 선택 단일화 + 요청 상태 전이(현장방문 견적 단계)
  if p_bid_id is not null then
    update public.bids set selected = (id = p_bid_id) where request_id = p_request_id;
  end if;
  update public.requests
     set status = 'site_visit',
         selected_bid_id     = coalesce(p_bid_id, selected_bid_id),
         selected_company_id = coalesce(p_company_id, selected_company_id),
         updated_at = now()
   where id = p_request_id
     and status in ('open','site_visit');

  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 3. 업체 수락/거절
-- ────────────────────────────────────────────────────────────────────
create or replace function public.site_visit_respond(
  p_actor_id uuid, p_id uuid, p_action text
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits; v_status text;
begin
  if not exists (
    select 1 from public.site_visits sv join public.companies c on c.id = sv.company_id
     where sv.id = p_id and c.owner_id = p_actor_id
  ) then
    raise exception 'NOT_SITE_VISIT_OWNER';
  end if;

  v_status := case p_action when 'accept' then 'accepted'
                            when 'reject' then 'rejected'
                            else null end;
  if v_status is null then raise exception 'BAD_ACTION'; end if;

  update public.site_visits
     set status = v_status, updated_at = now()
   where id = p_id and status in ('requested','accepted')
   returning * into v_row;
  if v_row.id is null then raise exception 'NOT_RESPONDABLE'; end if;

  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 4. site_visit_create 를 upsert 로 — '실측 일정 잡기' 가 기존 요청 row 를 scheduled 로 갱신
--    (시그니처 유지: createSiteVisit 호출부 변경 불필요)
-- ────────────────────────────────────────────────────────────────────
create or replace function public.site_visit_create(
  p_actor_id uuid, p_bid_id uuid, p_request_id uuid, p_company_id uuid, p_scheduled_at timestamptz
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits;
begin
  if not public._actor_owns_company(p_company_id, p_actor_id) then
    raise exception 'NOT_COMPANY_OWNER';
  end if;
  if not exists (
    select 1 from public.bids b
     where b.id = p_bid_id and b.request_id = p_request_id
       and b.company_id = p_company_id and b.selected = true
  ) then
    raise exception 'BID_NOT_SELECTED';
  end if;

  -- 기존(요청/수락/created) row 재사용 → scheduled 로 갱신. 없으면 신규 생성.
  select * into v_row from public.site_visits
   where bid_id = p_bid_id and status not in ('rejected','cancelled')
   order by created_at desc
   limit 1;

  if v_row.id is null then
    insert into public.site_visits (bid_id, request_id, company_id, status, scheduled_at, created_at, updated_at)
    values (p_bid_id, p_request_id, p_company_id, 'scheduled', p_scheduled_at, now(), now())
    returning * into v_row;
  else
    update public.site_visits
       set status = 'scheduled', scheduled_at = p_scheduled_at, updated_at = now()
     where id = v_row.id
     returning * into v_row;
  end if;

  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 5. 권한
-- ────────────────────────────────────────────────────────────────────
grant execute on function public.site_visit_request(uuid,uuid,uuid,uuid)  to anon, authenticated;
grant execute on function public.site_visit_respond(uuid,uuid,text)       to anon, authenticated;
grant execute on function public.site_visit_create(uuid,uuid,uuid,uuid,timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';
