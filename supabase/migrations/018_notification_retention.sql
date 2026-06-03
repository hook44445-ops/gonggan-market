-- ════════════════════════════════════════════════════════════════════
-- 018_notification_retention.sql
-- 알림 히스토리 30일 보관 후 자동 삭제 — 충성도 5/6 STEP3
--   · notifications.priority 보장(없으면 추가)
--   · 30일 경과 알림 정리 함수 + (가능 시) pg_cron 일일 스케줄
-- 추가 전용 · 멱등(idempotent). 기존 데이터/구조 영향 없음.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- priority 컬럼 보장 (이미 schema.sql 에 있으면 무시)
alter table public.notifications
  add column if not exists priority text not null default 'NORMAL';

-- 30일 지난 알림 삭제. 운영자가 수동/스케줄로 호출.
create or replace function public.purge_old_notifications()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  deleted_count integer;
begin
  delete from public.notifications
  where created_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- pg_cron 이 설치돼 있으면 매일 새벽 4시(KST 기준 환경에 맞춰 조정)에 정리.
-- 설치돼 있지 않으면 이 블록은 조용히 건너뜀(에러 없음).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('purge_old_notifications')
      where exists (select 1 from cron.job where jobname = 'purge_old_notifications');
    perform cron.schedule(
      'purge_old_notifications',
      '0 19 * * *',  -- 매일 19:00 UTC = 04:00 KST
      $cron$ select public.purge_old_notifications(); $cron$
    );
  end if;
end;
$$;
