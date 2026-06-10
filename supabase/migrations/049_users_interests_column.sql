-- ════════════════════════════════════════════════════════════════════
-- 049_users_interests_column.sql
-- public.users.interests text[] 컬럼 추가 (additive · 멱등).
--
-- 배경:
--   repo schema.sql 은 users.interests text[] 를 정식 컬럼으로 정의(line 16,
--   그리고 'add column if not exists interests text[]')하지만, 운영 DB 에는
--   해당 마이그레이션이 적용되지 않아 컬럼이 없었다. 그 결과 048 가입 RPC 가
--   interests 에 저장하려다
--     42703  column "interests" of relation "users" does not exist
--   로 실패했다.
--
-- 수정:
--   · users.interests text[] 컬럼만 추가(nullable, 기본값 없음). 추가 전용.
--   · RLS 정책/RPC/기존 컬럼/데이터 변경 없음. 기존 가입·로그인·업체·에스크로·
--     결제·리뷰·GPS 흐름에 영향 없음(컬럼 추가만).
--   · 코드의 interests 읽기는 모두 방어적(Array.isArray ? : []) 이라 기존 행
--     (interests=NULL)도 안전.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(048 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

alter table public.users add column if not exists interests text[];

notify pgrst, 'reload schema';
