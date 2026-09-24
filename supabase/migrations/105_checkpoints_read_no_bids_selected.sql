-- ============================================================
--  Migration 105: GPS 기록 읽기 400 + 「공사 중」 전환 — 운영에 없는 bids.selected 참조 제거
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경
--    운영 DB 의 bids 에는 selected 칸이 없다(082 가 «저장» 함수만 고쳤다).
--    1) project_checkpoints_for_request(034) 가 당사자 확인에 b.selected 를 써서 매번 42703 → 400.
--       고객·업체 화면에서 GPS·현장 기록을 하나도 못 읽었다(총점검 09-24, 단계마다 400).
--    2) 104 에서 다시 만든 request_mark_in_progress 도 selected_bid_id 백필에 bids.selected 를 썼다
--       → 결제 뒤 「공사 중」 전환이 다시 실패할 수 있다. requests.selected_bid_id 를 그대로 쓴다.
--  기준: 선택 정보의 원본은 requests.selected_bid_id / selected_company_id (082 와 같다).
-- ============================================================

set search_path = public, extensions;

-- 1) GPS·현장 기록 읽기 ------------------------------------------------------------
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
                    or c.id = (select b.company_id from public.bids b
                                 join public.requests r on r.selected_bid_id = b.id
                                where r.id = p_request_id)
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

grant execute on function public.project_checkpoints_for_request(uuid,uuid) to anon, authenticated;

-- 2) 「공사 중」 전환 — bids.selected 없이 ------------------------------------------------
create or replace function public.request_mark_in_progress(p_request_id uuid)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_esc public.escrow_payments; v_new text;
begin
  select * into v_esc from public.escrow_payments
   where request_id = p_request_id
     and coalesce(transaction_status, '') not in ('SETTLED', 'CANCELLED', 'REFUNDED')
   order by created_at desc
   limit 1;
  if v_esc.id is null then
    return null;
  end if;

  update public.requests
     set status              = 'in_progress',
         selected_company_id = coalesce(selected_company_id, v_esc.company_id)
   where id = p_request_id
     and status in ('open', 'escrow_pending', 'site_visit', 'site_visiting', 'final_quote_submitted')
   returning status into v_new;

  return v_new;
end; $$;

grant execute on function public.request_mark_in_progress(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
