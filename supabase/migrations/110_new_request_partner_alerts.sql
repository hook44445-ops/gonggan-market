-- ============================================================
--  Migration 110: 새 견적 요청 → 파트너 알림(한도 등급에 따라 다르게)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경 (총점검 09-24 3차 · D6, 대표 지시 「파트너 공사수주 규모 등급에 따라 알람이 가는게 달라지겠는데」)
--    고객이 견적 요청을 올려도 파트너에게 알림이 전혀 가지 않았다(코드·DB 어디에도 없음).
--  규칙
--    · 대상: 승인 상태(ACTIVE 또는 상태 없음)이고 영업지역(region / service_regions)에 요청 지역(구·군·시)이 있는 업체.
--      요청한 본인 업체는 뺀다.
--    · 한도 안(요청 예산 최소값 ≤ 업체 한도, 또는 예산 미정): 「새 견적 요청」 알림 + 즉시 푸시.
--    · 한도 밖: 하루 한 번만 「한도 밖 요청」 알림 + 다음 계단 안내(서류 한 가지). 푸시도 하루 한 번.
--    · 한도는 입찰 트리거와 같은 함수(partner_bid_limit_manwon, 101)로 센다 — 알림과 실제 입찰이 어긋나지 않는다.
--    · 푸시는 수신설정(push_preferences)이 켜져 있을 때만(push_enabled, 견적 소식 push_estimate_news).
-- ============================================================

set search_path = public, extensions;

-- 한도 밖 업체에게 보여 줄 «다음 한 가지»
create or replace function public.partner_next_step_text(p_company uuid)
returns text language sql stable security definer
set search_path = public, extensions as $$
  select case
    when not coalesce(c.verified, false)       then '사업자등록증을 내면 500만원 공사까지 입찰할 수 있어요.'
    when not coalesce(c.has_insurance, false)  then '시공보험을 내면 1,000만원 공사까지 입찰할 수 있어요.'
    when coalesce(c.guarantee_status, '') <> 'ACTIVE' then '보증금을 예치하면 프리미엄으로 더 큰 공사에 입찰할 수 있어요.'
    when not coalesce(c.license_verified, false) then '실내건축공사업 등록증을 내면 1억원 공사까지 입찰할 수 있어요.'
    else '서류 화면에서 한도를 확인해 주세요.'
  end
  from public.companies c where c.id = p_company;
$$;

create or replace function public.request_notify_partners(p_request_id uuid)
returns integer language plpgsql security definer
set search_path = public, extensions as $$
declare
  r        public.requests;
  v_key    text;
  v_budget int;
  v_where  text;
  v_amount text;
  co       record;
  v_limit  int;
  v_fit    boolean;
  v_pref   record;
  v_push   boolean;
  v_title  text;
  v_msg    text;
  v_type   text;
  v_today  timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_count  int := 0;
begin
  select * into r from public.requests where id = p_request_id;
  if r.id is null or coalesce(r.status, 'open') <> 'open' then return 0; end if;

  -- 요청 지역 열쇠: 마지막 낱말(「서울 강서구」 → 「강서구」)
  v_key := nullif(regexp_replace(trim(coalesce(r.area, '')), '^.*\s', ''), '');
  if v_key is null then return 0; end if;   -- 지역 없는 요청은 알리지 않는다(전국 스팸 방지)

  v_budget := nullif(coalesce(r.budget_min, 0), 0);
  v_where  := concat_ws(' · ', v_key, nullif(r.space_type, ''), nullif(r.size, ''));
  v_amount := case
    when coalesce(r.budget_max, 0) > 0 and coalesce(r.budget_min, 0) > 0 and r.budget_max <> r.budget_min
      then r.budget_min || '~' || r.budget_max || '만원'
    when coalesce(r.budget_max, 0) > 0 then r.budget_max || '만원'
    when coalesce(r.budget_min, 0) > 0 then r.budget_min || '만원'
    else '예산 미정' end;

  for co in
    select c.id, c.owner_id
      from public.companies c
     where c.owner_id is not null
       and c.owner_id is distinct from r.user_id
       and (c.company_status is null or c.company_status = 'ACTIVE')
       and (coalesce(c.region, '') ilike '%' || v_key || '%'
         or coalesce(c.service_regions::text, '') ilike '%' || v_key || '%')
  loop
    v_limit := public.partner_bid_limit_manwon(co.id);
    v_fit   := v_budget is null or v_limit is null or v_budget <= v_limit;

    if v_fit then
      v_type  := 'NEW_REQUEST';
      v_title := '새 견적 요청';
      v_msg   := v_where || ' · ' || v_amount || ' — 바로 입찰할 수 있어요.';
    else
      -- 한도 밖은 하루 한 번만
      if exists (select 1 from public.notifications n
                  where n.user_id = co.owner_id and n.type = 'NEW_REQUEST_LOCKED' and n.created_at >= v_today) then
        continue;
      end if;
      v_type  := 'NEW_REQUEST_LOCKED';
      v_title := '한도 밖 견적 요청이 들어왔어요';
      v_msg   := v_where || ' · ' || v_amount || ' (지금 한도 ' || v_limit || '만원). '
                 || public.partner_next_step_text(co.id);
    end if;

    -- 같은 요청을 두 번 알리지 않는다
    if exists (select 1 from public.notifications n
                where n.user_id = co.owner_id and n.related_id = r.id and n.type in ('NEW_REQUEST', 'NEW_REQUEST_LOCKED')) then
      continue;
    end if;

    insert into public.notifications (user_id, type, title, message, related_id, related_type)
    values (co.owner_id, v_type, v_title, v_msg, r.id, 'request');

    select * into v_pref from public.push_preferences p where p.user_id = co.owner_id;
    v_push := v_pref.user_id is not null
              and coalesce(v_pref.push_enabled, false)
              and coalesce((to_jsonb(v_pref) ->> 'push_estimate_news')::boolean, true);
    if v_push then
      insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
      values (co.owner_id, v_type, v_title, v_msg, '/requests/' || r.id, r.id::text, 'queued')
      on conflict do nothing;
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end; $$;

grant execute on function public.request_notify_partners(uuid) to anon, authenticated;

-- 요청이 저장되면 서버가 알린다(어느 화면·경로로 들어와도 같다). 실패해도 요청 저장은 막지 않는다.
create or replace function public.trg_request_notify_partners()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  begin
    perform public.request_notify_partners(new.id);
  exception when others then
    null;
  end;
  return new;
end; $$;

drop trigger if exists trg_request_notify_partners on public.requests;
create trigger trg_request_notify_partners after insert on public.requests
  for each row execute function public.trg_request_notify_partners();

notify pgrst, 'reload schema';
