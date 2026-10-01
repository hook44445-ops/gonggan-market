-- ============================================================
--  Migration 199: 라운지 신고 — 신고한 사람은 로그인 토큰으로만 · 조회수(라운지 글 · 업체 페이지) — 한 사람 하루 한 번
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  순서: 앱 배포 → 이 SQL(먼저 실행해도 망가지진 않는다 — 옛 앱 신고는 «익명 신고»로, 조회수는 접속 주소로 센다).
--
--  왜(10-01 점검):
--    · lounge_report_create(113)는 «앱이 보낸 신고자 ID»를 믿었다 — 남의 이름으로 신고를 남길 수 있었다
--      (관리자 신고 목록의 «신고한 사람»이 거짓이 된다 · 신고 수로 자동 숨김은 없다).
--    · increment_lounge_view(141) · company_page_view(156)는 부를 때마다 +1 —
--      라운지 «인기글» 순서가 조회수로 정해져(view_count) 광고 글을 반복 호출로 맨 위에 올릴 수 있었다.
--  바꾼 뒤
--    · 신고: 신고자 = 로그인 토큰의 사용자(없으면 익명 신고 — 예전처럼 로그인 없이도 신고는 된다) · 넘긴 ID 는 무시
--    · 조회수: 같은 사람이 같은 글(업체 페이지)을 한국 날짜로 하루 한 번만 올린다
--        사람 구분 = 로그인했으면 계정 · 아니면 접속 주소(request.headers — cf-connecting-ip → x-real-ip → x-forwarded-for 첫 칸)
--        둘 다 없으면 예전처럼 센다(조회수가 멈추지 않게)
--      기록 표 view_marks(종류 · 대상 · 사람 · 날짜) — 앱에서 직접 못 읽고 못 쓴다(정책 없음)
--  되돌리기: 113 의 lounge_report_create · 141 의 increment_lounge_view · 156 의 company_page_view 를 다시 실행한다.
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 1) 신고 — 신고자 = 토큰의 사용자
create or replace function public.lounge_report_create(
  p_reporter_id uuid, p_target_type text, p_target_id text, p_reason text, p_description text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_id uuid;
begin
  p_reporter_id := auth.uid();   -- 199: 앱이 보낸 신고자 ID 는 쓰지 않는다(로그인 안 했으면 익명 신고)
  if p_target_type not in ('post','comment','story','user') then raise exception 'BAD_TARGET_TYPE'; end if;
  if coalesce(trim(p_target_id), '') = '' then raise exception 'NO_TARGET'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'NO_REASON'; end if;
  if p_reporter_id is not null and not exists (select 1 from public.users where id = p_reporter_id) then
    p_reporter_id := null;
  end if;

  select id into v_id from public.lounge_reports
   where target_type = p_target_type and target_id = p_target_id
     and reporter_id is not distinct from p_reporter_id
     and status in ('pending','reviewing')
   limit 1;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
  end if;

  insert into public.lounge_reports (reporter_id, target_type, target_id, reason, description)
  values (p_reporter_id, p_target_type, trim(p_target_id), left(trim(p_reason), 100), left(p_description, 1000))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
end; $$;
grant execute on function public.lounge_report_create(uuid,text,text,text,text) to anon, authenticated;

-- 2) 조회 기록 — 한 사람 하루 한 번
create table if not exists public.view_marks (
  kind   text not null,
  target uuid not null,
  viewer text not null,
  day    date not null,
  primary key (kind, target, viewer, day)
);
alter table public.view_marks enable row level security;   -- 정책 없음 = 앱에서 직접 못 읽고 못 쓴다

-- 지금 보는 사람(계정 또는 접속 주소) — 없으면 null
create or replace function public._viewer_key()
returns text language plpgsql stable
set search_path = public, extensions as $$
declare v_h json; v_ip text;
begin
  if auth.uid() is not null then return 'u:' || auth.uid()::text; end if;
  begin
    v_h := current_setting('request.headers', true)::json;
    -- 꾸미기 어려운 순서: Cloudflare 가 넣는 주소 → 프록시 주소 → x-forwarded-for 첫 칸
    v_ip := coalesce(nullif(trim(v_h ->> 'cf-connecting-ip'), ''),
                     nullif(trim(v_h ->> 'x-real-ip'), ''),
                     nullif(trim(split_part(coalesce(v_h ->> 'x-forwarded-for', ''), ',', 1)), ''));
  exception when others then v_ip := null; end;
  return case when v_ip is null then null else 'ip:' || left(v_ip, 64) end;
end; $$;

-- 처음 보는가(오늘) — 처음이면 표시하고 true
create or replace function public._view_first_today(p_kind text, p_target uuid)
returns boolean language plpgsql security definer
set search_path = public, extensions as $$
declare v_key text := public._viewer_key(); v_n int;
begin
  if p_target is null then return false; end if;
  if v_key is null then return true; end if;   -- 사람을 모르면 예전처럼 센다
  insert into public.view_marks (kind, target, viewer, day)
  values (p_kind, p_target, v_key, (now() at time zone 'Asia/Seoul')::date)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end; $$;
revoke execute on function public._view_first_today(text, uuid) from public, anon, authenticated;

create or replace function public.increment_lounge_view(p_post_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not public._view_first_today('lounge_post', p_post_id) then return; end if;   -- 199: 한 사람 하루 한 번
  update public.lounge_posts set view_count = coalesce(view_count, 0) + 1 where id = p_post_id;
end; $$;
grant execute on function public.increment_lounge_view(uuid) to anon, authenticated;

create or replace function public.company_page_view(p_company_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_company_id is null or not exists (select 1 from public.companies where id = p_company_id) then return; end if;
  if not public._view_first_today('company_page', p_company_id) then return; end if;   -- 199: 한 사람 하루 한 번
  insert into public.company_page_views (company_id, day, views) values (p_company_id, v_day, 1)
  on conflict (company_id, day) do update
    set views = public.company_page_views.views + 1
    where public.company_page_views.views < 10000;
end; $$;
grant execute on function public.company_page_view(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① report_actor: 신고자를 토큰으로 정한다
--  ② view_once: 두 조회수 함수가 «하루 한 번»을 확인하고 기록 표는 잠겨 있다
select
  position('199:' in pg_get_functiondef('public.lounge_report_create(uuid,text,text,text,text)'::regprocedure)) > 0 as report_actor,
  position('_view_first_today' in pg_get_functiondef('public.increment_lounge_view(uuid)'::regprocedure)) > 0
  and position('_view_first_today' in pg_get_functiondef('public.company_page_view(uuid)'::regprocedure)) > 0
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'view_marks') as view_once;
