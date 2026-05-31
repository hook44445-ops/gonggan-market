-- ════════════════════════════════════════════════════════════════════
-- cleanup_test_deal_data.sql
-- 공간마켓 테스트/더미 "거래 진행 데이터" 정리 (요청/입찰/계약/결제/에스크로)
--
-- ⚠️ 절대 규칙
--   · users / companies 테이블 자체는 삭제하지 않는다.
--   · 테스트업체 row(아래 ID)와 service_regions 는 유지한다.
--   · 지역 지도용 테스트업체 노출은 유지(요청/계약 진행 데이터만 제거).
--
-- 데이터 모델 메모
--   · "contract" 별도 테이블 없음. 계약 = public.escrow_payments.
--   · requests(id) ← bids / escrow_payments / payment_orders / site_visits /
--                     estimates           (대부분 ON DELETE CASCADE)
--   · escrow_payments(id) ← escrow_payouts / phase_photos / change_orders /
--                            contract_scopes / contract_notes (CASCADE),
--                            payment_transactions.escrow_id (ON DELETE SET NULL)
--   · payment_orders(id) ← payment_transactions.order_id (ON DELETE CASCADE)
--   · bids.company_id / escrow_payments.company_id 는 users.id(업체 owner user id)를 가리킴.
--
-- 식별 기준
--   (a) 테스트업체: company_id = '03438ba2-5cd0-468a-bd5b-957b5555b580'
--                   owner_id   = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
--   (b) 테스트 텍스트/지역: region/area/space_type/description 에
--        '테스트','오피스32','원룸','오피스텔','마포구','강서구' 포함
--   (c) 테스트 금액: 100000/110000/5000000 (원) + 10/11/500 (만원 환산)
--
-- 실행 순서:  STEP 0(대상 고정) → A(preview) → B(soft) → 화면검증 → (선택)hard → C(확인)
-- ════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ STEP 0. 대상 request_id 집합을 임시 테이블로 고정                  ║
-- ║   세션 단위 임시 테이블 — A/B/C 를 같은 세션(쿼리 창)에서 실행할 것 ║
-- ╚══════════════════════════════════════════════════════════════════╝
drop table if exists _tmp_target_requests;
create temporary table _tmp_target_requests as
with ids as (
  select array['03438ba2-5cd0-468a-bd5b-957b5555b580'::uuid,
               '9e8b3138-ffba-4970-8a5c-b489026c4e54'::uuid] as arr
)
select distinct r.id
from public.requests r, ids
where
  -- (a) 테스트업체가 입찰/계약/결제한 요청
  r.id in (
    select request_id from public.bids            where company_id = any(ids.arr)
    union select request_id from public.escrow_payments where company_id = any(ids.arr)
    union select request_id from public.payment_orders  where company_id = any(ids.arr)
  )
  -- (b) 테스트 텍스트/지역
  or r.region      ~* '(테스트|오피스32|원룸|오피스텔|마포구|강서구)'
  or r.area        ~* '(테스트|오피스32|원룸|오피스텔|마포구|강서구)'
  or r.space_type  ~* '(테스트|오피스32|원룸|오피스텔)'
  or r.description ~* '(테스트|오피스32|원룸|오피스텔)'
  -- (c) 테스트 금액 (원 단위 + 만원 단위)
  or r.budget_min in (100000,110000,5000000,10,11,500)
  or r.budget_max in (100000,110000,5000000,10,11,500)
  or r.id in (select request_id from public.bids            where price        in (100000,110000,5000000,10,11,500))
  or r.id in (select request_id from public.escrow_payments where total_amount in (100000,110000,5000000,10,11,500));


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ A. PREVIEW (삭제/보관 대상 미리보기 — 먼저 단독 실행해 검수)        ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- A1) 영향 row 수 요약
select 'target_requests'      as bucket, count(*) from _tmp_target_requests
union all select 'bids',                 count(*) from public.bids            where request_id in (select id from _tmp_target_requests)
union all select 'escrow_payments',      count(*) from public.escrow_payments where request_id in (select id from _tmp_target_requests)
union all select 'payment_orders',       count(*) from public.payment_orders  where request_id in (select id from _tmp_target_requests)
union all select 'escrow_payouts',       count(*) from public.escrow_payouts  where escrow_id in (select id from public.escrow_payments where request_id in (select id from _tmp_target_requests))
union all select 'phase_photos',         count(*) from public.phase_photos    where escrow_id in (select id from public.escrow_payments where request_id in (select id from _tmp_target_requests))
union all select 'payment_transactions', count(*) from public.payment_transactions where request_id in (select id from _tmp_target_requests);

-- A2) 어떤 request 가 잡히는지 행 단위 검수
select r.id, r.region, r.area, r.space_type, r.status, r.budget_min, r.budget_max, r.created_at
from public.requests r
where r.id in (select id from _tmp_target_requests)
order by r.created_at desc;


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ B. CLEANUP — 트랜잭션으로 감싸 안전 실행 (rollback 가능)            ║
-- ║   먼저 옵션 1(SOFT)만 COMMIT 해 화면 검증 → 필요시 옵션 2(HARD)     ║
-- ╚══════════════════════════════════════════════════════════════════╝

BEGIN;

-- ── 옵션 1 (권장): SOFT — 화면에서 사라지게 + 새 견적 가능 ──────────
update public.requests
set is_deleted = true, is_hidden = true, status = 'cancelled',
    hidden_reason = 'qa_test_cleanup', cancelled_at = now(), updated_at = now()
where id in (select id from _tmp_target_requests);

-- 계약(에스크로) 비활성화 → 업체 진행중/완료 버킷에서 제외
update public.escrow_payments
set transaction_status = 'CANCELLED', updated_at = now()
where request_id in (select id from _tmp_target_requests);

-- 테스트 후기 숨김
update public.reviews
set is_hidden = true, is_deleted = true, hidden_at = now()
where request_id in (select id from _tmp_target_requests)
   or company_id in ('03438ba2-5cd0-468a-bd5b-957b5555b580',
                     '9e8b3138-ffba-4970-8a5c-b489026c4e54');

-- (선택) 테스트 라운지 글 숨김
update public.lounge_posts
set is_hidden = true, is_deleted = true
where title ~* '(테스트|오피스32|원룸·오피스텔)' or title = '11';

-- ✅ 여기서 멈추고 COMMIT; → 앱 화면 검증.
--    완전 삭제가 필요하면 ROLLBACK 하지 말고 아래 옵션 2 를 이어서 실행 후 COMMIT.


-- ── 옵션 2 (영구 삭제): HARD — FK 자식 → 부모 순서 ──────────────────
-- 에스크로 자식
delete from public.payment_transactions
 where escrow_id in (select id from public.escrow_payments where request_id in (select id from _tmp_target_requests))
    or request_id in (select id from _tmp_target_requests);
delete from public.escrow_payouts
 where escrow_id in (select id from public.escrow_payments where request_id in (select id from _tmp_target_requests));
delete from public.phase_photos
 where escrow_id in (select id from public.escrow_payments where request_id in (select id from _tmp_target_requests))
    or request_id in (select id from _tmp_target_requests);
delete from public.change_orders
 where contract_id in (select id from public.escrow_payments where request_id in (select id from _tmp_target_requests));
delete from public.contract_scopes
 where contract_id in (select id from public.escrow_payments where request_id in (select id from _tmp_target_requests))
    or request_id in (select id from _tmp_target_requests);
delete from public.contract_notes
 where contract_id in (select id from public.escrow_payments where request_id in (select id from _tmp_target_requests))
    or request_id in (select id from _tmp_target_requests);

-- 결제 주문 → 계약 본체
delete from public.payment_orders  where request_id in (select id from _tmp_target_requests);
delete from public.escrow_payments where request_id in (select id from _tmp_target_requests);

-- 실측/견적 보조 (테이블 없으면 해당 줄만 건너뛰기)
delete from public.site_visits where request_id in (select id from _tmp_target_requests);
delete from public.estimates   where request_id in (select id from _tmp_target_requests);

-- 입찰
delete from public.bids
 where request_id in (select id from _tmp_target_requests)
    or company_id in ('03438ba2-5cd0-468a-bd5b-957b5555b580',
                      '9e8b3138-ffba-4970-8a5c-b489026c4e54');

-- 요청 본체 (마지막)
delete from public.requests where id in (select id from _tmp_target_requests);

-- 테스트 후기 영구 삭제(원할 때만)
delete from public.reviews
 where company_id in ('03438ba2-5cd0-468a-bd5b-957b5555b580',
                      '9e8b3138-ffba-4970-8a5c-b489026c4e54');

-- 결과 확인 후:   COMMIT;   /   문제 시:   ROLLBACK;
COMMIT;


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ C. 적용 후 확인                                                    ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- C1) 테스트업체 row + service_regions 보존(삭제 금지 대상이 살아있어야 함)
select id, name, region, service_regions
from public.companies
where owner_id = '9e8b3138-ffba-4970-8a5c-b489026c4e54'
   or id       = '03438ba2-5cd0-468a-bd5b-957b5555b580';

-- C2) 테스트업체 진행중 계약 0건 확인
select count(*) as active_escrow_for_test_company
from public.escrow_payments
where company_id in ('03438ba2-5cd0-468a-bd5b-957b5555b580',
                     '9e8b3138-ffba-4970-8a5c-b489026c4e54')
  and transaction_status not in ('CANCELLED','SETTLED');

-- C3) 테스트 요청이 화면 노출 상태로 남지 않았는지
select id, region, area, status, is_hidden, is_deleted
from public.requests
where (region ~* '(오피스32|원룸|오피스텔|마포구|강서구)'
       or budget_min in (100000,110000,5000000,10,11,500))
  and coalesce(is_deleted,false) = false
  and coalesce(is_hidden,false)  = false;

-- C4) 남은 테스트 후기/입찰
select 'reviews_visible' as k, count(*) from public.reviews
  where company_id in ('03438ba2-5cd0-468a-bd5b-957b5555b580','9e8b3138-ffba-4970-8a5c-b489026c4e54')
    and coalesce(is_hidden,false)=false and coalesce(is_deleted,false)=false
union all
select 'bids_for_test_company', count(*) from public.bids
  where company_id in ('03438ba2-5cd0-468a-bd5b-957b5555b580','9e8b3138-ffba-4970-8a5c-b489026c4e54');

-- 정리: 임시 테이블 제거
drop table if exists _tmp_target_requests;
