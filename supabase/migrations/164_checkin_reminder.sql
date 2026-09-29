-- ============================================================
--  Migration 164: 출석 연속 기록 끊기기 전 알림 — «연속 N일 출석이 오늘 끊겨요»
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다. 157·162 뒤에.
--
--  왜(대표 09-29 「1등 재방문」): 연속 기록이 있는 사람은 끊기기 직전 한 번 알려 주면 다시 연다.
--  규칙
--    · 어제까지 2일 이상 연속 출석 · 오늘 아직 안 찍음 · 한국 시간 17시~20시에만(발송기 하루 크론이 18시)
--    · 알림함은 해당자 모두 · 한 사람 하루 한 번
--    · 폰 푸시는 «이벤트·혜택 알림(광고)» 동의 + 푸시 켠 사람만 · 제목 「(광고)」 · event_promo 타입(발송기의 9~20시·동의 재확인 그대로)
--    · /api/push/dispatch 가 돌 때마다 부른다
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.checkin_reminder_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_local timestamp := now() at time zone 'Asia/Seoul';
  v_today date := v_local::date;
  v_hour int := extract(hour from v_local)::int;
  r record; v_pref jsonb; v_title text; v_msg text; v_n int := 0;
  v_optout text := ' 수신거부: 공간마켓 마이 > 알림 설정';
begin
  if v_hour < 17 or v_hour >= 20 then return jsonb_build_object('status', 'not_window'); end if;

  for r in
    select y.user_id, y.streak
      from public.daily_checkins y
     where y.day = v_today - 1 and y.streak >= 2
       and not exists (select 1 from public.daily_checkins t where t.user_id = y.user_id and t.day = v_today)
       and not exists (select 1 from public.notifications n
                        where n.user_id = y.user_id and n.type = 'CHECKIN_REMINDER'
                          and (n.created_at at time zone 'Asia/Seoul')::date = v_today)
     limit 1000
  loop
    begin
      v_title := '연속 ' || r.streak || '일 출석이 오늘 끊겨요';
      v_msg := '홈에서 도장 한 번이면 ' || (r.streak + 1) || '일째로 이어져요.'
               || case when (r.streak + 1) % 7 = 0 then ' 오늘은 7일 보너스 +5 날이에요.' else '' end;
      insert into public.notifications (user_id, type, title, message, priority)
      values (r.user_id, 'CHECKIN_REMINDER', v_title, v_msg, 'NORMAL');
      select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = r.user_id;
      if coalesce((v_pref ->> 'push_enabled')::boolean, false) and coalesce((v_pref ->> 'push_marketing')::boolean, false) then
        insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
        values (r.user_id, 'event_promo', '(광고) ' || v_title, v_msg || v_optout, '/', 'checkin:' || to_char(v_today, 'YYYYMMDD'), 'queued')
        on conflict do nothing;
      end if;
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  return jsonb_build_object('status', 'ok', 'reminded', v_n);
end; $$;
grant execute on function public.checkin_reminder_due() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'checkin_reminder_due') as checkin_reminder_ok;
