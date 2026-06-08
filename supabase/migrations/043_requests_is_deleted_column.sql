-- 043_requests_is_deleted_column.sql
-- getUserRequests 에서 "column requests.is_deleted does not exist" 에러 →
-- 재로그인 후 새 견적요청이 rows:[] 로 사라지고 업체에게도 전달되지 않던 문제 해결.
-- 조회 쿼리는 is_deleted 조건을 유지하되, 컬럼이 존재하도록 추가한다.

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

UPDATE requests
SET is_deleted = false
WHERE is_deleted IS NULL;

CREATE INDEX IF NOT EXISTS idx_requests_is_deleted
ON requests(is_deleted);
