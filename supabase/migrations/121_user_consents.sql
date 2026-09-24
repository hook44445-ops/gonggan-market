-- ════════════════════════════════════════════════════════════════════
-- 121_user_consents.sql  (총점검 09-25 — 약관 동의가 기기에만 남던 것)
--
-- 문제: 약관·개인정보·위치정보 동의를 브라우저(localStorage)에만 저장했다.
--   · 기기·브라우저가 바뀔 때마다 동의를 다시 받는다(대표 계정으로 점검할 때마다 창이 뜬다).
--   · 회사 쪽에 «언제 무엇에 동의했는지» 증빙이 남지 않는다(개인정보·위치정보 동의는 기록이 필요).
-- 고침: 동의 한 건 = 한 줄(사용자 · 문서 종류 · 동의 시각 · 기기 정보). 지우지 않고 쌓는다.
--   앱은 Supabase 로그인 세션이 없어(auth.uid() = null) 표를 직접 읽고 쓰지 못한다 → definer 함수로만.
--   · consent_record(user, types[], ua)   — 동의 기록(같은 사용자·종류는 첫 동의 시각을 지킨다)
--   · consent_types_for(user)             — 이 사용자가 동의한 문서 종류 목록(시각 없이 종류만)
--
-- 추가 전용 · 재실행 안전. Supabase SQL Editor 에서 한 번 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create table if not exists public.user_consents (
  user_id       uuid        not null references public.users(id) on delete cascade,
  consent_type  text        not null,
  consented_at  timestamptz not null default now(),
  user_agent    text,
  primary key (user_id, consent_type)
);
alter table public.user_consents enable row level security;   -- 정책 없음 = 표 직접 접근 불가

create or replace function public.consent_record(p_user_id uuid, p_types text[], p_user_agent text default null)
returns integer language plpgsql security definer
set search_path = public, extensions as $$
declare v_n integer := 0;
begin
  if p_user_id is null or not exists (select 1 from public.users where id = p_user_id) then
    return 0;
  end if;
  insert into public.user_consents (user_id, consent_type, user_agent)
  select p_user_id, t, left(p_user_agent, 300)
    from unnest(coalesce(p_types, '{}'::text[])) as t
   where coalesce(trim(t), '') <> '' and length(t) <= 60
  on conflict (user_id, consent_type) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end; $$;
grant execute on function public.consent_record(uuid, text[], text) to anon, authenticated;

create or replace function public.consent_types_for(p_user_id uuid)
returns text[] language sql stable security definer
set search_path = public, extensions as $$
  select coalesce(array_agg(consent_type order by consent_type), '{}'::text[])
    from public.user_consents where user_id = p_user_id;
$$;
grant execute on function public.consent_types_for(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 셋 다 true 면 끝
select
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_consents') as table_ok,
  exists (select 1 from pg_proc where proname = 'consent_record')    as record_ok,
  exists (select 1 from pg_proc where proname = 'consent_types_for') as read_ok;
