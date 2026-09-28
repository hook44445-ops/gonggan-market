-- ============================================================
--  Migration 154: 업체 페이지 꾸미기 — 커버 사진 · 로고 · 소개글
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(추가 전용).
--
--  왜(대표 09-28): 업체 공개 페이지(/p/…)가 새 업체일수록 비어 보인다. 업체가 직접 커버·로고·소개를 올린다.
--    앱(React)과 로컬에서 만드는 Astro 페이지가 같은 칸을 읽는다(cover_url · logo_url · intro).
--  규칙
--    · 바꿀 수 있는 사람: 그 업체 주인(로그인 토큰의 사용자) 또는 관리자
--    · 사진 주소는 우리 저장소(photos 버킷 company/…)에 올린 것만 — 남의 사이트 그림을 걸 수 없게
--    · 소개글 300자 · null 을 보내면 그 칸은 그대로, 빈 글자('')를 보내면 지운다
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

alter table public.companies add column if not exists cover_url text;
alter table public.companies add column if not exists logo_url  text;
alter table public.companies add column if not exists intro     text;

create or replace function public.company_set_profile(p_company_id uuid, p_cover_url text default null, p_logo_url text default null, p_intro text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_row public.companies;
  v_ok_prefix text := '/storage/v1/object/public/photos/company/';
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select owner_id into v_owner from public.companies where id = p_company_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'COMPANY_NOT_FOUND'); end if;
  if v_owner is distinct from v_uid and not public.is_admin() then raise exception 'OWNER_ONLY' using errcode = '42501'; end if;

  if p_cover_url is not null and p_cover_url <> '' and (position(v_ok_prefix in p_cover_url) = 0 or char_length(p_cover_url) > 500 or p_cover_url !~ '^https://') then
    return jsonb_build_object('ok', false, 'reason', 'BAD_IMAGE');
  end if;
  if p_logo_url is not null and p_logo_url <> '' and (position(v_ok_prefix in p_logo_url) = 0 or char_length(p_logo_url) > 500 or p_logo_url !~ '^https://') then
    return jsonb_build_object('ok', false, 'reason', 'BAD_IMAGE');
  end if;
  if p_intro is not null and char_length(trim(p_intro)) > 300 then
    return jsonb_build_object('ok', false, 'reason', 'INTRO_TOO_LONG');
  end if;

  update public.companies set
    cover_url = case when p_cover_url is null then cover_url else nullif(p_cover_url, '') end,
    logo_url  = case when p_logo_url  is null then logo_url  else nullif(p_logo_url, '')  end,
    intro     = case when p_intro     is null then intro     else nullif(trim(p_intro), '') end
  where id = p_company_id
  returning * into v_row;
  return jsonb_build_object('ok', true, 'cover_url', v_row.cover_url, 'logo_url', v_row.logo_url, 'intro', v_row.intro);
end; $$;
grant execute on function public.company_set_profile(uuid, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'companies' and column_name = 'intro') as profile_cols_ok,
  exists (select 1 from pg_proc where proname = 'company_set_profile')                                                             as profile_fn_ok;
