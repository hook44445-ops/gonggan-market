-- ════════════════════════════════════════════════════════════════════
-- 046_admin_review_moderation_text.sql
-- 리뷰 어드민(수정·숨김·삭제·복구) — 코드 관리자(가상 'admin' 계정) 지원.
--
-- 배경:
--   migration 029 의 리뷰 RPC 4개는 p_admin_id 를 uuid 로 받는다. 그런데 이 앱의
--   아이디/비밀번호 관리자는 DB users 행이 아니라 VITE_ADMIN_CODE 게이트로 인증되는
--   '가상 코드 관리자'(userId='admin') 라서, 숨김/삭제/수정/복구 호출 시 문자열 "admin"
--   이 uuid 파라미터(및 reviews.deleted_by / admin_logs.admin_id uuid 컬럼)에 들어가
--     invalid input syntax for type uuid: "admin"
--   으로 실패했다. (PostgREST 가 함수 본문 진입 전에 인자 캐스팅 단계에서 실패)
--
-- 수정(이미 cleanup RPC 에 적용된 migration 040 패턴을 그대로 따른다):
--   · p_admin_id 를 uuid → text 로 변경(가상 'admin' 허용).
--   · 권한 게이트:
--       - p_admin_id 가 유효 uuid 면 → users.role='admin' 필수.
--       - p_admin_id 가 'admin'(코드 관리자 sentinel) 이면 → 허용(클라이언트 게이트 신뢰).
--       - 그 외 → 거부(ADMIN_ONLY).
--   · uuid 컬럼(reviews.deleted_by, admin_logs.admin_id)에는 _safe_uuid 로 캐스팅 가능할
--     때만 저장, 가상 'admin' 은 NULL(원본은 admin_logs.reason/after_val 에 기록).
--   · 기존 uuid 시그니처 함수는 drop(시그니처 변경 → overload 충돌 방지).
--
-- 멱등 · 추가 전용 · 물리 삭제 없음(soft delete). Supabase SQL Editor 에서 1회 실행(040 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 안전 uuid 캐스팅(유효한 uuid 문자열이 아니면 null) — 040 과 동일(없으면 생성, 있으면 갱신)
create or replace function public._safe_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end; $$;

-- 기존 uuid 시그니처 제거(text 시그니처로 교체)
drop function if exists public.admin_update_review(uuid, uuid, int, text, text);
drop function if exists public.admin_set_review_hidden(uuid, uuid, boolean, text);
drop function if exists public.admin_soft_delete_review(uuid, uuid, text);
drop function if exists public.admin_restore_review(uuid, uuid);

-- ── 1) 수정 ──────────────────────────────────────────────────────────
create or replace function public.admin_update_review(
  p_review_id uuid,
  p_admin_id  text,
  p_rating    int  default null,
  p_content   text default null,
  p_status    text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.reviews; v_admin_uuid uuid;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY';
    end if;
  elsif coalesce(p_admin_id, '') not in ('admin') then
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

  begin
    insert into public.admin_logs(admin_id, action, target_type, target_id, after_val)
    values (v_admin_uuid, 'UPDATE_REVIEW', 'review', p_review_id,
            jsonb_build_object('rating', v_row.rating, 'status', v_row.status, 'admin_raw', p_admin_id));
  exception when others then null; end;

  return jsonb_build_object('id', v_row.id, 'rating', v_row.rating,
                            'status', v_row.status, 'content', v_row.content);
end; $$;

-- ── 2) 숨김 / 숨김 해제 ──────────────────────────────────────────────
create or replace function public.admin_set_review_hidden(
  p_review_id uuid,
  p_admin_id  text,
  p_hidden    boolean,
  p_reason    text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.reviews; v_admin_uuid uuid;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY';
    end if;
  elsif coalesce(p_admin_id, '') not in ('admin') then
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

  begin
    insert into public.admin_logs(admin_id, action, target_type, target_id, before_val, after_val, reason)
    values (v_admin_uuid, case when p_hidden then 'HIDE_REVIEW' else 'UNHIDE_REVIEW' end,
            'review', p_review_id,
            jsonb_build_object('is_hidden', not p_hidden),
            jsonb_build_object('is_hidden', p_hidden, 'admin_raw', p_admin_id), p_reason);
  exception when others then null; end;

  return jsonb_build_object('id', v_row.id, 'is_hidden', v_row.is_hidden);
end; $$;

-- ── 3) 소프트 삭제 ───────────────────────────────────────────────────
create or replace function public.admin_soft_delete_review(
  p_review_id uuid,
  p_admin_id  text,
  p_reason    text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.reviews; v_admin_uuid uuid;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY';
    end if;
  elsif coalesce(p_admin_id, '') not in ('admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.reviews
     set is_deleted = true, deleted_at = now(), deleted_by = v_admin_uuid, updated_at = now()
   where id = p_review_id
   returning * into v_row;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;

  begin
    insert into public.admin_logs(admin_id, action, target_type, target_id, reason)
    values (v_admin_uuid, 'DELETE_REVIEW', 'review', p_review_id,
            coalesce(p_reason, '') || case when v_admin_uuid is null then ' [admin_raw=' || coalesce(p_admin_id,'') || ']' else '' end);
  exception when others then null; end;

  return jsonb_build_object('id', v_row.id, 'is_deleted', v_row.is_deleted);
end; $$;

-- ── 4) 복구 ──────────────────────────────────────────────────────────
create or replace function public.admin_restore_review(
  p_review_id uuid,
  p_admin_id  text
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.reviews; v_admin_uuid uuid;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY';
    end if;
  elsif coalesce(p_admin_id, '') not in ('admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.reviews
     set is_deleted = false, deleted_at = null, deleted_by = null,
         is_hidden = false, hidden_at = null, hidden_reason = null, updated_at = now()
   where id = p_review_id
   returning * into v_row;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;

  begin
    insert into public.admin_logs(admin_id, action, target_type, target_id, after_val)
    values (v_admin_uuid, 'RESTORE_REVIEW', 'review', p_review_id,
            jsonb_build_object('admin_raw', p_admin_id));
  exception when others then null; end;

  return jsonb_build_object('id', v_row.id, 'is_deleted', v_row.is_deleted, 'is_hidden', v_row.is_hidden);
end; $$;

grant execute on function public.admin_update_review(uuid, text, int, text, text)   to anon, authenticated;
grant execute on function public.admin_set_review_hidden(uuid, text, boolean, text) to anon, authenticated;
grant execute on function public.admin_soft_delete_review(uuid, text, text)         to anon, authenticated;
grant execute on function public.admin_restore_review(uuid, text)                   to anon, authenticated;

notify pgrst, 'reload schema';
