-- ============================================================
--  Migration 203: 업체 알림 두 가지 — 사업자등록 확인 전 업체에 «바로 입찰 · 견적을 보내 보세요»라고 하지 않는다
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다. 순서: 상관없음(앱과 따로).
--
--  왜(10-02 업체 가입 깔때기 점검 · 대표 «업체 10곳» 병목):
--    · SQL 124(09-25)부터 사업자등록 확인 전 업체는 입찰 한도 0(입찰 잠김)인데,
--      ① 새 요청 알림(110): 예산이 «미정»인 요청은 «바로 입찰할 수 있어요»로 갔고(입찰하려 하면 막힘),
--         예산이 있는 요청은 «한도 밖 견적 요청 · 지금 한도 0만원»으로 갔다(무슨 말인지 모름).
--      ② 월요일 동네 요청 알림(171): «아직 입찰할 수 있는 요청 K건 — 지금 먼저 견적을 보내 보세요»(보낼 수 없음).
--    · 새로 가입한 업체가 바로 이 상태라, 첫 알림이 거짓이면 앱을 다시 열 이유가 사라진다.
--  고침(두 함수를 같은 내용으로 다시 만들고 문구 · 갈래만 바꿈 — 권한(115 잠금 등)은 그대로 남는다):
--    ① 한도 0 이면 «우리 동네 새 견적 요청 — 사업자등록증을 올리면 입찰할 수 있어요(홈택스에서 당일 발급)» · 하루 한 번
--    ② 확인 전 업체의 월요일 알림: «아직 열린 요청이 K건 있어요. 사업자등록증을 올리면 입찰할 수 있어요»
--    확인된 업체에게 가는 알림은 예전과 똑같다.
--  되돌리기: 110 · 171 파일의 같은 함수 부분을 다시 실행.
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

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
    -- 203: 한도 0(사업자등록 확인 전 — 124)이면 «바로 입찰»이 아니다. 예산 미정 요청도 «맞음»으로 가 거짓 안내가 됐다.
    v_fit   := coalesce(v_limit, 1) > 0 and (v_budget is null or v_limit is null or v_budget <= v_limit);

    if v_fit then
      v_type  := 'NEW_REQUEST';
      v_title := '새 견적 요청';
      v_msg   := v_where || ' · ' || v_amount || ' — 바로 입찰할 수 있어요.';
    elsif coalesce(v_limit, 1) <= 0 then
      -- 사업자등록 확인 전: 하루 한 번만 · «한도 0만원» 대신 지금 할 한 가지
      if exists (select 1 from public.notifications n
                  where n.user_id = co.owner_id and n.type = 'NEW_REQUEST_LOCKED' and n.created_at >= v_today) then
        continue;
      end if;
      v_type  := 'NEW_REQUEST_LOCKED';
      v_title := '우리 동네 새 견적 요청';
      v_msg   := v_where || ' · ' || v_amount || ' — 사업자등록증을 올리면 입찰할 수 있어요(홈택스에서 당일 발급).';
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
      values (co.owner_id, v_type, v_title, v_msg, '/requests/' || r.id, r.id, 'queued')   -- related_id 가 uuid 든 text 든 들어간다
      on conflict do nothing;
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end; $$;

create or replace function public.company_region_weekly_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_local timestamp := now() at time zone 'Asia/Seoul';
  v_today date := v_local::date;
  v_hour int := extract(hour from v_local)::int;
  v_mon date; v_last_mon date;
  r record; v_pref jsonb; v_title text; v_msg text; v_n int := 0;
begin
  if extract(isodow from v_today) <> 1 then return jsonb_build_object('status', 'not_monday'); end if;
  if v_hour < 9 or v_hour >= 20 then return jsonb_build_object('status', 'quiet_hours'); end if;
  v_mon := v_today; v_last_mon := v_mon - 7;

  for r in
    with wk as (
      select q.id, q.user_id, q.status, q.expires_at,
             nullif(regexp_replace(trim(coalesce(q.area, '')), '^.*\s', ''), '') as k
        from public.requests q
       where (q.created_at at time zone 'Asia/Seoul')::date >= v_last_mon
         and (q.created_at at time zone 'Asia/Seoul')::date <  v_mon
    )
    select c.id, c.owner_id,
           coalesce(c.verified, false) as verified,   -- 203: 사업자등록 확인 전이면 «견적을 보내 보세요» 대신 지금 할 한 가지
           count(*)::int as new_cnt,
           count(*) filter (
             where coalesce(w.status, 'open') = 'open'
               and (w.expires_at is null or w.expires_at > now())
               and not exists (select 1 from public.bids b
                                where b.request_id = w.id and (b.company_id = c.id or b.company_id = c.owner_id))
           )::int as open_cnt,
           count(*) filter (
             where exists (select 1 from public.bids b
                            where b.request_id = w.id and (b.company_id = c.id or b.company_id = c.owner_id))
           )::int as bid_cnt
      from public.companies c
      join wk w on w.k is not null
               and w.user_id is distinct from c.owner_id
               and (coalesce(c.region, '') ilike '%' || w.k || '%'
                 or coalesce(c.service_regions::text, '') ilike '%' || w.k || '%')
     where c.owner_id is not null
       and (c.company_status is null or c.company_status = 'ACTIVE')
     group by c.id, c.owner_id, c.verified
     limit 1000
  loop
    if exists (select 1 from public.notifications n
                where n.user_id = r.owner_id and n.type = 'REGION_REQUESTS_WEEKLY'
                  and (n.created_at at time zone 'Asia/Seoul')::date >= v_mon) then
      continue;
    end if;
    begin
      v_title := '지난주 우리 동네 새 견적 요청 ' || r.new_cnt || '건';
      v_msg := case
        when r.open_cnt > 0 and not r.verified then '아직 열린 요청이 ' || r.open_cnt || '건 있어요. 사업자등록증을 올리면 입찰할 수 있어요 — 홈택스에서 당일 발급돼요.'
        when r.open_cnt > 0 then '아직 입찰할 수 있는 요청이 ' || r.open_cnt || '건 남았어요. 지금 먼저 견적을 보내 보세요.'
        when r.bid_cnt > 0 then '그중 ' || r.bid_cnt || '건에 견적을 보냈어요. 이번 주도 새 요청 알림을 켜 두세요.'
        else '지금은 모두 마감됐어요. 새 요청이 오면 바로 알려 드릴게요.' end;
      insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
      values (r.owner_id, 'REGION_REQUESTS_WEEKLY', v_title, v_msg, r.id, 'company', 'NORMAL');
      select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = r.owner_id;
      if coalesce((v_pref ->> 'push_enabled')::boolean, false) then
        insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
        values (r.owner_id, 'REGION_REQUESTS_WEEKLY', v_title, v_msg, '/', r.id::text || ':rw:' || to_char(v_mon, 'YYYYMMDD'), 'queued')
        on conflict do nothing;
      end if;
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  return jsonb_build_object('status', 'ok', 'sent', v_n);
end; $$;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① new_request_honest: 새 요청 알림이 사업자등록 확인 전 업체에 «사업자등록증을 올리면» 으로 안내한다
--  ② weekly_honest: 월요일 동네 요청 알림도 같다
select
  coalesce((select prosrc like '%사업자등록증을 올리면 입찰할 수 있어요(홈택스%' from pg_proc where proname = 'request_notify_partners' limit 1), false) as new_request_honest,
  coalesce((select prosrc like '%사업자등록증을 올리면 입찰할 수 있어요 — 홈택스%' from pg_proc where proname = 'company_region_weekly_due' limit 1), false) as weekly_honest;
