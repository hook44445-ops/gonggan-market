-- ============================================================
--  Migration 135: SQL 이 만든 알림도 푸시로 (9차 4-3 첫 줄 · 결제 열기 전 필수)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경
--    푸시 큐(push_logs)에는 앱의 createNotification → /api/push/enqueue 경로만 넣는다.
--    SQL 함수가 notifications 에 직접 넣는 알림은 앱에만 보이고 휴대폰 푸시가 안 나갔다:
--      · STAGE_APPROVE_REMINDER · STAGE_AUTO_APPROVED   (112 — 48시간 자동 승인 「12시간 전」 경고 · 자동 승인)
--      · BIZ_REQUIRED · BIZ_VERIFIED                    (116 — 선택된 업체 사업자등록 72시간 · 고객 「결제할 수 있어요」)
--      · ADMIN_BIZ_PENDING · ADMIN_DOC_SUBMITTED        (116 · 123 — 관리자 확인 요청)
--    (110 새 견적 요청 알림은 함수가 push_logs 에 직접 넣는다 — 여기서 빼서 두 번 나가지 않게)
--  하는 일
--    notifications 에 위 종류가 들어오면 수신설정(push_preferences)을 보고 push_logs 에 queued 로 넣는다.
--    규칙은 /api/push/enqueue 의 decidePushGate 와 같다: 설정 행이 없거나 push_enabled=false 면 안 보냄,
--    종류별 칸(push_escrow · push_company_recommend)이 false 면 안 보냄. 관리자 알림은 push_enabled 만 본다.
--    중복 방지: push_logs(user_id, type, related_id) 유일 — related_id 에 «알림 id» 를 넣어 같은 요청의
--    다른 단계 알림(착공·완료 경고)이 서로 막지 않게 한다. 이동 주소는 enqueue 의 buildTargetUrl 과 같다.
--    발송: /api/push/dispatch 가 돌 때(자동 승인 함수를 먼저 부르고 큐를 읽는다 — 112) · 하루 크론 · 앱 wake.
--  확인 칸 2개(아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.trg_notification_to_push()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_col   text;
  v_pref  jsonb;
  v_url   text;
begin
  if new.type not in ('STAGE_APPROVE_REMINDER', 'STAGE_AUTO_APPROVED',
                      'BIZ_REQUIRED', 'BIZ_VERIFIED',
                      'ADMIN_BIZ_PENDING', 'ADMIN_DOC_SUBMITTED') then
    return new;
  end if;

  v_col := case new.type
    when 'STAGE_APPROVE_REMINDER' then 'push_escrow'
    when 'STAGE_AUTO_APPROVED'    then 'push_escrow'
    when 'BIZ_VERIFIED'           then 'push_escrow'
    when 'BIZ_REQUIRED'           then 'push_company_recommend'
    else null end;                                    -- 관리자 알림: push_enabled 만

  select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = new.user_id;
  if v_pref is null or not coalesce((v_pref ->> 'push_enabled')::boolean, false) then
    return new;
  end if;
  if v_col is not null and (v_pref ->> v_col) = 'false' then
    return new;
  end if;

  v_url := case
    when new.related_id is null then '/'
    when new.related_type in ('contract', 'escrow') then '/contracts/' || new.related_id
    when new.related_type in ('request', 'bid')     then '/requests/'  || new.related_id
    when new.related_type in ('lounge', 'lounge_post') then '/lounge/posts/' || new.related_id
    else '/' end;

  insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
  values (new.user_id, new.type, coalesce(new.title, '공간마켓'), coalesce(new.message, ''), v_url, new.id, 'queued')
  on conflict do nothing;
  return new;
exception when others then
  return new;   -- 푸시 큐가 실패해도 알림 저장은 막지 않는다
end; $$;

drop trigger if exists trg_notification_to_push on public.notifications;
create trigger trg_notification_to_push after insert on public.notifications
  for each row execute function public.trg_notification_to_push();

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from pg_trigger where tgname = 'trg_notification_to_push')                                   as trigger_ok,
  position('STAGE_APPROVE_REMINDER' in pg_get_functiondef('public.trg_notification_to_push'::regproc)) > 0        as reminder_covered_ok;
