-- ─────────────────────────────────────────────────────
-- 010_region_multi.sql
-- 다중 활동지역/영업지역 (최대 2곳)
--
-- - users.activity_regions  : 고객 활동지역 RegionEntry[] (jsonb, nullable)
-- - companies.service_regions: 업체 영업지역 RegionEntry[] (jsonb, nullable)
-- - 기존 region text 컬럼은 삭제하지 않고 fallback 으로 유지
-- - 서버측 최대 2개 제한 (CHECK constraint)
--
-- 추가 전용(additive) 마이그레이션 — 기존 데이터/플로우 영향 없음.
-- 모든 신규 컬럼은 NULL 로 시작하므로 기존 행이 제약을 위반하지 않는다.
-- ─────────────────────────────────────────────────────

set search_path = public, extensions;

alter table public.users
  add column if not exists activity_regions jsonb;

alter table public.companies
  add column if not exists service_regions jsonb;

-- 최대 2개 제한 (null 허용, 배열 타입일 때만 검사)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_activity_regions_max2'
  ) then
    alter table public.users
      add constraint users_activity_regions_max2
      check (
        activity_regions is null
        or (jsonb_typeof(activity_regions) = 'array'
            and jsonb_array_length(activity_regions) <= 2)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'companies_service_regions_max2'
  ) then
    alter table public.companies
      add constraint companies_service_regions_max2
      check (
        service_regions is null
        or (jsonb_typeof(service_regions) = 'array'
            and jsonb_array_length(service_regions) <= 2)
      );
  end if;
end $$;

-- 확인 로그
do $$
begin
  raise notice '010_region_multi applied: users.activity_regions=%, companies.service_regions=%',
    (select count(*) from information_schema.columns
       where table_schema='public' and table_name='users' and column_name='activity_regions'),
    (select count(*) from information_schema.columns
       where table_schema='public' and table_name='companies' and column_name='service_regions');
end $$;
