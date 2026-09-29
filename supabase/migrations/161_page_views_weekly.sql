-- ============================================================
--  Migration 161: 업체 페이지 방문 수 주간 요약 — 월요일 «지난주 방문 N명»
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다. 156 뒤에.
--
--  왜(대표 09-29): 숫자를 매주 받아야 업체가 페이지를 계속 알린다(명함 QR·견적서·카톡).
--  규칙
--    · 한국 시간 월요일 9시~20시에 · 지난주(월~일) 방문이 1명 이상인 업체의 주인에게 한 번
--    · 알림함 + 푸시를 켠 사람은 폰으로(자기 업체 숫자 안내 — 광고 아님)
--    · 같은 주에 두 번 보내지 않는다(알림 확인 + push_logs 유일키)
--    · /api/push/dispatch 가 돌 때마다 부른다(월요일 저녁 6시 크론이 기본)
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.company_page_weekly_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_local timestamp := now() at time zone 'Asia/Seoul';
  v_today date := v_local::date;
  v_hour int := extract(hour from v_local)::int;
  v_mon date; v_last_mon date; v_prev_mon date;
  r record; v_pref jsonb; v_title text; v_msg text; v_n int := 0;
begin
  if extract(isodow from v_today) <> 1 then return jsonb_build_object('status', 'not_monday'); end if;
  if v_hour < 9 or v_hour >= 20 then return jsonb_build_object('status', 'quiet_hours'); end if;
  v_mon := v_today; v_last_mon := v_mon - 7; v_prev_mon := v_mon - 14;

  for r in
    select c.id, c.owner_id,
           coalesce(sum(v.views) filter (where v.day >= v_last_mon and v.day < v_mon), 0) as last_week,
           coalesce(sum(v.views) filter (where v.day >= v_prev_mon and v.day < v_last_mon), 0) as prev_week
      from public.companies c
      join public.company_page_views v on v.company_id = c.id and v.day >= v_prev_mon and v.day < v_mon
     where c.owner_id is not null
     group by c.id, c.owner_id
    having coalesce(sum(v.views) filter (where v.day >= v_last_mon and v.day < v_mon), 0) > 0
     limit 500
  loop
    if exists (select 1 from public.notifications n
                where n.user_id = r.owner_id and n.type = 'PAGE_VIEWS_WEEKLY'
                  and (n.created_at at time zone 'Asia/Seoul')::date >= v_mon) then
      continue;
    end if;
    begin
      v_title := '지난주 내 업체 페이지 방문 ' || r.last_week || '명';
      v_msg := case
        when r.prev_week = 0 then '지난주 처음으로 방문이 생겼어요. 명함 QR·견적서로 더 알려 보세요.'
        when r.last_week > r.prev_week then '그 전 주 ' || r.prev_week || '명보다 늘었어요. 이 흐름 그대로 알려 보세요.'
        when r.last_week < r.prev_week then '그 전 주는 ' || r.prev_week || '명이었어요. 카톡·명함 QR로 다시 알려 보세요.'
        else '그 전 주와 같아요(' || r.prev_week || '명). 새 시공 사례를 올리면 더 많이 봐요.' end;
      insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
      values (r.owner_id, 'PAGE_VIEWS_WEEKLY', v_title, v_msg, r.id, 'company', 'NORMAL');
      select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = r.owner_id;
      if coalesce((v_pref ->> 'push_enabled')::boolean, false) then
        insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
        values (r.owner_id, 'PAGE_VIEWS_WEEKLY', v_title, v_msg, '/', r.id::text || ':' || to_char(v_mon, 'YYYYMMDD'), 'queued')
        on conflict do nothing;
      end if;
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  return jsonb_build_object('status', 'ok', 'sent', v_n);
end; $$;
grant execute on function public.company_page_weekly_due() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'company_page_weekly_due') as page_weekly_ok;
