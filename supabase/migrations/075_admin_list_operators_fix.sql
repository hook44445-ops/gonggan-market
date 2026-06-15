-- ════════════════════════════════════════════════════════════════════
-- 075_admin_list_operators_fix.sql
-- 운영자 목록 누락 수정 — admin_permissions 기준 조회로 보강.
--
-- 증상: admin_register_operator 로 등록 성공(PIN 발급 + admin_permissions
--       row 생성)했으나, admin_list_operators 가 where u.is_operator=true 에만
--       의존해 목록에 0건으로 표시됨(is_operator 플래그 미반영 케이스).
--
-- 해결: users LEFT JOIN admin_permissions 후
--       where u.role <> 'admin' AND (u.is_operator=true OR ap.user_id is not null)
--       → 등록된 운영자(admin_permissions row 보유)는 확실히 표시.
--       대표 계정(role='admin')은 목록에서 계속 제외.
--
-- 범위: admin_list_operators(text) 1개만 재정의. PIN 생성/권한 저장/등록/해제/
--       테스트계정/IA·탭 구조 미수정. 멱등 · 추가 전용(074 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

drop function if exists public.admin_list_operators(uuid);
drop function if exists public.admin_list_operators(text);

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
     where u.role <> 'admin'
       and (u.is_operator = true or ap.user_id is not null)
     order by ap.updated_at desc nulls last, u.created_at desc;
end; $$;

grant execute on function public.admin_list_operators(text) to anon, authenticated;

notify pgrst, 'reload schema';
