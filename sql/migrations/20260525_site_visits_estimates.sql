-- ── site_visits ──────────────────────────────────────────────────────────────
-- 실측 방문 예약 / GPS 체크인 / 현장견적 / 견적 기한 관리

CREATE TABLE IF NOT EXISTS public.site_visits (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  bid_id                uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  scheduled_at          timestamptz,
  checked_in_at         timestamptz,
  gps_lat               numeric(10,6),
  gps_lng               numeric(10,6),
  photos                text[] DEFAULT '{}',

  field_estimate_amount numeric(12,0),
  field_estimate_note   text,

  completed_at          timestamptz,
  estimate_due_at       timestamptz,

  status                text NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled','checked_in','completed','estimate_submitted','overdue','canceled')),

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_bid_id      ON public.site_visits(bid_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_company_id  ON public.site_visits(company_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_request_id  ON public.site_visits(request_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_status      ON public.site_visits(status);

-- RLS
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company can manage own site visits"
  ON public.site_visits
  FOR ALL
  USING (company_id IN (
    SELECT id FROM public.companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "customer can view their site visits"
  ON public.site_visits
  FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "service role full access to site_visits"
  ON public.site_visits
  FOR ALL
  USING (auth.role() = 'service_role');


-- ── estimates ─────────────────────────────────────────────────────────────────
-- 플랫폼 상세 견적서 (외부 PDF/엑셀 금지 — 플랫폼 양식으로만)

CREATE TABLE IF NOT EXISTS public.estimates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  bid_id          uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  site_visit_id   uuid REFERENCES public.site_visits(id) ON DELETE SET NULL,
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  items           jsonb NOT NULL DEFAULT '[]',
  total_price     numeric(12,0) NOT NULL DEFAULT 0,
  duration_days   int,
  note            text,
  warranty_note   text,

  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','submitted','accepted','rejected','revised')),

  submitted_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_site_visit_id ON public.estimates(site_visit_id);
CREATE INDEX IF NOT EXISTS idx_estimates_request_id    ON public.estimates(request_id);
CREATE INDEX IF NOT EXISTS idx_estimates_company_id    ON public.estimates(company_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status        ON public.estimates(status);

-- RLS
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company can manage own estimates"
  ON public.estimates
  FOR ALL
  USING (company_id IN (
    SELECT id FROM public.companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "customer can view estimates for their requests"
  ON public.estimates
  FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "service role full access to estimates"
  ON public.estimates
  FOR ALL
  USING (auth.role() = 'service_role');


-- ── updated_at 자동 갱신 트리거 ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_site_visits_updated_at
  BEFORE UPDATE ON public.site_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
