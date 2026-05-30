-- ============================================================
--  Migration 008: reviews 어드민(숨김/소프트삭제) 컬럼 추가
--  Supabase SQL Editor에서 한 번만 실행하세요.
--
--  배경: 리뷰 어드민 화면이 reviews.is_deleted / is_hidden 등
--        존재하지 않는 컬럼을 조회하여 다음 오류로 로드 실패함:
--          "column reviews.is_deleted does not exist"
--
--  ⚠️ 데이터 무손상 원칙:
--     - 모든 추가는 `add column if not exists` (재실행 안전, 기존 행 보존)
--     - 기존 리뷰는 is_hidden=false / is_deleted=false 로 자동 채워짐(노출 유지)
--     - 물리 삭제(DROP/DELETE) 없음 — soft delete(플래그)만 사용
-- ============================================================

alter table public.reviews
  -- 숨김 (관리자가 노출 차단)
  add column if not exists is_hidden      boolean     not null default false,
  add column if not exists hidden_at      timestamptz,
  add column if not exists hidden_reason  text,
  -- 소프트 삭제 (물리 삭제 대신 플래그 — 복구 가능)
  add column if not exists is_deleted     boolean     not null default false,
  add column if not exists deleted_at     timestamptz,
  add column if not exists deleted_by     uuid,
  -- 모더레이션 상태 / 수정 추적
  add column if not exists status         text,
  add column if not exists updated_at     timestamptz default now(),
  -- 사진 후기 (이미 존재하면 무시됨)
  add column if not exists image_urls         text[],
  add column if not exists before_image_urls  text[],
  add column if not exists after_image_urls   text[];

-- 자주 조회되는 필터 컬럼 인덱스 (노출 목록/어드민 필터 성능)
create index if not exists reviews_is_hidden_idx  on public.reviews (is_hidden);
create index if not exists reviews_is_deleted_idx on public.reviews (is_deleted);
create index if not exists reviews_created_at_idx on public.reviews (created_at desc);

-- admin_logs.target_type 에 'review' 가 제약으로 막혀있지 않은지 보장
-- (제약이 없으면 그대로 통과 — 별도 처리 불필요)

notify pgrst, 'reload schema';
