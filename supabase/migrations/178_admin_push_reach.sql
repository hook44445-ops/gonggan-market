-- ============================================================
--  Migration 178: 관리자 «푸시 받는 사람» — 재방문 알림이 폰까지 닿는 사람이 몇 명인지
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  · 관리자(로그인 토큰 role=admin)만 · 개수만
--  · 받는 사람 = 푸시 설정 켬 + 켜진 기기 토큰이 있음(안드로이드 = 기기 정보에 Android)
--  되돌리기: drop function if exists public.admin_push_reach();
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.admin_push_reach()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.users),
    'reach', (select count(distinct p.user_id) from public.push_preferences p
                join public.fcm_tokens t on t.user_id = p.user_id and t.is_active
               where p.push_enabled),
    'android', (select count(distinct t.user_id) from public.fcm_tokens t
                  join public.push_preferences p on p.user_id = t.user_id and p.push_enabled
                 where t.is_active and coalesce(t.device_info ->> 'ua', '') ilike '%android%'),
    'marketing', (select count(*) from public.push_preferences where push_enabled and coalesce(push_marketing, false)),
    'new_7d', (select count(distinct t.user_id) from public.fcm_tokens t where t.is_active and t.created_at > now() - interval '7 days')
  );
end; $$;
grant execute on function public.admin_push_reach() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'admin_push_reach') as push_reach_ok;
