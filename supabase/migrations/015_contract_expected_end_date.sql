-- ════════════════════════════════════════════════════════════════════
-- 015_contract_expected_end_date.sql
-- 계약(에스크로) 예상 완공일 — 진행감(Progress) 구조용
--   · escrow_payments.expected_end_date (date) 추가
--   · 업체가 계약 시작 시 입력, 계약 상세에 "예상 완공일" 로 표시
-- 추가 전용 · 멱등(idempotent) · 기존 데이터 영향 없음(NULL 허용)
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

alter table public.escrow_payments
  add column if not exists expected_end_date date;
