-- ════════════════════════════════════════════════════════════════════
-- 071_test_account_flag.sql
-- 테스트 계정 플래그 — 대표/QA/개발/테스트 업체 계정의 거래를 실거래
-- 재무·매출·정산 통계에서 분리하기 위한 users.is_test_account 권한 구조.
--
-- 설계 원칙(028_operator_flag_split.sql 패턴 미러링):
--  · 전화번호 하드코딩 금지 — 관리자 UI 에서 번호로 검색해 플래그만 토글.
--  · role 불변 — 기존 사용자 유형(company/consumer)은 그대로 유지.
--  · admin(role='admin') 만 토글 가능 / admin 계정 자체는 변경 불가.
--  · 기존 admin_project_flow_list / set_user_operator_* / 계산식 일절 미수정.
--  · seed 없음 — 01027406030 등 특정 번호는 적용 후 관리자 UI 로 직접 등록.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1) is_test_account 컬럼 ────────────────────────────────────────────
alter table public.users
  add column if not exists is_test_account boolean not null default false;

create index if not exists users_is_test_account_idx
  on public.users (is_test_account) where is_test_account = true;

-- ── 2) 등록: 전화번호로 검색 → is_test_account=true (role 불변) ─────────
create or replace function public.set_user_test_account_by_phone(p_phone text, p_admin_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_digits text;
  v_e164   text;
  v_id     uuid;
  v_role   text;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  v_digits := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  if left(v_digits,2) = '82' then
    v_e164 := '+' || v_digits;
  elsif left(v_digits,1) = '0' then
    v_e164 := '+82' || substr(v_digits,2);
  else
    v_e164 := '+' || v_digits;
  end if;

  select id, role into v_id, v_role
    from public.users
   where phone = v_e164 or phone = p_phone or phone = v_digits
      or phone = ('0' || substr(v_digits, greatest(length(v_digits)-9,1)))
   limit 1;

  if v_id is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_role = 'admin' then raise exception 'CANNOT_MODIFY_ADMIN'; end if;

  update public.users set is_test_account = true, updated_at = now() where id = v_id;

  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (p_admin_id, 'admin', 'SET_TEST_ACCOUNT', 'user', v_id,
          jsonb_build_object('phone', p_phone, 'role', v_role));

  return jsonb_build_object('user_id', v_id, 'role', v_role, 'is_test_account', true);
end; $$;

-- ── 3) 해제: is_test_account=false ─────────────────────────────────────
create or replace function public.unset_user_test_account(p_user_id uuid, p_admin_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_role text;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  select role into v_role from public.users where id = p_user_id;
  if v_role is null then raise exception 'USER_NOT_FOUND'; end if;

  update public.users set is_test_account = false, updated_at = now() where id = p_user_id;

  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (p_admin_id, 'admin', 'UNSET_TEST_ACCOUNT', 'user', p_user_id, jsonb_build_object('role', v_role));
end; $$;

-- ── 4) 목록: 테스트 계정(id/name/phone/role) — admin 전용 ──────────────
create or replace function public.list_test_accounts(p_admin_id uuid)
returns table (id uuid, name text, phone text, role text, created_at timestamptz)
language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  return query
    select u.id, u.name, u.phone, u.role, u.created_at
      from public.users u
     where u.is_test_account = true
     order by u.created_at desc;
end; $$;

grant execute on function public.set_user_test_account_by_phone(text, uuid) to anon, authenticated;
grant execute on function public.unset_user_test_account(uuid, uuid)        to anon, authenticated;
grant execute on function public.list_test_accounts(uuid)                   to anon, authenticated;

notify pgrst, 'reload schema';
