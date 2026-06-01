-- ============================================================
-- 013_ai_training_data.sql
-- AI 학습용 데이터 구조 추가
--   · requests / estimates / escrow_payouts / reviews 컬럼 추가
--   · ai_training_snapshots / space_price_index 테이블 생성
--   · 에스크로 완료 시 가격 인덱스 자동 집계 트리거
--
-- 수정 이력:
--   · requests.budget_min/max 이미 integer 로 존재 → AI 집계용 bigint 컬럼은
--     ai_budget_min / ai_budget_max 로 분리 (기존 컬럼과 충돌 방지)
--   · estimates.total_price 신규 추가 (트리거 집계에 필요)
--   · 트리거 WHEN 절: transaction_status 체크 제약은 대문자 'COMPLETED' 사용
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. requests — AI 분석용 컬럼 추가
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS space_size_m2       numeric,
  ADD COLUMN IF NOT EXISTS building_type       text,
  ADD COLUMN IF NOT EXISTS building_age_years  int,
  ADD COLUMN IF NOT EXISTS style_preference    text,
  ADD COLUMN IF NOT EXISTS ai_budget_min       bigint,
  ADD COLUMN IF NOT EXISTS ai_budget_max       bigint,
  ADD COLUMN IF NOT EXISTS photo_count         int,
  ADD COLUMN IF NOT EXISTS ai_estimated_price  bigint,
  ADD COLUMN IF NOT EXISTS ai_confidence       numeric,
  ADD COLUMN IF NOT EXISTS region_code         text;

comment on column public.requests.space_size_m2      is 'AI 학습용 실면적(m²)';
comment on column public.requests.building_type      is 'AI 학습용 건물 유형';
comment on column public.requests.region_code        is 'AI 학습용 지역 코드';
comment on column public.requests.ai_estimated_price is 'AI 예상 견적가 (원)';
comment on column public.requests.ai_confidence      is 'AI 예측 신뢰도 (0–1)';

-- ─────────────────────────────────────────────────────────────
-- 2. estimates — AI 분석용 컬럼 추가
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS total_price           bigint,
  ADD COLUMN IF NOT EXISTS material_grade        text
    CHECK (material_grade IN ('economy','standard','premium','luxury')),
  ADD COLUMN IF NOT EXISTS labor_ratio           numeric,
  ADD COLUMN IF NOT EXISTS material_ratio        numeric,
  ADD COLUMN IF NOT EXISTS region_code           text,
  ADD COLUMN IF NOT EXISTS season                text
    CHECK (season IN ('spring','summer','fall','winter')),
  ADD COLUMN IF NOT EXISTS negotiation_count     int  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_vs_initial      numeric;

comment on column public.estimates.total_price        is 'AI 집계용 견적 총액 (원)';
comment on column public.estimates.material_grade     is 'AI 학습용 자재 등급';
comment on column public.estimates.labor_ratio        is '인건비 비율 (0–1)';
comment on column public.estimates.material_ratio     is '자재비 비율 (0–1)';
comment on column public.estimates.final_vs_initial   is '최종가/초기가 비율 — 협상 영향도';

-- ─────────────────────────────────────────────────────────────
-- 3. escrow_payouts — 공정별 기간/지연 추적
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.escrow_payouts
  ADD COLUMN IF NOT EXISTS phase_duration_days  int,
  ADD COLUMN IF NOT EXISTS delay_days           int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_reason         text;

comment on column public.escrow_payouts.phase_duration_days is 'AI 학습용 공정 소요일';
comment on column public.escrow_payouts.delay_days          is 'AI 학습용 지연일수';

-- ─────────────────────────────────────────────────────────────
-- 4. reviews — 세부 평가 항목 추가
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS quality_score         int
    CHECK (quality_score       BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS schedule_score        int
    CHECK (schedule_score      BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS communication_score   int
    CHECK (communication_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS price_score           int
    CHECK (price_score         BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS would_recommend       boolean,
  ADD COLUMN IF NOT EXISTS recontract_within_year boolean;

comment on column public.reviews.quality_score         is 'AI 학습용 시공 품질 점수';
comment on column public.reviews.schedule_score        is 'AI 학습용 일정 준수 점수';
comment on column public.reviews.communication_score   is 'AI 학습용 의사소통 점수';
comment on column public.reviews.price_score           is 'AI 학습용 가격 적정성 점수';

-- ─────────────────────────────────────────────────────────────
-- 5. ai_training_snapshots — 집계 스냅샷 테이블
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_training_snapshots (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type     text        NOT NULL
    CHECK (snapshot_type IN (
      'estimate_accuracy',
      'contractor_quality',
      'dispute_pattern',
      'price_trend',
      'regional_demand'
    )),
  region_code       text,
  space_type        text,
  building_type     text,
  season            text,
  sample_count      int,
  avg_price         bigint,
  min_price         bigint,
  max_price         bigint,
  avg_duration_days int,
  dispute_rate      numeric,
  satisfaction_avg  numeric,
  created_at        timestamptz NOT NULL DEFAULT now()
);

comment on table public.ai_training_snapshots is 'AI 학습용 통계 스냅샷 — 주기적 집계 결과 보관';

CREATE INDEX IF NOT EXISTS idx_ai_snapshots_type_region
  ON public.ai_training_snapshots (snapshot_type, region_code, created_at DESC);

ALTER TABLE public.ai_training_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_snapshots: admin only" ON public.ai_training_snapshots
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- 6. space_price_index — 지역/유형별 가격 인덱스 테이블
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.space_price_index (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code    text        NOT NULL,
  space_type     text        NOT NULL,
  building_type  text        NOT NULL,
  material_grade text        NOT NULL,
  work_type      text        NOT NULL,
  price_per_m2   bigint,
  sample_count   int,
  last_updated   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region_code, space_type, building_type, material_grade, work_type)
);

comment on table public.space_price_index is 'AI 학습용 지역·유형별 m² 단가 인덱스 — 트리거로 자동 갱신';

CREATE INDEX IF NOT EXISTS idx_spi_region_type
  ON public.space_price_index (region_code, space_type, building_type);

ALTER TABLE public.space_price_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spi: public read" ON public.space_price_index
  FOR SELECT USING (true);

CREATE POLICY "spi: admin write" ON public.space_price_index
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- 7. 가격 인덱스 자동 집계 트리거
--    에스크로 transaction_status 가 'COMPLETED' 로 바뀔 때 실행.
--    (체크 제약 대문자: 'COMPLETED' — schema.sql line ~341)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_price_index()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.space_price_index (
    region_code, space_type, building_type,
    material_grade, work_type,
    price_per_m2, sample_count, last_updated
  )
  SELECT
    r.region_code,
    r.space_type,
    r.building_type,
    e.material_grade,
    'general',
    AVG(e.total_price / NULLIF(r.space_size_m2, 0))::bigint,
    COUNT(*)::int,
    now()
  FROM public.escrow_payments ep
  JOIN public.requests  r ON r.id = ep.request_id
  JOIN public.estimates e ON e.request_id = ep.request_id
  WHERE ep.transaction_status = 'COMPLETED'
    AND r.region_code    IS NOT NULL
    AND r.space_type     IS NOT NULL
    AND r.building_type  IS NOT NULL
    AND e.material_grade IS NOT NULL
    AND e.total_price    IS NOT NULL
    AND r.space_size_m2  IS NOT NULL
    AND r.space_size_m2   > 0
  GROUP BY
    r.region_code, r.space_type,
    r.building_type, e.material_grade
  ON CONFLICT (region_code, space_type, building_type, material_grade, work_type)
  DO UPDATE SET
    price_per_m2 = EXCLUDED.price_per_m2,
    sample_count = EXCLUDED.sample_count,
    last_updated = now();

  RETURN NEW;
END;
$$;

-- 기존 트리거 있으면 교체
DROP TRIGGER IF EXISTS trigger_update_price_index ON public.escrow_payments;

CREATE TRIGGER trigger_update_price_index
  AFTER UPDATE ON public.escrow_payments
  FOR EACH ROW
  WHEN (NEW.transaction_status = 'COMPLETED'
    AND (OLD.transaction_status IS DISTINCT FROM NEW.transaction_status))
  EXECUTE FUNCTION public.update_price_index();
