-- ════════════════════════════════════════════════════════════════════
-- 034_project_checkpoints_boost.sql
-- GPS 체크포인트 점검/보강 — 행정주소 컬럼 추가, checkpoint_type 표준화,
-- 저장/조회 RPC 보강(주소 파싱 저장 + actor 검증 + 좌표 admin 전용).
--
-- 정책 유지:
--   · 분쟁 증빙 데이터 → hard delete 금지(삭제 컬럼/함수 없음, 보존).
--   · 직접 쓰기 개방 금지 — security-definer RPC 만.
--   · 좌표(lat/lng/accuracy)는 admin 만 조회. 일반 당사자(의뢰인/업체)는 주소 수준만.
--   · operator(is_operator)는 admin 이 아니므로 GPS 조회 불가(role='admin' 만 좌표).
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(032 다음, 033 과 무관).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ────────────────────────────────────────────────────────────────────
-- 0. 행정주소 컬럼 보강 (멱등)
--    기존 컬럼 매핑: contract_id=escrow_id, captured_by=uploaded_by, photos=photo_urls
-- ────────────────────────────────────────────────────────────────────
alter table public.project_checkpoints
  add column if not exists address_full text,
  add column if not exists sido         text,
  add column if not exists sigungu      text,
  add column if not exists dong         text,
  add column if not exists bunji        text;

-- ────────────────────────────────────────────────────────────────────
-- 1. checkpoint_type 표준화: site_visit / start / middle / complete
-- ────────────────────────────────────────────────────────────────────
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

update public.project_checkpoints set checkpoint_type = case checkpoint_type
  when 'construction_start' then 'start'
  when 'mid_inspection'     then 'middle'
  when 'completion'         then 'complete'
  else checkpoint_type end
 where checkpoint_type in ('construction_start','mid_inspection','completion');

alter table public.project_checkpoints
  add constraint project_checkpoints_type_check
  check (checkpoint_type in ('site_visit','start','middle','complete'));

-- ────────────────────────────────────────────────────────────────────
-- 2. 저장 RPC 재정의 — 주소 파싱 필드 포함 (이전 시그니처 제거 후 생성)
-- ────────────────────────────────────────────────────────────────────
drop function if exists public.project_checkpoint_save(
  uuid,uuid,uuid,uuid,text,numeric,numeric,numeric,text,text,text[],text);

create or replace function public.project_checkpoint_save(
  p_actor_id uuid, p_request_id uuid, p_contract_id uuid, p_site_visit_id uuid,
  p_type text, p_lat numeric, p_lng numeric, p_accuracy numeric,
  p_address_full text, p_road_address text, p_jibun_address text,
  p_sido text, p_sigungu text, p_dong text, p_bunji text,
  p_photos text[], p_note text
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.project_checkpoints;
begin
  -- 액터가 해당 요청의 선택된 업체 또는 계약 업체의 소유자인지 검증.
  if not exists (
    select 1 from public.companies c
     where c.owner_id = p_actor_id
       and (
         c.id = (select selected_company_id from public.requests where id = p_request_id)
         or c.id = (select company_id from public.escrow_payments where id = p_contract_id)
         or exists (select 1 from public.bids b
                     where b.request_id = p_request_id and b.company_id = c.id and b.selected = true)
       )
  ) then
    raise exception 'NOT_PROJECT_COMPANY';
  end if;

  insert into public.project_checkpoints (
    request_id, contract_id, site_visit_id, checkpoint_type,
    lat, lng, accuracy, address_full, road_address, jibun_address,
    sido, sigungu, dong, bunji, photos, note, captured_by, captured_at, created_at
  ) values (
    p_request_id, p_contract_id, p_site_visit_id, p_type,
    p_lat, p_lng, p_accuracy, p_address_full, p_road_address, p_jibun_address,
    p_sido, p_sigungu, p_dong, p_bunji, coalesce(p_photos, '{}'), p_note,
    p_actor_id, now(), now()
  ) returning * into v_row;

  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 3. 조회 RPC 재정의 — actor 검증 + 좌표는 admin 전용
--    반환 순서: site_visit → start → middle → complete, 동일 type 은 최신 우선.
-- ────────────────────────────────────────────────────────────────────
drop function if exists public.project_checkpoints_for_request(uuid);

create or replace function public.project_checkpoints_for_request(p_request_id uuid, p_actor_id uuid)
returns table (
  id uuid, request_id uuid, contract_id uuid, site_visit_id uuid, checkpoint_type text,
  lat numeric, lng numeric, accuracy numeric,
  address_full text, road_address text, jibun_address text,
  sido text, sigungu text, dong text, bunji text,
  photos text[], note text, captured_by uuid, captured_at timestamptz, created_at timestamptz,
  can_view_coords boolean
) language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_admin boolean; v_party boolean;
begin
  v_admin := exists (select 1 from public.users u where u.id = p_actor_id and u.role = 'admin');
  -- 당사자: 요청 소유자(의뢰인) 또는 선택/계약 업체 소유자
  v_party := exists (select 1 from public.requests r where r.id = p_request_id and r.user_id = p_actor_id)
          or exists (
               select 1 from public.companies c
                where c.owner_id = p_actor_id
                  and (
                    c.id = (select selected_company_id from public.requests where id = p_request_id)
                    or c.id in (select company_id from public.escrow_payments where request_id = p_request_id)
                    or exists (select 1 from public.bids b where b.request_id = p_request_id and b.company_id = c.id and b.selected = true)
                  )
             );

  if not (v_admin or v_party) then return; end if;

  return query
    select pc.id, pc.request_id, pc.contract_id, pc.site_visit_id, pc.checkpoint_type,
           case when v_admin then pc.lat      else null end,
           case when v_admin then pc.lng      else null end,
           case when v_admin then pc.accuracy else null end,
           pc.address_full, pc.road_address, pc.jibun_address,
           pc.sido, pc.sigungu, pc.dong, pc.bunji,
           pc.photos, pc.note, pc.captured_by, pc.captured_at, pc.created_at,
           v_admin
      from public.project_checkpoints pc
     where pc.request_id = p_request_id
     order by case pc.checkpoint_type
                when 'site_visit' then 1 when 'start' then 2 when 'middle' then 3 when 'complete' then 4 else 5 end asc,
              pc.captured_at desc;
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 4. 실행 권한
-- ────────────────────────────────────────────────────────────────────
grant execute on function public.project_checkpoint_save(
  uuid,uuid,uuid,uuid,text,numeric,numeric,numeric,text,text,text,text,text,text,text,text[],text
) to anon, authenticated;
grant execute on function public.project_checkpoints_for_request(uuid,uuid) to anon, authenticated;

notify pgrst, 'reload schema';
