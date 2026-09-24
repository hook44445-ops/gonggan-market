-- ============================================================
--  Migration 102: 진짜 본인인증(포트원 휴대폰 본인인증) — 기록 · 가입 연결 · 가짜 막기
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경
--    예전 「본인인증하기」 버튼은 아무 확인 없이 앱에서 users.is_identity_verified 를 true 로
--    적고 「본인인증이 완료됐습니다」라고 말했다(identity_provider 'mock'). 거짓 완료다.
--    이제 본인인증은 포트원(PASS·통신사 본인확인) 결과를 «서버에서» 다시 조회해 확인한다
--    (api/verify-otp.js 의 본인인증 갈래). 이 마이그레이션은 그 뒤를 받친다.
--
--  하는 일
--    1) identity_verification_log — 서버가 확인한 본인인증 기록. 같은 인증 건을 두 번 못 쓴다(1회용).
--       서비스 롤만 읽고 쓴다(RLS 켜고 정책 없음).
--    2) signup_user_by_phone — 새 사용자를 만들 때, 그 번호가 «방금(30분 안)» 본인인증을 마쳤으면
--       서버가 본인인증 완료로 표시한다. 가입 전에 인증을 먼저 하는 업체 가입이 이 길을 탄다.
--    3) 앱이 스스로 「인증 완료」를 적지 못하게 — users 의 본인인증 칸은 서비스 롤·서버 함수만
--       true 로 바꿀 수 있다. 앱(anon/authenticated)은 해제(false)만 할 수 있다(관리자 「인증 철회」).
--       ⚠ 관리자 화면의 「수동 인증」(adminVerifyUserIdentity 'verified')은 이제 막힌다 —
--         본인인증은 진짜 인증으로만 켠다.
-- ============================================================

set search_path = public, extensions;

-- 1) 서버가 확인한 본인인증 기록 ---------------------------------------------------
create table if not exists public.identity_verification_log (
  id            text primary key,              -- 포트원 identityVerificationId
  phone         text not null,                 -- 인증된 번호(E.164, +82…)
  verified_at   timestamptz not null,          -- 포트원이 인증을 마친 시각
  user_id       uuid,                          -- 연결된 사용자(로그인·가입 뒤에 채워짐)
  provider      text not null default 'portone',
  created_at    timestamptz not null default now()
);
create index if not exists identity_verification_log_phone_idx
  on public.identity_verification_log (phone, verified_at desc);
alter table public.identity_verification_log enable row level security;
-- 정책 없음 = anon/authenticated 는 읽기·쓰기 불가. 서비스 롤(api/verify-otp.js)만 쓴다.

-- 2) 가입 서버 함수 — 방금 본인인증한 번호면 인증 완료로 표시 ------------------------
create or replace function public.signup_user_by_phone(
  p_phone     text,
  p_name      text,
  p_role      text,
  p_region    text   default null,
  p_interests text[] default null
) returns public.users
language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_row public.users;
  v_iv  public.identity_verification_log;
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

  -- 102: 이 번호가 30분 안에 본인인증을 마쳤으면 서버가 인증 완료로 표시한다.
  if v_row.id is not null and coalesce(v_row.is_identity_verified, false) = false then
    select * into v_iv
      from public.identity_verification_log
     where phone = p_phone and verified_at > now() - interval '30 minutes'
     order by verified_at desc
     limit 1;
    if v_iv.id is not null then
      update public.users
         set is_identity_verified         = true,
             identity_verified_at         = v_iv.verified_at,
             identity_provider            = v_iv.provider,
             identity_verification_status = 'verified'
       where id = v_row.id
      returning * into v_row;
      update public.identity_verification_log set user_id = v_row.id where id = v_iv.id;
    end if;
  end if;

  return v_row;
end; $$;
grant execute on function public.signup_user_by_phone(text, text, text, text, text[])
  to anon, authenticated;

-- 3) 앱이 스스로 「인증 완료」를 적지 못하게 -------------------------------------------
--    current_user 로 가른다: 앱 직접 요청은 anon/authenticated, 서비스 롤은 service_role,
--    security definer 함수 안에서는 함수 소유자(postgres).
create or replace function public.guard_identity_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if coalesce(new.is_identity_verified, false) = true
       and coalesce(old.is_identity_verified, false) = false then
      raise exception 'IDENTITY_SERVER_ONLY: 본인인증은 서버에서만 완료로 바꿀 수 있습니다'
        using errcode = 'insufficient_privilege';
    end if;
    if new.identity_verification_status = 'verified'
       and old.identity_verification_status is distinct from 'verified' then
      raise exception 'IDENTITY_SERVER_ONLY: 본인인증은 서버에서만 완료로 바꿀 수 있습니다'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_identity_columns on public.users;
create trigger trg_guard_identity_columns
  before update of is_identity_verified, identity_verification_status on public.users
  for each row execute function public.guard_identity_columns();

-- 예전 가짜 버튼으로 켜진 인증은 거둔다(identity_provider = 'mock').
update public.users
   set is_identity_verified = false,
       identity_verification_status = 'unverified',
       identity_provider = null,
       identity_verified_at = null
 where identity_provider = 'mock';

notify pgrst, 'reload schema';
