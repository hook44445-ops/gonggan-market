-- ============================================================
--  Migration 166: 견적·현장방문·증거(체크포인트)·추가공사·요청 함수 — «토큰의 사용자»로만 판단 (보완 S4)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(이 함수들을 로그인 토큰으로 부르는 버전) → 대표 재로그인으로 토큰 확인 → 이 SQL.
--          배포 전 앱은 토큰 없이 불러 «LOGIN_REQUIRED» 로 막힌다(131·138 과 같은 순서).
--
--  문제(09-29 정부지원 준비 보안 점검 S4)
--    · 아래 28개 함수가 앱이 보낸 p_actor_id(사용자 ID)를 믿었다. 사용자 ID 는 공개 화면에서 알 수 있어
--      다른 사람 이름으로 현장 사진·GPS 증거를 저장하거나, 견적을 올리거나, 요청을 고치고 취소할 수 있었다.
--      특히 project_checkpoint_save / project_contract_checkpoint_save 는 «공사 증거» 라 위조되면 분쟁 때 쓸 수 없다.
--  고침
--    · 함수 몸통은 가장 최근 정의(주석에 파일 번호) 그대로 옮기고, 맨 앞에서 p_actor_id := auth.uid() 로 바꾼다.
--      쓰기 함수는 토큰이 없으면 LOGIN_REQUIRED. 읽기 함수(방 목록·체크포인트 보기·계약 ID 찾기)는 토큰이 없으면 빈 결과.
--    · p_actor_id 는 이름만 남긴다(앱 호환). 권한 표(grant)는 create or replace 라 그대로.
--  되돌리기: 각 함수의 «최근 정의» 파일(주석)의 해당 create or replace 문을 다시 실행하면 예전 그대로.
--  확인 칸 3개(맨 아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- change_order_approve (최근 정의: 033_change_orders_policy.sql)
create or replace function public.change_order_approve(p_actor_id uuid, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) <> 'consumer' then raise exception 'NOT_CONSUMER'; end if;

  update public.change_orders set
    status = 'approved', approved_by_customer = true, approved_at = now(), updated_at = now()
  where id = p_id and status = 'requested'
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_APPROVABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- change_order_cancel (최근 정의: 033_change_orders_policy.sql)
create or replace function public.change_order_cancel(p_actor_id uuid, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) is null then raise exception 'NOT_CONTRACT_PARTY'; end if;

  update public.change_orders set
    status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_id and status in ('requested','approved','payment_pending')
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_CANCELLABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- change_order_complete (최근 정의: 033_change_orders_policy.sql)
create or replace function public.change_order_complete(p_actor_id uuid, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) <> 'company' then raise exception 'NOT_COMPANY'; end if;

  -- 정산 정책: 추가견적은 결제 완료 + 추가공사 완료 후 100% 지급(원계약과 분리).
  update public.change_orders set
    status = 'completed', completed_at = now(), settled_at = now(), updated_at = now()
  where id = p_id and status = 'paid'
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_COMPLETABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- change_order_create (최근 정의: 033_change_orders_policy.sql)
create or replace function public.change_order_create(
  p_actor_id uuid, p_contract_id uuid, p_role text, p_reason_type text,
  p_description text, p_amount integer, p_photos text[]
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_role text; v_row public.change_orders;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  v_role := public._change_order_role(p_contract_id, p_actor_id);
  if v_role is null then raise exception 'NOT_CONTRACT_PARTY'; end if;
  if p_role is distinct from v_role then raise exception 'ROLE_MISMATCH'; end if;
  if p_reason_type is null or length(coalesce(p_description,'')) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;

  insert into public.change_orders (
    contract_id, requested_by, requested_by_role, reason_type, description,
    amount, photos, status, created_at, updated_at
  ) values (
    p_contract_id, p_actor_id, p_role, p_reason_type, p_description,
    coalesce(p_amount, 0), coalesce(p_photos, '{}'), 'requested', now(), now()
  ) returning * into v_row;

  -- 신뢰 데이터: 업체별 발생 건수(구조 유지, UI 미노출)
  update public.companies set change_order_count = coalesce(change_order_count, 0) + 1
   where id = (select company_id from public.escrow_payments where id = p_contract_id);

  return to_jsonb(v_row);
end; $$;

-- change_order_mark_paid (최근 정의: 033_change_orders_policy.sql)
create or replace function public.change_order_mark_paid(p_actor_id uuid, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) <> 'consumer' then raise exception 'NOT_CONSUMER'; end if;

  update public.change_orders set
    status = 'paid', paid_at = now(), updated_at = now()
  where id = p_id and status in ('approved','payment_pending')
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_PAYABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- change_order_reject (최근 정의: 033_change_orders_policy.sql)
create or replace function public.change_order_reject(p_actor_id uuid, p_id uuid, p_reason text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) is null then raise exception 'NOT_CONTRACT_PARTY'; end if;

  update public.change_orders set
    status = 'rejected', reject_reason = p_reason, updated_at = now()
  where id = p_id and status in ('requested','approved','payment_pending')
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_REJECTABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- change_order_set_amount (최근 정의: 033_change_orders_policy.sql)
create or replace function public.change_order_set_amount(
  p_actor_id uuid, p_id uuid, p_amount integer, p_description text, p_photos text[]
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_contract uuid; v_row public.change_orders;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select contract_id into v_contract from public.change_orders where id = p_id;
  if public._change_order_role(v_contract, p_actor_id) <> 'company' then raise exception 'NOT_COMPANY'; end if;

  update public.change_orders set
    amount = coalesce(p_amount, amount),
    description = coalesce(p_description, description),
    photos = coalesce(p_photos, photos),
    updated_at = now()
  where id = p_id and status = 'requested'
  returning * into v_row;
  if v_row.id is null then raise exception 'NOT_EDITABLE'; end if;
  return to_jsonb(v_row);
end; $$;

-- company_guarantee_select (최근 정의: 068_company_guarantee.sql)
create or replace function public.company_guarantee_select(
  p_actor_id   uuid,
  p_company_id uuid,
  p_grade      text
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_row    public.companies;
  v_amount integer;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if p_actor_id is null or p_company_id is null then
    raise exception 'ACTOR_AND_COMPANY_REQUIRED';
  end if;
  if p_grade not in ('BASIC','STANDARD','PREMIUM','MASTER','SIGNATURE') then
    raise exception 'INVALID_GRADE: %', coalesce(p_grade, '(null)');
  end if;

  -- 소유자 검증.
  select * into v_row from public.companies
   where id = p_company_id and owner_id = p_actor_id;
  if v_row.id is null then raise exception 'NOT_COMPANY_OWNER'; end if;

  -- 입금확인 이후 등급 변경 차단(NONE/PENDING_DEPOSIT 에서만 선택/변경 허용).
  if v_row.guarantee_status not in ('NONE','PENDING_DEPOSIT') then
    raise exception 'GUARANTEE_LOCKED: %', v_row.guarantee_status;
  end if;

  v_amount := public._guarantee_amount(p_grade);

  update public.companies set
    guarantee_grade      = p_grade,
    guarantee_amount     = v_amount,
    guarantee_status     = 'PENDING_DEPOSIT',
    guarantee_updated_at = now()
  where id = p_company_id
  returning * into v_row;

  return to_jsonb(v_row);
end; $fn$;

-- contract_bootstrap (최근 정의: 092_contract_bootstrap_enrich_bid.sql)
create or replace function public.contract_bootstrap(p_contract_id uuid, p_actor_id uuid)
returns jsonb language sql stable security definer
set search_path = public, extensions as $$
  select jsonb_build_object(
           'request_id',       ep.request_id,
           'company_id',       ep.company_id,
           'customer_id',      r.user_id,
           'company_owner_id', c.owner_id,
           -- 계약 업체 입찰(추가 반환) — 화면 resolvedBid 복원용(price 포함)
           'bid_id',           b.id,
           'bid_price',        to_jsonb(b) -> 'price',
           'bid_period',       to_jsonb(b) -> 'period_days',
           'bid_material',     to_jsonb(b) -> 'material_note',
           'bid_comment',      to_jsonb(b) -> 'comment',
           'bid_selected',     to_jsonb(b) -> 'selected'   -- 운영 bids 에 없는 칸이 있어도 멈추지 않게(없으면 null)
         )
    from public.escrow_payments ep
    left join public.requests  r on r.id = ep.request_id
    left join public.companies c on c.id = ep.company_id
    left join public.bids      b on b.request_id = ep.request_id
                                and b.company_id = ep.company_id
   where ep.id = p_contract_id
     and auth.uid() is not null
     and (r.user_id = auth.uid() or c.owner_id = auth.uid())
   limit 1;
$$;

-- estimate_submit (최근 정의: 045_estimate_submit_keep_5arg.sql)
create or replace function public.estimate_submit(
  p_actor_id uuid, p_estimate_id uuid, p_site_visit_id uuid, p_request_id uuid,
  p_photo_urls text[] default '{}'
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.estimates;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.estimates e join public.companies c on c.id = e.company_id
     where e.id = p_estimate_id and c.owner_id = p_actor_id
  ) then
    raise exception 'NOT_ESTIMATE_OWNER';
  end if;

  -- 상태전이만 수행(타임스탬프 대입 제거 — 아래 헤더 주석의 핫픽스 사유 참조).
  update public.estimates
     set status = 'submitted', submitted_at = now()
   where id = p_estimate_id
   returning * into v_row;

  if p_site_visit_id is not null then
    update public.site_visits set status = 'estimate_submitted'
     where id = p_site_visit_id;
  end if;

  if p_request_id is not null then
    update public.requests set status = 'final_quote_submitted'
     where id = p_request_id and status in ('site_visit','final_quote_submitted');
  end if;

  return to_jsonb(v_row);
end; $$;

-- estimate_upsert (최근 정의: 043_estimate_final_quote_photos.sql)
create or replace function public.estimate_upsert(
  p_actor_id uuid, p_estimate_id uuid, p_bid_id uuid, p_request_id uuid,
  p_site_visit_id uuid, p_company_id uuid, p_items jsonb, p_total_price bigint,
  p_duration_days int, p_note text, p_warranty_note text,
  p_photo_urls text[] default '{}'
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.estimates;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if not public._actor_owns_company(p_company_id, p_actor_id) then
    raise exception 'NOT_COMPANY_OWNER';
  end if;

  if p_estimate_id is null then
    insert into public.estimates (
      bid_id, request_id, site_visit_id, company_id, items, total_price,
      duration_days, note, warranty_note, final_quote_photo_urls, status, created_at, updated_at
    ) values (
      p_bid_id, p_request_id, p_site_visit_id, p_company_id, coalesce(p_items,'[]'::jsonb), p_total_price,
      p_duration_days, p_note, p_warranty_note, coalesce(p_photo_urls,'{}'), 'draft', now(), now()
    ) returning * into v_row;
  else
    update public.estimates set
      bid_id = p_bid_id, request_id = p_request_id, site_visit_id = p_site_visit_id,
      company_id = p_company_id, items = coalesce(p_items,'[]'::jsonb), total_price = p_total_price,
      duration_days = p_duration_days, note = p_note, warranty_note = p_warranty_note,
      final_quote_photo_urls = coalesce(p_photo_urls, '{}'), updated_at = now()
    where id = p_estimate_id and company_id = p_company_id
    returning * into v_row;
    if v_row.id is null then raise exception 'ESTIMATE_NOT_FOUND'; end if;
  end if;

  return to_jsonb(v_row);
end; $$;

-- portfolio_delete (최근 정의: 100_portfolios.sql)
create or replace function public.portfolio_delete(p_actor_id uuid, p_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  delete from public.portfolios p
   using public.companies c
   where p.id = p_id and c.id = p.company_id and c.owner_id = p_actor_id;
  if not found then raise exception 'NOT_COMPANY_OWNER'; end if;
end; $$;

-- portfolio_save (최근 정의: 100_portfolios.sql)
create or replace function public.portfolio_save(
  p_actor_id uuid, p_company_id uuid, p_id uuid,
  p_title text, p_space_type text, p_area text, p_size text, p_budget integer,
  p_desc text, p_tags text[], p_before text[], p_after text[], p_contract_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.portfolios;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.companies c where c.id = p_company_id and c.owner_id = p_actor_id) then
    raise exception 'NOT_COMPANY_OWNER';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'TITLE_REQUIRED';
  end if;

  if p_id is null then
    insert into public.portfolios (company_id, contract_id, title, space_type, area, size, budget,
                                   before_photos, after_photos, "desc", tags)
    values (p_company_id, p_contract_id, trim(p_title), p_space_type, p_area, p_size, p_budget,
            coalesce(p_before, '{}'), coalesce(p_after, '{}'), p_desc, coalesce(p_tags, '{}'))
    returning * into v_row;
  else
    update public.portfolios
       set title = trim(p_title), space_type = p_space_type, area = p_area, size = p_size, budget = p_budget,
           before_photos = coalesce(p_before, '{}'), after_photos = coalesce(p_after, '{}'),
           "desc" = p_desc, tags = coalesce(p_tags, '{}'), updated_at = now()
     where id = p_id and company_id = p_company_id
    returning * into v_row;
    if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  end if;

  return to_jsonb(v_row);
end; $$;

-- project_checkpoint_save (최근 정의: 082_project_checkpoint_save_fix_b_selected.sql)
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
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  -- 액터가 해당 요청의 선택된 업체 또는 계약 업체의 소유자인지 검증.
  --   · requests.selected_company_id 직접 매칭
  --   · escrow_payments.company_id 매칭
  --   · requests.selected_bid_id 가 가리키는 입찰의 업체(= 선택된 입찰 업체)  ← b.selected 대체(SSOT)
  if not exists (
    select 1 from public.companies c
     where c.owner_id = p_actor_id
       and (
         c.id = (select selected_company_id from public.requests where id = p_request_id)
         or c.id = (select company_id from public.escrow_payments where id = p_contract_id)
         or exists (
              select 1
                from public.bids b
                join public.requests r on r.id = b.request_id
               where b.request_id = p_request_id
                 and b.company_id = c.id
                 and r.selected_bid_id = b.id)
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

-- project_checkpoints_for_request (최근 정의: 106_checkpoints_read_and_completion_trigger.sql)
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
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
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

-- project_contract_checkpoint_save (최근 정의: 067_contract_checkpoint.sql)
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
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
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

-- project_rooms_for_actor (최근 정의: 104_project_rooms_status_fix.sql)
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
     where auth.uid() is not null and r.user_id = auth.uid()
    union all
    select r.*, c.id as co_id, 'company'::text as role,
           cu.name as other_name, cu.phone as other_phone
      from public.requests r
      join public.companies c on c.id = r.selected_company_id and c.owner_id = auth.uid()
      left join public.users cu on cu.id = r.user_id
     where auth.uid() is not null
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

-- request_approve_final_quote (최근 정의: 103_project_chat_rooms.sql)
create or replace function public.request_approve_final_quote(
  p_request_id uuid, p_actor_id uuid
) returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_new text;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
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

-- request_cancel_by_owner (최근 정의: 128_reversal_by_effort_bid_cap.sql)
create or replace function public.request_cancel_by_owner(
  p_request_id uuid, p_actor_id uuid, p_reason text default null)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_req public.requests;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_req.user_id is distinct from p_actor_id then
    raise exception 'NOT_REQUEST_OWNER' using errcode = '42501';
  end if;
  if v_req.status in ('cancelled','canceled','expired','closed','completed') then
    return v_req.status;
  end if;
  -- 결제(에스크로)가 있으면 여기서는 못 한다 — 이의 신청·분쟁 절차
  if v_req.status = 'in_progress' or exists (
       select 1 from public.escrow_payments e
        where e.request_id = p_request_id
          and coalesce(e.transaction_status, '') not in ('CANCELLED','REFUNDED')) then
    raise exception 'PAID_USE_DISPUTE' using errcode = 'P0001';
  end if;

  update public.requests
     set status = 'cancelled',
         hidden_reason = coalesce(nullif(trim(p_reason), ''), hidden_reason)
   where id = p_request_id;
  return 'cancelled';     -- 번복 온도는 1) 트리거가 단계에 맞게
end; $$;

-- request_contract_direct (최근 정의: 119_request_contract_direct.sql)
create or replace function public.request_contract_direct(
  p_request_id uuid, p_bid_id uuid, p_actor_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_req public.requests; v_bid public.bids; v_co uuid;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if not public._actor_owns_request(p_request_id, p_actor_id) then
    raise exception 'NOT_REQUEST_OWNER';
  end if;

  select * into v_req from public.requests where id = p_request_id for update;
  if coalesce(v_req.status, 'open') not in ('open','bidding','site_visit','site_visiting','visit_requested','selected') then
    raise exception 'NOT_CONTRACTABLE: %', v_req.status;
  end if;
  if exists (select 1 from public.escrow_payments e where e.request_id = p_request_id) then
    raise exception 'ALREADY_CONTRACTED';
  end if;

  select * into v_bid from public.bids where id = p_bid_id and request_id = p_request_id;
  if v_bid.id is null then raise exception 'BID_NOT_FOUND'; end if;
  if coalesce(v_bid.price, 0) <= 0 then raise exception 'BID_NO_PRICE'; end if;

  -- bids.company_id 는 업체 ID 일 수도, 업체 주인 사용자 ID 일 수도 있다 → 선택 칸엔 업체 ID(방 ID 규칙과 같게).
  select c.id into v_co from public.companies c
   where c.id = v_bid.company_id or c.owner_id = v_bid.company_id
   order by (c.id = v_bid.company_id) desc limit 1;
  if v_co is null then raise exception 'COMPANY_NOT_FOUND'; end if;

  update public.requests
     set selected_bid_id     = p_bid_id,
         selected_company_id = v_co,
         status              = 'escrow_pending'
   where id = p_request_id;

  -- 입찰 표시는 부가 정보 — 운영 제약에 걸려도 계약 선택을 되돌리지 않는다(선택의 원본은 requests.selected_bid_id).
  begin
    update public.bids set status = 'selected' where id = p_bid_id;
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'request_id', p_request_id, 'bid_id', p_bid_id,
                            'company_id', v_co, 'price', v_bid.price, 'status', 'escrow_pending');
end; $$;

-- request_mark_site_visit (최근 정의: 038_site_visit_rpc_guard.sql)
create or replace function public.request_mark_site_visit(
  p_request_id uuid, p_bid_id uuid, p_company_id uuid, p_actor_id uuid
) returns text language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_req        record;
  v_new_status text;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  -- actor 소유권 검증(의뢰인만 허용)
  if not public._actor_owns_request(p_request_id, p_actor_id) then
    raise exception 'NOT_REQUEST_OWNER';
  end if;

  -- 현재 요청 행을 FOR UPDATE 로 잠근다(동시 호출 직렬화)
  select id, status, selected_company_id, selected_bid_id
    into v_req
    from public.requests
   where id = p_request_id
     for update;

  if v_req.id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  -- 다른 업체가 이미 확정된 경우: 덮어쓰기 금지
  if v_req.selected_company_id is not null
     and p_company_id is not null
     and v_req.selected_company_id != p_company_id then
    raise exception 'COMPANY_MISMATCH: already selected %', v_req.selected_company_id;
  end if;

  -- terminal 상태는 진입 차단(깨진 데이터도 terminal 이면 건드리지 않음)
  if v_req.status in (
    'completed','settled','cancelled','closed','expired','done','finished','refunded'
  ) then
    raise exception 'TERMINAL_STATUS: %', v_req.status;
  end if;

  -- 선택 입찰 단일화 — 같은 요청의 다른 입찰은 해제
  if p_bid_id is not null then
    update public.bids
       set selected = (id = p_bid_id)
     where request_id = p_request_id;
  end if;

  -- 상태 결정:
  --   open / site_visit → site_visit(정상 전이·멱등)
  --   in_progress / escrow_pending / final_quote_submitted / contracting 등 →
  --     status 는 변경하지 않고 selected_* backfill 만.
  if v_req.status in ('open', 'site_visit') then
    v_new_status := 'site_visit';
  else
    v_new_status := v_req.status;   -- 상태 변경 없이 backfill 만
  end if;

  -- selected_* 는 null 일 때만 채운다(이미 있으면 유지)
  update public.requests
     set status              = v_new_status,
         selected_company_id = coalesce(selected_company_id, p_company_id),
         selected_bid_id     = coalesce(selected_bid_id, p_bid_id),
         updated_at          = now()
   where id = p_request_id;

  return v_new_status;
end; $$;

-- request_update_by_owner (최근 정의: 108_ops_switch_request_edit.sql)
create or replace function public.request_update_by_owner(
  p_request_id uuid, p_actor_id uuid,
  p_space_type text, p_size text, p_style text, p_description text)
returns public.requests language plpgsql security definer
set search_path = public, extensions as $$
declare v_req public.requests;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_req.user_id is distinct from p_actor_id then
    raise exception 'NOT_REQUEST_OWNER' using errcode = '42501';
  end if;
  -- 업체를 고른 뒤에는 조건을 바꾸지 않는다(입찰 조건이 달라진다)
  if v_req.status not in ('open') then
    raise exception 'REQUEST_LOCKED' using errcode = 'P0001';
  end if;

  update public.requests
     set space_type  = coalesce(p_space_type, space_type),
         size        = coalesce(p_size, size),
         style       = coalesce(p_style, style),
         description = coalesce(p_description, description)
   where id = p_request_id
  returning * into v_req;
  return v_req;
end; $$;

-- request_update_by_owner (최근 정의: 126_request_budget_edit_and_expire.sql)
create or replace function public.request_update_by_owner(
  p_request_id uuid, p_actor_id uuid,
  p_space_type text, p_size text, p_style text, p_description text,
  p_budget_min int, p_budget_max int)
returns public.requests language plpgsql security definer
set search_path = public, extensions as $$
declare v_req public.requests; v_bids int;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_req.user_id is distinct from p_actor_id then
    raise exception 'NOT_REQUEST_OWNER' using errcode = '42501';
  end if;
  if v_req.status not in ('open') then
    raise exception 'REQUEST_LOCKED' using errcode = 'P0001';
  end if;

  -- 예산을 바꾸려 할 때만 입찰 수를 본다(예산 칸이 비면 예전과 같다)
  if (p_budget_min is not null or p_budget_max is not null)
     and (coalesce(p_budget_min, -1) is distinct from coalesce(v_req.budget_min, -1)
          or coalesce(p_budget_max, -1) is distinct from coalesce(v_req.budget_max, -1)) then
    select count(*) into v_bids from public.bids where request_id = p_request_id;
    if v_bids > 0 then
      raise exception 'BUDGET_LOCKED_HAS_BIDS' using errcode = 'P0001';
    end if;
  end if;

  update public.requests
     set space_type  = coalesce(p_space_type, space_type),
         size        = coalesce(p_size, size),
         style       = coalesce(p_style, style),
         description = coalesce(p_description, description),
         budget_min  = case when p_budget_min is null and p_budget_max is null then budget_min else nullif(p_budget_min, 0) end,
         budget_max  = case when p_budget_min is null and p_budget_max is null then budget_max else nullif(p_budget_max, 0) end
   where id = p_request_id
  returning * into v_req;
  return v_req;
end; $$;

-- resolve_contract_id (최근 정의: 089_resolve_contract_id_rpc.sql)
create or replace function public.resolve_contract_id(p_request_id uuid, p_actor_id uuid)
returns jsonb language sql stable security definer
set search_path = public, extensions as $$
  select jsonb_build_object(
           'contract_id',      ep.id,
           'customer_id',      r.user_id,
           'company_owner_id', c.owner_id
         )
    from public.escrow_payments ep
    left join public.requests  r on r.id = ep.request_id
    left join public.companies c on c.id = ep.company_id
   where ep.request_id = p_request_id
     and auth.uid() is not null
     and (r.user_id = auth.uid() or c.owner_id = auth.uid())
   order by ep.created_at desc
   limit 1;
$$;

-- site_visit_checkin (최근 정의: 031_site_visit_estimate_rpc.sql)
create or replace function public.site_visit_checkin(
  p_actor_id uuid, p_id uuid, p_lat numeric, p_lng numeric, p_photos text[]
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.site_visits sv join public.companies c on c.id = sv.company_id
     where sv.id = p_id and c.owner_id = p_actor_id
  ) then
    raise exception 'NOT_SITE_VISIT_OWNER';
  end if;

  update public.site_visits
     set checked_in_at = now(), gps_lat = p_lat, gps_lng = p_lng,
         photos = coalesce(p_photos, '{}'), status = 'checked_in', updated_at = now()
   where id = p_id
   returning * into v_row;

  return to_jsonb(v_row);
end; $$;

-- site_visit_complete (최근 정의: 031_site_visit_estimate_rpc.sql)
create or replace function public.site_visit_complete(
  p_actor_id uuid, p_id uuid, p_field_amount bigint, p_field_note text
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.site_visits sv join public.companies c on c.id = sv.company_id
     where sv.id = p_id and c.owner_id = p_actor_id
  ) then
    raise exception 'NOT_SITE_VISIT_OWNER';
  end if;

  update public.site_visits
     set completed_at = now(),
         estimate_due_at = now() + interval '72 hours',
         field_estimate_amount = p_field_amount,
         field_estimate_note = p_field_note,
         status = 'completed', updated_at = now()
   where id = p_id
   returning * into v_row;

  return to_jsonb(v_row);
end; $$;

-- site_visit_create (최근 정의: 039_site_visit_request_flow.sql)
create or replace function public.site_visit_create(
  p_actor_id uuid, p_bid_id uuid, p_request_id uuid, p_company_id uuid, p_scheduled_at timestamptz
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if not public._actor_owns_company(p_company_id, p_actor_id) then
    raise exception 'NOT_COMPANY_OWNER';
  end if;
  if not exists (
    select 1 from public.bids b
     where b.id = p_bid_id and b.request_id = p_request_id
       and b.company_id = p_company_id
       -- 선택 정보의 원본은 requests.selected_bid_id / selected_company_id(082·105) — 운영 bids 에는 selected 칸이 없다
       and exists (select 1 from public.requests r
                    where r.id = p_request_id
                      and (r.selected_bid_id = b.id or r.selected_company_id = p_company_id))
  ) then
    raise exception 'BID_NOT_SELECTED';
  end if;

  -- 기존(요청/수락/created) row 재사용 → scheduled 로 갱신. 없으면 신규 생성.
  select * into v_row from public.site_visits
   where bid_id = p_bid_id and status not in ('rejected','cancelled')
   order by created_at desc
   limit 1;

  if v_row.id is null then
    insert into public.site_visits (bid_id, request_id, company_id, status, scheduled_at, created_at, updated_at)
    values (p_bid_id, p_request_id, p_company_id, 'scheduled', p_scheduled_at, now(), now())
    returning * into v_row;
  else
    update public.site_visits
       set status = 'scheduled', scheduled_at = p_scheduled_at, updated_at = now()
     where id = v_row.id
     returning * into v_row;
  end if;

  return to_jsonb(v_row);
end; $$;

-- site_visit_request (최근 정의: 039_site_visit_request_flow.sql)
create or replace function public.site_visit_request(
  p_actor_id uuid, p_request_id uuid, p_bid_id uuid, p_company_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  -- 요청 소유자(의뢰인)만 현장견적 요청 가능
  if not public._actor_owns_request(p_request_id, p_actor_id) then
    raise exception 'NOT_REQUEST_OWNER';
  end if;

  -- 중복 방지: 같은 request+bid+company 의 비종료 site_visit 이 있으면 재사용
  select * into v_row from public.site_visits
   where request_id = p_request_id and bid_id = p_bid_id and company_id = p_company_id
     and status not in ('rejected','cancelled')
   order by created_at desc
   limit 1;

  if v_row.id is null then
    insert into public.site_visits (request_id, bid_id, company_id, status, created_at, updated_at)
    values (p_request_id, p_bid_id, p_company_id, 'requested', now(), now())
    returning * into v_row;
  end if;

  -- 입찰 선택 단일화 + 요청 상태 전이(현장방문 견적 단계)
  if p_bid_id is not null then
    update public.bids set selected = (id = p_bid_id) where request_id = p_request_id;
  end if;
  update public.requests
     set status = 'site_visit',
         selected_bid_id     = coalesce(p_bid_id, selected_bid_id),
         selected_company_id = coalesce(p_company_id, selected_company_id),
         updated_at = now()
   where id = p_request_id
     and status in ('open','site_visit');

  return to_jsonb(v_row);
end; $$;

-- site_visit_respond (최근 정의: 039_site_visit_request_flow.sql)
create or replace function public.site_visit_respond(
  p_actor_id uuid, p_id uuid, p_action text
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits; v_status text;
begin
  p_actor_id := auth.uid();   -- 166: 행위자는 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if p_actor_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.site_visits sv join public.companies c on c.id = sv.company_id
     where sv.id = p_id and c.owner_id = p_actor_id
  ) then
    raise exception 'NOT_SITE_VISIT_OWNER';
  end if;

  v_status := case p_action when 'accept' then 'accepted'
                            when 'reject' then 'rejected'
                            else null end;
  if v_status is null then raise exception 'BAD_ACTION'; end if;

  update public.site_visits
     set status = v_status, updated_at = now()
   where id = p_id and status in ('requested','accepted')
   returning * into v_row;
  if v_row.id is null then raise exception 'NOT_RESPONDABLE'; end if;

  return to_jsonb(v_row);
end; $$;

-- ── 확인 ──────────────────────────────────────────────────────
--  ① token_all: 28개 함수(29개 판)가 모두 auth.uid() 로 판단한다
--  ② login_guard: 쓰기 함수 25개 판에 LOGIN_REQUIRED 가 들어갔다
--  ③ no_old_overload: 지운 옛 판(034·043·045 에서 정리)이 되살아나지 않았다
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'change_order_approve','change_order_cancel','change_order_complete','change_order_create','change_order_mark_paid',
      'change_order_reject','change_order_set_amount','company_guarantee_select','contract_bootstrap','estimate_submit',
      'estimate_upsert','portfolio_delete','portfolio_save','project_checkpoint_save','project_checkpoints_for_request',
      'project_contract_checkpoint_save','project_rooms_for_actor','request_approve_final_quote','request_cancel_by_owner',
      'request_contract_direct','request_mark_site_visit','request_update_by_owner','resolve_contract_id','site_visit_checkin',
      'site_visit_complete','site_visit_create','site_visit_request','site_visit_respond')
      and p.prosrc like '%auth.uid()%') = 29 as token_all,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%166: 행위자%' and p.prosrc like '%LOGIN_REQUIRED%') = 25 as login_guard,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('estimate_submit','estimate_upsert','project_checkpoint_save')) = 3 as no_old_overload;
