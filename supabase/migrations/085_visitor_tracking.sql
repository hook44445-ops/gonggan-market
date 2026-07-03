-- ── 085: 방문 추적(운영 KPI: DAU/MAU) ─────────────────────────────────────────
-- 목적: 관리자 운영 대시보드의 오늘/7일/30일 방문자(DAU/MAU) 집계용 최소 데이터.
-- 원칙(회귀 방지):
--   · users 테이블은 건드리지 않는다(트리거/updated_at 오염 방지) → 별도 user_visits 테이블.
--   · 기존 RLS/정책/RPC 변경 없음. 신규 오브젝트만 추가.
--   · 방문 기록은 last_seen_at 1개만 upsert(사용자당 1행). 클라이언트는 touch_last_seen RPC로만 기록.
--   · 집계 read 는 service-role(/api/admin/stats)에서만 수행 → 클라이언트 직접 read 정책 불필요.
-- 주의: 이 마이그레이션은 프로덕션 Supabase 에 수동 적용해야 한다(Vercel 배포는 DB 마이그레이션을 실행하지 않음).
--       미적용 상태여도 앱/대시보드는 안전하게 동작(touch_last_seen 실패는 무시, 방문자 지표는 0).

create table if not exists public.user_visits (
  user_id      uuid primary key references public.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists user_visits_last_seen_idx on public.user_visits (last_seen_at);

alter table public.user_visits enable row level security;
-- 집계는 service-role 만 수행(RLS 우회). 일반 클라이언트 read 정책은 두지 않는다.

-- 방문 기록(사용자당 last_seen_at upsert) — SECURITY DEFINER 로 RLS 우회, last_seen_at 만 갱신.
create or replace function public.touch_last_seen(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_visits (user_id, last_seen_at)
  values (p_user_id, now())
  on conflict (user_id) do update set last_seen_at = now();
$$;

-- 앱은 anon key 로 동작하므로 anon 에 실행 권한 부여(기록만 가능, 조회 권한 아님).
grant execute on function public.touch_last_seen(uuid) to anon, authenticated;
