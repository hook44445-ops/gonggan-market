-- ════════════════════════════════════════════════════════════════════
-- 037_test_data_reset.sql
-- 테스트 데이터 초기화 — 꼬인 진행건/중복 에스크로/고아 site_visit 를 전부 비우고
-- 깨끗한 상태에서 [견적요청 → 입찰 → 업체선택 → 현장견적요청 → 업체응답] 플로우만 검증.
--
-- ⚠️ 절대 규칙(보존 대상):
--   · companies(업체) · users/owners(소유자) 행은 절대 삭제하지 않는다.
--   · 아래 DELETE 는 "요청 라이프사이클의 거래성 데이터"에만 한정한다.
--
-- 처리 순서(FK 역순, 자식 → 부모):
--   escrow_payouts → escrow_payments / estimates / site_visits / 기타 자식 → bids → requests
--   존재하지 않는 테이블은 to_regclass 가드로 건너뛴다(스키마 차이에도 에러 없음).
--
-- Supabase SQL Editor 에서 1회 실행. (되돌릴 수 없으니 테스트 환경에서만)
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

begin;

do $$
declare
  t text;
  -- 거래성(요청 라이프사이클) 테이블만 — 자식 → 부모 순서.
  -- companies / users / owners / 업체 프로필 류는 의도적으로 제외(보존).
  tables text[] := array[
    'escrow_payouts',            -- escrow_payments 자식
    'escrow_release_requests',   -- escrow 자식(있으면)
    'payment_transactions',      -- 결제 자식(있으면)
    'payment_orders',            -- 결제 주문(있으면)
    'estimates',                 -- site_visit/request 자식
    'site_visits',               -- bid/request 자식
    'chats',                     -- request 자식(있으면)
    'contracts',                 -- request 자식(있으면)
    'project_checkpoints',       -- request 자식(있으면)
    'activity_logs',             -- 요청 활동 로그(있으면)
    'notifications',             -- 요청 알림(있으면) — userId 값만 참조, user 행 보존
    'escrow_payments',           -- request 자식
    'bids',                      -- request 자식
    'requests'                   -- 부모(마지막)
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I', t);
      raise notice 'cleared public.%', t;
    else
      raise notice 'skip (no table) public.%', t;
    end if;
  end loop;
end $$;

-- 안전 차원의 명시적 선택값 초기화 — requests 가 모두 삭제됐다면 0행(멱등).
-- (요청을 일부 보존하는 변형 운영 시에도 selected_* 만 깨끗이 비우도록 남겨둠)
update public.requests
   set selected_company_id = null,
       selected_bid_id     = null,
       updated_at          = now()
 where selected_company_id is not null
    or selected_bid_id is not null;

commit;

-- 검증용 카운트(실행 후 결과 확인) — 모두 0 이어야 정상.
select 'requests'        as tbl, count(*) from public.requests
union all select 'bids',            count(*) from public.bids
union all select 'escrow_payments', count(*) from public.escrow_payments
union all select 'site_visits',     count(*) from public.site_visits;
