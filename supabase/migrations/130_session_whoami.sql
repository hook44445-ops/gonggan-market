-- ════════════════════════════════════════════════════════════════════
-- 130_session_whoami.sql  (총점검 09-25 — 서버 서명 로그인 토큰 확인용 · 동작 변화 없음)
--
-- 로그인 토큰(api/verify-otp 가 SUPABASE_JWT_SECRET 으로 서명)을 붙여 부르면 «토큰의 사용자»가 나온다.
-- 토큰 없이(anon) 부르면 uid = null. → 131(관리자 문 잠그기)을 켜기 전에 운영에서 토큰이 통하는지 본다.
-- 개인정보 없음: 사용자 ID · 관리자 여부만.
-- 추가 전용 · 재실행 안전.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.session_whoami()
returns jsonb language sql stable security definer
set search_path = public, extensions as $$
  select jsonb_build_object(
    'uid', auth.uid(),
    'is_admin', exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
$$;
grant execute on function public.session_whoami() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'session_whoami') as whoami_ok;
