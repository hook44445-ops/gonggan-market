-- ============================================================
--  Migration 116: 계약은 사업자부터 (A안 · 대표 확정 2026-09-24)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠️ 이 SQL 을 «먼저» 실행하고 앱을 배포하세요 — 앱 문구(「업체에 안내했어요」「확인되면 알려 드릴게요」
--     「72시간이 지나면 공간온도 영향 없음」)가 여기서 실제로 일어나는 일이다.
--
--  입찰·상담은 누구나. 돈이 오가는 계약(결제)은 사업자등록을 관리자가 확인한(companies.verified) 업체와만.
--  결제 자체를 막는 곳은 앱 결제 화면 + 결제 승인 서버(api/confirm-payment) — 승인 전에 막아 돈이 안 나간다.
--  여기서는 그 사이를 사람에게 알린다.
--
--    1) requests.selected_at — 업체를 고른 시각(기한 72시간의 기준)
--    2) 확인 안 된 업체가 선택되면 → 업체 주인에게 「사업자등록증을 올려 주세요」, 관리자에게 「확인 대기」 알림
--    3) 업체가 확인되면(verified false→true) → 그 업체를 골라 두고 아직 계약 전인 의뢰인에게 「결제할 수 있어요」
--    4) 선택 뒤 72시간이 지나도 확인 안 된 업체를 바꾸거나 취소하면 → 고객 공간온도를 깎지 않는다(114 번복 규칙의 예외)
-- ============================================================

set search_path = public, extensions;

alter table public.requests add column if not exists selected_at timestamptz;

-- 요청에 적힌 업체 참조(업체 ID 또는 주인 사용자 ID) → 업체 행
create or replace function public.company_row_of(p_ref uuid)
returns public.companies language sql stable security definer
set search_path = public, extensions as $$
  select c.* from public.companies c
   where c.id = p_ref or c.owner_id = p_ref
   order by (c.id = p_ref) desc limit 1;
$$;
revoke execute on function public.company_row_of(uuid) from public, anon, authenticated;

-- 1)·2) 선택 순간 -------------------------------------------------------------------
create or replace function public.trg_request_selected_biz()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare co public.companies; v_title text := coalesce(to_jsonb(new) ->> 'type', '시공');
begin
  if new.selected_company_id is null
     or new.selected_company_id is not distinct from old.selected_company_id then
    return new;
  end if;
  new.selected_at := now();

  co := public.company_row_of(new.selected_company_id);
  if co.id is null or coalesce(co.verified, false) then return new; end if;

  if co.owner_id is not null then
    insert into public.notifications (user_id, type, title, message, related_id, related_type)
    values (co.owner_id, 'BIZ_REQUIRED', '선택됐어요! 사업자등록증을 올려 주세요',
            v_title || ' 요청에서 선택됐어요. 공간마켓은 사업자등록을 마친 업체와만 계약해요 — 홈택스에서 당일 발급돼요. '
            || '72시간 안에 「내 한도 · 서류」에 올려 주세요.',
            new.id, 'request');
  end if;

  insert into public.notifications (user_id, type, title, message, related_id, related_type)
  select u.id, 'ADMIN_BIZ_PENDING', '사업자 확인 대기',
         coalesce(co.name, '업체') || ' — 의뢰인이 선택함. 사업자등록증 확인 뒤에 결제가 열립니다.',
         new.id, 'request'
    from public.users u where u.role = 'admin';
  return new;
exception when others then
  return new;   -- 알림 실패가 선택 저장을 막지 않는다
end; $$;

drop trigger if exists trg_request_selected_biz on public.requests;
create trigger trg_request_selected_biz before update on public.requests
  for each row execute function public.trg_request_selected_biz();

-- 3) 업체가 확인되면 기다리던 의뢰인에게 ----------------------------------------------
create or replace function public.trg_company_verified_notify()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if coalesce(new.verified, false) and not coalesce(old.verified, false) then
    insert into public.notifications (user_id, type, title, message, related_id, related_type)
    select r.user_id, 'BIZ_VERIFIED', '결제할 수 있어요',
           coalesce(new.name, '업체') || '의 사업자등록이 확인됐어요. 이제 계약(결제)을 진행할 수 있어요.',
           r.id, 'request'
      from public.requests r
     where r.selected_company_id in (new.id, new.owner_id)
       and r.user_id is not null
       and coalesce(r.status, '') not in ('cancelled','canceled','completed','expired','closed')
       and not exists (select 1 from public.escrow_payments e where e.request_id = r.id);
  end if;
  return new;
exception when others then
  return new;
end; $$;

drop trigger if exists trg_company_verified_notify on public.companies;
create trigger trg_company_verified_notify after update on public.companies
  for each row execute function public.trg_company_verified_notify();

-- 4) 번복 예외 — 114 의 함수를 그대로 두고 맨 앞에 한 조건만 더한다 --------------------------
create or replace function public.trg_request_customer_reversal()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_kind text; v_delta numeric; co public.companies;
begin
  -- A안: 선택 뒤 72시간이 지나도 사업자 확인이 안 된 업체였다면, 바꾸거나 취소해도 고객 탓이 아니다.
  if old.selected_company_id is not null
     and old.selected_at is not null
     and old.selected_at < now() - interval '72 hours' then
    co := public.company_row_of(old.selected_company_id);
    if co.id is not null and not coalesce(co.verified, false) then
      return new;
    end if;
  end if;

  if old.selected_company_id is not null
     and new.status in ('cancelled','canceled')
     and coalesce(old.status, '') not in ('cancelled','canceled','completed','expired','closed') then
    v_kind := 'cancel_after_select'; v_delta := -1.0;
  elsif old.selected_company_id is not null
     and new.selected_company_id is not null
     and new.selected_company_id <> old.selected_company_id then
    v_kind := 'switch_company'; v_delta := -0.5;
  else
    return new;
  end if;

  if coalesce((to_jsonb(new) ->> 'description'), '') like '[점검%'
     or coalesce((to_jsonb(new) ->> 'desc'), '') like '[점검%' then
    return new;
  end if;

  insert into public.customer_temp_events (request_id, kind, user_id, delta)
  values (new.id, v_kind, new.user_id, v_delta)
  on conflict (request_id, kind) do nothing;
  if found then perform public.customer_temp_add(new.user_id, v_delta); end if;
  return new;
exception when others then
  return new;
end; $$;

notify pgrst, 'reload schema';

-- 확인: 넷 다 true 면 끝
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'requests' and column_name = 'selected_at') as selected_at_ok,
  exists (select 1 from pg_trigger where tgname = 'trg_request_selected_biz')    as select_notify_ok,
  exists (select 1 from pg_trigger where tgname = 'trg_company_verified_notify') as verified_notify_ok,
  not has_function_privilege('anon', 'public.company_row_of(uuid)', 'execute')    as helper_locked;
