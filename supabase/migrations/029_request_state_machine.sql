-- ════════════════════════════════════════════════════════════════════
-- 029_request_state_machine.sql
-- 현장방문 견적 흐름 1차 — requests.status 상태머신 확장(라우팅/상태 배선).
--
-- 흐름: open → site_visit → final_quote_submitted → escrow_pending
--       → in_progress → completed
--   · 업체 선택 시 바로 에스크로로 가지 않고 site_visit 로 전이(현장방문 견적 단계).
--   · 업체 최종 견적서 제출 → final_quote_submitted.
--   · 의뢰인 승인 → escrow_pending → (결제) → in_progress.
--
-- 기존 site_visits / estimates 테이블·헬퍼 재사용. 이 마이그레이션은 상태값만 확장.
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- requests.status 제약 확장 — 기존 값 + 현장방문/최종견적/에스크로대기/계약중
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.requests'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.requests drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.requests
  add constraint requests_status_check check (status in (
    'open','site_visit','final_quote_submitted','escrow_pending',
    'contracting','in_progress','completed','cancelled','closed','expired'
  ));

-- 선택된 업체/입찰 추적 컬럼(있으면 무시) — 현장방문 단계에서 어떤 업체가 선택됐는지.
alter table public.requests
  add column if not exists selected_bid_id     uuid,
  add column if not exists selected_company_id uuid;
