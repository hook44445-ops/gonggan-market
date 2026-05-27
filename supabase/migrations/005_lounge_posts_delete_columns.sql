-- ============================================================
--  Migration 005: lounge_posts 삭제/수정 컬럼 추가
--  Supabase SQL Editor에서 한 번만 실행하세요.
-- ============================================================

alter table public.lounge_posts
  add column if not exists deleted_at  timestamptz,
  add column if not exists deleted_by  uuid,
  add column if not exists updated_at  timestamptz default now();

notify pgrst, 'reload schema';
