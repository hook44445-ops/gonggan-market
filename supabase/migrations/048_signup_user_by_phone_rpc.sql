-- ════════════════════════════════════════════════════════════════════
-- 048_signup_user_by_phone_rpc.sql
-- 신규 회원가입(전화번호 OTP) — security-definer 가입 RPC.
--
-- 배경:
--   이 앱은 Twilio OTP + anon key 구조라 Supabase Auth 세션이 없다(auth.uid()=NULL).
--   그런데 public.users 의 INSERT 정책이 WITH CHECK (auth.uid() = id) 라서,
--   신규 가입의 클라이언트 upsert(=실질 INSERT)가
--     42501  new row violates row-level security policy for table "users"
--   로 항상 거부됐다. (기존 로그인은 api/verify-otp.js 가 service role 로 SELECT 하므로 무관)
--
-- 수정(040/046 패턴과 동일한 security-definer + 화이트리스트):
--   · OTP 검증을 통과한 클라이언트만 호출하는 가입 흐름에서, RLS 를 우회해 users 행을 생성.
--   · role 은 consumer/company 만 허용(admin/operator 생성 차단 = 권한 상승 방지).
--   · 멱등 — 같은 phone 이 이미 있으면 기존 행을 그대로 반환(덮어쓰기/role 변조 없음).
--   · RLS 정책/스키마/컬럼 변경 없음. 신규 함수 1개만 추가.
--
-- 멱등 · 추가 전용 · 물리 삭제 없음. Supabase SQL Editor 에서 1회 실행(047 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.signup_user_by_phone(
  p_phone     text,
  p_name      text,
  p_role      text,
  p_region    text   default null,
  p_interests text[] default null
) returns public.users
language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.users;
begin
  -- 입력 검증
  if coalesce(trim(p_phone), '') = '' then raise exception 'PHONE_REQUIRED'; end if;
  if coalesce(trim(p_name),  '') = '' then raise exception 'NAME_REQUIRED';  end if;
  -- 화이트리스트 — 가입은 consumer/company 만(공개 RPC 로 admin/operator 생성 금지).
  if p_role not in ('consumer', 'company') then raise exception 'INVALID_ROLE'; end if;

  -- 멱등: 이미 가입된 번호면 기존 행을 그대로 반환(프로필/role 덮어쓰기 없음).
  insert into public.users (phone, name, role, region, interests)
  values (p_phone, trim(p_name), p_role, p_region, coalesce(p_interests, '{}'))
  on conflict (phone) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.users where phone = p_phone limit 1;
  end if;

  return v_row;
end; $$;

grant execute on function public.signup_user_by_phone(text, text, text, text, text[])
  to anon, authenticated;

notify pgrst, 'reload schema';
