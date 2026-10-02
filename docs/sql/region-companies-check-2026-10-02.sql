-- ============================================================
--  조회만(읽기 전용) — 지역 × 공사 검색 페이지를 «업체가 실제로 있는 지역»부터 열기 위한 확인 (2026-10-02)
--  Supabase SQL Editor 에서 실행하세요. 아무것도 바꾸지 않습니다. 여러 번 실행해도 안전합니다.
--
--  왜: 지시서 7절 5번 — 빈 지역 페이지를 많이 만들면 «얇은 문서»로 검색에서 손해를 본다.
--      사업자등록이 확인된 업체가 있는 지역 1~2곳부터 연다.
--  결과 칸 4개: 지역 · 확인된_업체 · 전체_업체 · 최근90일_요청
--  (테스트 업체 — 이름에 «테스트»·«test» — 는 뺀다)
-- ============================================================

with co as (
  select
    to_jsonb(c) as j,
    coalesce((to_jsonb(c) ->> 'verified')::boolean, false) as verified
  from public.companies c
  where coalesce(c.name, '') !~* '(테스트|test)'
),
co_regions as (
  -- 영업지역(service_regions · 최대 2곳)의 마지막 낱말(동/구) — 없으면 예전 region 글자
  select verified, nullif(regexp_replace(trim(r), '^.*\s', ''), '') as k
  from co,
  lateral (
    select coalesce(e ->> 'district', e ->> 'city') as r   -- RegionEntry = { city, district, is_primary, added_at }
      from jsonb_array_elements(case when jsonb_typeof(j -> 'service_regions') = 'array' then j -> 'service_regions' else '[]'::jsonb end) e
    union all
    select j ->> 'region'
     where jsonb_typeof(j -> 'service_regions') is distinct from 'array' or jsonb_array_length(j -> 'service_regions') = 0
  ) x
),
req as (
  select nullif(regexp_replace(trim(coalesce(q.area, '')), '^.*\s', ''), '') as k
  from public.requests q
  where q.created_at > now() - interval '90 days'
)
select
  k as 지역,
  count(*) filter (where verified) as 확인된_업체,
  count(*) as 전체_업체,
  (select count(*) from req where req.k = co_regions.k) as 최근90일_요청
from co_regions
where k is not null
group by k
order by 확인된_업체 desc, 최근90일_요청 desc, 전체_업체 desc
limit 20;
