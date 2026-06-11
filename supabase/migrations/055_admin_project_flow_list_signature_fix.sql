-- ════════════════════════════════════════════════════════════════════
-- 055_admin_project_flow_list_signature_fix.sql
-- admin_project_flow_list — PGRST202 해소(시그니처/인자이름 고정).
--
-- 문제:
--   프론트(lib/supabase.js)는 인자 '이름'으로 호출한다:
--     rpc('admin_project_flow_list',
--         { p_admin_id, p_date_from, p_date_to, p_limit, p_search, p_status })
--   그런데 기존에 인자 이름이 다른 오버로드가 남아 있으면
--     · create or replace 는 인자 이름을 바꾸지 못해(같은 타입·다른 이름 → 에러)
--       047 재생성이 적용되지 않거나,
--     · 이름이 다른 함수만 남아 PostgREST 가 호출 키와 매칭하지 못해
--   PGRST202 (Could not find the function ... in the schema cache) 가 발생한다.
--
-- 해결(최소·안전):
--   1) public.admin_project_flow_list 의 '모든' 오버로드를 동적으로 DROP.
--   2) 프론트 호출 키와 정확히 일치하는 단일 함수로 재생성.
--      · 함수 본문(로직)은 047 과 100% 동일(verbatim) — 상태/결제/정산/GPS 로직 변경 없음.
--      · 인자 이름: p_admin_id, p_date_from, p_date_to, p_limit, p_search, p_status
--        (모두 default 보유 → 일부만 보내도 안전. PostgREST 는 이름으로 매칭).
--
-- 멱등 · 추가 전용(데이터 변경 없음). Supabase SQL Editor 에서 1회 실행(054 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 0) 040/046/047 과 동일 — sentinel uuid 변환 헬퍼(없으면 생성, 멱등).
create or replace function public._safe_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end; $$;

-- 1) 이름이 admin_project_flow_list 인 '모든' 오버로드를 제거(인자이름/타입 불문).
--    → 이후 단일 정규 시그니처만 남아 PGRST202/203(모호성) 모두 해소.
do $$
declare r record;
begin
  for r in
    select 'public.' || quote_ident(p.proname) || '(' ||
           pg_get_function_identity_arguments(p.oid) || ')' as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'admin_project_flow_list'
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- 2) 정규 시그니처로 재생성 — 본문은 047 verbatim, 인자 순서/이름만 고정.
create or replace function public.admin_project_flow_list(
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
      'urgent',          r.urgent,
      'created_at',      r.created_at,
      'updated_at',      r.updated_at,

      -- 계산된 현재 단계 — 도달한 최고 마일스톤(escrow 상태 + 체크포인트 + 마일스톤).
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

      'customer', jsonb_build_object(
        'id', u.id, 'name', u.name, 'phone', u.phone
      ),

      'company', case when comp.id is null then null else jsonb_build_object(
        'id', comp.id, 'name', comp.name, 'phone', comp.phone, 'owner_id', comp.owner_id
      ) end,

      'bids_count', coalesce(bc.bids_count, 0),

      'selected_bid', case when sb.id is null then null else jsonb_build_object(
        'id', sb.id, 'price', sb.price, 'period_days', sb.period_days,
        'selected', sb.selected, 'created_at', sb.created_at
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
    coalesce(r.updated_at, r.created_at) as sort_key

    from public.requests r
    left join public.users u    on u.id = r.user_id
    left join public.companies comp on comp.id = coalesce(
      r.selected_company_id,
      -- selected_bid 와 동일 보정 — 1순위 r.selected_bid_id, 2순위 b.selected=true.
      (select b.company_id from public.bids b
        where b.request_id = r.id
          and (b.id = r.selected_bid_id or b.selected = true)
        order by case when b.id = r.selected_bid_id then 0 else 1 end,
                 b.selected desc, b.created_at desc
        limit 1)
    )
    left join lateral (
      select count(*) as bids_count from public.bids b where b.request_id = r.id
    ) bc on true
    left join lateral (
      -- 1순위: r.selected_bid_id 매칭, 2순위: b.selected=true (과거 데이터 selected 누락 보정).
      select b.* from public.bids b
       where b.request_id = r.id
         and (b.id = r.selected_bid_id or b.selected = true)
       order by case when b.id = r.selected_bid_id then 0 else 1 end,
                b.selected desc, b.created_at desc
       limit 1
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
    -- 체크포인트 단계 도달 플래그(구/신 명칭 모두) — flow_stage 계산용.
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
        or comp.phone ilike '%' || v_search || '%'
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
