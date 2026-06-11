-- ════════════════════════════════════════════════════════════════════
-- 056_admin_project_flow_list_create_verified.sql
-- admin_project_flow_list 실제 생성 보장 + 생성 검증.
--
-- 배경:
--   047/055 가 SQL Editor 에서 "Success" 였으나 운영 DB 에 함수가 없음
--   (pg_proc 조회 0행). 원인은 멀티 스테이트먼트 + do$$ 동적 DROP + $$ 중첩
--   파싱에서 CREATE 가 실제로 실행되지 않았을 가능성.
--
-- 이 파일(원인 제거):
--   · do$$ 동적 DROP 제거 → 명시적 DROP ... IF EXISTS (두 시그니처).
--   · 달러쿼팅 태그를 $fn$ 로 통일($$ 중첩/파싱 충돌 차단).
--   · 본문(로직)은 047 verbatim — 상태/결제/정산/GPS 변경 없음.
--   · 맨 끝 검증 SELECT — 생성 성공 시 1행 반환(이제 "No rows" 면 실패가 즉시 드러남).
--
-- ★ Supabase SQL Editor 에 "전체" 붙여넣고 한 번에 RUN. 마지막 SELECT 가
--   1행(schema=public, args=text, timestamptz, timestamptz, integer, text, text)을
--   반환하면 성공. 0행이면 위쪽 CREATE 에서 뜬 빨간 에러 메시지를 그대로 회신.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- sentinel uuid 변환 헬퍼(040/046/047 과 동일, 멱등).
create or replace function public._safe_uuid(p text)
returns uuid language plpgsql immutable as $fn$
begin
  return p::uuid;
exception when others then
  return null;
end;
$fn$;

-- 기존 동일 이름 함수 제거(있으면). 두 가지 인자 순서 모두 명시.
drop function if exists public.admin_project_flow_list(text, text, text, timestamptz, timestamptz, int);
drop function if exists public.admin_project_flow_list(text, timestamptz, timestamptz, int, text, text);

-- 정규 시그니처로 생성 — 프론트 호출 키와 일치(p_admin_id/p_date_from/p_date_to/p_limit/p_search/p_status).
create function public.admin_project_flow_list(
  p_admin_id  text,
  p_date_from timestamptz default null,
  p_date_to   timestamptz default null,
  p_limit     int         default 200,
  p_search    text        default null,
  p_status    text        default null
) returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $fn$
declare
  v_admin_uuid uuid;
  v_limit      int;
  v_search     text;
  v_result     jsonb;
begin
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
                          when 'site_visit'         then 1
                          when 'start'              then 2
                          when 'construction_start' then 2
                          when 'middle'             then 3
                          when 'mid_inspection'     then 3
                          when 'complete'           then 4
                          when 'completion'         then 4
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
end;
$fn$;

grant execute on function public.admin_project_flow_list(text, timestamptz, timestamptz, int, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 생성 검증 — 아래 SELECT 가 1행을 반환해야 성공 ──────────────────────────
select n.nspname as schema, p.proname,
       pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.proname = 'admin_project_flow_list';
