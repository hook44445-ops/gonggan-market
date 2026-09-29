-- ============================================================
--  Migration 157: 광고성 정보(이벤트·혜택) 수신 동의 + 초대왕 이벤트 푸시
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(추가 전용). 155 뒤에.
--
--  왜(대표 09-29 「동의」): 10월 초대왕 이벤트를 앱을 안 켠 사람에게도 알리되, 정보통신망법 제50조를 지킨다.
--  규칙
--    · 광고 푸시는 «이벤트·혜택 알림(광고)»을 본인이 켠 사람에게만(기본 꺼짐) + 푸시 알림 전체가 켜진 사람
--    · 제목 맨 앞 「(광고)」 · 본문에 보낸 곳(공간마켓)과 수신거부 방법
--    · 한국 시간 9시~20시에만 쌓고, 보내는 쪽(/api/push/dispatch)도 같은 시간에만 보낸다(야간 금지)
--    · 켜거나 끄면 날짜와 결과를 알림함으로 알린다(수신동의 처리 결과 통지) · 켠 날·끈 날을 남긴다
--    · 이벤트 푸시는 한 이벤트에 두 번까지: 시작(시작 뒤 2일 안) · 마감 3일 전 — 사람마다 한 번씩(push_logs 중복 금지)
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

alter table public.push_preferences add column if not exists push_marketing        boolean not null default false;
alter table public.push_preferences add column if not exists marketing_consent_at  timestamptz;
alter table public.push_preferences add column if not exists marketing_withdraw_at timestamptz;

-- 동의·철회 — 로그인 토큰의 본인만. 결과를 알림함으로 알린다.
create or replace function public.marketing_consent_set(p_on boolean)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_day text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD');
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  insert into public.push_preferences (user_id, push_marketing, marketing_consent_at, marketing_withdraw_at, updated_at)
  values (v_uid, coalesce(p_on, false), case when p_on then now() end, case when not coalesce(p_on, false) then now() end, now())
  on conflict (user_id) do update set
    push_marketing        = coalesce(p_on, false),
    marketing_consent_at  = case when p_on then now() else public.push_preferences.marketing_consent_at end,
    marketing_withdraw_at = case when not coalesce(p_on, false) then now() else public.push_preferences.marketing_withdraw_at end,
    updated_at            = now();
  insert into public.notifications (user_id, type, title, message, priority)
  values (v_uid, 'MARKETING_CONSENT', '광고성 정보 수신 ' || case when p_on then '동의' else '철회' end || ' 안내',
          '공간마켓 이벤트·혜택 알림(광고) 수신을 ' || v_day || '에 ' || case when p_on then '동의' else '철회' end
          || '하셨어요. 바꾸려면 마이 > 알림 설정에서 켜고 끌 수 있어요. (보낸 곳: 공간마켓)', 'NORMAL');
  return jsonb_build_object('ok', true, 'on', coalesce(p_on, false), 'day', v_day);
end; $$;
grant execute on function public.marketing_consent_set(boolean) to anon, authenticated;

-- 초대왕 이벤트 푸시 — /api/push/dispatch 가 돌 때마다 부른다(하루 크론 · 새 알림 깨우기)
create or replace function public.referral_event_push_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  e public.referral_events; v_kind text; v_title text; v_body text; v_n int := 0;
  v_optout text := ' 수신거부: 공간마켓 마이 > 알림 설정';
begin
  if v_hour < 9 or v_hour >= 20 then return jsonb_build_object('status', 'quiet_hours'); end if;
  select * into e from public.referral_events
   where now() >= starts_at and now() < ends_at and settled_at is null
   order by starts_at limit 1;
  if e.id is null then return jsonb_build_object('status', 'no_live_event'); end if;

  if now() < e.starts_at + interval '2 days' then
    v_kind := 'kickoff';
    v_title := '(광고) ' || e.title || ' 이벤트 시작!';
    v_body := '친구를 가장 많이 초대한 세 분께 공간토큰 ' || e.prizes[1] || '·' || e.prizes[2] || '·' || e.prizes[3] || '개를 드려요.' || v_optout;
  elsif now() >= e.ends_at - interval '3 days' then
    v_kind := 'final';
    v_title := '(광고) ' || e.title || ' 마감이 얼마 안 남았어요';
    v_body := '지금 순위를 확인해 보세요. 1등은 공간토큰 ' || e.prizes[1] || '개.' || v_optout;
  else
    return jsonb_build_object('status', 'not_window');
  end if;

  insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
  select p.user_id, 'event_promo', v_title, v_body, '/?open=invite', e.id || ':' || v_kind, 'queued'
    from public.push_preferences p
   where p.push_enabled = true and p.push_marketing = true
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return jsonb_build_object('status', 'ok', 'kind', v_kind, 'queued', v_n);
end; $$;
grant execute on function public.referral_event_push_due() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'push_preferences' and column_name = 'push_marketing') as marketing_col_ok,
  exists (select 1 from pg_proc where proname = 'marketing_consent_set') and exists (select 1 from pg_proc where proname = 'referral_event_push_due') as marketing_fn_ok;
