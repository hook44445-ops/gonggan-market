-- ============================================================
--  Migration 155: 초대왕 이벤트 — 10월 한 달 · 1~3등 공간토큰 300/200/100 (고객·업체 모두)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다. (146·148 뒤에)
--
--  왜(대표 09-28 「추천안으로 가」): 초대 보상(148)에 순위 경쟁을 얹어 한 달 동안 초대를 몰아준다.
--  규칙
--    · 기간: 한국 시간 2026-10-01 00:00 ~ 2026-10-31 23:59:59
--    · 세는 것: 그 기간에 «초대로 가입이 기록된» 사람 수(users.referred_at · 146/148 조건 그대로 — 새 가입 7일 안 · 본인 X)
--    · 같은 수면 그 수에 먼저 닿은 사람이 앞(마지막 초대 시각이 빠른 순)
--    · 순위판은 누구나(이름 첫 글자만) · 내 순위는 로그인 토큰으로
--    · 지급은 기간이 끝난 뒤 관리자가 한 번(admin_referral_event_settle) — 두 번 눌러도 한 번만 준다
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create table if not exists public.referral_events (
  id         text primary key,                 -- '2026-10'
  title      text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  prizes     int[] not null,                   -- 등수별 토큰 {300,200,100}
  settled_at timestamptz,
  settled    jsonb
);
alter table public.referral_events enable row level security;
drop policy if exists "referral_events: read" on public.referral_events;
create policy "referral_events: read" on public.referral_events for select using (true);

insert into public.referral_events (id, title, starts_at, ends_at, prizes)
values ('2026-10', '10월 초대왕', '2026-10-01 00:00:00+09', '2026-11-01 00:00:00+09', array[300, 200, 100])
on conflict (id) do nothing;

-- 순위(내부용) — 기간 안 초대 가입 수 · 같으면 먼저 닿은 순
create or replace function public._referral_event_rank(p_event text)
returns table (inviter uuid, cnt bigint, last_at timestamptz, rnk bigint)
language sql stable security definer
set search_path = public, extensions as $$
  select x.referred_by, x.cnt, x.last_at, row_number() over (order by x.cnt desc, x.last_at asc) as rnk
    from (select u.referred_by, count(*) cnt, max(u.referred_at) last_at
            from public.users u, public.referral_events e
           where e.id = p_event and u.referred_by is not null
             and u.referred_at >= e.starts_at and u.referred_at < e.ends_at
           group by u.referred_by) x;
$$;
revoke execute on function public._referral_event_rank(text) from public, anon, authenticated;

-- 순위판 — 누구나. 상위 10(이름 첫 글자) + 로그인했으면 내 순위
create or replace function public.referral_event_board(p_event text default '2026-10')
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); e public.referral_events; v_top jsonb; v_me jsonb;
begin
  select * into e from public.referral_events where id = p_event;
  if e.id is null then return jsonb_build_object('ok', false, 'reason', 'NO_EVENT'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('rank', r.rnk, 'name', left(coalesce(nullif(trim(u.name), ''), '회원'), 1) || '○○', 'count', r.cnt) order by r.rnk), '[]'::jsonb)
    into v_top
    from public._referral_event_rank(p_event) r join public.users u on u.id = r.inviter
   where r.rnk <= 10;
  if v_uid is not null then
    select jsonb_build_object('rank', r.rnk, 'count', r.cnt) into v_me from public._referral_event_rank(p_event) r where r.inviter = v_uid;
  end if;
  return jsonb_build_object('ok', true, 'id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
    'prizes', to_jsonb(e.prizes), 'settled', e.settled_at is not null, 'top', v_top, 'me', coalesce(v_me, jsonb_build_object('rank', null, 'count', 0)));
end; $$;
grant execute on function public.referral_event_board(text) to anon, authenticated;

-- 지급 — 관리자만 · 기간이 끝난 뒤 · 한 번만
create or replace function public.admin_referral_event_settle(p_event text default '2026-10')
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare e public.referral_events; r record; v_prize int; v_paid jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select * into e from public.referral_events where id = p_event for update;
  if e.id is null then return jsonb_build_object('ok', false, 'reason', 'NO_EVENT'); end if;
  if now() < e.ends_at then return jsonb_build_object('ok', false, 'reason', 'NOT_ENDED'); end if;
  if e.settled_at is not null then return jsonb_build_object('ok', false, 'reason', 'ALREADY', 'settled', e.settled); end if;

  for r in select * from public._referral_event_rank(p_event) where rnk <= array_length(e.prizes, 1) order by rnk loop
    v_prize := e.prizes[r.rnk];
    perform public.token_balance_lock(r.inviter);
    update public.space_tokens set balance = balance + v_prize where user_id = r.inviter;
    insert into public.space_token_logs (user_id, amount, type, action, description)
    values (r.inviter, v_prize, 'earn', 'referral_event', e.title || ' ' || r.rnk || '등');
    insert into public.notifications (user_id, type, title, message, priority)
    values (r.inviter, 'REFERRAL_EVENT_PRIZE', e.title || ' ' || r.rnk || '등!',
            '초대 ' || r.cnt || '명으로 ' || r.rnk || '등이에요. 공간토큰 ' || v_prize || '개를 드렸어요.', 'NORMAL');
    v_paid := v_paid || jsonb_build_object('rank', r.rnk, 'user_id', r.inviter, 'count', r.cnt, 'prize', v_prize);
  end loop;

  update public.referral_events set settled_at = now(), settled = v_paid where id = p_event;
  return jsonb_build_object('ok', true, 'paid', v_paid);
end; $$;
grant execute on function public.admin_referral_event_settle(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from public.referral_events where id = '2026-10')                                                  as event_row_ok,
  exists (select 1 from pg_proc where proname = 'referral_event_board') and exists (select 1 from pg_proc where proname = 'admin_referral_event_settle') as event_fn_ok;
