-- 083_account_deletion.sql
-- 회원탈퇴(계정 삭제) 지원 — Google Play 계정 삭제 정책 대응.
--
-- 이 앱의 "계정"은 public.users row 다. 로그인은 Twilio OTP 인증 후 users 를
-- phone 으로 조회하는 구조이며, 별도의 Supabase auth.users 세션이나 user_sessions
-- 테이블을 사용하지 않는다. 따라서 탈퇴 처리는 users row 를 대상으로 한다.
--
-- 하드 삭제 대신 "익명화 + soft-delete" 로 처리한다:
--   - requests.user_id 등 다수 FK 가 users 를 참조(ON DELETE CASCADE/SET NULL)하므로
--     하드 삭제 시 거래 상대방(업체/의뢰인)의 기록까지 연쇄 삭제되어 정합성이 깨진다.
--   - 개인정보(이름·전화·지역·관심사·아바타)는 즉시 제거하고, 거래/정산 기록은
--     법령상 보관 의무에 따라 보존한다(개인정보처리방침과 일치).
--
-- 기존 008/043 마이그레이션의 soft-delete 관례(is_deleted/deleted_at)를 따른다.
-- 가산(additive) 변경만 — 기존 데이터/구조 무영향.

alter table public.users
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists idx_users_is_deleted on public.users(is_deleted);

comment on column public.users.is_deleted is '회원탈퇴(soft-delete) 여부 — true 면 익명화된 탈퇴 계정';
comment on column public.users.deleted_at is '회원탈퇴 처리 시각';
