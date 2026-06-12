-- ════════════════════════════════════════════════════════════════════
-- 067_contract_checkpoint.sql
-- C-1 최종계약 GPS — checkpoint_type 'contract' 추가 + 고객 전용 저장 RPC.
--
-- 목적: 최종계약(에스크로 생성) 시점에 '고객' 위치 GPS 1회를 남겨
--   증빙 타임라인의 '계약' 단계를 채운다(현장방문→최종계약→착공→중간→완료).
--
-- 안전성(회귀 금지):
--   · checkpoint_type CHECK 를 superset 으로 확장(기존 4값 유지 + 'contract').
--     034 와 동일한 robust drop-loop. 기존 데이터/insert 무영향.
--   · 기존 project_checkpoint_save(업체 actor 전용)·착공/중간/완료 로직 미변경.
--   · 신규 RPC 1개만 추가(고객 actor). SECURITY DEFINER(앱 auth.uid()=null).
--   · 멱등: 같은 request 에 contract 체크포인트가 있으면 insert 생략.
--   · 테이블 컬럼/RLS/기존 RPC/realtime 무변경. additive only.
--
-- Supabase SQL Editor 에서 1회 실행(066 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1. checkpoint_type CHECK 제약 확장 (superset) ──────────────────────
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.project_checkpoints'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%checkpoint_type%'
  loop
    execute format('alter table public.project_checkpoints drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.project_checkpoints
  add constraint project_checkpoints_type_check
  check (checkpoint_type in ('site_visit','contract','start','middle','complete'));

-- ── 2. 고객 전용 계약 GPS 저장 RPC (멱등) ──────────────────────────────
create or replace function public.project_contract_checkpoint_save(
  p_actor_id      uuid,
  p_request_id    uuid,
  p_contract_id   uuid    default null,
  p_lat           numeric default null,
  p_lng           numeric default null,
  p_accuracy      numeric default null,
  p_address_full  text    default null,
  p_road_address  text    default null,
  p_jibun_address text    default null,
  p_sido          text    default null,
  p_sigungu       text    default null,
  p_dong          text    default null,
  p_bunji         text    default null,
  p_note          text    default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_row public.project_checkpoints;
begin
  if p_actor_id is null or p_request_id is null then
    raise exception 'ACTOR_AND_REQUEST_REQUIRED';
  end if;

  -- 요청 소유 고객만 허용(업체 actor 전용 RPC 와 분리).
  if not exists (
    select 1 from public.requests r
     where r.id = p_request_id and r.user_id = p_actor_id
  ) then
    raise exception 'NOT_REQUEST_OWNER';
  end if;

  -- 멱등 — 이미 contract 체크포인트가 있으면 기존 행 반환(중복 insert 금지).
  select * into v_row
    from public.project_checkpoints
   where request_id = p_request_id and checkpoint_type = 'contract'
   order by created_at asc
   limit 1;
  if v_row.id is not null then
    return to_jsonb(v_row);
  end if;

  insert into public.project_checkpoints (
    request_id, contract_id, site_visit_id, checkpoint_type,
    lat, lng, accuracy, address_full, road_address, jibun_address,
    sido, sigungu, dong, bunji, photos, note, captured_by, captured_at, created_at
  ) values (
    p_request_id, p_contract_id, null, 'contract',
    p_lat, p_lng, p_accuracy, p_address_full, p_road_address, p_jibun_address,
    p_sido, p_sigungu, p_dong, p_bunji, '{}', p_note,
    p_actor_id, now(), now()
  ) returning * into v_row;

  return to_jsonb(v_row);
end; $fn$;

grant execute on function public.project_contract_checkpoint_save(
  uuid, uuid, uuid, numeric, numeric, numeric, text, text, text, text, text, text, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
