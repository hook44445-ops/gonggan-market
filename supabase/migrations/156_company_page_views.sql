-- ============================================================
--  Migration 156: 내 업체 페이지 방문 수 — «이번 주 방문 N명 · 누적 M명»
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(추가 전용).
--
--  왜(대표 09-29): 명함 QR·추천 링크·블로그에 업체 페이지(/p/…)를 걸어도 몇 명이 봤는지 알 수 없었다.
--    숫자가 보여야 업체가 페이지를 더 알린다(다운로드 입구가 넓어진다).
--  규칙
--    · 세는 것: 사람이 연 업체 페이지(앱 화면) — 검색 로봇은 봇 프리렌더로 가서 세지 않는다
--    · 같은 기기는 하루 한 번만(앱이 기기에 기록) · 업체 주인이 자기 페이지를 연 건 앱이 세지 않는다
--    · 날짜는 한국 시간 · 하루·업체당 한 줄(방문 수만 — 누가 봤는지는 남기지 않는다)
--    · 보기는 그 업체 주인(로그인 토큰) 또는 관리자만
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create table if not exists public.company_page_views (
  company_id uuid not null references public.companies(id) on delete cascade,
  day        date not null,
  views      int  not null default 0,
  primary key (company_id, day)
);
alter table public.company_page_views enable row level security;
-- 정책 없음 — 아래 함수로만 쓰고 읽는다

-- 방문 한 번 — 누구나(로그인 없이). 없는 업체면 아무것도 안 한다. 하루·업체당 10000 을 넘기지 않는다(장난 방지).
create or replace function public.company_page_view(p_company_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_company_id is null or not exists (select 1 from public.companies where id = p_company_id) then return; end if;
  insert into public.company_page_views (company_id, day, views) values (p_company_id, v_day, 1)
  on conflict (company_id, day) do update
    set views = public.company_page_views.views + 1
    where public.company_page_views.views < 10000;
end; $$;
grant execute on function public.company_page_view(uuid) to anon, authenticated;

-- 방문 수 보기 — 업체 주인 또는 관리자. 오늘 · 최근 7일(오늘 포함) · 누적
create or replace function public.company_page_stats(p_company_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_today int; v_week int; v_total int;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select owner_id into v_owner from public.companies where id = p_company_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'COMPANY_NOT_FOUND'); end if;
  if v_owner is distinct from v_uid and not public.is_admin() then raise exception 'OWNER_ONLY' using errcode = '42501'; end if;
  select coalesce(sum(views) filter (where day = v_day), 0),
         coalesce(sum(views) filter (where day > v_day - 7), 0),
         coalesce(sum(views), 0)
    into v_today, v_week, v_total
    from public.company_page_views where company_id = p_company_id;
  return jsonb_build_object('ok', true, 'today', v_today, 'week', v_week, 'total', v_total);
end; $$;
grant execute on function public.company_page_stats(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'company_page_views') as page_views_table_ok,
  exists (select 1 from pg_proc where proname = 'company_page_view') and exists (select 1 from pg_proc where proname = 'company_page_stats') as page_views_fn_ok;
