-- ============================================================
--  Migration 007: 의뢰인 본인인증 컬럼 추가 (mock — 실제 KYC 미연동)
--  Supabase SQL Editor에서 한 번만 실행하세요.
--
--  ⚠️ PII 미저장 원칙: 주민번호/신분증 등 개인 식별 정보는 저장하지 않습니다.
--     인증 여부(boolean) + 시각 + 제공자(provider 라벨) + 상태 문자열만 보관합니다.
--  TODO: 추후 service role Edge Function으로 실제 본인인증(PASS/NICE 등) 전환.
-- ============================================================

alter table public.users
  add column if not exists is_identity_verified        boolean     not null default false,
  add column if not exists identity_verified_at         timestamptz,
  add column if not exists identity_provider            text,        -- 'mock' | 'admin_manual' | (추후 'pass'|'nice' 등)
  add column if not exists identity_verification_status text        not null default 'unverified';
  -- identity_verification_status: 'unverified' | 'required' | 'verified' | 'revoked'

-- 상태값 무결성 보장 (선택 — 기존 행은 default로 'unverified')
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_identity_verification_status_check'
  ) then
    alter table public.users
      add constraint users_identity_verification_status_check
      check (identity_verification_status in ('unverified', 'required', 'verified', 'revoked'));
  end if;
end $$;

notify pgrst, 'reload schema';
