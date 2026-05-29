-- ============================================================
-- 공간마켓 에스크로 데이터 정리 스크립트
-- Supabase SQL Editor에서 단계별로 실행하세요.
-- 각 STEP 전에 SELECT로 영향 범위를 먼저 확인하세요.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1: phase_photos — blob: URL 진단
-- ────────────────────────────────────────────────────────────
-- 현상: 업체가 사진 업로드 시 스토리지(documents RLS) 오류로
--       blob: URL이 DB에 저장됨 → 고객/업체 화면에서 깨진 이미지.
-- 해결: RLS 정책 추가로 신규 업로드는 정상화됨.
--       이 스크립트는 기존 오염 row를 정리합니다.

-- 1-A. 영향 범위 확인 (실행 전 반드시 먼저 확인)
SELECT
  id,
  contract_id,
  step,
  created_at,
  array_length(photos, 1)                                                     AS total_photos,
  (SELECT count(*) FROM unnest(photos) u WHERE u LIKE 'blob:%')::int         AS blob_count,
  (SELECT count(*) FROM unnest(photos) u WHERE u LIKE 'https://%')::int      AS valid_count
FROM phase_photos
WHERE EXISTS (
  SELECT 1 FROM unnest(photos) u WHERE u LIKE 'blob:%'
)
ORDER BY created_at DESC;

-- 1-B. blob: URL 제거 — https:// URL만 남기기
--      (valid URL이 1개 이상 남는 경우)
UPDATE phase_photos
SET photos = ARRAY(
  SELECT u FROM unnest(photos) u WHERE u LIKE 'https://%'
)
WHERE EXISTS (
  SELECT 1 FROM unnest(photos) u WHERE u LIKE 'blob:%'
);

-- 1-C. 전부 blob: 이었던 row 삭제 (valid URL 0개 = 빈 배열)
DELETE FROM phase_photos
WHERE array_length(photos, 1) IS NULL
   OR array_length(photos, 1) = 0;

-- 1-D. 정리 결과 확인
SELECT count(*) AS remaining_phase_photo_rows FROM phase_photos;
SELECT count(*) AS rows_with_any_blob_url
FROM phase_photos
WHERE EXISTS (SELECT 1 FROM unnest(photos) u WHERE u LIKE 'blob:%');


-- ────────────────────────────────────────────────────────────
-- STEP 2: activity_logs — PHOTO_UPLOADED 중복 타임라인 항목
-- ────────────────────────────────────────────────────────────
-- 현상: 업체가 같은 phase를 여러 번 시도 → PHOTO_UPLOADED 중복 로그.
-- 코드측에서는 이미 로드 시 dedup 처리됨(latest per stage).
-- DB 정리: 동일 contract+action+stage 기준 최신 1건만 남기기.

-- 2-A. 영향 범위 확인
SELECT
  target_id,
  action,
  (metadata->>'stage')::text AS stage,
  count(*)                   AS cnt,
  max(created_at)            AS latest
FROM activity_logs
WHERE target_type = 'contract'
  AND action = 'PHOTO_UPLOADED'
GROUP BY target_id, action, (metadata->>'stage')::text
HAVING count(*) > 1
ORDER BY cnt DESC;

-- 2-B. 중복 제거 — 최신(MAX created_at)만 유지
DELETE FROM activity_logs
WHERE target_type = 'contract'
  AND action = 'PHOTO_UPLOADED'
  AND id NOT IN (
    SELECT DISTINCT ON (target_id, action, (metadata->>'stage')::text)
      id
    FROM activity_logs
    WHERE target_type = 'contract'
      AND action = 'PHOTO_UPLOADED'
    ORDER BY target_id, action, (metadata->>'stage')::text, created_at DESC
  );

-- 2-C. 결과 확인 (모두 1이어야 함)
SELECT
  target_id,
  action,
  (metadata->>'stage')::text AS stage,
  count(*) AS cnt
FROM activity_logs
WHERE target_type = 'contract'
  AND action = 'PHOTO_UPLOADED'
GROUP BY target_id, action, (metadata->>'stage')::text
HAVING count(*) > 1;


-- ────────────────────────────────────────────────────────────
-- STEP 3: escrow_payments — orphan row 진단
-- ────────────────────────────────────────────────────────────
-- 현상: 테스트 중 생성된 escrow row가 실제 request와 연결되지 않거나
--       이미 종료된 request에 묶인 상태.

-- 3-A. request가 closed/cancelled인데 CONTRACTED 상태인 escrow (진단만)
SELECT
  ep.id                     AS escrow_id,
  ep.request_id,
  ep.company_id,
  ep.transaction_status,
  ep.created_at,
  r.status                  AS request_status
FROM escrow_payments ep
LEFT JOIN requests r ON r.id = ep.request_id
WHERE ep.transaction_status IN ('CONTRACTED', 'STARTED')
  AND r.status IN ('closed', 'cancelled', 'completed', 'settled', 'done')
ORDER BY ep.created_at DESC;

-- 3-B. phase_photos가 없고 CONTRACTED 상태인 오래된 escrow (7일 초과)
SELECT
  ep.id,
  ep.request_id,
  ep.transaction_status,
  ep.created_at
FROM escrow_payments ep
WHERE ep.transaction_status = 'CONTRACTED'
  AND ep.created_at < now() - interval '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM phase_photos pp WHERE pp.contract_id = ep.id
  )
ORDER BY ep.created_at;

-- ※ escrow_payments는 직접 DELETE하지 않음.
--    필요시 transaction_status를 'CANCELLED'로 업데이트:
--
-- UPDATE escrow_payments
-- SET transaction_status = 'CANCELLED'
-- WHERE id IN (/* STEP 3-B 결과의 id 목록 */);


-- ────────────────────────────────────────────────────────────
-- STEP 4: 최종 상태 확인
-- ────────────────────────────────────────────────────────────
SELECT 'phase_photos'           AS tbl, count(*) AS rows FROM phase_photos
UNION ALL
SELECT 'escrow_payments'        AS tbl, count(*) AS rows FROM escrow_payments
UNION ALL
SELECT 'activity_logs_contract' AS tbl, count(*) AS rows FROM activity_logs WHERE target_type = 'contract';
