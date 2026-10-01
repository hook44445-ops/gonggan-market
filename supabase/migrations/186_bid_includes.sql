-- ============================================================
--  Migration 186: 견적 «포함 항목» 칸 — 부가세·철거·폐기물 처리·자재비 포함/별도 + AS 개월 (본질 ②)
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--
--  · bids.includes jsonb 칸 하나만 더한다(비어 있으면 = 업체가 안 적음). 예: {"vat":true,"demolition":false,"as_months":12}
--  · 크기 제한(2KB) 하나 — 앱이 아닌 곳에서 큰 값을 넣지 못하게. 모양 검사는 앱(lib/bidIncludes normalizeIncludes)이 한다.
--  · 정책·함수·다른 칸은 바꾸지 않는다. 입찰 쓰기·고치기는 지금 정책(182 본인만) 그대로.
--  · 앱은 이 칸이 없으면(186 전) 칸을 빼고 예전처럼 저장한다 — 실행 순서 상관없음.
--  되돌리기: alter table public.bids drop constraint if exists bids_includes_size; alter table public.bids drop column if exists includes;
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

alter table public.bids add column if not exists includes jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bids_includes_size' and conrelid = 'public.bids'::regclass) then
    alter table public.bids add constraint bids_includes_size check (includes is null or octet_length(includes::text) <= 2000);
  end if;
end $$;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'bids' and column_name = 'includes' and data_type = 'jsonb')
   and exists (select 1 from pg_constraint where conname = 'bids_includes_size') as bid_includes_ok;
