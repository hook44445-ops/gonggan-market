-- ============================================================
--  Migration 152: 견적이 3일째 없는 요청 — 고객에게 «요청을 조금 넓혀 보세요» 한 번
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  왜(대표 09-28 「1등 다운로드 앱」 — 설치 뒤 계속 쓰게): 견적이 안 오면 고객은 조용히 떠난다.
--    3일째 입찰 0건인 요청의 주인에게 «예산 범위·사진·공사 칩을 더하면 업체가 보기 쉬워요»를 한 번 알린다.
--  하는 일: request_nudge_due()
--    · 대상: status open · 만든 지 72시간~6일 · 입찰 0건 · 기간 안 지남 · 이 요청으로 보낸 적 없음
--    · 알림함(notifications) + 푸시 수신을 켠 사람은 push_logs(→ /requests/요청ID)
--    · 한국 시간 9시~21시에만(밤에 깨우지 않게) · 한 번에 최대 100건
--    · /api/push/dispatch 가 돌 때마다(하루 크론·새 알림 깨우기) 함께 부른다 — 중복은 push_logs 유일키 + 알림 확인으로 막음
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.request_nudge_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  r record; v_pref jsonb; v_sent int := 0;
  v_title text := '견적이 아직 없어요';
  v_msg   text := '요청 3일째예요. 예산 범위를 넓히거나 사진·공사 항목을 더하면 업체가 보기 쉬워요.';
begin
  if v_hour < 9 or v_hour >= 21 then return jsonb_build_object('status', 'quiet_hours'); end if;

  for r in
    select q.id, q.user_id
      from public.requests q
     where coalesce(q.status, 'open') = 'open'
       and q.user_id is not null
       and q.created_at < now() - interval '72 hours'
       and q.created_at > now() - interval '6 days'
       and (q.expires_at is null or q.expires_at > now())
       and not exists (select 1 from public.bids b where b.request_id = q.id)
       and not exists (select 1 from public.notifications n
                        where n.user_id = q.user_id and n.type = 'REQUEST_NUDGE' and n.related_id::text = q.id::text)
     order by q.created_at asc
     limit 100
  loop
    begin
      insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
      values (r.user_id, 'REQUEST_NUDGE', v_title, v_msg, r.id, 'request', 'NORMAL');
      select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = r.user_id;
      if coalesce((v_pref ->> 'push_enabled')::boolean, false)
         and coalesce((v_pref ->> 'push_estimate_news')::boolean, true) then
        insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
        values (r.user_id, 'REQUEST_NUDGE', v_title, v_msg, '/requests/' || r.id, r.id::text, 'queued')
        on conflict do nothing;
      end if;
      v_sent := v_sent + 1;
    exception when others then null;   -- 한 건 실패가 나머지를 막지 않게
    end;
  end loop;
  return jsonb_build_object('status', 'ok', 'nudged', v_sent);
end; $$;
grant execute on function public.request_nudge_due() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'request_nudge_due') as request_nudge_ok;
