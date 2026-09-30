-- ============================================================
--  Migration 175: 관리자 «알림별 읽음률» — 최근 14일 알림 종류마다 보냄·읽음 수
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  왜: 재방문 알림(165·171~174 등)이 실제로 사람을 다시 데려오는지 숫자로 본다(정부지원 증빙에도 쓴다).
--  · 관리자(로그인 토큰의 사용자 role=admin)만 · 개인 정보 없이 종류별 개수만
--  되돌리기: drop function if exists public.admin_notify_stats();
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.admin_notify_stats()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('type', t.type, 'sent', t.sent, 'read', t.read, 'users', t.users) order by t.sent desc)
      from (
        select n.type, count(*)::int as sent, count(*) filter (where n.is_read)::int as read,
               count(distinct n.user_id)::int as users
          from public.notifications n
         where n.created_at > now() - interval '14 days'
         group by n.type
         order by count(*) desc
         limit 30
      ) t
  ), '[]'::jsonb);
end; $$;
grant execute on function public.admin_notify_stats() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'admin_notify_stats') as notify_stats_ok;
