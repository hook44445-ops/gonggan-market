-- ============================================================
-- 공간마켓 — 테스트/QA 진행 데이터 정리 스크립트
-- Supabase SQL Editor 에서 섹션 순서대로 실행하세요.
--
-- 목적: 의뢰인 홈 / 업체 진행중·완료 화면에 남아 QA 를 방해하는
--       테스트 견적·입찰·계약·결제·에스크로 "진행 데이터" 제거.
--
-- 보존(절대 삭제 금지):
--   · users / companies 자체 row
--   · 테스트 업체 row 및 companies.service_regions (지역 지도용)
--   · 실제 운영 데이터 (아래 ANCHOR 와 무관한 row)
--
-- 삭제 대상:
--   · requests / bids / escrow_payments(=계약) + 계약 child
--   · payment_orders / payment_transactions / escrow_payouts
--   · (선택) reviews / lounge_posts 중 테스트분
--
-- ⚠️ 컬럼 주의:
--   · requests 에는 title/category/address/region/amount 컬럼이 없음.
--     지역=area, 유형=space_type, 평수=size, 예산=budget_min/budget_max.
--   · "contracts" 테이블은 없음 → escrow_payments 가 계약/에스크로 본체.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- ANCHOR — 테스트 식별 기준 (여기만 수정하면 됨)
-- ════════════════════════════════════════════════════════════
--   TEST_COMPANY_ID = '03438ba2-5cd0-468a-bd5b-957b5555b580'  (테스트 업체)
--   TEST_OWNER_ID   = '9e8b3138-ffba-4970-8a5c-b489026c4e54'  (테스트 업체 owner = 테스트 계정)
--
-- 아래 모든 쿼리는 이 두 ID 와, 명시된 텍스트 패턴(area/space_type/size/desc)을
-- 기준으로 동작합니다. 텍스트 패턴은 "TEXT PATTERN" 블록에서 조정하세요.


-- ════════════════════════════════════════════════════════════
-- A. PREVIEW — 삭제 전 영향 범위 확인 (반드시 먼저 실행)
-- ════════════════════════════════════════════════════════════

-- A-1) 대상 requests + 매칭 사유(match_reason). 어떤 규칙으로 잡혔는지 눈으로 확인.
SELECT
  r.id,
  r.user_id,
  r.area, r.space_type, r.size, r.style,
  r.budget_min, r.budget_max,
  r.status, r.created_at,
  -- 어떤 규칙에 걸렸는가
  (r.user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54')                       AS by_owner,
  EXISTS (SELECT 1 FROM public.bids b
          WHERE b.request_id = r.id
            AND b.company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580')        AS by_test_bid,
  EXISTS (SELECT 1 FROM public.escrow_payments ep
          WHERE ep.request_id = r.id
            AND ep.company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580')        AS by_test_escrow,
  (r.area ILIKE '%마포%' OR r.area ILIKE '%강서%'
   OR r.space_type ILIKE '%원룸%' OR r.space_type ILIKE '%오피스%'
   OR r.size ILIKE '%32평%'
   OR r.desc ILIKE '%테스트%' OR r.style ILIKE '%테스트%')                     AS by_text_pattern
FROM public.requests r
WHERE
  -- ── ID ANCHOR ──
  r.user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
  OR EXISTS (SELECT 1 FROM public.bids b
             WHERE b.request_id = r.id
               AND b.company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580')
  OR EXISTS (SELECT 1 FROM public.escrow_payments ep
             WHERE ep.request_id = r.id
               AND ep.company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580')
  -- ── TEXT PATTERN (필요 시 조정/제거) ──
  OR r.area ILIKE '%마포%' OR r.area ILIKE '%강서%'
  OR r.space_type ILIKE '%원룸%' OR r.space_type ILIKE '%오피스%'
  OR r.size ILIKE '%32평%'
  OR r.desc ILIKE '%테스트%' OR r.style ILIKE '%테스트%'
ORDER BY r.created_at DESC;

-- A-2) 대상 escrow_payments(=계약) — 테스트 업체 또는 위 대상 requests 에 연결된 것
SELECT
  ep.id            AS escrow_id,
  ep.request_id,
  ep.company_id,
  ep.total_amount,
  ep.status,
  ep.transaction_status,
  ep.created_at
FROM public.escrow_payments ep
WHERE ep.company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
   OR ep.request_id IN (
        SELECT r.id FROM public.requests r
        WHERE r.user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
           OR EXISTS (SELECT 1 FROM public.bids b
                      WHERE b.request_id = r.id
                        AND b.company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580')
           OR r.area ILIKE '%마포%' OR r.area ILIKE '%강서%'
           OR r.space_type ILIKE '%원룸%' OR r.space_type ILIKE '%오피스%'
           OR r.size ILIKE '%32평%'
           OR r.desc ILIKE '%테스트%' OR r.style ILIKE '%테스트%'
      )
ORDER BY ep.created_at DESC;

-- A-3) 대상 bids — 테스트 업체 입찰 또는 대상 request 의 입찰
SELECT b.id, b.request_id, b.company_id, b.price, b.selected, b.created_at
FROM public.bids b
WHERE b.company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
   OR b.request_id IN (
        SELECT r.id FROM public.requests r
        WHERE r.user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
           OR r.area ILIKE '%마포%' OR r.area ILIKE '%강서%'
           OR r.space_type ILIKE '%원룸%' OR r.space_type ILIKE '%오피스%'
           OR r.size ILIKE '%32평%'
      )
ORDER BY b.created_at DESC;

-- A-4) 대상 결제/정산 — payment_orders / payment_transactions / escrow_payouts 건수
SELECT 'payment_orders' AS tbl, count(*) AS rows
FROM public.payment_orders po
WHERE po.user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
   OR po.contract_id IN (SELECT id FROM public.escrow_payments
                         WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580')
UNION ALL
SELECT 'payment_transactions', count(*)
FROM public.payment_transactions pt
WHERE pt.payment_order_id IN (
  SELECT id FROM public.payment_orders po
  WHERE po.user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
     OR po.contract_id IN (SELECT id FROM public.escrow_payments
                           WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580')
)
UNION ALL
SELECT 'escrow_payouts', count(*)
FROM public.escrow_payouts
WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
   OR escrow_id IN (SELECT id FROM public.escrow_payments
                    WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580');


-- ════════════════════════════════════════════════════════════
-- B. CLEANUP — 트랜잭션 안에서 FK 순서대로 삭제 (HARD DELETE)
-- ════════════════════════════════════════════════════════════
-- 실행 방법:
--   1) 아래 블록 전체를 한 번에 실행 (BEGIN ~ 마지막 SELECT 까지, COMMIT 제외)
--   2) 맨 끝 "삭제 후 건수" 결과를 확인
--   3) 정상이면  COMMIT;   /  이상하면  ROLLBACK;  를 별도 실행
--
-- ※ bids / payment_transactions 에는 soft-delete 컬럼이 없으므로
--   QA 정리 목적상 hard delete 가 가장 깨끗합니다.
--   soft-delete 만 원하면 섹션 B-ALT 사용.

BEGIN;

-- 대상 집합을 임시 테이블로 고정 (트랜잭션 종료 시 자동 삭제)
CREATE TEMP TABLE _t_req ON COMMIT DROP AS
  SELECT r.id
  FROM public.requests r
  WHERE r.user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
     OR EXISTS (SELECT 1 FROM public.bids b
                WHERE b.request_id = r.id
                  AND b.company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580')
     OR EXISTS (SELECT 1 FROM public.escrow_payments ep
                WHERE ep.request_id = r.id
                  AND ep.company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580')
     OR r.area ILIKE '%마포%' OR r.area ILIKE '%강서%'
     OR r.space_type ILIKE '%원룸%' OR r.space_type ILIKE '%오피스%'
     OR r.size ILIKE '%32평%'
     OR r.desc ILIKE '%테스트%' OR r.style ILIKE '%테스트%';

CREATE TEMP TABLE _t_con ON COMMIT DROP AS
  SELECT id FROM public.escrow_payments
  WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
     OR request_id IN (SELECT id FROM _t_req);

CREATE TEMP TABLE _t_pord ON COMMIT DROP AS
  SELECT id FROM public.payment_orders
  WHERE user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
     OR contract_id IN (SELECT id FROM _t_con)
     OR request_id  IN (SELECT id FROM _t_req)
     OR bid_id IN (SELECT b.id FROM public.bids b
                   WHERE b.company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
                      OR b.request_id IN (SELECT id FROM _t_req));

-- ── 1) payment_transactions  (payment_orders 의 child) ──
DELETE FROM public.payment_transactions
WHERE payment_order_id IN (SELECT id FROM _t_pord);

-- ── 2) payment_orders ──
DELETE FROM public.payment_orders
WHERE id IN (SELECT id FROM _t_pord);

-- ── 3) escrow_payouts  (escrow_payments 의 child) ──
DELETE FROM public.escrow_payouts
WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
   OR escrow_id IN (SELECT id FROM _t_con);

-- ── 4) 계약 child 테이블들 (contract_id → escrow_payments) ──
DELETE FROM public.phase_photos    WHERE contract_id IN (SELECT id FROM _t_con);
DELETE FROM public.change_orders   WHERE contract_id IN (SELECT id FROM _t_con);
DELETE FROM public.contract_scopes WHERE contract_id IN (SELECT id FROM _t_con);
DELETE FROM public.contract_notes  WHERE contract_id IN (SELECT id FROM _t_con);

-- ── 5) reviews  (테스트 업체 / 대상 계약·request 의 후기) ──
DELETE FROM public.reviews
WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
   OR escrow_payment_id IN (SELECT id FROM _t_con)
   OR request_id IN (SELECT id FROM _t_req);

-- ── 6) escrow_payments (=계약 본체) ──
DELETE FROM public.escrow_payments
WHERE id IN (SELECT id FROM _t_con);

-- ── 7) bids ──
DELETE FROM public.bids
WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
   OR request_id IN (SELECT id FROM _t_req);

-- ── 8) activity_logs (대상 request/계약 타임라인 — 선택적 정리) ──
DELETE FROM public.activity_logs
WHERE (target_type = 'request'  AND target_id IN (SELECT id FROM _t_req))
   OR (target_type IN ('contract','escrow') AND target_id IN (SELECT id FROM _t_con));

-- ── 9) requests (마지막) ──
DELETE FROM public.requests
WHERE id IN (SELECT id FROM _t_req);

-- ── 삭제 후 잔존 건수 확인 (0 또는 예상치인지 확인) ──
SELECT 'requests(test)' AS tbl, count(*) AS remaining
FROM public.requests r
WHERE r.user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
   OR r.area ILIKE '%마포%' OR r.area ILIKE '%강서%'
UNION ALL
SELECT 'bids(test company)', count(*) FROM public.bids
WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
UNION ALL
SELECT 'escrow_payments(test company)', count(*) FROM public.escrow_payments
WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
UNION ALL
SELECT 'escrow_payouts(test company)', count(*) FROM public.escrow_payouts
WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580';

-- ✅ 결과 정상 → 아래를 별도 실행:   COMMIT;
-- ⛔ 이상 → 아래를 별도 실행:        ROLLBACK;


-- ════════════════════════════════════════════════════════════
-- B-ALT. (선택) SOFT-DELETE 변형 — 삭제 대신 상태값만 변경
-- ════════════════════════════════════════════════════════════
-- soft-delete 컬럼이 있는 테이블만 가능. bids/payment_transactions 는 불가.
-- 화면에서 숨기되 row 는 보존하고 싶을 때 사용. (B 와 택일)
--
-- BEGIN;
-- -- 견적: 마감 처리
-- UPDATE public.requests SET status = 'cancelled'
-- WHERE user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
--    OR area ILIKE '%마포%' OR area ILIKE '%강서%';
-- -- 계약: 취소 상태
-- UPDATE public.escrow_payments SET transaction_status = 'CANCELLED'
-- WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580';
-- -- 결제주문: 취소
-- UPDATE public.payment_orders SET status = 'CANCELLED'
-- WHERE contract_id IN (SELECT id FROM public.escrow_payments
--                       WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580');
-- -- 정산: 취소
-- UPDATE public.escrow_payouts SET status = 'CANCELLED'
-- WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580';
-- -- 후기: 소프트 삭제
-- UPDATE public.reviews SET is_deleted = true, deleted_at = now()
-- WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580';
-- COMMIT;  -- 또는 ROLLBACK;


-- ════════════════════════════════════════════════════════════
-- B-OPT. (선택) lounge_posts 테스트 글 — soft delete
-- ════════════════════════════════════════════════════════════
-- UPDATE public.lounge_posts SET is_deleted = true, deleted_at = now()
-- WHERE user_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
--   AND (title ILIKE '%테스트%' OR content ILIKE '%테스트%');


-- ════════════════════════════════════════════════════════════
-- E. 적용 후 확인 — QA 시작 가능 상태인지 검증
-- ════════════════════════════════════════════════════════════
-- E-1) 테스트 업체 row + service_regions 가 보존됐는지 (남아 있어야 정상)
SELECT id, name, region, service_regions, default_service_region_id, company_status
FROM public.companies
WHERE id = '03438ba2-5cd0-468a-bd5b-957b5555b580';

-- E-2) 테스트 계정 user row 보존 확인 (남아 있어야 정상)
SELECT id, name, region, activity_regions
FROM public.users
WHERE id = '9e8b3138-ffba-4970-8a5c-b489026c4e54';

-- E-3) 진행 데이터 전부 정리됐는지 (모두 0 이어야 정상)
SELECT 'bids'             AS tbl, count(*) FROM public.bids            WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
UNION ALL SELECT 'escrow_payments', count(*) FROM public.escrow_payments WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
UNION ALL SELECT 'escrow_payouts',  count(*) FROM public.escrow_payouts  WHERE company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
UNION ALL SELECT 'requests(owner)', count(*) FROM public.requests       WHERE user_id   = '9e8b3138-ffba-4970-8a5c-b489026c4e54';
