-- ════════════════════════════════════════════════════════════════════
-- 132_otp_send_limit.sql  (대표 09-25 「인증번호 여러 번 계속 받으면 돈 나가」)
--
-- 문제: /api/send-otp 에 발송 제한이 없었다 — 스크립트로 계속 부르면 그만큼 문자 요금이 나가고,
--       재발송마다 틀린 횟수(attempts)가 0 으로 돌아가 인증번호를 계속 맞혀 볼 수도 있었다.
-- 고침(서버 api/send-otp 가 이 칸·표를 쓴다):
--   · 번호당 60초에 1번 · 24시간 5번 · 접속 주소(IP)당 1시간 10번 — 모두 발송 기록(otp_send_log)으로 센다
--     (otp_codes 는 인증 성공·만료 때 지워지므로 거기 세면 초기화된다)
--   · 국내 휴대폰 번호(+8210…)만 — 해외 문자는 요금이 크다
--   · 맞혀 보기는 번호당 하루 발송 5번 × 한 번에 5번 시도 = 25번이 끝(100만 가지 중)
-- 표는 서버(service role)만 쓴다 — RLS 켜고 정책 없음.
-- 추가 전용 · 재실행 안전.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create table if not exists public.otp_send_log (
  id      bigint generated always as identity primary key,
  ip      text        not null,
  phone   text,
  sent_at timestamptz not null default now()
);
create index if not exists otp_send_log_ip_time    on public.otp_send_log (ip, sent_at desc);
create index if not exists otp_send_log_phone_time on public.otp_send_log (phone, sent_at desc);
alter table public.otp_send_log enable row level security;

-- 오래된 기록 정리(하루 지난 것) — 발송 때마다 서버가 가볍게 부른다
create or replace function public.otp_send_log_prune()
returns void language sql security definer
set search_path = public, extensions as $$
  delete from public.otp_send_log where sent_at < now() - interval '1 day';
$$;
revoke execute on function public.otp_send_log_prune() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from information_schema.tables where table_schema='public' and table_name='otp_send_log') as otp_log_ok;
