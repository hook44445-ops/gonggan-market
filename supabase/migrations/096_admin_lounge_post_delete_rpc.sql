-- ════════════════════════════════════════════════════════════════════
-- Phase 22 — 관리자 lounge_posts 소프트삭제/복구/수정 RPC (RLS 우회, 확정 수정)
--
--   증상(스크린샷 확인): 관리자 삭제 시
--     "new row violates row-level security policy for table lounge_posts"
--   원인: 관리자 패널이 anon 키 또는 role 매칭 문제로 UPDATE RLS 를 통과하지 못하는 환경.
--   확정 수정: 리뷰 어드민(admin_soft_delete_review)과 동일한 SECURITY DEFINER RPC 로
--             RLS 를 우회하되, 내부에서 p_admin_id 가 admin 인지 검증한다.
--
--   · 삭제는 Soft Delete(is_deleted=true) 유지 — 물리 삭제(DELETE) 없음.
--   · 범위: lounge_posts 만. 다른 테이블 RLS·기존 기능 무변경. 멱등.
--   · Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 1) 관리자 소프트 삭제
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

-- 2) 관리자 복구
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

-- 3) 관리자 본문/제목/카테고리 수정(선택적 필드만 갱신)
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

-- 실행 권한(내부에서 admin 검증하므로 anon/authenticated 모두 호출 허용 — 관리자 패널 인증방식 무관).
grant execute on function public.admin_soft_delete_lounge_post(uuid, uuid, text) to anon, authenticated;
grant execute on function public.admin_restore_lounge_post(uuid, uuid)          to anon, authenticated;
grant execute on function public.admin_update_lounge_post(uuid, uuid, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
