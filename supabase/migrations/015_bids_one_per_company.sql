-- ════════════════════════════════════════════════════════════════════
-- 015_bids_one_per_company.sql
-- 한 업체당 한 요청에 1입찰 정책 — DB 레벨 강제
--   1) 기존 중복 입찰 정리 (업체별 최신 1건 유지, 나머지 삭제)
--   2) unique (request_id, company_id) 제약 추가
--
-- 멱등 · 안전. 앱은 이미 재제출을 '수정(update)'으로 처리하므로 이 제약은 방어선.
-- ════════════════════════════════════════════════════════════════════

-- 1) 중복 입찰 soft-clean — 동일 (request_id, company_id) 중 최신(created_at) 1건만 남기고 삭제
delete from public.bids b
using public.bids b2
where b.request_id = b2.request_id
  and b.company_id = b2.company_id
  and b.id <> b2.id
  and (
    b.created_at < b2.created_at
    or (b.created_at = b2.created_at and b.id < b2.id)
  );

-- 2) unique 제약 (이미 있으면 통과)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bids_request_company_unique'
  ) then
    alter table public.bids
      add constraint bids_request_company_unique unique (request_id, company_id);
  end if;
end $$;
