-- 084_otp_codes.sql
-- OTP 인증 제공자 교체(Twilio Verify → Solapi)에 따른 서버측 OTP 저장소.
--
-- Twilio Verify 는 인증코드의 생성·저장·검증을 자체적으로 처리했으나, Solapi 는
-- SMS 발송만 제공하므로 코드 생성·만료·시도제한·검증을 앱(서버)에서 직접 수행한다.
-- 전화번호(E.164)당 1개의 활성 코드만 유지하며 재전송 시 upsert 로 갱신한다.
-- 코드는 평문이 아닌 sha256 해시로 저장한다.

create table if not exists public.otp_codes (
  phone       text primary key,            -- E.164 (+82...) — verify-otp 조회 키와 동일
  code_hash   text not null,               -- sha256(`${phone}:${code}`)
  expires_at  timestamptz not null,        -- 발송 시각 + TTL(기본 3분)
  attempts    integer not null default 0,  -- 검증 시도 횟수(상한 초과 시 폐기)
  created_at  timestamptz not null default now()
);

-- 서버(service_role)만 접근. RLS 활성화 + 정책 미생성 → anon/authenticated 직접
-- 조회 차단(인증코드 유출 방지). service_role 키는 RLS 를 우회한다.
alter table public.otp_codes enable row level security;

comment on table public.otp_codes is 'SMS OTP 코드(서버 전용, service_role). 전화번호당 1행, 단기 만료, 해시 저장.';
