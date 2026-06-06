-- ════════════════════════════════════════════════════════════════════
-- 040_admin_cleanup_admin_id_text.sql
-- 관리자 정리도구 버그 수정 — 코드 관리자(userId='admin' 가상 계정)가 uuid 컬럼/파라미터에
-- 들어가 "invalid input syntax for type uuid: admin" 으로 실패하던 문제.
--
-- 수정:
--   · admin_cleanup_* 의 p_admin_id 를 uuid → text 로 변경(가상 'admin' 허용).
--   · 권한 게이트:
--       - p_admin_id 가 uuid 면 → users.role='admin' 필수(operator/일반 차단).
--       - p_admin_id 가 'admin'(코드 관리자 sentinel) 이면 → 허용(클라이언트 게이트 신뢰).
--       - 그 외 → 거부.
--   · admin_logs.admin_id 에는 uuid 로 캐스팅 가능할 때만 저장, 아니면 NULL(가상 'admin' 은 reason 에 기록).
--   · 기존 uuid 시그니처 함수는 drop(시그니처 변경이라 overload 충돌 방지).
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(038 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 기존 uuid 시그니처 제거(텍스트 시그니처로 교체)
drop function if exists public.admin_cleanup_request(uuid, uuid, text);
drop function if exists public.admin_cleanup_user_test_data(uuid, uuid, text);
drop function if exists public.admin_cleanup_company_test_data(uuid, uuid, text);
drop function if exists public._admin_cleanup_exec(uuid, uuid[], text, text, uuid);

-- 안전 uuid 캐스팅(유효한 uuid 문자열이 아니면 null)
create or replace function public._safe_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end; $$;

-- ── 공통 실행 + admin 게이트 + 로깅 (p_admin_id text) ──
create or replace function public._admin_cleanup_exec(
  p_admin_id text, p_ids uuid[], p_mode text, p_target_type text, p_target_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_before jsonb; v_after jsonb; v_admin_uuid uuid;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);

  -- 권한: 실제 사용자(uuid)면 role='admin' 필수. 코드 관리자 sentinel('admin')은 허용.
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY';
    end if;
  elsif coalesce(p_admin_id, '') not in ('admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  if p_mode not in ('soft_cancel', 'hard_delete_test_only') then
    raise exception 'BAD_MODE';
  end if;

  v_before := public._admin_cleanup_snapshot(p_ids);
  perform public._admin_cleanup_request_ids(p_ids, p_mode);
  v_after := public._admin_cleanup_snapshot(p_ids);

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, reason)
    values (v_admin_uuid, 'CLEANUP_' || upper(p_mode), p_target_type, p_target_id,
            jsonb_build_object('mode', p_mode, 'admin_raw', p_admin_id,
                               'request_count', coalesce(array_length(p_ids,1),0),
                               'before', v_before, 'after', v_after)::text);
  exception when others then null; end;

  return jsonb_build_object('ok', true, 'mode', p_mode,
    'request_count', coalesce(array_length(p_ids,1),0), 'before', v_before, 'after', v_after);
end; $$;

-- ── 1) request 단위 ──
create or replace function public.admin_cleanup_request(p_admin_id text, p_request_id uuid, p_mode text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
begin
  if p_request_id is null then raise exception 'NO_REQUEST_ID'; end if;
  return public._admin_cleanup_exec(p_admin_id, array[p_request_id], p_mode, 'report', p_request_id);
end; $$;

-- ── 2) user 단위 ──
create or replace function public.admin_cleanup_user_test_data(p_admin_id text, p_user_id uuid, p_mode text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_ids uuid[];
begin
  if p_user_id is null then raise exception 'NO_USER_ID'; end if;
  select array_agg(id) into v_ids from public.requests where user_id = p_user_id;
  return public._admin_cleanup_exec(p_admin_id, v_ids, p_mode, 'user', p_user_id);
end; $$;

-- ── 3) company 단위 ──
create or replace function public.admin_cleanup_company_test_data(p_admin_id text, p_company_id uuid, p_mode text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_ids uuid[];
begin
  if p_company_id is null then raise exception 'NO_COMPANY_ID'; end if;
  select array_agg(distinct rid) into v_ids from (
    select id as rid from public.requests where selected_company_id = p_company_id
    union select request_id from public.escrow_payments where company_id = p_company_id
    union select request_id from public.bids where company_id = p_company_id
  ) s where rid is not null;
  return public._admin_cleanup_exec(p_admin_id, v_ids, p_mode, 'company', p_company_id);
end; $$;

grant execute on function public.admin_cleanup_request(text,uuid,text)           to anon, authenticated;
grant execute on function public.admin_cleanup_user_test_data(text,uuid,text)    to anon, authenticated;
grant execute on function public.admin_cleanup_company_test_data(text,uuid,text) to anon, authenticated;

notify pgrst, 'reload schema';
