-- ============================================================
--  Migration 171: 업체 주간 알림 — 월요일 «지난주 우리 동네 새 요청 N건 · 아직 입찰할 수 있는 K건»
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  왜(재방문): 새 요청 알림(110)은 한 건씩 와서 놓치기 쉽다. 한 주를 모아 «아직 열린 요청»을 알려
--      업체가 매주 월요일 앱을 연다. 자기 동네 요청 수 안내라 광고가 아니다(161 과 같은 기준).
--  규칙
--    · 한국 시간 월요일 9시~20시에 · 지난주(월~일) 내 영업지역(110 과 같은 판정) 새 요청이 1건 이상인 업체 주인에게 한 번
--    · 내 요청·정지 업체는 빼고 · 같은 주에 두 번 보내지 않는다(알림 확인 + push_logs 유일키)
--    · 푸시는 푸시를 켠 사람만 · /api/push/dispatch 가 돌 때 부른다(월요일 저녁 6시 크론이 기본)
--  되돌리기: drop function if exists public.company_region_weekly_due();
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.company_region_weekly_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_local timestamp := now() at time zone 'Asia/Seoul';
  v_today date := v_local::date;
  v_hour int := extract(hour from v_local)::int;
  v_mon date; v_last_mon date;
  r record; v_pref jsonb; v_title text; v_msg text; v_n int := 0;
begin
  if extract(isodow from v_today) <> 1 then return jsonb_build_object('status', 'not_monday'); end if;
  if v_hour < 9 or v_hour >= 20 then return jsonb_build_object('status', 'quiet_hours'); end if;
  v_mon := v_today; v_last_mon := v_mon - 7;

  for r in
    with wk as (
      select q.id, q.user_id, q.status, q.expires_at,
             nullif(regexp_replace(trim(coalesce(q.area, '')), '^.*\s', ''), '') as k
        from public.requests q
       where (q.created_at at time zone 'Asia/Seoul')::date >= v_last_mon
         and (q.created_at at time zone 'Asia/Seoul')::date <  v_mon
    )
    select c.id, c.owner_id,
           count(*)::int as new_cnt,
           count(*) filter (
             where coalesce(w.status, 'open') = 'open'
               and (w.expires_at is null or w.expires_at > now())
               and not exists (select 1 from public.bids b
                                where b.request_id = w.id and (b.company_id = c.id or b.company_id = c.owner_id))
           )::int as open_cnt,
           count(*) filter (
             where exists (select 1 from public.bids b
                            where b.request_id = w.id and (b.company_id = c.id or b.company_id = c.owner_id))
           )::int as bid_cnt
      from public.companies c
      join wk w on w.k is not null
               and w.user_id is distinct from c.owner_id
               and (coalesce(c.region, '') ilike '%' || w.k || '%'
                 or coalesce(c.service_regions::text, '') ilike '%' || w.k || '%')
     where c.owner_id is not null
       and (c.company_status is null or c.company_status = 'ACTIVE')
     group by c.id, c.owner_id
     limit 1000
  loop
    if exists (select 1 from public.notifications n
                where n.user_id = r.owner_id and n.type = 'REGION_REQUESTS_WEEKLY'
                  and (n.created_at at time zone 'Asia/Seoul')::date >= v_mon) then
      continue;
    end if;
    begin
      v_title := '지난주 우리 동네 새 견적 요청 ' || r.new_cnt || '건';
      v_msg := case
        when r.open_cnt > 0 then '아직 입찰할 수 있는 요청이 ' || r.open_cnt || '건 남았어요. 지금 먼저 견적을 보내 보세요.'
        when r.bid_cnt > 0 then '그중 ' || r.bid_cnt || '건에 견적을 보냈어요. 이번 주도 새 요청 알림을 켜 두세요.'
        else '지금은 모두 마감됐어요. 새 요청이 오면 바로 알려 드릴게요.' end;
      insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
      values (r.owner_id, 'REGION_REQUESTS_WEEKLY', v_title, v_msg, r.id, 'company', 'NORMAL');
      select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = r.owner_id;
      if coalesce((v_pref ->> 'push_enabled')::boolean, false) then
        insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
        values (r.owner_id, 'REGION_REQUESTS_WEEKLY', v_title, v_msg, '/', r.id::text || ':rw:' || to_char(v_mon, 'YYYYMMDD'), 'queued')
        on conflict do nothing;
      end if;
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  return jsonb_build_object('status', 'ok', 'sent', v_n);
end; $$;
grant execute on function public.company_region_weekly_due() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'company_region_weekly_due') as region_weekly_ok;
