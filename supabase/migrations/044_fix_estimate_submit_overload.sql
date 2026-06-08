-- ════════════════════════════════════════════════════════════════════
-- 044_fix_estimate_submit_overload.sql
-- estimate_submit RPC 중복(오버로드) 정리 → 정확히 1개만 유지.
--
-- 증상(프론트 제출 시):
--   Could not choose the best candidate function between:
--     estimate_submit(p_actor_id, p_estimate_id, p_site_visit_id, p_request_id)
--     estimate_submit(p_actor_id, p_estimate_id, p_site_visit_id, p_request_id, p_photo_urls text[])
--   → PostgREST 가 4-인자 호출에 대해 두 함수 중 하나를 고르지 못함.
--
-- 원인:
--   레포 정규 정의(031)는 4-인자뿐인데, 라이브 DB 에 p_photo_urls 를 추가한 5-인자
--   오버로드가 별도로 생성돼 공존(레포 외 직접 SQL). 프론트 submitEstimate 는 4-인자만 호출.
--
-- 처리:
--   1) 정규 4-인자 시그니처 외의 모든 estimate_submit 오버로드 제거.
--   2) 정규 4-인자 estimate_submit 을 create or replace 로 재확정(멱등) + 권한 부여.
--   → 최종적으로 estimate_submit 은 정확히 1개(4-인자)만 존재.
--
-- 상태전이/소유자검증 로직은 031 정규 정의를 그대로 유지(변경 없음).
-- 멱등 · DB 정리 전용. Supabase SQL Editor 에서 1회 실행(031/043 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 1) 정규 4-인자 외 모든 estimate_submit 오버로드 제거(예: ...,p_photo_urls text[]).
do $$
declare r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'estimate_submit'
       and pg_get_function_identity_arguments(p.oid)
           <> 'p_actor_id uuid, p_estimate_id uuid, p_site_visit_id uuid, p_request_id uuid'
  loop
    execute format('drop function if exists public.estimate_submit(%s)', r.args);
  end loop;
end $$;

-- 2) 정규 4-인자 estimate_submit 재확정(031 과 동일 본문 — 변경 없음, 멱등).
create or replace function public.estimate_submit(
  p_actor_id uuid, p_estimate_id uuid, p_site_visit_id uuid, p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.estimates;
begin
  if not exists (
    select 1 from public.estimates e join public.companies c on c.id = e.company_id
     where e.id = p_estimate_id and c.owner_id = p_actor_id
  ) then
    raise exception 'NOT_ESTIMATE_OWNER';
  end if;

  update public.estimates
     set status = 'submitted', submitted_at = now(), updated_at = now()
   where id = p_estimate_id
   returning * into v_row;

  if p_site_visit_id is not null then
    update public.site_visits set status = 'estimate_submitted', updated_at = now()
     where id = p_site_visit_id;
  end if;

  if p_request_id is not null then
    update public.requests set status = 'final_quote_submitted', updated_at = now()
     where id = p_request_id and status in ('site_visit','final_quote_submitted');
  end if;

  return to_jsonb(v_row);
end; $$;

grant execute on function public.estimate_submit(uuid,uuid,uuid,uuid) to anon, authenticated;

notify pgrst, 'reload schema';
