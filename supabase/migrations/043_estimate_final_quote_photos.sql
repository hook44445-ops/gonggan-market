-- ════════════════════════════════════════════════════════════════════
-- 043_estimate_final_quote_photos.sql
-- 최종견적서에 현장 실측 사진 URL 배열 컬럼 추가 + estimate_upsert 에 p_photo_urls 추가.
--
-- 목적: 업체가 최종견적서 작성 시 현장 실측 사진을 첨부하고, 의뢰인이 결제 전에 확인.
--
-- 영향 범위(최소):
--   · estimates 테이블에 final_quote_photo_urls text[] (default '{}') 추가 — 기존 무영향.
--   · estimate_upsert(견적 draft 저장/수정) 에 p_photo_urls 파라미터만 추가 — 나머지 로직 동일.
--   · estimate_submit(상태전이 RPC) / RLS / 다른 흐름은 변경하지 않음.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(031 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 1) 컬럼 추가 (기존 데이터/로직 무영향)
alter table public.estimates
  add column if not exists final_quote_photo_urls text[] not null default '{}';

-- 2) estimate_upsert 에 p_photo_urls 추가.
--    파라미터 추가는 새 시그니처(오버로드)를 만들므로, 기존 11-인자 시그니처를 먼저 제거해
--    PostgREST 함수 해석 모호성(could not choose best candidate)을 방지한다.
drop function if exists public.estimate_upsert(uuid,uuid,uuid,uuid,uuid,uuid,jsonb,bigint,int,text,text);

create or replace function public.estimate_upsert(
  p_actor_id uuid, p_estimate_id uuid, p_bid_id uuid, p_request_id uuid,
  p_site_visit_id uuid, p_company_id uuid, p_items jsonb, p_total_price bigint,
  p_duration_days int, p_note text, p_warranty_note text,
  p_photo_urls text[] default '{}'
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.estimates;
begin
  if not public._actor_owns_company(p_company_id, p_actor_id) then
    raise exception 'NOT_COMPANY_OWNER';
  end if;

  if p_estimate_id is null then
    insert into public.estimates (
      bid_id, request_id, site_visit_id, company_id, items, total_price,
      duration_days, note, warranty_note, final_quote_photo_urls, status, created_at, updated_at
    ) values (
      p_bid_id, p_request_id, p_site_visit_id, p_company_id, coalesce(p_items,'[]'::jsonb), p_total_price,
      p_duration_days, p_note, p_warranty_note, coalesce(p_photo_urls,'{}'), 'draft', now(), now()
    ) returning * into v_row;
  else
    update public.estimates set
      bid_id = p_bid_id, request_id = p_request_id, site_visit_id = p_site_visit_id,
      company_id = p_company_id, items = coalesce(p_items,'[]'::jsonb), total_price = p_total_price,
      duration_days = p_duration_days, note = p_note, warranty_note = p_warranty_note,
      final_quote_photo_urls = coalesce(p_photo_urls, '{}'), updated_at = now()
    where id = p_estimate_id and company_id = p_company_id
    returning * into v_row;
    if v_row.id is null then raise exception 'ESTIMATE_NOT_FOUND'; end if;
  end if;

  return to_jsonb(v_row);
end; $$;

grant execute on function public.estimate_upsert(uuid,uuid,uuid,uuid,uuid,uuid,jsonb,bigint,int,text,text,text[]) to anon, authenticated;

notify pgrst, 'reload schema';
