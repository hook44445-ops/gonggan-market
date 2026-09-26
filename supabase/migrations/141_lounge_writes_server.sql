-- ============================================================
--  Migration 141: 라운지 숫자·공감·삭제를 서버 함수로 — 「누구나 글 수정」 닫기(142) 준비
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  순서: 141 실행 → 같은 PR 앱 배포 → 142 실행(누구나 수정 권한 닫기).
--        141 은 앱 배포 앞뒤 상관없음(앱은 공감 함수가 없으면 예전 방식으로 돈다).
--
--  09-26 AI 운영 점검에서 나온 것 — lounge_posts 에 «anon update using(true)»(005) 가 남아 있어
--  로그인 없이도 아무 글의 제목·내용·숨김·공감 수를 바꿀 수 있다. 닫기 전에 그 권한에 기대던 것들을 옮긴다.
--    ① 조회수 +1(increment_lounge_view) · 댓글 수 맞추기 트리거(sync_lounge_comment_count) — 호출한 사람 권한으로
--       돌던 것을 서버 권한(security definer)으로. 안 바꾸면 142 뒤 댓글 달기가 실패한다.
--    ② 공감 lounge_post_like(글, 켜기/끄기) — 로그인 토큰의 본인만. 공감 줄이 실제로 생기거나 없어질 때만 숫자 ±1(0 아래 없음).
--       예전: 공감 줄은 토큰 없이 보내 실패하고 숫자는 직접 +1 → 같은 사람이 누를 때마다 숫자만 올라갔다.
--    ③ 본인 글 삭제 soft_delete_lounge_post — 예전엔 «넘겨준 사용자 번호»를 믿어, 남의 번호를 넣으면 남의 글이 지워졌다.
--       이제 로그인 토큰의 본인(auth.uid())만. 영구 삭제 아님(is_deleted 표시).
--  확인 칸 4개(아래 select) — 넷 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- ① 조회수 · 댓글 수 — 서버 권한으로 ------------------------------------------------------
create or replace function public.increment_lounge_view(p_post_id uuid)
returns void language sql security definer
set search_path = public as $$
  update public.lounge_posts set view_count = coalesce(view_count, 0) + 1 where id = p_post_id;
$$;
grant execute on function public.increment_lounge_view(uuid) to anon, authenticated;

create or replace function public.sync_lounge_comment_count()
returns trigger language plpgsql security definer
set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.post_id, old.post_id);
  update public.lounge_posts p set comment_count = (
    select count(*) from public.lounge_comments c
     where c.post_id = pid
       and coalesce(c.is_deleted, false) = false
       and coalesce(c.is_hidden, false) = false
  ) where p.id = pid;
  return null;
end; $$;

-- ② 공감 켜기/끄기 -------------------------------------------------------------------------
create or replace function public.lounge_post_like(p_post_id uuid, p_on boolean)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare v_uid uuid := auth.uid(); v_changed int := 0; v_count int;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.lounge_posts where id = p_post_id and not coalesce(is_deleted, false)) then
    raise exception 'NOT_FOUND';
  end if;

  if p_on then
    insert into public.lounge_post_likes (post_id, user_id) values (p_post_id, v_uid)
    on conflict (post_id, user_id) do nothing;
    get diagnostics v_changed = row_count;
    if v_changed > 0 then
      update public.lounge_posts set like_count = coalesce(like_count, 0) + 1 where id = p_post_id;
    end if;
  else
    delete from public.lounge_post_likes where post_id = p_post_id and user_id = v_uid;
    get diagnostics v_changed = row_count;
    if v_changed > 0 then
      update public.lounge_posts set like_count = greatest(0, coalesce(like_count, 0) - 1) where id = p_post_id;
    end if;
  end if;

  select like_count into v_count from public.lounge_posts where id = p_post_id;
  return jsonb_build_object('liked', p_on, 'like_count', coalesce(v_count, 0), 'changed', v_changed > 0);
end; $$;
grant execute on function public.lounge_post_like(uuid, boolean) to anon, authenticated;

-- ③ 본인 글 삭제 — 토큰의 본인만 -----------------------------------------------------------
create or replace function public.soft_delete_lounge_post(p_post_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer
set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_count int;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select user_id into v_owner from public.lounge_posts where id = p_post_id;
  if v_owner is distinct from v_uid then raise exception 'NOT_OWNER' using errcode = '42501'; end if;
  update public.lounge_posts
     set is_deleted = true, deleted_at = now(), deleted_by = v_uid
   where id = p_post_id and user_id = v_uid and not coalesce(is_deleted, false);
  get diagnostics v_count = row_count;
  return v_count > 0;
end; $$;
grant execute on function public.soft_delete_lounge_post(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 넷 다 true 면 끝
select
  (select prosecdef from pg_proc where oid = 'public.increment_lounge_view(uuid)'::regprocedure)      as view_server_ok,
  (select prosecdef from pg_proc where oid = 'public.sync_lounge_comment_count()'::regprocedure)       as comment_count_server_ok,
  exists (select 1 from pg_proc where proname = 'lounge_post_like')                                    as like_fn_ok,
  -- 142 로 닫기 전 마지막 확인: 호출한 사람 권한으로 lounge_posts 를 고치는 함수가 더 없어야 한다
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.prokind = 'f' and not p.prosecdef
                 and pg_get_functiondef(p.oid) ~* 'update\s+(public\.)?lounge_posts')                  as no_invoker_writers_ok;
