-- ── Migration 검증 쿼리 ───────────────────────────────────────────────────────
-- Supabase 대시보드 → SQL Editor 에서 실행
-- 모든 항목이 ✅ 로 나오면 migration_ok = true

-- 1. 테이블 존재 여부
SELECT
  'site_visits_table_exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'site_visits'
  ) THEN '✅ OK' ELSE '❌ MISSING' END AS result

UNION ALL

SELECT
  'estimates_table_exists',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'estimates'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

-- 2. RLS 활성화 여부
UNION ALL
SELECT
  'site_visits_rls_enabled',
  CASE WHEN (
    SELECT relrowsecurity FROM pg_class
    WHERE relname = 'site_visits' AND relnamespace = 'public'::regnamespace
  ) THEN '✅ OK' ELSE '❌ DISABLED' END

UNION ALL
SELECT
  'estimates_rls_enabled',
  CASE WHEN (
    SELECT relrowsecurity FROM pg_class
    WHERE relname = 'estimates' AND relnamespace = 'public'::regnamespace
  ) THEN '✅ OK' ELSE '❌ DISABLED' END

-- 3. FK 제약조건 확인
UNION ALL
SELECT
  'site_visits_fk_request_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'site_visits'
      AND kcu.column_name = 'request_id'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL
SELECT
  'site_visits_fk_bid_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'site_visits'
      AND kcu.column_name = 'bid_id'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL
SELECT
  'estimates_fk_site_visit_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'estimates'
      AND kcu.column_name = 'site_visit_id'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL
SELECT
  'estimates_fk_request_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'estimates'
      AND kcu.column_name = 'request_id'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

-- 4. 인덱스 확인
UNION ALL
SELECT
  'idx_site_visits_bid_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'site_visits' AND indexname = 'idx_site_visits_bid_id'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL
SELECT
  'idx_site_visits_company_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'site_visits' AND indexname = 'idx_site_visits_company_id'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL
SELECT
  'idx_estimates_site_visit_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'estimates' AND indexname = 'idx_estimates_site_visit_id'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL
SELECT
  'idx_estimates_request_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'estimates' AND indexname = 'idx_estimates_request_id'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

-- 5. updated_at 트리거 확인
UNION ALL
SELECT
  'trg_site_visits_updated_at',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_site_visits_updated_at'
      AND event_object_table = 'site_visits'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

UNION ALL
SELECT
  'trg_estimates_updated_at',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_estimates_updated_at'
      AND event_object_table = 'estimates'
  ) THEN '✅ OK' ELSE '❌ MISSING' END

-- 6. RLS 정책 개수 확인
UNION ALL
SELECT
  'site_visits_rls_policy_count',
  CONCAT(
    (SELECT COUNT(*)::text FROM pg_policies WHERE tablename = 'site_visits'),
    ' policies (expected: 3)'
  )

UNION ALL
SELECT
  'estimates_rls_policy_count',
  CONCAT(
    (SELECT COUNT(*)::text FROM pg_policies WHERE tablename = 'estimates'),
    ' policies (expected: 3)'
  )

-- 7. site_visits 컬럼 확인
UNION ALL
SELECT
  'site_visits_columns',
  CONCAT(
    (SELECT COUNT(*)::text FROM information_schema.columns
     WHERE table_name = 'site_visits' AND table_schema = 'public'),
    ' cols (expected: 17)'
  )

UNION ALL
SELECT
  'estimates_columns',
  CONCAT(
    (SELECT COUNT(*)::text FROM information_schema.columns
     WHERE table_name = 'estimates' AND table_schema = 'public'),
    ' cols (expected: 14)'
  )

ORDER BY check_name;

-- ── 종합 migration_ok 판정 ──────────────────────────────────────────────────
SELECT
  'migration_ok' AS check_name,
  CASE WHEN (
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_visits') AND
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'estimates') AND
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'site_visits' AND relnamespace = 'public'::regnamespace) AND
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'estimates' AND relnamespace = 'public'::regnamespace) AND
    EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'site_visits' AND indexname = 'idx_site_visits_bid_id') AND
    EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'estimates' AND indexname = 'idx_estimates_site_visit_id') AND
    EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trg_site_visits_updated_at') AND
    EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trg_estimates_updated_at')
  ) THEN '✅ migration_ok = true' ELSE '❌ migration_ok = false — 위 항목 확인 필요' END AS result;
