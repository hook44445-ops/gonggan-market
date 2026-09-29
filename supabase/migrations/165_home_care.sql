-- ============================================================
--  Migration 165: 내 집 관리 수첩 — 한 날짜·주기를 적어 두면 다음 시기를 알려 준다
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(추가 전용).
--
--  왜(대표 09-29 「1등 재방문」): 공사가 끝난 뒤에도 앱을 열 이유 — «욕실 실리콘 2년 됐어요».
--  규칙
--    · 본인 것만 읽고 쓴다(로그인 토큰 · 작업 장부 146 과 같은 방식)
--    · 항목: 이름(30자) · 주기(1~240개월) · 한 날짜 · 메모(200자)
--    · 시기가 된 항목은 알림함으로 한 번(같은 항목 30일에 한 번) — 자기 집 관리 안내라 광고 아님, 푸시는 푸시 켠 사람만
--    · home_care_due() 는 /api/push/dispatch 가 돌 때마다 부른다(한국 9~20시만)
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create table if not exists public.home_care_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  kind         text,
  label        text not null check (char_length(label) between 1 and 30),
  cycle_months int  not null check (cycle_months between 1 and 240),
  done_on      date not null,
  memo         text check (memo is null or char_length(memo) <= 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists home_care_items_user on public.home_care_items (user_id);

alter table public.home_care_items enable row level security;
drop policy if exists "home_care_items: own" on public.home_care_items;
create policy "home_care_items: own" on public.home_care_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.home_care_items to authenticated;

-- 시기 알림 — 다음 시기(한 날짜 + 주기)가 오늘 이전·오늘인 항목 · 같은 항목 30일에 한 번
create or replace function public.home_care_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_local timestamp := now() at time zone 'Asia/Seoul';
  v_today date := v_local::date;
  v_hour int := extract(hour from v_local)::int;
  r record; v_pref jsonb; v_title text; v_msg text; v_n int := 0;
begin
  if v_hour < 9 or v_hour >= 20 then return jsonb_build_object('status', 'quiet_hours'); end if;
  for r in
    select i.id, i.user_id, i.label, i.done_on, i.cycle_months
      from public.home_care_items i
     where (i.done_on + make_interval(months => i.cycle_months))::date <= v_today
       and not exists (select 1 from public.notifications n
                        where n.user_id = i.user_id and n.type = 'HOME_CARE_DUE'
                          and n.related_id::text = i.id::text and n.created_at > now() - interval '30 days')
     limit 500
  loop
    begin
      v_title := r.label || ' 시기가 됐어요';
      v_msg := to_char(r.done_on, 'YYYY년 FMMM월') || '에 한 뒤 ' || r.cycle_months || '개월이 지났어요. 내 집 관리 수첩에서 확인해 보세요.';
      insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
      values (r.user_id, 'HOME_CARE_DUE', v_title, v_msg, r.id, 'home_care', 'NORMAL');
      select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = r.user_id;
      if coalesce((v_pref ->> 'push_enabled')::boolean, false) then
        insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
        values (r.user_id, 'HOME_CARE_DUE', v_title, v_msg, '/', r.id::text || ':' || to_char(v_today, 'YYYYMM'), 'queued')
        on conflict do nothing;
      end if;
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  return jsonb_build_object('status', 'ok', 'notified', v_n);
end; $$;
grant execute on function public.home_care_due() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from pg_policies where tablename = 'home_care_items' and policyname = 'home_care_items: own') as home_care_ok,
  exists (select 1 from pg_proc where proname = 'home_care_due') as home_care_due_ok;
