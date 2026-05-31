-- ─────────────────────────────────────────────────────
-- 011_region_multi_defaults.sql
-- 010_region_multi 보강:
--   · activity_regions / service_regions 에 DEFAULT '[]'::jsonb
--   · default_activity_region_id / default_service_region_id (text) 추가
--   · 최대 2개 CHECK 제약 (명시적 이름으로 재생성)
--   · GIN 인덱스 추가
--
-- ⚠️ 중요: 이 프로젝트의 "고객 프로필" 테이블은 public.users 입니다.
--    (지시문의 `profiles` 는 이 코드베이스에 존재하지 않으므로 users 로 적용)
--
-- 추가 전용(additive) · 멱등(idempotent). 기존 region text / mainRegion 컬럼은 보존(삭제 금지).
-- 미적용 상태에서도 앱은 legacy region text fallback 으로 정상 동작합니다.
-- ─────────────────────────────────────────────────────

set search_path = public, extensions;

-- 1) 컬럼 추가 (기본값 빈 배열 + default id)
alter table public.users
  add column if not exists activity_regions jsonb default '[]'::jsonb,
  add column if not exists default_activity_region_id text;

alter table public.companies
  add column if not exists service_regions jsonb default '[]'::jsonb,
  add column if not exists default_service_region_id text;

-- 2) 기존 NULL → 빈 배열 정규화 (CHECK 위반/길이계산 안전)
update public.users     set activity_regions = '[]'::jsonb where activity_regions is null;
update public.companies set service_regions  = '[]'::jsonb where service_regions  is null;

-- 3) 최대 2개 제약 (이름 명시, drop 후 재생성)
alter table public.users     drop constraint if exists users_activity_regions_max2;
alter table public.users     drop constraint if exists profiles_activity_regions_max_2; -- 방어적(존재 시)
alter table public.users
  add constraint users_activity_regions_max2
  check (jsonb_array_length(coalesce(activity_regions, '[]'::jsonb)) <= 2);

alter table public.companies drop constraint if exists companies_service_regions_max2;
alter table public.companies
  add constraint companies_service_regions_max2
  check (jsonb_array_length(coalesce(service_regions, '[]'::jsonb)) <= 2);

-- 4) GIN 인덱스 (지역 교집합 조회 대비)
create index if not exists idx_users_activity_regions
  on public.users using gin (activity_regions);
create index if not exists idx_companies_service_regions
  on public.companies using gin (service_regions);

-- 5) 확인 로그
do $$
begin
  raise notice '011 applied: users.activity_regions=%, users.default_activity_region_id=%, companies.service_regions=%, companies.default_service_region_id=%',
    (select count(*) from information_schema.columns where table_schema='public' and table_name='users'     and column_name='activity_regions'),
    (select count(*) from information_schema.columns where table_schema='public' and table_name='users'     and column_name='default_activity_region_id'),
    (select count(*) from information_schema.columns where table_schema='public' and table_name='companies' and column_name='service_regions'),
    (select count(*) from information_schema.columns where table_schema='public' and table_name='companies' and column_name='default_service_region_id');
end $$;
