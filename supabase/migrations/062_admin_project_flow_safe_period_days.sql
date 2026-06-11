-- ════════════════════════════════════════════════════════════════════
-- 062_admin_project_flow_safe_period_days.sql
-- admin_project_flow_list — selected_bid 필드를 스키마 부재에 안전하게(널-가드).
--
-- 배경:
--   운영 bids 스키마가 코드와 불일치한 전례(selected 컬럼 부재)가 있어,
--   selected_bid 의 sb.period_days / sb.price 직접 참조가 "column does not exist"
--   다음 후보였다.
--
-- 수정(RPC 내부 SQL만, 061 기준):
--   · selected_bid 의 price/period_days/created_at 를 to_jsonb(sb)->>'..' 로 추출.
--     컬럼이 있으면 값, 없으면 null — 컬럼 존재 여부와 무관하게 에러 없음.
--   · sb.id 는 selected_bid 조회 키(항상 존재)라 그대로 사용.
--   · 그 외(comp.phone 제거, r.urgent→false, r.updated_at→r.created_at, b.selected 미사용,
--     'admin' sentinel 허용)는 061 과 동일.
--   · 동명 모든 overload 동적 DROP 후 단일 CREATE. 컬럼 추가 없음. 조회 전용.
--
-- 검증(실행 후 0 이어야 함):
--   select position('sb.period_days' in pg_get_functiondef(p.oid))
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.proname='admin_project_flow_list';
--
-- 멱등 · Supabase SQL Editor 에서 1회 실행. notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 1) 이름이 같은 모든 overload 제거(시그니처 무관) — 잔존 r.updated_at 버전 확실 제거.
do $$
declare r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'admin_project_flow_list'
  loop
    execute format('drop function if exists public.admin_project_flow_list(%s)', r.args);
  end loop;
end $$;

-- 2) 단일 깨끗한 정의 재생성.
create function public.admin_project_flow_list(
  p_admin_id  text,
  p_date_from timestamptz default null,
  p_date_to   timestamptz default null,
  p_limit     int         default 200,
  p_search    text        default null,
  p_status    text        default null
) returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  v_admin_uuid uuid;
  v_limit      int;
  v_search     text;
  v_result     jsonb;
begin
  -- 관리자 검증 — 040/046 sentinel 패턴(코드 관리자 'admin' 허용).
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY';
    end if;
  elsif coalesce(p_admin_id, '') not in ('admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  v_limit  := least(greatest(coalesce(p_limit, 200), 1), 1000);
  v_search := nullif(trim(coalesce(p_search, '')), '');

  select coalesce(jsonb_agg(flow_row order by sort_key desc), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'request_id',      r.id,
      'area',            r.area,
      'space_type',      r.space_type,
      'size',            r.size,
      'status',          r.status,
      'urgent',          false,
      'created_at',      r.created_at,
      'updated_at',      r.created_at,

      'flow_stage', case
        when esc.transaction_status = 'SETTLED'
          or coalesce(rev.review_count, 0) > 0
          or r.status = 'completed'                                   then 'SETTLED_OR_REVIEWED'
        when esc.transaction_status = 'COMPLETED'
          or esc.step4_approved_at is not null
          or cpf.has_complete                                         then 'COMPLETED'
        when esc.transaction_status = 'MID_INSPECTION'
          or cpf.has_middle                                          then 'MID_INSPECTION'
        when esc.transaction_status = 'STARTED'
          or cpf.has_start                                           then 'ESCROW_STARTED'
        when esc.id is not null
          or esc.transaction_status in ('CONTRACTED','COMPANY_SELECTED')
          or r.status in ('escrow_pending','contracting','in_progress') then 'CONTRACTED'
        when r.status = 'final_quote_submitted'
          or sv.status = 'estimate_submitted'                        then 'FINAL_QUOTE'
        when sv.id is not null
          or r.status in ('site_visit','site_visiting')
          or cpf.has_site_visit                                      then 'SITE_VISIT'
        when coalesce(bc.bids_count, 0) > 0
          or sb.id is not null                                       then 'BID_SUBMITTED'
        else 'REQUESTED'
      end,

      'customer', jsonb_build_object('id', u.id, 'name', u.name, 'phone', u.phone),

      'company', case when comp.id is null then null else jsonb_build_object(
        'id', comp.id, 'name', comp.name, 'owner_id', comp.owner_id
      ) end,

      'bids_count', coalesce(bc.bids_count, 0),

      'selected_bid', case when sb.id is null then null else jsonb_build_object(
        'id', sb.id,
        'price',       (to_jsonb(sb) ->> 'price'),
        'period_days', (to_jsonb(sb) ->> 'period_days'),
        'created_at',  (to_jsonb(sb) ->> 'created_at')
      ) end,

      'site_visit', case when sv.id is null then null else jsonb_build_object(
        'id', sv.id, 'status', sv.status,
        'checked_in_at', sv.checked_in_at, 'completed_at', sv.completed_at,
        'gps_lat', sv.gps_lat, 'gps_lng', sv.gps_lng,
        'field_estimate_amount', sv.field_estimate_amount,
        'field_estimate_note', sv.field_estimate_note
      ) end,

      'escrow', case when esc.id is null then null else jsonb_build_object(
        'id', esc.id, 'transaction_status', esc.transaction_status, 'status', esc.status,
        'total_amount', esc.total_amount, 'current_step', esc.current_step,
        'step1_deposited_at', esc.step1_deposited_at, 'step2_paid_at', esc.step2_paid_at,
        'photos_uploaded_at', esc.photos_uploaded_at, 'step3_approved_at', esc.step3_approved_at,
        'step3_disputed', esc.step3_disputed, 'step4_approved_at', esc.step4_approved_at,
        'dispute_status', esc.dispute_status, 'dispute_reason', esc.dispute_reason,
        'disputed_at', esc.disputed_at, 'expected_end_date', esc.expected_end_date,
        'created_at', esc.created_at, 'updated_at', esc.updated_at
      ) end,

      'checkpoints',          coalesce(cps.checkpoints, '[]'::jsonb),
      'review_count',         coalesce(rev.review_count, 0),
      'direct_deal_reports',  coalesce(ddr.reports, '[]'::jsonb)
    ) as flow_row,
    r.created_at as sort_key

    from public.requests r
    left join public.users u    on u.id = r.user_id
    -- 선택 업체: 1순위 r.selected_company_id, 2순위 r.selected_bid_id 의 입찰 업체(b.selected 미사용).
    left join public.companies comp on comp.id = coalesce(
      r.selected_company_id,
      (select b.company_id from public.bids b where b.id = r.selected_bid_id limit 1)
    )
    left join lateral (
      select count(*) as bids_count from public.bids b where b.request_id = r.id
    ) bc on true
    -- 선택 입찰: r.selected_bid_id 기준(b.selected 미사용).
    left join lateral (
      select b.* from public.bids b where b.id = r.selected_bid_id limit 1
    ) sb on true
    left join lateral (
      select sv.* from public.site_visits sv
       where sv.request_id = r.id
       order by sv.created_at desc limit 1
    ) sv on true
    left join lateral (
      select e.* from public.escrow_payments e
       where e.request_id = r.id
       order by e.created_at desc limit 1
    ) esc on true
    left join lateral (
      select
        bool_or(cp.checkpoint_type = 'site_visit')                                as has_site_visit,
        bool_or(cp.checkpoint_type in ('start','construction_start'))             as has_start,
        bool_or(cp.checkpoint_type in ('middle','mid_inspection'))               as has_middle,
        bool_or(cp.checkpoint_type in ('complete','completion'))                  as has_complete
      from public.project_checkpoints cp
       where cp.request_id = r.id
    ) cpf on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
               'id', cp.id, 'checkpoint_type', cp.checkpoint_type,
               'lat', cp.lat, 'lng', cp.lng, 'accuracy', cp.accuracy,
               'road_address', cp.road_address, 'jibun_address', cp.jibun_address,
               'photos', cp.photos, 'captured_by', cp.captured_by, 'captured_at', cp.captured_at
             ) order by case cp.checkpoint_type
                          when 'site_visit'        then 1
                          when 'start'             then 2
                          when 'construction_start' then 2
                          when 'middle'            then 3
                          when 'mid_inspection'    then 3
                          when 'complete'          then 4
                          when 'completion'        then 4
                          else 5 end,
                        cp.captured_at) as checkpoints
        from public.project_checkpoints cp
       where cp.request_id = r.id
    ) cps on true
    left join lateral (
      select count(*) as review_count from public.reviews rv
       where rv.request_id = r.id and coalesce(rv.is_deleted, false) = false
    ) rev on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'trigger_type', d.trigger_type,
               'status', d.status, 'detected_at', d.detected_at
             ) order by d.detected_at desc) as reports
        from public.direct_deal_reports d
       where d.request_id = r.id
    ) ddr on true

    where (p_date_from is null or r.created_at >= p_date_from)
      and (p_date_to   is null or r.created_at <= p_date_to)
      and (p_status    is null or r.status = p_status or esc.transaction_status = p_status)
      and (
        v_search is null
        or u.name     ilike '%' || v_search || '%'
        or u.phone    ilike '%' || v_search || '%'
        or comp.name  ilike '%' || v_search || '%'
        or r.area     ilike '%' || v_search || '%'
        or r.id::text = v_search
      )
    order by sort_key desc
    limit v_limit
  ) t;

  return v_result;
end; $$;

grant execute on function public.admin_project_flow_list(text, timestamptz, timestamptz, int, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
