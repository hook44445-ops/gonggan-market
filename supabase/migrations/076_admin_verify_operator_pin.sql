-- ════════════════════════════════════════════════════════════════════
-- 076_admin_verify_operator_pin.sql
-- 운영자 PIN 로그인 검증 RPC.
--
-- 관리자 로그인 모달에서 전화번호 + 6자리 PIN 입력 시,
-- admin_permissions.pin_hash 를 crypt 로 검증하고 운영자 정보/권한을 반환한다.
--
-- 원칙:
--  · PIN 평문 미저장 — crypt(p_pin, pin_hash) 비교만.
--  · role='admin' 대표 계정은 운영자 PIN 로그인 대상에서 제외.
--  · 검증 실패(사용자 없음/대표 계정/PIN 불일치/미발급) → 0행 반환.
--  · 기존 테이블/RPC/대표 관리자코드 로그인 미수정. 멱등 · 추가 전용(075 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.admin_verify_operator_pin(p_phone text, p_pin text)
returns table (
  user_id uuid, name text, phone text, role text,
  can_operations boolean, can_transactions boolean, can_project_proof boolean,
  can_contents boolean, can_system boolean
)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_digits text; v_e164 text; v_id uuid; v_role text;
begin
  if coalesce(p_pin,'') = '' then return; end if;

  v_digits := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  if left(v_digits,2) = '82' then v_e164 := '+' || v_digits;
  elsif left(v_digits,1) = '0' then v_e164 := '+82' || substr(v_digits,2);
  else v_e164 := '+' || v_digits; end if;

  select u.id, u.role into v_id, v_role from public.users u
   where u.phone = v_e164 or u.phone = p_phone or u.phone = v_digits
      or u.phone = ('0' || substr(v_digits, greatest(length(v_digits)-9,1)))
   limit 1;

  if v_id is null then return; end if;          -- 사용자 없음
  if v_role = 'admin' then return; end if;       -- 대표 계정 제외

  return query
    select u.id, u.name, u.phone, u.role,
           coalesce(ap.can_operations,false), coalesce(ap.can_transactions,false),
           coalesce(ap.can_project_proof,false), coalesce(ap.can_contents,false),
           coalesce(ap.can_system,false)
      from public.users u
      join public.admin_permissions ap on ap.user_id = u.id
     where u.id = v_id
       and ap.pin_hash is not null
       and ap.pin_hash = crypt(p_pin, ap.pin_hash);   -- crypt 검증(평문 미저장)
end; $$;

grant execute on function public.admin_verify_operator_pin(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
