-- ============================================================
--  Migration 104: 공사 대화방 — 선택 직후 상태(site_visiting)도 잡기 + 옛 가짜 인사 지우기
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경
--    103 은 상태를 허용 목록('site_visit', …)으로 걸렀다. 그런데 고객이 업체를 선택하는
--    request_site_visit(041) 은 상태를 'site_visiting' 으로 바꾼다 → 방금 선택한 공사가 빠지고,
--    같은 고객·업체의 옛 공사가 카드에 잡혔다(총점검 09-24).
--    이제 «업체가 선택된 공사» 중 열림·취소·만료·종료만 뺀다(상태 이름이 늘어도 안전).
--    옛 상담방에 업체 이름으로 들어간 가짜 자동 인사도 지운다(업체가 쓴 척하는 글).
--    결제 뒤 「공사 중」, 완료 뒤 「완료」 로 바꾸는 두 함수도 requests.updated_at 때문에 실패하고
--    있었다 → 다시 만들고, 멈춰 있던 거래를 에스크로 상태 기준으로 한 번 바로잡는다.
-- ============================================================

set search_path = public, extensions;

drop function if exists public.project_rooms_for_actor(uuid);
create or replace function public.project_rooms_for_actor(p_actor_id uuid)
returns table (
  room_id           text,
  request_id        uuid,
  my_role           text,
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
    select r.*, c.id as co_id, 'consumer'::text as role,
           c.name as other_name, ou.phone as other_phone
      from public.requests r
      join public.companies c on c.id = r.selected_company_id
      left join public.users ou on ou.id = c.owner_id
     where p_actor_id is not null and r.user_id = p_actor_id
    union all
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
   where coalesce(m.status, 'open') not in ('open','cancelled','canceled','expired','closed')
     and coalesce((to_jsonb(m) ->> 'is_deleted')::boolean, false) = false
   order by m.user_id, m.co_id, m.role, m.created_at desc;
$$;

grant execute on function public.project_rooms_for_actor(uuid) to anon, authenticated;

-- ── 공사 상태가 「최종 견적 도착」에서 멈추던 것 ───────────────────────────────────
-- request_mark_in_progress(036)·request_mark_completed(041) 이 운영에 없는 requests.updated_at 을
-- 써서 매번 실패했다 → 결제·완료 뒤에도 requests.status 가 final_quote_submitted 로 남았다.
-- updated_at 없이 다시 만들고, 선택 직후 상태(site_visiting)에서도 넘어가게 한다.
create or replace function public.request_mark_in_progress(p_request_id uuid)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_esc public.escrow_payments; v_bid uuid; v_new text;
begin
  select * into v_esc from public.escrow_payments
   where request_id = p_request_id
     and coalesce(transaction_status, '') not in ('SETTLED', 'CANCELLED', 'REFUNDED')
   order by created_at desc
   limit 1;
  if v_esc.id is null then
    return null;
  end if;

  select id into v_bid from public.bids
   where request_id = p_request_id and selected = true
   order by created_at desc
   limit 1;

  update public.requests
     set status              = 'in_progress',
         selected_company_id = coalesce(selected_company_id, v_esc.company_id),
         selected_bid_id     = coalesce(selected_bid_id,     v_bid)
   where id = p_request_id
     and status in ('open', 'escrow_pending', 'site_visit', 'site_visiting', 'final_quote_submitted')
   returning status into v_new;

  return v_new;
end; $$;

grant execute on function public.request_mark_in_progress(uuid) to anon, authenticated;

create or replace function public.request_mark_completed(p_request_id uuid)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_esc public.escrow_payments; v_new text;
begin
  select * into v_esc from public.escrow_payments
   where request_id = p_request_id
     and coalesce(transaction_status, '') in ('SETTLED', 'COMPLETED')
   order by created_at desc
   limit 1;
  if v_esc.id is null then
    return null;
  end if;

  update public.requests
     set status = 'completed'
   where id = p_request_id
     and status not in ('completed', 'cancelled')
   returning status into v_new;

  return v_new;
end; $$;

grant execute on function public.request_mark_completed(uuid) to anon, authenticated;

-- 이미 멈춰 있던 거래 바로잡기(한 번) — 에스크로 상태를 기준으로.
--   정산·완료된 에스크로가 있는 요청 → completed
update public.requests r
   set status = 'completed'
 where r.status not in ('completed','cancelled','canceled','expired','closed')
   and exists (select 1 from public.escrow_payments e
                where e.request_id = r.id
                  and coalesce(e.transaction_status,'') in ('SETTLED','COMPLETED'));
--   진행 중(정산·취소·환불 아님) 에스크로가 있는 요청 → in_progress
update public.requests r
   set status = 'in_progress'
 where r.status in ('open','escrow_pending','site_visit','site_visiting','final_quote_submitted')
   and exists (select 1 from public.escrow_payments e
                where e.request_id = r.id
                  and coalesce(e.transaction_status,'') not in ('SETTLED','COMPLETED','CANCELLED','REFUNDED'));

notify pgrst, 'reload schema';

-- 옛 가짜 자동 인사(업체 이름으로 들어간 글) 지우기 — 지금은 시스템 안내로만 시작한다.
delete from public.chats
 where text like '안녕하세요! 공간마켓 파트너 업체입니다%';

-- 확인: 방금 선택한 공사(site_visiting)가 맨 위 카드로 잡히는지
select room_id, my_role, status, created_at from public.project_rooms_for_actor('9e8b3138-ffba-4970-8a5c-b489026c4e54');
