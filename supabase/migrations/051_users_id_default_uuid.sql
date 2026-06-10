-- ════════════════════════════════════════════════════════════════════
-- 051_users_id_default_uuid.sql
-- public.users.id 기본값(gen_random_uuid()) 추가.
--
-- 배경:
--   repo schema.sql 은 users.id 를 'uuid primary key default gen_random_uuid()'
--   로 정의하지만, 운영 DB 의 id 컬럼에 DEFAULT 가 없어 INSERT 시 id 가 생성되지
--   않아
--     23502  null value in column "id" of relation "users" violates not-null constraint
--   로 실패했다. (048 가입 RPC 등 모든 users INSERT 경로의 기본키 문제)
--
-- 수정(최소 범위 — DB 기본값만 추가):
--   · users.id DEFAULT 를 gen_random_uuid() 로 설정.
--   · 컬럼/제약/데이터/RLS/RPC/가입·로그인·업체 플로우 변경 없음(default 추가만).
--   · 기존 행(id 이미 존재)에는 영향 없음. 이후 INSERT 부터 id 자동 생성.
--
-- 적용 전 확인(선택):
--     select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--     where table_schema='public' and table_name='users' and column_name='id';
--   → column_default 가 NULL 이면 본 마이그레이션 필요, gen_random_uuid() 면 이미 적용됨.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(050 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

alter table public.users
  alter column id set default gen_random_uuid();

notify pgrst, 'reload schema';
