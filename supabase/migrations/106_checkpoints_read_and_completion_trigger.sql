-- ============================================================
--  Migration 106: ① GPS 기록 읽기 400(42702) ② 완공 사진 보내기 404(42P01)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  ① 배경 (총점검 09-24 2차 거래 · 착공 단계)
--    105 가 bids.selected 참조를 걷어냈지만, 같은 함수가 이번엔 42702 로 매번 실패했다.
--    RETURNS TABLE 의 결과 칸 이름(id, request_id …)은 함수 안에서 변수가 된다. 그래서
--      (select selected_company_id from public.requests where id = p_request_id)
--      (select company_id from public.escrow_payments where request_id = p_request_id)
--    의 id · request_id 가 «표의 칸인지 결과 변수인지» 모호하다.
--    → 고객·업체 공사 화면이 현장 기록을 하나도 못 읽었다(저장은 됨 · 관리자 증빙은 다른 함수라 정상).
--  고침: 모든 칸에 표 별칭을 붙이고, 혹시 남은 모호함은 표 칸으로 해석하게 한다(#variable_conflict).
--  결과 모양·권한·좌표 가림(관리자만 좌표)은 105 와 같다.
-- ============================================================

set search_path = public, extensions;

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
#variable_conflict use_column
declare v_admin boolean; v_party boolean;
begin
  v_admin := exists (select 1 from public.users u where u.id = p_actor_id and u.role = 'admin');
  -- 당사자: 요청 소유자(의뢰인) 또는 선택/계약 업체 소유자
  v_party := exists (select 1 from public.requests rq where rq.id = p_request_id and rq.user_id = p_actor_id)
          or exists (
               select 1 from public.companies c
                where c.owner_id = p_actor_id
                  and (
                    c.id = (select rq2.selected_company_id from public.requests rq2 where rq2.id = p_request_id)
                    or c.id in (select ep.company_id from public.escrow_payments ep where ep.request_id = p_request_id)
                    or c.id = (select b.company_id from public.bids b
                                 join public.requests rq3 on rq3.selected_bid_id = b.id
                                where rq3.id = p_request_id)
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

-- ============================================================
--  ② 완공 사진 보내기 404 — 운영에 없는 space_price_index 를 쓰는 트리거
--    013 의 trigger_update_price_index 는 escrow_payments.transaction_status 가
--    'COMPLETED' 로 바뀔 때 public.space_price_index 에 집계를 넣는다. 운영에는 그 표가 없다(PGRST205).
--    → 업체가 완공 사진을 보낼 때(상태 COMPLETED) 매번 42P01 → 404, 상태가 안 바뀌고
--      대화방 알림·기록도 안 남는다(총점검 09-24 2차 거래 · 완료 단계).
--  고침: 거래 흐름을 절대 막지 않게 한다 — 표가 없으면 건너뛰고, 집계가 실패해도 무시한다.
--        (가격 인덱스는 부가 기능. 표를 만들 때가 오면 그대로 다시 돈다.)
-- ============================================================
create or replace function public.update_price_index()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if to_regclass('public.space_price_index') is null
     or to_regclass('public.estimates') is null then
    return new;
  end if;

  begin
    execute $q$
      insert into public.space_price_index (
        region_code, space_type, building_type, material_grade, work_type,
        price_per_m2, sample_count, last_updated)
      select r.region_code, r.space_type, r.building_type, e.material_grade, 'general',
             avg(e.total_price / nullif(r.space_size_m2, 0))::bigint, count(*)::int, now()
        from public.escrow_payments ep
        join public.requests  r on r.id = ep.request_id
        join public.estimates e on e.request_id = ep.request_id
       where ep.transaction_status = 'COMPLETED'
         and r.region_code is not null and r.space_type is not null
         and r.building_type is not null and e.material_grade is not null
         and e.total_price is not null and r.space_size_m2 is not null and r.space_size_m2 > 0
       group by r.region_code, r.space_type, r.building_type, e.material_grade
      on conflict (region_code, space_type, building_type, material_grade, work_type)
      do update set price_per_m2 = excluded.price_per_m2,
                    sample_count = excluded.sample_count,
                    last_updated = now()
    $q$;
  exception when others then
    -- 집계 실패는 거래를 막지 않는다
    null;
  end;
  return new;
end; $$;

notify pgrst, 'reload schema';
