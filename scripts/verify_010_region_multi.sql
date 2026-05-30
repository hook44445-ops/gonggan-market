-- ─────────────────────────────────────────────────────
-- 010_region_multi 적용 확인 쿼리 (Supabase SQL Editor 에서 실행)
--
-- 앱 데이터 모델 메모:
--   · 다중 지역은 jsonb 배열로 저장됩니다.
--       users.activity_regions     : RegionEntry[]  (고객 활동지역, 최대 2)
--       companies.service_regions  : RegionEntry[]  (업체 영업지역, 최대 2)
--       RegionEntry = { city, district, is_primary, added_at }
--   · "기본 지역(default)"은 별도 컬럼이 아니라 배열 안의 is_primary=true 로 표현합니다.
--     (그래서 default_activity_region_id / default_service_region_id 컬럼은 사용하지 않습니다)
--   · 기존 region text 컬럼은 삭제하지 않고 fallback 으로 유지하며 primary 와 동기화됩니다.
-- ─────────────────────────────────────────────────────

-- 1) 신규 컬럼 존재 여부 (각각 1행이 나오면 적용됨)
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'users'     and column_name = 'activity_regions') or
    (table_name = 'companies' and column_name = 'service_regions')
  )
order by table_name;

-- 2) 최대 2개 제한 CHECK 제약 존재 여부 (2행이 나오면 적용됨)
select conname
from pg_constraint
where conname in ('users_activity_regions_max2', 'companies_service_regions_max2');

-- 3) 실제 저장 데이터 샘플 — 고객 활동지역
select id, region, activity_regions
from public.users
where activity_regions is not null
order by created_at desc
limit 10;

-- 4) 실제 저장 데이터 샘플 — 업체 영업지역
select id, name, region, service_regions
from public.companies
where service_regions is not null
order by id desc
limit 10;
