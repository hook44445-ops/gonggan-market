-- ════════════════════════════════════════════════════════════════════
-- verify_consumer_bids.sql
-- 의뢰인 "진행중" 0건 진단 — 입찰 존재/상태/소유자 매칭 확인
--   증상: 업체는 요청·입찰을 보는데 의뢰인 마이페이지 진행중=0.
--   원인 후보:
--     (A) 프론트: 진행중/완료 카운트 하드코딩 → 코드 수정으로 해결됨
--     (B) 데이터: 그 request 의 user_id 가 로그인한 의뢰인과 다름(=다른 계정/시드)
-- ════════════════════════════════════════════════════════════════════

-- 0) 로그인 의뢰인 id 확인 (이름/전화로)
select id, name, phone, role, region, created_at
from public.users
where name = '김태웅'        -- ← 실제 의뢰인 이름/전화로 교체
order by created_at desc;

-- 1) 스크린샷의 요청(카페/식당·32평, 강서구, 500만원) 찾기
select id, user_id, space_type, area, size, status, budget_min, budget_max,
       is_hidden, is_deleted, created_at
from public.requests
where space_type ilike '%카페%' or (area ilike '%강서%' and size ilike '%32%')
order by created_at desc
limit 10;

-- 2) 그 요청에 입찰이 실제로 있는지 (request_id 는 1) 결과로 교체)
select b.id, b.request_id, b.company_id, b.price, b.status, b.selected, b.created_at
from public.bids b
where b.request_id = '여기에_request_id'
order by b.created_at desc;

-- 3) 소유자 매칭 — 요청 user_id 가 1)의 의뢰인 id 와 같은지 (핵심)
--    다르면: 그 요청은 다른 계정(또는 시드)이 만든 것 → 의뢰인 화면에 안 뜨는 게 정상.
select r.id as request_id, r.user_id as request_owner,
       u.name as owner_name, u.role as owner_role, r.status,
       (select count(*) from public.bids b where b.request_id = r.id) as bid_count
from public.requests r
left join public.users u on u.id = r.user_id
where r.id = '여기에_request_id';

-- 4) 특정 의뢰인 기준 — 진행중으로 잡혀야 할 요청 미리보기
--    (status open/bidding/quoted/contracting/in_progress 또는 bids>0, 완료/취소/만료/삭제 제외)
select r.id, r.status, r.space_type, r.area,
       (select count(*) from public.bids b where b.request_id = r.id) as bid_count,
       coalesce(r.is_hidden,false) as hidden, coalesce(r.is_deleted,false) as deleted
from public.requests r
where r.user_id = '여기에_consumer_user_id'
  and coalesce(r.is_deleted,false) = false
  and coalesce(r.is_hidden,false)  = false
  and r.status not in ('completed','cancelled','expired','closed')
order by r.created_at desc;
