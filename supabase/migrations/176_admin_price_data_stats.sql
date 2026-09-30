-- ============================================================
--  Migration 176: 관리자 «가격 데이터 쌓임» — 170 의 표준 칸·자재 등급·시세표가 실제로 쌓이는지
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다. 170 뒤에.
--  · 관리자(로그인 토큰 role=admin)만 · 개수만(개인 정보 없음)
--  되돌리기: drop function if exists public.admin_price_data_stats();
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.admin_price_data_stats()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'requests_total', (select count(*) from public.requests where created_at > now() - interval '30 days'),
    'requests_with_fields', (select count(*) from public.requests
                               where created_at > now() - interval '30 days'
                                 and region_code is not null and building_type is not null and space_size_m2 is not null),
    'estimates_total', (select count(*) from public.estimates),
    'estimates_graded', (select count(*) from public.estimates where material_grade is not null),
    'index_rows', (select count(*) from public.space_price_index),
    'index_samples', (select coalesce(sum(sample_count), 0) from public.space_price_index)
  );
end; $$;
grant execute on function public.admin_price_data_stats() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'admin_price_data_stats') as price_data_stats_ok;
