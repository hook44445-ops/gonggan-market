-- ─────────────────────────────────────────────────────
-- seed_test_company_service_regions.sql
-- 테스트 업체에 영업지역(service_regions) 주입: 서울 강서구 + 서울 영등포구
-- → 매칭이 tier-4(all, company-region-empty) 대신 tier-1(exact)로 떨어지는지 확인용.
--
-- 사용법(Supabase SQL Editor):
--   STEP 1) 아래 (A) 후보 조회로 실제 company_id 확인
--   STEP 2) (B) 의 :company_id 자리에 그 값을 넣고 실행
--   STEP 3) verify_010_region_multi.sql 의 5)/7) 로 저장 확인
--   STEP 4) 앱에서 RegionRefetch + region_debug 재검증
--
-- ⚠️ 테이블은 public.companies (=profiles 아님). 기존 region text 는 보존(COALESCE).
-- ─────────────────────────────────────────────────────

-- (A) 후보 업체 조회 — service_regions 가 비어있는(=company-region-empty 원인) 업체 찾기
select id, owner_id, name, region, company_status, service_regions
from public.companies
where service_regions is null or service_regions = '[]'::jsonb
order by created_at desc
limit 20;

-- ─────────────────────────────────────────────────────
-- (B) 주입 — :company_id 를 (A) 에서 확인한 실제 값으로 교체 후 실행
--     강서구(기본) + 영등포구 두 곳을 한 배열로 저장.
-- ─────────────────────────────────────────────────────
update public.companies
set
  service_regions = '[
    {
      "id": "서울 강서구", "sido": "서울", "sigungu": "강서구", "label": "서울 강서구",
      "city": "서울", "district": "강서구", "is_primary": true,
      "lat": 37.5509, "lng": 126.8495, "radiusKm": 3
    },
    {
      "id": "서울 영등포구", "sido": "서울", "sigungu": "영등포구", "label": "서울 영등포구",
      "city": "서울", "district": "영등포구", "is_primary": false,
      "lat": 37.5264, "lng": 126.8962, "radiusKm": 3
    }
  ]'::jsonb,
  default_service_region_id = '서울 강서구',
  region = coalesce(nullif(region, ''), '서울 강서구')
where id = :'company_id';   -- ← psql 변수. SQL Editor 라면 = '실제_company_id' 로 직접 교체

-- (C) 주입 결과 확인
select id, name, region, default_service_region_id, service_regions
from public.companies
where id = :'company_id';

-- ─────────────────────────────────────────────────────
-- (옵션) 단일 테스트 업체 환경에서 자동 타깃 — 가장 최근 생성된 ACTIVE 업체 1건에 주입.
--   ⚠️ 운영 데이터가 여러 건이면 사용 금지. 테스트 환경에서만 주석 해제.
-- ─────────────────────────────────────────────────────
-- update public.companies c
-- set service_regions = '[
--     {"id":"서울 강서구","sido":"서울","sigungu":"강서구","label":"서울 강서구","city":"서울","district":"강서구","is_primary":true,"lat":37.5509,"lng":126.8495,"radiusKm":3},
--     {"id":"서울 영등포구","sido":"서울","sigungu":"영등포구","label":"서울 영등포구","city":"서울","district":"영등포구","is_primary":false,"lat":37.5264,"lng":126.8962,"radiusKm":3}
--   ]'::jsonb,
--   default_service_region_id = '서울 강서구',
--   region = coalesce(nullif(c.region,''), '서울 강서구')
-- where c.id = (
--   select id from public.companies
--   order by (company_status = 'ACTIVE') desc, created_at desc
--   limit 1
-- );
