-- 조회만(읽기 전용) · 지역별 확인된 업체 · 요청 수 (2026-10-02 · 2판 — 1판은 SQL Editor 에서 42601 오류)
-- 아무것도 바꾸지 않습니다. 여러 번 실행해도 안전합니다. 결과 칸 4개: 지역 · 확인된_업체 · 전체_업체 · 최근90일_요청

with co as (
  select to_jsonb(c) as j,
         coalesce((to_jsonb(c) ->> 'verified')::boolean, false) as verified,
         case when jsonb_typeof(to_jsonb(c) -> 'service_regions') = 'array'
              then to_jsonb(c) -> 'service_regions' else '[]'::jsonb end as sr
  from public.companies c
  where coalesce(c.name, '') !~* '(테스트|test)'
),
raw_regions as (
  select co.verified, coalesce(e ->> 'district', e ->> 'city') as r
  from co cross join jsonb_array_elements(co.sr) as e
  union all
  select co.verified, co.j ->> 'region' as r
  from co
  where jsonb_array_length(co.sr) = 0
),
regions as (
  select verified, nullif(regexp_replace(trim(r), '^.*\s', ''), '') as k
  from raw_regions
),
req as (
  select nullif(regexp_replace(trim(coalesce(q.area, '')), '^.*\s', ''), '') as k
  from public.requests q
  where q.created_at > now() - interval '90 days'
)
select regions.k as 지역,
       count(*) filter (where regions.verified) as 확인된_업체,
       count(*) as 전체_업체,
       (select count(*) from req where req.k = regions.k) as 최근90일_요청
from regions
where regions.k is not null
group by regions.k
order by 2 desc, 4 desc, 3 desc
limit 20;
