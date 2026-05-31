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
