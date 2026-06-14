-- ════════════════════════════════════════════════════════════════════
-- 073_admin_permissions.sql
-- 운영자 권한 시스템(ADMIN IA 개편 Phase 2) — 대분류(5) 기준 권한 + PIN.
--
-- 목적: 운영자(users.is_operator)별로 관리자 메뉴 대분류 접근 권한을 부여하고,
--       6자리 PIN 을 자동 생성해 해시(pin_hash)만 저장한다. 평문은 등록/재발급
--       시 1회만 반환(모달 표시용).
--
-- 대분류: 운영 / 거래 / 프로젝트증빙 / 콘텐츠 / 시스템
--
-- 원칙:
--  · SUPER_ADMIN = users.role='admin'. 운영자 등록/권한수정/PIN재발급 전권.
--  · role 불변 — 기존 사용자 유형(company/consumer) 유지, is_operator 만 토글.
--  · 평문 PIN 미저장 — pgcrypto crypt/gen_salt('bf') 해시만 저장.
--  · admin_logs(기존 테이블) 재사용 — 신규 로그 테이블 생성 안 함.
--  · 기존 028(operator)/071(test)/072(settlement) RPC·테이블 미수정.
--  · RLS enable + 정책 미생성 → security definer RPC 경유만.
--  · Phase 3(PIN 게이트/Route Guard)는 본 마이그레이션 범위 아님.
--  · 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(072 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create extension if not exists pgcrypto with schema extensions;

-- ── 1) 테이블 ──────────────────────────────────────────────────────────
create table if not exists public.admin_permissions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.users(id) on delete cascade,
  can_operations    boolean not null default false,
  can_transactions  boolean not null default false,
  can_project_proof boolean not null default false,
  can_contents      boolean not null default false,
  can_system        boolean not null default false,
  pin_hash          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.admin_permissions enable row level security;  -- 정책 미생성 → RPC 경유만

-- ── 내부 헬퍼: 6자리 PIN 생성 ─────────────────────────────────────────
create or replace function public._gen_admin_pin()
returns text language sql volatile as $$
  select lpad((floor(random() * 1000000))::int::text, 6, '0');
$$;

-- ── 2) 운영자 등록 + 권한 + PIN 발급 ──────────────────────────────────
-- 전화번호로 사용자 검색 → is_operator=true → 권한 upsert → PIN 생성/해시.
-- 평문 PIN 은 반환값으로만 1회 노출(저장 안 함).
create or replace function public.admin_register_operator(
  p_admin_id uuid, p_phone text,
  p_ops boolean default false, p_tx boolean default false, p_proof boolean default false,
  p_contents boolean default false, p_system boolean default false
)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_digits text; v_e164 text; v_id uuid; v_role text; v_pin text;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
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
     set can_operations    = excluded.can_operations,
         can_transactions  = excluded.can_transactions,
         can_project_proof = excluded.can_project_proof,
         can_contents      = excluded.can_contents,
         can_system        = excluded.can_system,
         pin_hash          = excluded.pin_hash,
         updated_at        = now();

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, after_val)
    values (p_admin_id, 'REGISTER_OPERATOR', 'user', v_id,
            jsonb_build_object('ops',p_ops,'tx',p_tx,'proof',p_proof,'contents',p_contents,'system',p_system));
  exception when others then null; end;

  return jsonb_build_object('user_id', v_id, 'pin', v_pin);
end; $$;

-- ── 3) 권한 수정(PIN 변경 없음) ───────────────────────────────────────
create or replace function public.admin_update_permissions(
  p_admin_id uuid, p_user_id uuid,
  p_ops boolean, p_tx boolean, p_proof boolean, p_contents boolean, p_system boolean
)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  insert into public.admin_permissions
    (user_id, can_operations, can_transactions, can_project_proof, can_contents, can_system, updated_at)
  values (p_user_id, coalesce(p_ops,false), coalesce(p_tx,false), coalesce(p_proof,false),
          coalesce(p_contents,false), coalesce(p_system,false), now())
  on conflict (user_id) do update
     set can_operations    = excluded.can_operations,
         can_transactions  = excluded.can_transactions,
         can_project_proof = excluded.can_project_proof,
         can_contents      = excluded.can_contents,
         can_system        = excluded.can_system,
         updated_at        = now();

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, after_val)
    values (p_admin_id, 'UPDATE_PERMISSIONS', 'user', p_user_id,
            jsonb_build_object('ops',p_ops,'tx',p_tx,'proof',p_proof,'contents',p_contents,'system',p_system));
  exception when others then null; end;

  return jsonb_build_object('user_id', p_user_id, 'updated', true);
end; $$;

-- ── 4) PIN 재발급 ─────────────────────────────────────────────────────
create or replace function public.admin_reset_pin(p_admin_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_pin text;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
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
    values (p_admin_id, 'RESET_PIN', 'user', p_user_id);
  exception when others then null; end;

  return jsonb_build_object('user_id', p_user_id, 'pin', v_pin);
end; $$;

-- ── 5) 운영자 목록(권한 포함) ─────────────────────────────────────────
create or replace function public.admin_list_operators(p_admin_id uuid)
returns table (
  user_id uuid, name text, phone text, role text,
  can_operations boolean, can_transactions boolean, can_project_proof boolean,
  can_contents boolean, can_system boolean, has_pin boolean, updated_at timestamptz
)
language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
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

-- ── 6) 운영자 해제(권한/PIN 제거, role 불변) ──────────────────────────
create or replace function public.admin_unregister_operator(p_admin_id uuid, p_user_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  update public.users set is_operator = false, updated_at = now() where id = p_user_id;
  delete from public.admin_permissions where user_id = p_user_id;

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id)
    values (p_admin_id, 'UNREGISTER_OPERATOR', 'user', p_user_id);
  exception when others then null; end;
end; $$;

grant execute on function public.admin_register_operator(uuid, text, boolean, boolean, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.admin_update_permissions(uuid, uuid, boolean, boolean, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.admin_reset_pin(uuid, uuid)         to anon, authenticated;
grant execute on function public.admin_list_operators(uuid)          to anon, authenticated;
grant execute on function public.admin_unregister_operator(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
