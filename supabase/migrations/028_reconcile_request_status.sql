-- ════════════════════════════════════════════════════════════════════
-- 028_reconcile_request_status.sql
-- requests.status 를 단일 기준(single source of truth)으로 정합화.
--
-- 배경:
--   계약(escrow) 이 생성됐는데 requests.status 가 'open' 으로 남은 요청이 있어
--   업체 '입찰' 목록과 '진행중'에 이중 노출되는 불일치가 있었음.
--   계약 시 status 전이가 누락된 과거/시드 데이터를 실제 상태로 맞춘다.
--
-- 규칙:
--   · escrow.transaction_status ∈ (SETTLED, COMPLETED)            → requests.status = 'completed'
--   · escrow.transaction_status ∈ (CONTRACTED, STARTED,
--       MID_INSPECTION, DISPUTE)                                  → requests.status = 'in_progress'
--   · status='open' 인 요청만 변경(이미 정합한 데이터는 건드리지 않음) → 멱등.
--
-- 추가 전용 · 데이터 정합화. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 1) 완료/정산된 계약 → completed
update public.requests r
   set status = 'completed', updated_at = now()
  from public.escrow_payments e
 where e.request_id = r.id
   and r.status = 'open'
   and e.transaction_status in ('SETTLED','COMPLETED');

-- 2) 진행 중인 계약 → in_progress
update public.requests r
   set status = 'in_progress', updated_at = now()
  from public.escrow_payments e
 where e.request_id = r.id
   and r.status = 'open'
   and e.transaction_status in ('CONTRACTED','STARTED','MID_INSPECTION','DISPUTE');

-- (선택) 3) escrow.transaction_status 가 없거나 기타 값이어도 escrow 가 존재하면 계약된 것:
--     안전하게 in_progress 로(완료 조건에 안 걸린 나머지 open 요청).
update public.requests r
   set status = 'in_progress', updated_at = now()
  from public.escrow_payments e
 where e.request_id = r.id
   and r.status = 'open';
