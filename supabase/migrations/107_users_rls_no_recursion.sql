-- ============================================================
--  Migration 107: users 표 조회 500 — 「infinite recursion detected in policy for relation "users"」(42P17)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경 (총점검 09-24 · 파트너센터 「활동기록」 등 여러 곳)
--    GET /users?select=created_at&id=eq.<본인> → 500 42P17.
--    운영 users 표에 «users 표를 다시 조회하는» 정책(관리자 확인 등)이 손으로 추가돼 있다(저장소엔 없음).
--    users 를 읽을 때 정책이 users 를 또 읽고 → 그 정책이 또 … 무한 반복.
--    다른 표의 관리자 정책(exists (select … from users where role='admin'))도 users 를 거치므로 같이 깨진다.
--  고침: 관리자 확인을 security definer 함수 public.is_admin() 로 옮긴다(함수 안에서는 정책을 다시 타지 않음).
--        users 표 정책 중 users 를 다시 조회하는 것만 골라 지우고, 관리자 정책 하나로 대신한다.
--        「본인 행 읽기·수정」 정책은 그대로 둔다.
--  맨 아래 조회 결과에 지운 정책과 남은 정책이 나온다 — 캡처해 주세요.
-- ============================================================

set search_path = public, extensions;

-- 1) 관리자 확인 함수 — 정책을 다시 타지 않는다
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin');
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- 2) users 를 다시 조회하는 users 정책만 지우고 기록
create table if not exists public._migration_107_dropped (
  policyname text, cmd text, qual text, with_check text, dropped_at timestamptz default now()
);

do $$
declare p record;
begin
  for p in
    select policyname, cmd, qual, with_check
      from pg_policies
     where schemaname = 'public' and tablename = 'users'
       and (coalesce(qual, '') ~* '(from|join)\s+(public\.)?users\M'
         or coalesce(with_check, '') ~* '(from|join)\s+(public\.)?users\M')
  loop
    insert into public._migration_107_dropped(policyname, cmd, qual, with_check)
    values (p.policyname, p.cmd, p.qual, p.with_check);
    execute format('drop policy %I on public.users', p.policyname);
  end loop;
end $$;

-- 3) 관리자 정책 하나로 대신 (읽기·수정·추가·삭제)
drop policy if exists "users: admin all" on public.users;
create policy "users: admin all" on public.users
  for all using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';

-- 4) 결과 보기 — 지운 정책 / 지금 남은 정책
select 'dropped' as kind, policyname, cmd, qual from public._migration_107_dropped
union all
select 'now', policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = 'users'
order by 1, 2;
