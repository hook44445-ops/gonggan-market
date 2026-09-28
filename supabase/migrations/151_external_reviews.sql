-- ============================================================
--  Migration 151: 공간마켓 밖 공사 후기(지인 공사 등) — 따로 표시 · 평점·온도에 넣지 않음
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(추가 전용).
--
--  왜(대표 09-28 「1번으로」): 1인 파트너(대표 포함)의 첫 신뢰는 지인 공사에서 나온다.
--    그런데 공간마켓 후기는 «계약한 공사만»이라 첫 후기를 모을 길이 없었다.
--  규칙(대표 결정 1번)
--    · 표를 따로 둔다(external_reviews) → 기존 reviews · 평점 · 공간온도 · 레벨 계산에 절대 섞이지 않는다.
--    · 쓰려면 로그인(휴대폰 인증 계정, 토큰의 사용자) · 업체 주인은 자기 업체에 못 쓴다 · 한 사람이 한 업체에 하나.
--    · 화면은 «공간마켓 밖 공사 후기» 이름으로 따로 보여 준다(계약 기록이 없는 후기라는 뜻).
--    · 관리자는 숨길 수 있다(external_review_hide).
--  확인 칸 3개(맨 아래 select) — 모두 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create table if not exists public.external_reviews (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  author_id   uuid not null references public.users(id) on delete cascade,
  author_name text not null,                      -- 이름 첫 글자 + ○○ (저장할 때 가린다)
  rating      int  not null check (rating between 1 and 5),
  work_title  text check (work_title is null or char_length(work_title) <= 40),
  content     text not null check (char_length(content) between 5 and 500),
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists external_reviews_one_per_author on public.external_reviews (company_id, author_id);
create index if not exists external_reviews_company on public.external_reviews (company_id, created_at desc);

alter table public.external_reviews enable row level security;
drop policy if exists "external_reviews: read visible" on public.external_reviews;
create policy "external_reviews: read visible" on public.external_reviews for select using (is_hidden = false);
-- 쓰기는 함수로만(정책 없음)

create or replace function public.external_review_submit(p_company_id uuid, p_rating int, p_content text, p_work_title text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_name text; v_content text := trim(coalesce(p_content, ''));
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select owner_id into v_owner from public.companies where id = p_company_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'COMPANY_NOT_FOUND'); end if;
  if v_owner = v_uid then return jsonb_build_object('ok', false, 'reason', 'OWN_COMPANY'); end if;
  if coalesce(p_rating, 0) not between 1 and 5 then return jsonb_build_object('ok', false, 'reason', 'BAD_RATING'); end if;
  if char_length(v_content) < 5 or char_length(v_content) > 500 then return jsonb_build_object('ok', false, 'reason', 'BAD_CONTENT'); end if;
  if exists (select 1 from public.external_reviews where company_id = p_company_id and author_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'ALREADY');
  end if;
  select left(coalesce(nullif(trim(name), ''), '회원'), 1) || '○○' into v_name from public.users where id = v_uid;
  insert into public.external_reviews (company_id, author_id, author_name, rating, work_title, content)
  values (p_company_id, v_uid, coalesce(v_name, '회원'), p_rating, nullif(left(trim(coalesce(p_work_title, '')), 40), ''), v_content);
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'ALREADY');
end; $$;
grant execute on function public.external_review_submit(uuid, int, text, text) to anon, authenticated;

create or replace function public.external_review_hide(p_id uuid, p_hidden boolean)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  update public.external_reviews set is_hidden = coalesce(p_hidden, true) where id = p_id;
  return jsonb_build_object('ok', found);
end; $$;
grant execute on function public.external_review_hide(uuid, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 모두 true 면 끝
select
  exists (select 1 from pg_policies where tablename = 'external_reviews' and policyname = 'external_reviews: read visible') as ext_table_ok,
  exists (select 1 from pg_proc where proname = 'external_review_submit')                                                    as ext_submit_ok,
  exists (select 1 from pg_proc where proname = 'external_review_hide')                                                      as ext_hide_ok;
