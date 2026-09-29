-- ============================================================
--  Migration 172: 고객 «견적 N개 · 최저~최고 · 차이» 알림 — 견적을 받고 이틀째 못 고른 요청에 한 번
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  왜(재방문): 견적이 와도 어느 곳이 나은지 몰라 앱을 닫고 잊는다. 받은 견적을 한 줄로 정리해
--      «금액만 말고 항목을 나란히 보세요»로 다시 들어오게 한다. 내 요청에 온 견적 안내라 광고가 아니다.
--  규칙
--    · 열린 요청(업체를 아직 안 고름) · 견적 2개 이상 · 첫 견적이 온 지 48시간 지남 · 요청 7일 안
--    · 요청마다 한 번 · 한국 9~20시 · 푸시는 «견적 소식» 푸시를 켠 사람만(152 와 같은 설정)
--    · /api/push/dispatch 가 돌 때 부른다
--  되돌리기: drop function if exists public.bid_compare_nudge_due();
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.bid_compare_nudge_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  r record; v_pref jsonb; v_sent int := 0; v_title text; v_msg text;
begin
  if v_hour < 9 or v_hour >= 20 then return jsonb_build_object('status', 'quiet_hours'); end if;

  for r in
    select q.id, q.user_id,
           count(*)::int as n, min(b.price)::bigint as lo, max(b.price)::bigint as hi
      from public.requests q
      join public.bids b on b.request_id = q.id and coalesce(b.price, 0) > 0
     where coalesce(q.status, 'open') = 'open'
       and q.user_id is not null
       and q.selected_bid_id is null
       and q.created_at > now() - interval '7 days'
       and (q.expires_at is null or q.expires_at > now())
       and not exists (select 1 from public.escrow_payments e where e.request_id = q.id)
       and not exists (select 1 from public.notifications n
                        where n.user_id = q.user_id and n.type = 'BID_COMPARE_NUDGE' and n.related_id::text = q.id::text)
     group by q.id, q.user_id
    having count(*) >= 2 and min(b.created_at) < now() - interval '48 hours'
     order by min(b.created_at) asc
     limit 100
  loop
    begin
      v_title := '받은 견적 ' || r.n || '개, 비교해 보셨나요?';
      v_msg := case when r.hi > r.lo
        then to_char(r.lo, 'FM999,999,999') || '만원 ~ ' || to_char(r.hi, 'FM999,999,999') || '만원 (차이 '
             || to_char(r.hi - r.lo, 'FM999,999,999') || '만원). 금액만 말고 자재·기간·하자보수를 나란히 보세요.'
        else '금액이 모두 ' || to_char(r.lo, 'FM999,999,999') || '만원이에요. 기간·하자보수·후기로 골라 보세요.' end;
      insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
      values (r.user_id, 'BID_COMPARE_NUDGE', v_title, v_msg, r.id, 'request', 'NORMAL');
      select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = r.user_id;
      if coalesce((v_pref ->> 'push_enabled')::boolean, false)
         and coalesce((v_pref ->> 'push_estimate_news')::boolean, true) then
        insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
        values (r.user_id, 'BID_COMPARE_NUDGE', v_title, v_msg, '/requests/' || r.id, r.id::text || ':cmp', 'queued')
        on conflict do nothing;
      end if;
      v_sent := v_sent + 1;
    exception when others then null;   -- 한 건 실패가 나머지를 막지 않게
    end;
  end loop;
  return jsonb_build_object('status', 'ok', 'nudged', v_sent);
end; $$;
grant execute on function public.bid_compare_nudge_due() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'bid_compare_nudge_due') as bid_compare_ok;
