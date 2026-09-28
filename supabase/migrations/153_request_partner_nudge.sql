-- ============================================================
--  Migration 153: 견적이 3일째 없는 요청 — 동네 업체에 «지금 입찰하면 첫 견적이에요»
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다. (152 와 짝)
--
--  왜(대표 09-28 「배짱있게 다운로드 1등」): 견적 0건 요청은 고객이 떠나는 가장 큰 이유다.
--    152 가 고객에게 «요청을 넓혀 보세요»를 보낸다면, 153 은 업체 쪽에서 0건을 메운다.
--  규칙(110 새 요청 알림과 같은 매칭 · 같은 한도 함수)
--    · 대상 요청: open · 만든 지 72시간~6일 · 입찰 0건 · 기간 안
--    · 대상 업체: 승인 상태 · 요청 지역(구·군·시)이 영업지역에 있음 · 한도 안(partner_bid_limit_manwon) · 요청자 본인 X
--      구·군에 맞는 업체가 한 곳도 없으면 같은 시·도(요청 지역 첫 낱말)로 넓힌다
--    · 같은 요청은 업체당 한 번 · 업체 한 곳에 하루 3건까지 · 한국 시간 9~21시 · 한 번에 요청 50건
--    · 푸시는 수신설정(push_enabled · push_estimate_news)이 켜진 업체만
--  /api/push/dispatch 가 152 와 함께 부른다.
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.request_partner_nudge_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_hour  int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  r record; co record; v_pref record;
  v_key text; v_city text; v_budget int; v_limit int; v_where text; v_amount text;
  v_matched int; v_sent int := 0;
  v_title text := '지금 입찰하면 첫 견적이에요';
  v_msg text;
begin
  if v_hour < 9 or v_hour >= 21 then return jsonb_build_object('status', 'quiet_hours'); end if;

  for r in
    select q.* from public.requests q
     where coalesce(q.status, 'open') = 'open'
       and q.created_at < now() - interval '72 hours'
       and q.created_at > now() - interval '6 days'
       and (q.expires_at is null or q.expires_at > now())
       and not exists (select 1 from public.bids b where b.request_id = q.id)
     order by q.created_at asc
     limit 50
  loop
    v_key  := nullif(regexp_replace(trim(coalesce(r.area, '')), '^.*\s', ''), '');
    v_city := nullif(split_part(trim(coalesce(r.area, '')), ' ', 1), '');
    if v_key is null then continue; end if;   -- 지역 없는 요청은 알리지 않는다(110 과 같음)
    v_budget := nullif(coalesce(r.budget_min, 0), 0);
    v_where  := concat_ws(' · ', v_key, nullif(r.space_type, ''), nullif(r.size, ''));
    v_amount := case
      when coalesce(r.budget_max, 0) > 0 and coalesce(r.budget_min, 0) > 0 and r.budget_max <> r.budget_min
        then r.budget_min || '~' || r.budget_max || '만원'
      when coalesce(r.budget_max, 0) > 0 then r.budget_max || '만원'
      when coalesce(r.budget_min, 0) > 0 then r.budget_min || '만원'
      else '예산 미정' end;
    v_msg := v_where || ' · ' || v_amount || ' — 3일째 견적이 없어요. 지금 보내면 고객이 가장 먼저 봐요.';

    -- 구·군 → (없으면) 시·도
    select count(*) into v_matched from public.companies c
     where c.owner_id is not null and c.owner_id is distinct from r.user_id
       and (c.company_status is null or c.company_status = 'ACTIVE')
       and (coalesce(c.region, '') ilike '%' || v_key || '%' or coalesce(c.service_regions::text, '') ilike '%' || v_key || '%');

    for co in
      select c.id, c.owner_id from public.companies c
       where c.owner_id is not null and c.owner_id is distinct from r.user_id
         and (c.company_status is null or c.company_status = 'ACTIVE')
         and (
           (v_matched > 0 and (coalesce(c.region, '') ilike '%' || v_key || '%' or coalesce(c.service_regions::text, '') ilike '%' || v_key || '%'))
           or (v_matched = 0 and v_city is not null and (coalesce(c.region, '') ilike '%' || v_city || '%' or coalesce(c.service_regions::text, '') ilike '%' || v_city || '%'))
         )
    loop
      begin
        v_limit := public.partner_bid_limit_manwon(co.id);
        if v_budget is not null and v_limit is not null and v_budget > v_limit then continue; end if;   -- 한도 밖은 X
        if exists (select 1 from public.notifications n
                    where n.user_id = co.owner_id and n.type = 'REQUEST_FIRST_BID' and n.related_id = r.id) then continue; end if;
        if (select count(*) from public.notifications n
             where n.user_id = co.owner_id and n.type = 'REQUEST_FIRST_BID' and n.created_at >= v_today) >= 3 then continue; end if;

        insert into public.notifications (user_id, type, title, message, related_id, related_type)
        values (co.owner_id, 'REQUEST_FIRST_BID', v_title, v_msg, r.id, 'request');

        select * into v_pref from public.push_preferences p where p.user_id = co.owner_id;
        if v_pref.user_id is not null and coalesce(v_pref.push_enabled, false)
           and coalesce((to_jsonb(v_pref) ->> 'push_estimate_news')::boolean, true) then
          insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
          values (co.owner_id, 'REQUEST_FIRST_BID', v_title, v_msg, '/requests/' || r.id, r.id::text, 'queued')
          on conflict do nothing;
        end if;
        v_sent := v_sent + 1;
      exception when others then null;   -- 한 업체 실패가 나머지를 막지 않게
      end;
    end loop;
  end loop;
  return jsonb_build_object('status', 'ok', 'notified', v_sent);
end; $$;
grant execute on function public.request_partner_nudge_due() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'request_partner_nudge_due') as partner_nudge_ok;
