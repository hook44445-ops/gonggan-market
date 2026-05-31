-- ─────────────────────────────────────────────────────
-- 010 + 011 region multi 적용 확인 쿼리 (Supabase SQL Editor 에서 실행)
--
-- ⚠️ 테이블명: 이 코드베이스의 고객 프로필 테이블은 public.users 입니다(=profiles 아님).
--
-- 앱 데이터 모델:
--   users.activity_regions     : RegionEntry[]  (고객 활동지역, 최대 2)
--   users.default_activity_region_id   : text  (기본 활동지역 id)
--   companies.service_regions  : RegionEntry[]  (업체 영업지역, 최대 2)
--   companies.default_service_region_id : text  (기본 영업지역 id)
--   RegionEntry = { id, sido, sigungu, label, lat, lng, radiusKm,  city, district, is_primary, added_at }
--   · 기본 지역은 default_*_region_id(컬럼) + 배열 내 is_primary=true 둘 다로 표현
--   · 기존 region text 컬럼은 fallback 으로 유지(삭제 금지)
-- ─────────────────────────────────────────────────────

-- 1) 신규 컬럼 존재 여부 (4행이면 적용 완료)
select table_name, column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name='users'     and column_name in ('activity_regions','default_activity_region_id')) or
    (table_name='companies' and column_name in ('service_regions','default_service_region_id'))
  )
order by table_name, column_name;

-- 2) 최대 2개 제약 (2행이면 적용 완료)
select conname
from pg_constraint
where conname in ('users_activity_regions_max2', 'companies_service_regions_max2');

-- 3) GIN 인덱스 (2행이면 적용 완료)
select indexname
from pg_indexes
where schemaname='public'
  and indexname in ('idx_users_activity_regions', 'idx_companies_service_regions');

-- 4) 고객 활동지역 저장 데이터 샘플
select id, region, default_activity_region_id, activity_regions
from public.users
where activity_regions is not null and activity_regions <> '[]'::jsonb
order by created_at desc
limit 10;

-- 5) 업체 영업지역 저장 데이터 샘플
select id, name, region, default_service_region_id, service_regions
from public.companies
where service_regions is not null and service_regions <> '[]'::jsonb
order by id desc
limit 10;

-- ─────────────────────────────────────────────────────
-- 6) 전체 스냅샷 — 저장 여부를 한 번에 보기 (값이 없으면 매칭이 fallback 으로 떨어짐)
--    activity_regions / service_regions 가 NULL 이거나 '[]' 이면
--    앱은 legacy region text 로 fallback, 그것도 없으면 '전국' fallback.
-- ─────────────────────────────────────────────────────
select id, name, region, activity_regions, default_activity_region_id
from public.users
order by created_at desc
limit 20;

select id, owner_id, name, region, service_regions, default_service_region_id
from public.companies
order by created_at desc
limit 20;

-- ─────────────────────────────────────────────────────
-- 7) 테스트용 — 업체 service_regions 직접 주입 (지역 기준으로 바뀌는지 확인)
--    ⚠️ 아래 WHERE id 는 6) 결과에서 실제 company id 를 확인해 넣을 것.
--       RegionEntry 키: id / sido / sigungu / label / lat / lng / radiusKm
--       (앱 호환을 위해 city / district / is_primary 도 함께 넣어두면 안전)
--    실제 실행 시 주석 해제.
-- ─────────────────────────────────────────────────────

-- 강서구 예시
-- UPDATE public.companies
-- SET
--   service_regions = '[{
--     "id": "서울 강서구",
--     "sido": "서울", "sigungu": "강서구", "label": "서울 강서구",
--     "city": "서울", "district": "강서구", "is_primary": true,
--     "lat": 37.5509, "lng": 126.8495, "radiusKm": 3
--   }]'::jsonb,
--   default_service_region_id = '서울 강서구',
--   region = COALESCE(region, '서울 강서구')
-- WHERE id = '여기에_company_id';

-- 부평구 예시
-- UPDATE public.companies
-- SET
--   service_regions = '[{
--     "id": "인천 부평구",
--     "sido": "인천", "sigungu": "부평구", "label": "인천 부평구",
--     "city": "인천", "district": "부평구", "is_primary": true,
--     "lat": 37.5074, "lng": 126.7218, "radiusKm": 3
--   }]'::jsonb,
--   default_service_region_id = '인천 부평구',
--   region = COALESCE(region, '인천 부평구')
-- WHERE id = '여기에_company_id';

-- ─────────────────────────────────────────────────────
-- 8) 고객 activity_regions 직접 주입 (테스트 계정용)
--    ⚠️ WHERE id 는 1)/4) 결과에서 실제 user id 확인 후 넣을 것. 실행 시 주석 해제.
-- ─────────────────────────────────────────────────────
-- UPDATE public.users
-- SET
--   activity_regions = '[{
--     "id": "서울 강서구",
--     "sido": "서울", "sigungu": "강서구", "label": "서울 강서구",
--     "city": "서울", "district": "강서구", "is_primary": true,
--     "lat": 37.5509, "lng": 126.8495, "radiusKm": 3
--   },{
--     "id": "인천 부평구",
--     "sido": "인천", "sigungu": "부평구", "label": "인천 부평구",
--     "city": "인천", "district": "부평구", "is_primary": false,
--     "lat": 37.5074, "lng": 126.7218, "radiusKm": 3
--   }]'::jsonb,
--   default_activity_region_id = '서울 강서구',
--   region = COALESCE(region, '서울 강서구')
-- WHERE id = '여기에_user_id';

