-- ════════════════════════════════════════════════════════════════════
-- 047_admin_project_flow_list.sql
-- 관리자 "GPS 흐름관리(현장흐름 관리)" 화면 — 조회 전용 통합 리스트 RPC.
--
-- 배경:
--   견적요청→업체입찰→현장실측방문→최종견적제출→계약확정→전액예치→착공확인→
--   중간점검→완료확인→정산완료→리뷰작성 의 11단계 진행상황을 관리자가 한 화면
--   에서 검색/조회할 수 있어야 한다. GPS 체크포인트(현장실측/착공/중간/완료)는
--   이미 032/034 의 project_checkpoints 테이블에 저장되지만, 조회 RPC
--   (project_checkpoints_for_request)는 요청 1건 단위만 지원해 관리자 전체
--   목록 조회에는 쓸 수 없다.
--
-- 이 마이그레이션:
--   · 기존 테이블/컬럼 변경 없음(추가 전용) — requests/bids/site_visits/
--     escrow_payments/project_checkpoints/reviews/direct_deal_reports 그대로 사용.
--   · 신규 함수 1개만 추가: admin_project_flow_list(...) — 읽기 전용 집계,
--     상태 전이·결제·정산·직거래 의심(direct_deal_reports) 로직 변경 없음.
--   · p_admin_id 는 040/046 과 동일한 sentinel 패턴(text):
--       - 유효 uuid 면 users.role='admin' 필수.
--       - 'admin'(코드 관리자 가상 계정) 이면 허용(클라이언트 게이트 신뢰).
--       - 그 외 거부(ADMIN_ONLY).
--   · 반환은 jsonb 배열 — request 1건당 고객/업체/입찰/현장방문/에스크로/GPS
--     체크포인트(배열)/리뷰개수/직거래의심 신고(배열) + 계산된 flow_stage 포함.
--     세부 필터(GPS 누락/사진 누락/낮은 정확도/직거래 의심 분석 등)는 화면(JS)에서
--     이 원본 데이터로 계산 — SQL 은 조회 + 단계 계산만 담당(최소 범위).
--
-- 컬럼 검증(실행 실패 방지):
--   · requests.last_activity_at 는 스키마에 없어 사용하지 않음(정렬은 updated_at/created_at).
--   · project_checkpoints.address_full 은 034 의존이라 미사용(road/jibun 만 노출).
--   · checkpoint_type 은 구(construction_start/mid_inspection/completion)·
--     신(start/middle/complete) 명칭 모두 처리.
--
-- 멱등 · 추가 전용 · 물리 삭제 없음. Supabase SQL Editor 에서 1회 실행(046 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 040/046 과 동일 — 이미 있으면 재생성(idempotent), 046 미적용 환경에서도 단독 실행 가능.
create or replace function public._safe_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end; $$;

create or replace function public.admin_project_flow_list(
  p_admin_id  text,
  p_search    text        default null,
  p_status    text        default null,
  p_date_from timestamptz default null,
  p_date_to   timestamptz default null,
  p_limit     int         default 200
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
      (select b.company_id from public.bids b
        where b.request_id = r.id and b.selected = true limit 1)
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

grant execute on function public.admin_project_flow_list(text, text, text, timestamptz, timestamptz, int)
  to anon, authenticated;

notify pgrst, 'reload schema';
