-- ============================================================
--  Migration 179: 찜한 업체의 새 시공 사례 알림 — 업체가 사례를 올리면 그 업체를 찜한 고객에게 한 번
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  · 같은 고객·같은 업체는 7일에 한 번까지(사례를 여러 장 올려도 한 번)
--  · 알림함은 언제나, 푸시는 한국 9~21시 + 푸시 켬 + «업체 추천» 소식 켬(기본 켬)인 사람만
--  · 사례 저장을 절대 막지 않는다(알림이 실패해도 넘어감)
--  되돌리기: drop trigger if exists trg_portfolio_notify_savers on public.portfolios;
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public._portfolio_notify_savers()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_name text; v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  s record; v_pref jsonb; v_title text := '찜한 업체의 새 시공 사례'; v_msg text;
begin
  begin
    select name into v_name from public.companies where id = new.company_id;
    v_msg := coalesce(nullif(v_name, ''), '찜한 업체') || ' — ' || left(coalesce(nullif(trim(new.title), ''), '새 사례'), 30)
             || coalesce(' · ' || nullif(new.space_type, ''), '');
    for s in select distinct sc.customer_id from public.saved_companies sc where sc.company_id = new.company_id loop
      if exists (select 1 from public.notifications n
                  where n.user_id = s.customer_id and n.type = 'SAVED_COMPANY_NEW'
                    and n.related_id::text = new.company_id::text and n.created_at > now() - interval '7 days') then
        continue;
      end if;
      insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
      values (s.customer_id, 'SAVED_COMPANY_NEW', v_title, v_msg, new.company_id, 'company', 'LOW');
      if v_hour >= 9 and v_hour < 21 then
        select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = s.customer_id;
        if coalesce((v_pref ->> 'push_enabled')::boolean, false)
           and coalesce((v_pref ->> 'push_company_recommend')::boolean, true) then
          insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
          values (s.customer_id, 'SAVED_COMPANY_NEW', v_title, v_msg, '/p/' || new.company_id, new.id::text || ':saved', 'queued')
          on conflict do nothing;
        end if;
      end if;
    end loop;
  exception when others then null;   -- 사례 저장은 막지 않는다
  end;
  return new;
end; $$;

drop trigger if exists trg_portfolio_notify_savers on public.portfolios;
create trigger trg_portfolio_notify_savers
  after insert on public.portfolios
  for each row execute function public._portfolio_notify_savers();

-- 확인: true 면 끝
select exists (select 1 from pg_trigger where tgname = 'trg_portfolio_notify_savers' and not tgisinternal) as saved_notify_ok;
