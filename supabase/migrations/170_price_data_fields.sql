-- ============================================================
--  Migration 170: 가격 데이터 칸 — 평수(m²)·건물 유형·지역 코드(요청), 자재 등급(견적서) (데이터 보완)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(있으면 건너뜀).
--  순서 상관없음 — 앱은 이 칸이 없으면 예전처럼 저장하고, 생기면 같이 채운다.
--
--  왜: 013(AI 학습 데이터)의 칸·시세표가 운영에 없어(106 주석: space_price_index 없음) «우리 동네 평당 시세»를
--      만들 표본이 하나도 쌓이지 않았다. 고객·업체에게 새로 묻지 않고, 이미 적은 값(공간 유형·평수·지역)에서
--      앱이 채운다. 자재 등급만 업체가 견적서에서 한 번 누른다(선택).
--  되돌리기: 칸·표를 지우지 않는다(비어 있어도 해가 없다). 함수만 끄려면
--      drop function if exists public.estimate_set_material_grade(uuid, text);
--  확인 칸 3개(맨 아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

alter table public.requests
  add column if not exists space_size_m2 numeric,
  add column if not exists building_type text,
  add column if not exists region_code   text;

alter table public.estimates
  add column if not exists material_grade text,
  add column if not exists labor_ratio    numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'estimates_material_grade_chk') then
    alter table public.estimates add constraint estimates_material_grade_chk
      check (material_grade is null or material_grade in ('economy','standard','premium','luxury')) not valid;
  end if;
end $$;

create index if not exists idx_requests_price_keys on public.requests (region_code, space_type, building_type);

-- 시세표(013 과 같은 모양) — 완공(COMPLETED) 때 106 의 update_price_index 가 채운다. 표본 수를 같이 둔다.
create table if not exists public.space_price_index (
  id             uuid        primary key default gen_random_uuid(),
  region_code    text        not null,
  space_type     text        not null,
  building_type  text        not null,
  material_grade text        not null,
  work_type      text        not null default 'general',
  price_per_m2   bigint,
  sample_count   int         not null default 0,
  last_updated   timestamptz not null default now(),
  unique (region_code, space_type, building_type, material_grade, work_type)
);
alter table public.space_price_index enable row level security;
drop policy if exists "spi: public read" on public.space_price_index;
create policy "spi: public read" on public.space_price_index for select using (true);

-- 견적서 자재 등급 — 그 견적서의 업체 주인(토큰의 사용자)만
create or replace function public.estimate_set_material_grade(p_estimate_id uuid, p_grade text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if p_grade is not null and p_grade not in ('economy','standard','premium','luxury') then
    raise exception 'BAD_GRADE';
  end if;
  update public.estimates e
     set material_grade = p_grade
    from public.companies c
   where e.id = p_estimate_id and c.id = e.company_id and c.owner_id = auth.uid();
  return found;
end; $$;
grant execute on function public.estimate_set_material_grade(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① request_cols: 요청에 평수·건물 유형·지역 코드 칸이 있다
--  ② estimate_cols: 견적서에 자재 등급 칸이 있다
--  ③ price_table: 시세표와 등급 저장 함수가 있다
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'requests'
     and column_name in ('space_size_m2','building_type','region_code')) = 3 as request_cols,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'estimates'
     and column_name = 'material_grade') as estimate_cols,
  to_regclass('public.space_price_index') is not null
    and exists (select 1 from pg_proc where proname = 'estimate_set_material_grade') as price_table;
