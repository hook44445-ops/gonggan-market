-- ════════════════════════════════════════════════════════════════════
-- 045_estimate_submit_keep_5arg.sql
-- estimate_submit RPC 중복(오버로드) 정리 → 5-인자(p_photo_urls 포함) 단일 시그니처만 유지.
--
-- 증상(프론트 제출 시):
--   Could not choose the best candidate function between:
--     estimate_submit(p_actor_id, p_estimate_id, p_site_visit_id, p_request_id)
--     estimate_submit(p_actor_id, p_estimate_id, p_site_visit_id, p_request_id, p_photo_urls text[])
--   → PostgREST 가 4-인자 호출에 대해 두 함수 중 하나를 못 고름.
--
-- 처리(요청사항 — 최신 5-인자만 유지):
--   1) 정규 5-인자(...,p_photo_urls text[]) 외 모든 estimate_submit 오버로드(4-인자 등) 제거.
--   2) 정규 5-인자 estimate_submit 을 create or replace 로 재확정(멱등) + 권한 부여.
--   → 최종적으로 estimate_submit 은 정확히 1개(5-인자)만 존재.
--   · 프론트 submitEstimate 는 4-인자만 호출 → p_photo_urls DEFAULT '{}' 로 매칭(변경 불필요).
--
-- ★ 핫픽스: 라이브 requests 테이블에는 타임스탬프 갱신 컬럼이 없어
--   'column "updated_at" of relation "requests" does not exist' 에러가 발생했다.
--   테이블 스키마는 건드리지 않고, 함수 본문의 타임스탬프 대입(= now())만 전부 제거해
--   상태전이만 수행하도록 정밀 수정한다. (시그니처/소유자검증/상태값/p_photo_urls 그대로)
--
-- 상태전이/소유자검증 로직은 031 정규 정의와 동일(타임스탬프 대입만 제거). p_photo_urls 는
-- 시그니처 호환용으로 받되, 사진 저장은 estimate_upsert(043)의 final_quote_photo_urls 가
-- 담당하므로 본문에서 사용하지 않는다(사진 업로드/저장 로직 변경 없음).
--
-- ※ 044(4-인자 유지)의 결정을 대체한다. 044 파일은 수정하지 않으며, 본 045 를 마지막에 적용한다.
-- 멱등 · DB 정리 전용. Supabase SQL Editor 에서 1회 실행(031/043/044 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 1) 정규 5-인자 외 모든 estimate_submit 오버로드 제거(예: 4-인자 구버전).
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
           <> 'p_actor_id uuid, p_estimate_id uuid, p_site_visit_id uuid, p_request_id uuid, p_photo_urls text[]'
  loop
    execute format('drop function if exists public.estimate_submit(%s)', r.args);
  end loop;
end $$;

-- 2) 정규 5-인자 estimate_submit 재확정(031 상태전이 본문과 동일 · 멱등).
--    p_photo_urls 는 시그니처 호환용(본문 미사용 — 사진 저장은 estimate_upsert 043 담당).
create or replace function public.estimate_submit(
  p_actor_id uuid, p_estimate_id uuid, p_site_visit_id uuid, p_request_id uuid,
  p_photo_urls text[] default '{}'
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

  -- 상태전이만 수행(타임스탬프 대입 제거 — 아래 헤더 주석의 핫픽스 사유 참조).
  update public.estimates
     set status = 'submitted', submitted_at = now()
   where id = p_estimate_id
   returning * into v_row;

  if p_site_visit_id is not null then
    update public.site_visits set status = 'estimate_submitted'
     where id = p_site_visit_id;
  end if;

  if p_request_id is not null then
    update public.requests set status = 'final_quote_submitted'
     where id = p_request_id and status in ('site_visit','final_quote_submitted');
  end if;

  return to_jsonb(v_row);
end; $$;

grant execute on function public.estimate_submit(uuid,uuid,uuid,uuid,text[]) to anon, authenticated;

notify pgrst, 'reload schema';
