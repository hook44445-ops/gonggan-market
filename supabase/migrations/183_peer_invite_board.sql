-- ============================================================
--  Migration 183: 업체 «동료 초대» 순위 — 사장님이 사장님을 데려온 수(이번 달 · 한국 시간)
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다. (146·148 뒤에)
--
--  · 세는 것: 내 초대 링크로 가입(users.referred_by = 나)한 사람 가운데 «업체 등록까지 한» 사람(companies.owner_id)
--    — 초대한 사람도 업체 주인일 때만 순위에 들어간다(초대왕 155 는 고객·업체 모두 · 이건 업체끼리 따로)
--  · 기간: 한국 시간 이번 달 1일 0시부터(가입 기록 referred_at 기준) — 매달 새로 시작
--  · 같은 수면 그 수에 먼저 닿은 업체가 앞
--  · 순위판은 누구나(업체 이름 첫 글자 + ○○) · 내 순위·누적은 로그인 토큰으로
--  · 보상 없음(대표 결정 전) — 읽기만 하는 함수. 표·권한·다른 함수는 바꾸지 않는다.
--  되돌리기: drop function if exists public.peer_invite_board(); drop function if exists public._peer_invite_rank(timestamptz);
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 순위(내부용) — p_since 이후 «업체가 된» 초대 가입 수 · 같으면 먼저 닿은 순
create or replace function public._peer_invite_rank(p_since timestamptz)
returns table (inviter uuid, cnt bigint, last_at timestamptz, rnk bigint)
language sql stable security definer
set search_path = public, extensions as $$
  select x.referred_by, x.cnt, x.last_at, row_number() over (order by x.cnt desc, x.last_at asc) as rnk
    from (select u.referred_by, count(*) cnt, max(u.referred_at) last_at
            from public.users u
           where u.referred_by is not null
             and u.referred_at >= p_since
             and exists (select 1 from public.companies c where c.owner_id = u.id)
             and exists (select 1 from public.companies c where c.owner_id = u.referred_by)
           group by u.referred_by) x;
$$;
revoke execute on function public._peer_invite_rank(timestamptz) from public, anon, authenticated;

-- 순위판 — 누구나. 이번 달 상위 10(업체 이름 첫 글자) + 로그인했으면 내 순위 · 이번 달 · 누적 · 아직 업체 등록 전인 초대 가입
create or replace function public.peer_invite_board()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_since timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_top jsonb; v_me jsonb; v_total bigint := 0; v_waiting bigint := 0;
begin
  select coalesce(jsonb_agg(jsonb_build_object('rank', r.rnk,
           'name', left(coalesce(nullif(trim(c.name), ''), '업체'), 1) || '○○', 'count', r.cnt) order by r.rnk), '[]'::jsonb)
    into v_top
    from public._peer_invite_rank(v_since) r
    cross join lateral (select c0.name from public.companies c0 where c0.owner_id = r.inviter limit 1) c
   where r.rnk <= 10;

  if v_uid is not null then
    select jsonb_build_object('rank', r.rnk, 'count', r.cnt) into v_me
      from public._peer_invite_rank(v_since) r where r.inviter = v_uid;
    select count(*) filter (where exists (select 1 from public.companies c where c.owner_id = u.id)),
           count(*) filter (where not exists (select 1 from public.companies c where c.owner_id = u.id))
      into v_total, v_waiting
      from public.users u where u.referred_by = v_uid;
  end if;

  return jsonb_build_object('ok', true, 'since', v_since, 'top', v_top,
    'me', coalesce(v_me, jsonb_build_object('rank', null, 'count', 0)) || jsonb_build_object('total', v_total, 'waiting', v_waiting));
end; $$;
grant execute on function public.peer_invite_board() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'peer_invite_board') and exists (select 1 from pg_proc where proname = '_peer_invite_rank') as peer_invite_board_ok;
