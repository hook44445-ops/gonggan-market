-- ============================================================
--  Migration 103: 공사 한 건 = 대화방 하나 (+ 「예약 확정」 400 고침)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경
--    1) 고객이 업체를 선택해도 대화방이 열리지 않았다. 대화 목록은 «지도에 공개된 업체»
--       기준이라, 목록에 없는 업체와의 방은 메시지가 있어도 보이지 않았다.
--       이제 «고객이 선택한 업체» 를 기준으로 방을 만든다(room_id = 고객ID_업체ID, 기존 규칙 그대로).
--    2) 선택된 뒤에는 서로 전화할 수 있어야 현장방문을 잡는다. 번호는 «선택된 공사가 있는
--       두 사람» 에게만 이 함수로 돌려준다(선택 전에는 가려진다).
--    3) request_approve_final_quote 가 requests.updated_at 을 썼는데 운영 DB 에는 그 칸이 없다
--       (053~055 와 같은 원인) → 「예약 확정하고 결제 진행」 때마다 400. 그 칸을 빼고 다시 만든다.
--
--  하는 일
--    project_rooms_for_actor(p_actor_id) — 내가 고객이면 내가 선택한 업체들, 내가 업체 주인이면
--      나를 선택한 고객들. 공사 요약(공간·평형·지역·상태)과 상대 이름·전화번호를 함께 준다.
--      상태가 site_visit 이후(현장방문·최종견적·결제·공사·완료)인 공사만. 취소·만료는 빼다.
--    request_approve_final_quote — updated_at 없이 다시 정의.
-- ============================================================

set search_path = public, extensions;

-- 1) 공사 대화방 목록 -------------------------------------------------------------
drop function if exists public.project_rooms_for_actor(uuid);
create or replace function public.project_rooms_for_actor(p_actor_id uuid)
returns table (
  room_id           text,
  request_id        uuid,
  my_role           text,      -- 'consumer' | 'company'
  customer_id       uuid,
  company_id        uuid,
  counterpart_name  text,
  counterpart_phone text,
  space_type        text,
  size              text,
  region            text,
  status            text,
  created_at        timestamptz
) language sql stable security definer
set search_path = public, extensions as $$
  with mine as (
    -- 내가 고객
    select r.*, c.id as co_id, 'consumer'::text as role,
           c.name as other_name, ou.phone as other_phone
      from public.requests r
      join public.companies c on c.id = r.selected_company_id
      left join public.users ou on ou.id = c.owner_id
     where p_actor_id is not null and r.user_id = p_actor_id
    union all
    -- 내가 업체 주인
    select r.*, c.id as co_id, 'company'::text as role,
           cu.name as other_name, cu.phone as other_phone
      from public.requests r
      join public.companies c on c.id = r.selected_company_id and c.owner_id = p_actor_id
      left join public.users cu on cu.id = r.user_id
     where p_actor_id is not null
  )
  select distinct on (m.user_id, m.co_id, m.role)
         m.user_id::text || '_' || m.co_id::text,
         m.id,
         m.role,
         m.user_id,
         m.co_id,
         m.other_name,
         m.other_phone,
         to_jsonb(m) ->> 'space_type',
         to_jsonb(m) ->> 'size',
         coalesce(to_jsonb(m) ->> 'district', to_jsonb(m) ->> 'area', to_jsonb(m) ->> 'region'),
         m.status,
         m.created_at
    from mine m
   where m.status in ('site_visit','final_quote_submitted','escrow_pending','contracting','in_progress','completed')
   order by m.user_id, m.co_id, m.role, m.created_at desc;
$$;

grant execute on function public.project_rooms_for_actor(uuid) to anon, authenticated;

-- 2) 「예약 확정」 — requests.updated_at 없이 ---------------------------------------
create or replace function public.request_approve_final_quote(
  p_request_id uuid, p_actor_id uuid
) returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_new text;
begin
  if not public._actor_owns_request(p_request_id, p_actor_id) then
    raise exception 'NOT_REQUEST_OWNER';
  end if;

  -- 운영 스키마 차이에 흔들리지 않게 status 만 바꾼다(updated_at 칸 유무와 무관).
  update public.estimates
     set status = 'accepted'
   where request_id = p_request_id and status = 'submitted';

  update public.requests
     set status = 'escrow_pending'
   where id = p_request_id
     and status in ('final_quote_submitted','escrow_pending')
   returning status into v_new;

  return v_new;
end; $$;

grant execute on function public.request_approve_final_quote(uuid,uuid) to anon, authenticated;

-- 확인용(선택): 대표 번호로 방이 나오는지
-- select * from public.project_rooms_for_actor('9e8b3138-ffba-4970-8a5c-b489026c4e54');
