-- ════════════════════════════════════════════════════════════════════
-- 074_admin_permissions_sentinel.sql
-- 운영자 권한 RPC(073) — 코드 관리자 sentinel('admin') 허용 보정.
--
-- 문제: 073 RPC 가 p_admin_id 를 uuid 엄격 타입으로 받아, 코드 관리자
--       (App.jsx 가상 admin: id='admin')가 호출하면
--       "invalid input syntax for type uuid: admin" 으로 등록 실패.
--
-- 해결: 기존 어드민 RPC 패턴(040/046/053/058)과 동일하게
--       · p_admin_id 를 text 로 받고
--       · p_admin_id='admin'(sentinel) 또는 실제 role='admin' uuid 면 허용
--       · admin_logs.admin_id(uuid) 에는 안전 캐스팅(sentinel → NULL) 저장
--
-- 범위: 073 의 5개 함수만 재정의(시그니처 uuid→text). 프론트 변경 없음.
--       admin_permissions 테이블 / 028·071·072 / 기타 RPC·RLS·데이터 미수정.
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(073 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 기존 uuid 시그니처 제거(텍스트 시그니처로 교체 — 오버로드 모호성 방지)
drop function if exists public.admin_register_operator(uuid, text, boolean, boolean, boolean, boolean, boolean);
drop function if exists public.admin_update_permissions(uuid, uuid, boolean, boolean, boolean, boolean, boolean);
drop function if exists public.admin_reset_pin(uuid, uuid);
drop function if exists public.admin_list_operators(uuid);
drop function if exists public.admin_unregister_operator(uuid, uuid);

-- ── 1) 운영자 등록 + 권한 + PIN (sentinel 허용) ───────────────────────
create or replace function public.admin_register_operator(
  p_admin_id text, p_phone text,
  p_ops boolean default false, p_tx boolean default false, p_proof boolean default false,
  p_contents boolean default false, p_system boolean default false
)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_admin uuid; v_digits text; v_e164 text; v_id uuid; v_role text; v_pin text;
begin
  begin v_admin := nullif(p_admin_id,'')::uuid; exception when others then v_admin := null; end;
  if not (p_admin_id = 'admin'
          or (v_admin is not null and exists (select 1 from public.users where id = v_admin and role = 'admin'))) then
    raise exception 'ADMIN_ONLY';
  end if;

  v_digits := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  if left(v_digits,2) = '82' then v_e164 := '+' || v_digits;
  elsif left(v_digits,1) = '0' then v_e164 := '+82' || substr(v_digits,2);
  else v_e164 := '+' || v_digits; end if;

  select id, role into v_id, v_role from public.users
   where phone = v_e164 or phone = p_phone or phone = v_digits
      or phone = ('0' || substr(v_digits, greatest(length(v_digits)-9,1)))
   limit 1;
  if v_id is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_role = 'admin' then raise exception 'CANNOT_MODIFY_ADMIN'; end if;

  update public.users set is_operator = true, updated_at = now() where id = v_id;

  v_pin := public._gen_admin_pin();
  insert into public.admin_permissions
    (user_id, can_operations, can_transactions, can_project_proof, can_contents, can_system, pin_hash, updated_at)
  values (v_id, coalesce(p_ops,false), coalesce(p_tx,false), coalesce(p_proof,false),
          coalesce(p_contents,false), coalesce(p_system,false), crypt(v_pin, gen_salt('bf')), now())
  on conflict (user_id) do update
     set can_operations=excluded.can_operations, can_transactions=excluded.can_transactions,
         can_project_proof=excluded.can_project_proof, can_contents=excluded.can_contents,
         can_system=excluded.can_system, pin_hash=excluded.pin_hash, updated_at=now();

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, after_val)
    values (v_admin, 'REGISTER_OPERATOR', 'user', v_id,
            jsonb_build_object('ops',p_ops,'tx',p_tx,'proof',p_proof,'contents',p_contents,'system',p_system));
  exception when others then null; end;

  return jsonb_build_object('user_id', v_id, 'pin', v_pin);
end; $$;

-- ── 2) 권한 수정 ──────────────────────────────────────────────────────
create or replace function public.admin_update_permissions(
  p_admin_id text, p_user_id uuid,
  p_ops boolean, p_tx boolean, p_proof boolean, p_contents boolean, p_system boolean
)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_admin uuid;
begin
  begin v_admin := nullif(p_admin_id,'')::uuid; exception when others then v_admin := null; end;
  if not (p_admin_id = 'admin'
          or (v_admin is not null and exists (select 1 from public.users where id = v_admin and role = 'admin'))) then
    raise exception 'ADMIN_ONLY';
  end if;

  insert into public.admin_permissions
    (user_id, can_operations, can_transactions, can_project_proof, can_contents, can_system, updated_at)
  values (p_user_id, coalesce(p_ops,false), coalesce(p_tx,false), coalesce(p_proof,false),
          coalesce(p_contents,false), coalesce(p_system,false), now())
  on conflict (user_id) do update
     set can_operations=excluded.can_operations, can_transactions=excluded.can_transactions,
         can_project_proof=excluded.can_project_proof, can_contents=excluded.can_contents,
         can_system=excluded.can_system, updated_at=now();

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, after_val)
    values (v_admin, 'UPDATE_PERMISSIONS', 'user', p_user_id,
            jsonb_build_object('ops',p_ops,'tx',p_tx,'proof',p_proof,'contents',p_contents,'system',p_system));
  exception when others then null; end;

  return jsonb_build_object('user_id', p_user_id, 'updated', true);
end; $$;

-- ── 3) PIN 재발급 ─────────────────────────────────────────────────────
create or replace function public.admin_reset_pin(p_admin_id text, p_user_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_admin uuid; v_pin text;
begin
  begin v_admin := nullif(p_admin_id,'')::uuid; exception when others then v_admin := null; end;
  if not (p_admin_id = 'admin'
          or (v_admin is not null and exists (select 1 from public.users where id = v_admin and role = 'admin'))) then
    raise exception 'ADMIN_ONLY';
  end if;
  if not exists (select 1 from public.admin_permissions where user_id = p_user_id) then
    raise exception 'NOT_OPERATOR';
  end if;
  v_pin := public._gen_admin_pin();
  update public.admin_permissions set pin_hash = crypt(v_pin, gen_salt('bf')), updated_at = now()
   where user_id = p_user_id;

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id)
    values (v_admin, 'RESET_PIN', 'user', p_user_id);
  exception when others then null; end;

  return jsonb_build_object('user_id', p_user_id, 'pin', v_pin);
end; $$;

-- ── 4) 운영자 목록 ────────────────────────────────────────────────────
create or replace function public.admin_list_operators(p_admin_id text)
returns table (
  user_id uuid, name text, phone text, role text,
  can_operations boolean, can_transactions boolean, can_project_proof boolean,
  can_contents boolean, can_system boolean, has_pin boolean, updated_at timestamptz
)
language plpgsql security definer
set search_path = public, extensions as $$
declare v_admin uuid;
begin
  begin v_admin := nullif(p_admin_id,'')::uuid; exception when others then v_admin := null; end;
  if not (p_admin_id = 'admin'
          or (v_admin is not null and exists (select 1 from public.users where id = v_admin and role = 'admin'))) then
    raise exception 'ADMIN_ONLY';
  end if;
  return query
    select u.id, u.name, u.phone, u.role,
           coalesce(ap.can_operations,false), coalesce(ap.can_transactions,false),
           coalesce(ap.can_project_proof,false), coalesce(ap.can_contents,false),
           coalesce(ap.can_system,false), (ap.pin_hash is not null), ap.updated_at
      from public.users u
      left join public.admin_permissions ap on ap.user_id = u.id
     where u.is_operator = true
     order by ap.updated_at desc nulls last, u.created_at desc;
end; $$;

-- ── 5) 운영자 해제 ────────────────────────────────────────────────────
create or replace function public.admin_unregister_operator(p_admin_id text, p_user_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_admin uuid;
begin
  begin v_admin := nullif(p_admin_id,'')::uuid; exception when others then v_admin := null; end;
  if not (p_admin_id = 'admin'
          or (v_admin is not null and exists (select 1 from public.users where id = v_admin and role = 'admin'))) then
    raise exception 'ADMIN_ONLY';
  end if;
  update public.users set is_operator = false, updated_at = now() where id = p_user_id;
  delete from public.admin_permissions where user_id = p_user_id;

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id)
    values (v_admin, 'UNREGISTER_OPERATOR', 'user', p_user_id);
  exception when others then null; end;
end; $$;

grant execute on function public.admin_register_operator(text, text, boolean, boolean, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.admin_update_permissions(text, uuid, boolean, boolean, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.admin_reset_pin(text, uuid)         to anon, authenticated;
grant execute on function public.admin_list_operators(text)          to anon, authenticated;
grant execute on function public.admin_unregister_operator(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
