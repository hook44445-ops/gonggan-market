-- ════════════════════════════════════════════════════════════════════
-- 029_admin_review_moderation.sql
-- 리뷰 어드민(수정·숨김·삭제·복구)이 실제 DB에 반영되도록 보안 정의자(security definer)
-- RPC 로 전환.
--
-- 배경:
--   기존 리뷰 어드민은 익명(anon) 키로 reviews 테이블을 직접 UPDATE 했다.
--   그런데 이 앱은 전화번호(OTP) 커스텀 인증이라 Supabase auth 세션을 만들지 않으므로
--   auth.uid() 가 항상 null 이고, reviews 의 UPDATE 정책은
--     "reviews: company reply" = auth.uid() = (해당 업체 owner)
--   하나뿐이라 관리자 수정/숨김/삭제가 RLS 에 막혀 0행 갱신 → 저장이 반영되지 않았다.
--   (admin_logs 도 RLS·target_type CHECK 때문에 기록 실패)
--
--   운영자/라운지 운영 기능(op_set_post_hidden, set_user_operator_by_phone 등)이 쓰는 방식과
--   동일하게, p_admin_id 를 받아 role='admin' 을 함수 내부에서 검증하고 RLS 를 우회하는
--   security definer 함수로 처리한다. (auth.uid() 비의존)
--
-- 변경:
--   1) admin_logs.target_type CHECK 에 'review','lounge_post','lounge_comment' 추가
--      (라운지 어드민 로그도 같은 이유로 막혀있던 잠재 버그 동시 보강)
--   2) admin_update_review / admin_set_review_hidden / admin_soft_delete_review /
--      admin_restore_review 4개 RPC (security definer, role=admin 검증)
--
-- 멱등 · 추가 전용 · 물리 삭제 없음(soft delete). Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1) admin_logs.target_type 확장 ───────────────────────────────────
alter table public.admin_logs drop constraint if exists admin_logs_target_type_check;
alter table public.admin_logs add constraint admin_logs_target_type_check
  check (target_type in (
    'company','customer','user','dispute','settlement','payment',
    'lounge','report','document','review','lounge_post','lounge_comment'
  ));

-- ── 2) 리뷰 어드민 RPC (security definer · role=admin 검증) ───────────
create or replace function public.admin_update_review(
  p_review_id uuid,
  p_admin_id  uuid,
  p_rating    int  default null,
  p_content   text default null,
  p_status    text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.reviews;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.reviews
     set rating     = coalesce(p_rating, rating),
         content    = coalesce(p_content, content),
         status     = coalesce(p_status, status),
         updated_at = now()
   where id = p_review_id
   returning * into v_row;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;

  insert into public.admin_logs(admin_id, action, target_type, target_id, after_val)
  values (p_admin_id, 'UPDATE_REVIEW', 'review', p_review_id,
          jsonb_build_object('rating', v_row.rating, 'status', v_row.status));

  return jsonb_build_object('id', v_row.id, 'rating', v_row.rating,
                            'status', v_row.status, 'content', v_row.content);
end; $$;

create or replace function public.admin_set_review_hidden(
  p_review_id uuid,
  p_admin_id  uuid,
  p_hidden    boolean,
  p_reason    text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.reviews;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.reviews
     set is_hidden     = p_hidden,
         hidden_at     = case when p_hidden then now()    else null end,
         hidden_reason = case when p_hidden then p_reason else null end,
         updated_at    = now()
   where id = p_review_id
   returning * into v_row;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;

  insert into public.admin_logs(admin_id, action, target_type, target_id, before_val, after_val, reason)
  values (p_admin_id, case when p_hidden then 'HIDE_REVIEW' else 'UNHIDE_REVIEW' end,
          'review', p_review_id,
          jsonb_build_object('is_hidden', not p_hidden),
          jsonb_build_object('is_hidden', p_hidden), p_reason);

  return jsonb_build_object('id', v_row.id, 'is_hidden', v_row.is_hidden);
end; $$;

create or replace function public.admin_soft_delete_review(
  p_review_id uuid,
  p_admin_id  uuid,
  p_reason    text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.reviews;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.reviews
     set is_deleted = true, deleted_at = now(), deleted_by = p_admin_id, updated_at = now()
   where id = p_review_id
   returning * into v_row;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;

  insert into public.admin_logs(admin_id, action, target_type, target_id, reason)
  values (p_admin_id, 'DELETE_REVIEW', 'review', p_review_id, p_reason);

  return jsonb_build_object('id', v_row.id, 'is_deleted', v_row.is_deleted);
end; $$;

create or replace function public.admin_restore_review(
  p_review_id uuid,
  p_admin_id  uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.reviews;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.reviews
     set is_deleted = false, deleted_at = null, deleted_by = null,
         is_hidden = false, hidden_at = null, hidden_reason = null, updated_at = now()
   where id = p_review_id
   returning * into v_row;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;

  insert into public.admin_logs(admin_id, action, target_type, target_id)
  values (p_admin_id, 'RESTORE_REVIEW', 'review', p_review_id);

  return jsonb_build_object('id', v_row.id, 'is_deleted', v_row.is_deleted, 'is_hidden', v_row.is_hidden);
end; $$;

grant execute on function public.admin_update_review(uuid, uuid, int, text, text)  to anon, authenticated;
grant execute on function public.admin_set_review_hidden(uuid, uuid, boolean, text) to anon, authenticated;
grant execute on function public.admin_soft_delete_review(uuid, uuid, text)         to anon, authenticated;
grant execute on function public.admin_restore_review(uuid, uuid)                   to anon, authenticated;

notify pgrst, 'reload schema';
