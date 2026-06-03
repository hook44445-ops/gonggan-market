-- ════════════════════════════════════════════════════════════════════
-- 016_enable_rls_admin_logs_fee_config.sql
-- rls_disabled_in_public 경고 해소 — RLS 미적용 public 테이블에 RLS ON + 정책
--
-- 대상(코드/스키마 기준 RLS OFF 2개):
--   · admin_logs  — 관리자 행동 감사 로그
--   · fee_config  — 수수료율 설정(싱글톤)
--
-- 원칙:
--   · public 테이블 RLS 기본 ON
--   · 무방비 public write 금지 (쓰기는 권한 있는 주체만)
--   · 기존 앱 동작 보존:
--       - fee_config: 앱이 getFeeConfig 로 읽음 → public SELECT 허용,
--         쓰기 정책 없음(=service_role/SQL 만 수정 가능)
--       - admin_logs: 관리자 액션이 insert(대부분 에러 무시) →
--         INSERT 는 인증 사용자 허용(감사 로그 끊김 방지),
--         SELECT/UPDATE/DELETE 는 관리자(users.role='admin') 전용
--
-- 멱등(idempotent) · 재실행 안전.
-- ════════════════════════════════════════════════════════════════════

-- ── 1) fee_config ──────────────────────────────────────────────────
alter table public.fee_config enable row level security;

drop policy if exists "fee_config: public read"  on public.fee_config;
-- 쓰기 정책은 두지 않음 → anon/authenticated 는 수정 불가(service_role/SQL 만 가능)

create policy "fee_config: public read" on public.fee_config
  for select using (true);

-- ── 2) admin_logs ──────────────────────────────────────────────────
alter table public.admin_logs enable row level security;

drop policy if exists "admin_logs: authenticated insert" on public.admin_logs;
drop policy if exists "admin_logs: admin read"           on public.admin_logs;

-- 감사 로그는 append-only — 인증 사용자(관리자 액션 수행자)가 기록 생성 가능.
-- (관리자 계정 role 설정 여부와 무관하게 로깅이 끊기지 않도록 인증만 요구)
create policy "admin_logs: authenticated insert" on public.admin_logs
  for insert with check (auth.uid() is not null);

-- 조회는 관리자만 (무방비 read 금지)
create policy "admin_logs: admin read" on public.admin_logs
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
-- UPDATE/DELETE 정책 없음 → 변조/삭제 불가(service_role/SQL 만 가능)
