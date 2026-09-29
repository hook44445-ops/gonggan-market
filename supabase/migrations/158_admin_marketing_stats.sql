-- ============================================================
--  Migration 158: 관리자 — 이벤트 알림(광고) 현황 숫자
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(조회 전용). 157 뒤에.
--
--  왜(대표 09-29): 10월 1일 이벤트 푸시 전에 «광고 알림 동의가 몇 명 모였는지», 나간 뒤엔 «몇 건 갔는지»를 본다.
--  보여 주는 것(관리자만 · 사람 이름·번호 없이 숫자만)
--    · 푸시 알림 켠 사람 · 광고 알림 동의한 사람 · 둘 다 켠 사람(실제 받을 사람)
--    · 최근 7일 동의 · 최근 7일 철회
--    · 이벤트 푸시(event_promo) — 대기 · 보냄 · 건너뜀(토큰 없음·동의 철회·기한 지남)
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.admin_marketing_stats()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select jsonb_build_object(
    'ok', true,
    'push_on',        count(*) filter (where push_enabled),
    'marketing_on',   count(*) filter (where push_marketing),
    'reachable',      count(*) filter (where push_enabled and push_marketing),
    'consent_7d',     count(*) filter (where push_marketing and marketing_consent_at > now() - interval '7 days'),
    'withdraw_7d',    count(*) filter (where not push_marketing and marketing_withdraw_at > now() - interval '7 days')
  ) into v
  from public.push_preferences;
  return v || (
    select jsonb_build_object(
      'promo_queued',  count(*) filter (where status = 'queued'),
      'promo_sent',    count(*) filter (where status = 'sent'),
      'promo_skipped', count(*) filter (where status = 'skipped'))
    from public.push_logs where type = 'event_promo');
end; $$;
grant execute on function public.admin_marketing_stats() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'admin_marketing_stats') as marketing_stats_ok;
