-- ============================================================
--  Migration 147: 안드로이드 테스터 신청 — 메일 받기 · 대표 휴대폰 푸시 · 목록 페이지
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(추가 전용).
--
--  왜(대표 09-28): 「테스터 모집 링크에 메일 보내면 페이지 하나 만들어서 적어 두고,
--                  010-2740-6030 공간마켓 앱에 푸시 알람 오게, 페이지 보게끔만」.
--    Play 비공개 테스트가 이메일 목록 방식이면 대표가 받은 Gmail 을 Play Console 에 직접 넣어야 한다.
--  하는 일
--    ① tester_signup(메일, 이름) — /download 페이지에서 누구나(로그인 없이) 부른다.
--       저장 → 대표 번호(010-2740-6030)로 가입된 계정 전부에 앱 알림 + 푸시 큐(push_logs) → 앱이 곧바로 발송을 깨운다.
--       같은 메일은 한 번만(다시 보내도 «이미 받았어요»). 한 시간에 30건 넘으면 막는다(장난 방지).
--    ② tester_signups_list() · tester_signup_mark(id, 추가함) — 관리자 또는 대표 번호 계정만(로그인 토큰).
--       /testers 페이지가 쓴다. 메일 주소는 개인정보라 표를 직접 읽는 정책은 두지 않는다(함수로만).
--  확인 칸 3개(맨 아래 select) — 모두 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create table if not exists public.tester_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (char_length(email) between 5 and 120),
  name       text check (name is null or char_length(name) <= 20),
  ref_code   text check (ref_code is null or char_length(ref_code) <= 12),
  added_at   timestamptz,                  -- 대표가 Play Console 테스터 목록에 넣은 시각
  created_at timestamptz not null default now()
);
create unique index if not exists tester_signups_email_key on public.tester_signups (lower(email));
alter table public.tester_signups enable row level security;   -- 정책 없음 = 함수로만

-- 대표 번호 — 알림을 받고 목록을 볼 수 있는 사람
create or replace function public._is_owner_phone(p_phone text)
returns boolean language sql immutable as $$
  select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') in ('01027406030', '821027406030');
$$;

-- ① 신청(누구나)
create or replace function public.tester_signup(p_email text, p_name text default null, p_ref text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_name text := nullif(trim(coalesce(p_name, '')), '');
        v_id uuid; v_recent int; v_total int;
begin
  if v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' or char_length(v_email) > 120 then
    return jsonb_build_object('ok', false, 'reason', 'BAD_EMAIL');
  end if;
  if exists (select 1 from public.tester_signups where lower(email) = v_email) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  select count(*) into v_recent from public.tester_signups where created_at > now() - interval '1 hour';
  if v_recent >= 30 then return jsonb_build_object('ok', false, 'reason', 'TOO_MANY'); end if;

  insert into public.tester_signups (email, name, ref_code)
  values (v_email, left(v_name, 20), left(nullif(upper(trim(coalesce(p_ref, ''))), ''), 12))
  on conflict do nothing
  returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', true, 'already', true); end if;
  select count(*) into v_total from public.tester_signups;

  -- 대표 번호 계정 전부 — 앱 알림함 + 휴대폰 푸시(즉시 종류 · 시간창 없음)
  begin
    insert into public.notifications (user_id, type, title, message, priority)
    select u.id, 'ADMIN_TESTER_SIGNUP', '테스터 신청 · ' || v_total || '명째',
           coalesce(v_name || ' · ', '') || v_email || ' — Play Console 테스터 목록에 추가해 주세요.', 'NORMAL'
      from public.users u where public._is_owner_phone(u.phone);
    insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
    select u.id, 'ADMIN_TESTER_SIGNUP', '테스터 신청 · ' || v_total || '명째',
           coalesce(v_name || ' · ', '') || v_email, '/testers', v_id::text, 'queued'
      from public.users u where public._is_owner_phone(u.phone)
    on conflict do nothing;
  exception when others then null;   -- 알림 실패가 신청을 막지 않게
  end;
  return jsonb_build_object('ok', true, 'already', false);
end; $$;
grant execute on function public.tester_signup(text, text, text) to anon, authenticated;

-- ② 목록 · 추가함 표시 — 관리자 또는 대표 번호 계정(로그인 토큰)
create or replace function public._can_see_testers()
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from public.users u
                  where u.id = auth.uid() and (u.role = 'admin' or public._is_owner_phone(u.phone)));
$$;

create or replace function public.tester_signups_list()
returns setof public.tester_signups language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not public._can_see_testers() then raise exception 'OWNER_ONLY' using errcode = '42501'; end if;
  return query select * from public.tester_signups order by created_at desc limit 500;
end; $$;
grant execute on function public.tester_signups_list() to anon, authenticated;

create or replace function public.tester_signup_mark(p_id uuid, p_added boolean)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.tester_signups;
begin
  if not public._can_see_testers() then raise exception 'OWNER_ONLY' using errcode = '42501'; end if;
  update public.tester_signups set added_at = case when p_added then coalesce(added_at, now()) else null end
   where id = p_id returning * into v_row;
  return jsonb_build_object('ok', v_row.id is not null, 'added_at', v_row.added_at);
end; $$;
grant execute on function public.tester_signup_mark(uuid, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 모두 true 면 끝 (owner_accounts 는 대표 번호로 가입된 계정 수 — 0 이면 알림 받을 계정이 없다)
select
  exists (select 1 from pg_proc where proname = 'tester_signup')                                               as signup_fn_ok,
  exists (select 1 from pg_proc where proname = 'tester_signups_list') and exists (select 1 from pg_proc where proname = 'tester_signup_mark') as list_fn_ok,
  exists (select 1 from public.users u where public._is_owner_phone(u.phone))                                  as owner_account_ok,
  (select count(*) from public.users u where public._is_owner_phone(u.phone))                                  as owner_accounts;
