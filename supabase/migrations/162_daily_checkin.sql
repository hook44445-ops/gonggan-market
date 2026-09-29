-- ============================================================
--  Migration 162: 출석 도장 — 하루 한 번 공간토큰 +1 · 7일 연속마다 +5
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(추가 전용). 111 뒤에.
--
--  왜(대표 09-29 「1등 다운로드와 더불어 1등 재방문」): 공사가 없는 날에도 앱을 열 이유 — 홈의 «오늘의 집 관리 한 줄»과 함께.
--  규칙
--    · 로그인 토큰의 본인만 · 한국 날짜 하루 한 번(daily_checkins 기본키로 막는다)
--    · 매일 +1 · 연속 7·14·21…일째에 +5 더 · 연속이 끊기면 1일부터
--    · 폰을 바꿔도 이어진다(서버 기록) · 기록은 날짜만(무엇을 봤는지는 남기지 않는다)
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create table if not exists public.daily_checkins (
  user_id uuid not null,
  day     date not null,
  earned  int  not null default 0,
  streak  int  not null default 1,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_checkins enable row level security;
-- 정책 없음 — 아래 함수로만

-- 연속 일수 — 도장마다 그날의 연속 수를 저장해 두므로 오늘 것, 없으면 어제 것(어제도 없으면 끊김 = 0) · 내부용
create or replace function public._checkin_streak(p_user uuid, p_until date)
returns int language sql stable security definer
set search_path = public, extensions as $$
  select coalesce(
    (select streak from public.daily_checkins where user_id = p_user and day = p_until),
    (select streak from public.daily_checkins where user_id = p_user and day = p_until - 1),
    0);
$$;
revoke execute on function public._checkin_streak(uuid, date) from public, anon, authenticated;

-- 오늘 상태 — { ok, checked, streak }
create or replace function public.daily_checkin_status()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_today date := (now() at time zone 'Asia/Seoul')::date; v_checked boolean;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  v_checked := exists (select 1 from public.daily_checkins where user_id = v_uid and day = v_today);
  return jsonb_build_object('ok', true, 'checked', v_checked, 'streak', public._checkin_streak(v_uid, v_today));
end; $$;
grant execute on function public.daily_checkin_status() to anon, authenticated;

-- 도장 찍기 — { ok, already, streak, earned }
create or replace function public.daily_checkin()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_prev int; v_streak int; v_earn int;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if exists (select 1 from public.daily_checkins where user_id = v_uid and day = v_today) then
    return jsonb_build_object('ok', true, 'already', true, 'streak', public._checkin_streak(v_uid, v_today), 'earned', 0);
  end if;
  v_prev := coalesce((select streak from public.daily_checkins where user_id = v_uid and day = v_today - 1), 0);
  v_streak := v_prev + 1;
  v_earn := 1 + case when v_streak % 7 = 0 then 5 else 0 end;

  insert into public.daily_checkins (user_id, day, earned, streak) values (v_uid, v_today, v_earn, v_streak)
  on conflict (user_id, day) do nothing;
  if not found then
    return jsonb_build_object('ok', true, 'already', true, 'streak', v_streak, 'earned', 0);
  end if;

  perform public.token_balance_lock(v_uid);
  update public.space_tokens set balance = balance + v_earn where user_id = v_uid;
  insert into public.space_token_logs (user_id, amount, type, action, description)
  values (v_uid, v_earn, 'earn', 'daily_checkin', '출석 ' || v_streak || '일째' || case when v_earn > 1 then ' (연속 보너스)' else '' end);

  return jsonb_build_object('ok', true, 'already', false, 'streak', v_streak, 'earned', v_earn);
end; $$;
grant execute on function public.daily_checkin() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'daily_checkins') as checkin_table_ok,
  exists (select 1 from pg_proc where proname = 'daily_checkin') and exists (select 1 from pg_proc where proname = 'daily_checkin_status') as checkin_fn_ok;
