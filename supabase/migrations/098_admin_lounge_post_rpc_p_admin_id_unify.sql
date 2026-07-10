-- ════════════════════════════════════════════════════════════════════
-- Phase 26 — 관리자 lounge_posts RPC 시그니처 통일 (p_admin_id 3/2인자 확정)
--
--   증상: 프론트가 admin_soft_delete_lounge_post(p_id, p_admin_id, p_reason) 3인자를 호출하나
--         DB 에는 auth.uid() 기반 2인자 admin_soft_delete_lounge_post(p_id, p_reason) 만 존재해
--         "Could not find the function ...(p_admin_id,p_id,p_reason) in the schema cache" 발생.
--   원인: 이 앱은 Supabase Auth 가 아니라 custom localStorage 세션 + anon 키 구조라
--         auth.uid() 가 NULL → auth.uid() 기반 함수 사용 불가.
--   확정: auth.uid() 기반(p_admin_id 없는) 버전을 DROP 하고, p_admin_id 를 명시적으로 받는
--         SECURITY DEFINER 버전으로 4개 함수(삭제/복구/수정/필드수정)를 통일한다.
--         admin 검증은 public.users.id = p_admin_id AND role='admin'.
--
--   · Soft Delete 만(is_deleted=true) · Hard Delete 없음.
--   · lounge_posts 만 대상. 다른 테이블 RLS·기존 기능 무변경. 멱등(재실행 안전).
--   · Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 0) auth.uid() 기반(p_admin_id 없는) 구버전 제거 — 오버로드 충돌/오호출 방지.
drop function if exists public.admin_soft_delete_lounge_post(uuid, text);
drop function if exists public.admin_soft_delete_lounge_post(uuid);
drop function if exists public.admin_restore_lounge_post(uuid);
drop function if exists public.admin_update_lounge_post_fields(uuid, jsonb);
drop function if exists public.admin_update_lounge_post(uuid, text, text, text);

-- 1) 관리자 소프트 삭제 (p_id, p_admin_id, p_reason)
create or replace function public.admin_soft_delete_lounge_post(
  p_id       uuid,
  p_admin_id uuid,
  p_reason   text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.lounge_posts;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.lounge_posts
     set is_deleted = true,
         deleted_at = now(),
         deleted_by = p_admin_id,
         is_visible = false,
         updated_at = now()
   where id = p_id
   returning * into v_row;
  if not found then raise exception 'LOUNGE_POST_NOT_FOUND'; end if;

  insert into public.admin_logs (admin_id, action, target_type, target_id, reason)
  values (p_admin_id, 'DELETE_LOUNGE_POST', 'lounge_post', p_id, p_reason);

  return jsonb_build_object('id', v_row.id, 'is_deleted', v_row.is_deleted);
end; $$;

-- 2) 관리자 복구 (p_id, p_admin_id)
create or replace function public.admin_restore_lounge_post(
  p_id       uuid,
  p_admin_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.lounge_posts;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.lounge_posts
     set is_deleted = false,
         deleted_at = null,
         deleted_by = null,
         is_hidden  = false,
         updated_at = now()
   where id = p_id
   returning * into v_row;
  if not found then raise exception 'LOUNGE_POST_NOT_FOUND'; end if;

  insert into public.admin_logs (admin_id, action, target_type, target_id)
  values (p_admin_id, 'RESTORE_LOUNGE_POST', 'lounge_post', p_id);

  return jsonb_build_object('id', v_row.id, 'is_deleted', v_row.is_deleted);
end; $$;

-- 3) 관리자 제목/본문/카테고리 수정 (p_id, p_admin_id, p_title, p_content, p_category)
create or replace function public.admin_update_lounge_post(
  p_id       uuid,
  p_admin_id uuid,
  p_title    text default null,
  p_content  text default null,
  p_category text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.lounge_posts;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.lounge_posts
     set title      = coalesce(p_title, title),
         content    = coalesce(p_content, content),
         category   = coalesce(p_category, category),
         updated_at = now()
   where id = p_id
   returning * into v_row;
  if not found then raise exception 'LOUNGE_POST_NOT_FOUND'; end if;

  insert into public.admin_logs (admin_id, action, target_type, target_id)
  values (p_admin_id, 'UPDATE_LOUNGE_POST', 'lounge_post', p_id);

  return jsonb_build_object('id', v_row.id);
end; $$;

-- 4) 관리자 전체 필드 수정 (p_id, p_admin_id, p_patch jsonb) — 화이트리스트 필드만.
create or replace function public.admin_update_lounge_post_fields(
  p_id       uuid,
  p_admin_id uuid,
  p_patch    jsonb
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.lounge_posts;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.lounge_posts
     set title      = coalesce(nullif(p_patch->>'title',' '), case when p_patch ? 'title' then p_patch->>'title' else title end),
         content    = case when p_patch ? 'content'   then p_patch->>'content'  else content   end,
         category   = case when p_patch ? 'category'  then p_patch->>'category' else category  end,
         region     = case when p_patch ? 'region'    then p_patch->>'region'   else region    end,
         gender     = case when p_patch ? 'gender'    then p_patch->>'gender'   else gender    end,
         age_group  = case when p_patch ? 'age_group' then p_patch->>'age_group' else age_group end,
         image_urls = case when p_patch ? 'image_urls' then
                        (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(p_patch->'image_urls') as t(x))
                        else image_urls end,
         updated_at = now()
   where id = p_id
   returning * into v_row;
  if not found then raise exception 'LOUNGE_POST_NOT_FOUND'; end if;

  insert into public.admin_logs (admin_id, action, target_type, target_id, after_val)
  values (p_admin_id, 'UPDATE_LOUNGE_POST', 'lounge_post', p_id, p_patch);

  return jsonb_build_object('id', v_row.id, 'title', v_row.title, 'category', v_row.category);
end; $$;

-- 실행 권한(내부 admin 검증하므로 anon/authenticated 모두 허용 — 관리자 패널 인증방식 무관).
grant execute on function public.admin_soft_delete_lounge_post(uuid, uuid, text)              to anon, authenticated;
grant execute on function public.admin_restore_lounge_post(uuid, uuid)                         to anon, authenticated;
grant execute on function public.admin_update_lounge_post(uuid, uuid, text, text, text)        to anon, authenticated;
grant execute on function public.admin_update_lounge_post_fields(uuid, uuid, jsonb)            to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 실행 후 확인: 4개 함수가 p_admin_id 포함 시그니처인지 ────────────────
-- select proname, pg_get_function_identity_arguments(oid) as args
-- from pg_proc
-- where pronamespace = 'public'::regnamespace
--   and proname in ('admin_soft_delete_lounge_post','admin_restore_lounge_post',
--                   'admin_update_lounge_post','admin_update_lounge_post_fields')
-- order by proname;
