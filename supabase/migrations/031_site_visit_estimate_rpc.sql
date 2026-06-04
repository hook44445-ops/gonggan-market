-- ════════════════════════════════════════════════════════════════════
-- 031_site_visit_estimate_rpc.sql
-- 현장방문 견적 흐름 2차 — 쓰기 경로를 security-definer RPC 로 보장.
--
-- 배경:
--   이 앱은 전화번호(OTP) 커스텀 인증이라 auth.uid()=null 이다. requests/site_visits/
--   estimates 의 RLS 는 모두 auth.uid() 기반(owner/company)이라 anon 직접 INSERT/UPDATE 가
--   0행으로 막힌다(030 에서 requests 전이를 RPC 로 처리한 것과 동일 원인).
--   또한 코드가 쓰는 컬럼/상태값 일부가 스키마에 없어(현장방문 scheduled, scheduled_at,
--   estimates.items/company_id 등) 제약·컬럼 오류로도 저장이 실패한다.
--
-- 처리:
--   1) 누락 컬럼·상태값 보강(멱등).
--   2) 현장방문/최종견적/requests 상태 전이를 security-definer RPC 로 감싼다.
--      · RLS 는 제한적으로 유지(직접 쓰기 개방 금지).
--      · RPC 내부에서 p_actor_id 기준으로 요청 소유자(의뢰인) / 선택된 업체 소유자를 검증.
--      · 분쟁/정산 증빙 데이터이므로 임의 actor 의 쓰기를 차단.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ────────────────────────────────────────────────────────────────────
-- 0. 스키마 보강 — 코드가 쓰는 컬럼/상태값 정합 (멱등)
-- ────────────────────────────────────────────────────────────────────

-- requests: 선택 입찰/업체 추적(029 미적용 환경 대비, 멱등)
alter table public.requests
  add column if not exists selected_bid_id     uuid,
  add column if not exists selected_company_id uuid;

-- site_visits: 실측 예약시각 + 'scheduled' 상태
alter table public.site_visits
  add column if not exists scheduled_at timestamptz;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.site_visits'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.site_visits drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.site_visits
  add constraint site_visits_status_check check (status in (
    'created','scheduled','checked_in','completed','estimate_submitted','cancelled'
  ));

-- estimates: 플랫폼 견적서 작성에 필요한 컬럼
alter table public.estimates
  add column if not exists bid_id        uuid references public.bids(id)      on delete set null,
  add column if not exists company_id    uuid references public.companies(id) on delete set null,
  add column if not exists items         jsonb default '[]'::jsonb,
  add column if not exists duration_days int,
  add column if not exists note          text,
  add column if not exists warranty_note text;

-- ────────────────────────────────────────────────────────────────────
-- 1. actor 검증 헬퍼 — security definer
-- ────────────────────────────────────────────────────────────────────

-- 액터가 해당 업체(company)의 소유자인지
create or replace function public._actor_owns_company(p_company_id uuid, p_actor_id uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select p_actor_id is not null and exists (
    select 1 from public.companies c
     where c.id = p_company_id and c.owner_id = p_actor_id
  );
$$;

-- 액터가 해당 요청의 소유자(의뢰인)인지
create or replace function public._actor_owns_request(p_request_id uuid, p_actor_id uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select p_actor_id is not null and exists (
    select 1 from public.requests r
     where r.id = p_request_id and r.user_id = p_actor_id
  );
$$;

-- ────────────────────────────────────────────────────────────────────
-- 2. requests 상태 전이 RPC
-- ────────────────────────────────────────────────────────────────────

-- 업체 선택(의뢰인) → site_visit. 선택 입찰/업체 기록 + bids.selected 단일화.
create or replace function public.request_mark_site_visit(
  p_request_id uuid, p_bid_id uuid, p_company_id uuid, p_actor_id uuid
) returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_new text;
begin
  if not public._actor_owns_request(p_request_id, p_actor_id) then
    raise exception 'NOT_REQUEST_OWNER';
  end if;

  -- 선택 입찰 단일화(같은 요청의 다른 입찰은 해제)
  if p_bid_id is not null then
    update public.bids set selected = (id = p_bid_id)
     where request_id = p_request_id;
  end if;

  update public.requests
     set status = 'site_visit',
         selected_bid_id     = coalesce(p_bid_id, selected_bid_id),
         selected_company_id = coalesce(p_company_id, selected_company_id),
         updated_at = now()
   where id = p_request_id
     and status in ('open','site_visit')
   returning status into v_new;

  return v_new;
end; $$;

-- 의뢰인 최종견적 승인 → escrow_pending (+ 제출 견적서 accepted)
create or replace function public.request_approve_final_quote(
  p_request_id uuid, p_actor_id uuid
) returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_new text;
begin
  if not public._actor_owns_request(p_request_id, p_actor_id) then
    raise exception 'NOT_REQUEST_OWNER';
  end if;

  update public.estimates
     set status = 'accepted', updated_at = now()
   where request_id = p_request_id and status = 'submitted';

  update public.requests
     set status = 'escrow_pending', updated_at = now()
   where id = p_request_id
     and status in ('final_quote_submitted','escrow_pending')
   returning status into v_new;

  return v_new;
end; $$;

-- 결제(에스크로) 성립 → in_progress. 030 을 재정의해 escrow_pending 도 허용.
create or replace function public.request_mark_in_progress(p_request_id uuid)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_has_escrow boolean; v_new text;
begin
  select exists (
    select 1 from public.escrow_payments
     where request_id = p_request_id
       and coalesce(transaction_status, '') not in ('SETTLED','CANCELLED','REFUNDED')
  ) into v_has_escrow;

  if not v_has_escrow then
    return null;
  end if;

  update public.requests
     set status = 'in_progress', updated_at = now()
   where id = p_request_id
     and status in ('open','escrow_pending','site_visit','final_quote_submitted')
   returning status into v_new;

  return v_new;
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 3. site_visits 저장 RPC (업체)
-- ────────────────────────────────────────────────────────────────────

-- 현장방문 일정 생성
create or replace function public.site_visit_create(
  p_actor_id uuid, p_bid_id uuid, p_request_id uuid, p_company_id uuid, p_scheduled_at timestamptz
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits;
begin
  if not public._actor_owns_company(p_company_id, p_actor_id) then
    raise exception 'NOT_COMPANY_OWNER';
  end if;
  -- 선택된 업체의 요청에만 현장방문 생성 가능
  if not exists (
    select 1 from public.bids b
     where b.id = p_bid_id and b.request_id = p_request_id
       and b.company_id = p_company_id and b.selected = true
  ) then
    raise exception 'BID_NOT_SELECTED';
  end if;

  insert into public.site_visits (bid_id, request_id, company_id, status, scheduled_at, created_at, updated_at)
  values (p_bid_id, p_request_id, p_company_id, 'scheduled', p_scheduled_at, now(), now())
  returning * into v_row;

  return to_jsonb(v_row);
end; $$;

-- GPS 체크인 (현장방문 1회 위치 기록 · 실시간 추적 아님)
create or replace function public.site_visit_checkin(
  p_actor_id uuid, p_id uuid, p_lat numeric, p_lng numeric, p_photos text[]
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits;
begin
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

-- 현장견적 입력 + 실측 완료 (72h 제출 카운트다운 시작)
create or replace function public.site_visit_complete(
  p_actor_id uuid, p_id uuid, p_field_amount bigint, p_field_note text
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.site_visits;
begin
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

-- ────────────────────────────────────────────────────────────────────
-- 4. estimates 저장 RPC (업체)
-- ────────────────────────────────────────────────────────────────────

-- 견적서 생성/수정 (draft 임시저장)
create or replace function public.estimate_upsert(
  p_actor_id uuid, p_estimate_id uuid, p_bid_id uuid, p_request_id uuid,
  p_site_visit_id uuid, p_company_id uuid, p_items jsonb, p_total_price bigint,
  p_duration_days int, p_note text, p_warranty_note text
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.estimates;
begin
  if not public._actor_owns_company(p_company_id, p_actor_id) then
    raise exception 'NOT_COMPANY_OWNER';
  end if;

  if p_estimate_id is null then
    insert into public.estimates (
      bid_id, request_id, site_visit_id, company_id, items, total_price,
      duration_days, note, warranty_note, status, created_at, updated_at
    ) values (
      p_bid_id, p_request_id, p_site_visit_id, p_company_id, coalesce(p_items,'[]'::jsonb), p_total_price,
      p_duration_days, p_note, p_warranty_note, 'draft', now(), now()
    ) returning * into v_row;
  else
    update public.estimates set
      bid_id = p_bid_id, request_id = p_request_id, site_visit_id = p_site_visit_id,
      company_id = p_company_id, items = coalesce(p_items,'[]'::jsonb), total_price = p_total_price,
      duration_days = p_duration_days, note = p_note, warranty_note = p_warranty_note, updated_at = now()
    where id = p_estimate_id and company_id = p_company_id
    returning * into v_row;
    if v_row.id is null then raise exception 'ESTIMATE_NOT_FOUND'; end if;
  end if;

  return to_jsonb(v_row);
end; $$;

-- 견적서 제출 → estimate submitted + site_visit estimate_submitted + request final_quote_submitted
create or replace function public.estimate_submit(
  p_actor_id uuid, p_estimate_id uuid, p_site_visit_id uuid, p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.estimates;
begin
  if not exists (
    select 1 from public.estimates e join public.companies c on c.id = e.company_id
     where e.id = p_estimate_id and c.owner_id = p_actor_id
  ) then
    raise exception 'NOT_ESTIMATE_OWNER';
  end if;

  update public.estimates
     set status = 'submitted', submitted_at = now(), updated_at = now()
   where id = p_estimate_id
   returning * into v_row;

  if p_site_visit_id is not null then
    update public.site_visits set status = 'estimate_submitted', updated_at = now()
     where id = p_site_visit_id;
  end if;

  if p_request_id is not null then
    update public.requests set status = 'final_quote_submitted', updated_at = now()
     where id = p_request_id and status in ('site_visit','final_quote_submitted');
  end if;

  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 5. 실행 권한 — anon/authenticated 가 RPC 호출(내부에서 actor 검증)
-- ────────────────────────────────────────────────────────────────────
grant execute on function public.request_mark_site_visit(uuid,uuid,uuid,uuid)  to anon, authenticated;
grant execute on function public.request_approve_final_quote(uuid,uuid)        to anon, authenticated;
grant execute on function public.request_mark_in_progress(uuid)                to anon, authenticated;
grant execute on function public.site_visit_create(uuid,uuid,uuid,uuid,timestamptz) to anon, authenticated;
grant execute on function public.site_visit_checkin(uuid,uuid,numeric,numeric,text[]) to anon, authenticated;
grant execute on function public.site_visit_complete(uuid,uuid,bigint,text)    to anon, authenticated;
grant execute on function public.estimate_upsert(uuid,uuid,uuid,uuid,uuid,uuid,jsonb,bigint,int,text,text) to anon, authenticated;
grant execute on function public.estimate_submit(uuid,uuid,uuid,uuid)          to anon, authenticated;

notify pgrst, 'reload schema';
