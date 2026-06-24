-- ════════════════════════════════════════════════════════════════════
-- 082_project_checkpoint_save_fix_b_selected.sql
-- 착공/중간/완료 GPS 체크포인트 저장 실패 수정 — [42703] column b.selected does not exist.
--
-- 원인: project_checkpoint_save(034) 의 actor 검증이 public.bids.selected 를 참조하는데,
--   운영 DB 의 bids 에는 selected 컬럼이 없다(요청 SSOT 는 requests.selected_bid_id /
--   selected_company_id — admin_project_flow_list 등 신규 RPC 는 이미 b.selected 미사용).
--   → security definer RPC 가 42703 으로 실패하며 GPS+사진 체크포인트가 저장되지 않음.
--
-- 수정: 'b.selected = true' 참조를 제거하고, 이미 존재하는 SSOT(requests.selected_bid_id)
--   기준으로 '선택된 입찰 업체' 를 판정한다. 컬럼/테이블/시그니처/정책 변경 없음(함수 본문만).
--
-- ⚠️ 컬럼 신설/스키마 변경 없음. project_checkpoints 테이블·RLS·시그니처(17 params) 동일.
--    Supabase SQL Editor 에서 1회 실행(멱등 — create or replace).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.project_checkpoint_save(
  p_actor_id uuid, p_request_id uuid, p_contract_id uuid, p_site_visit_id uuid,
  p_type text, p_lat numeric, p_lng numeric, p_accuracy numeric,
  p_address_full text, p_road_address text, p_jibun_address text,
  p_sido text, p_sigungu text, p_dong text, p_bunji text,
  p_photos text[], p_note text
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.project_checkpoints;
begin
  -- 액터가 해당 요청의 선택된 업체 또는 계약 업체의 소유자인지 검증.
  --   · requests.selected_company_id 직접 매칭
  --   · escrow_payments.company_id 매칭
  --   · requests.selected_bid_id 가 가리키는 입찰의 업체(= 선택된 입찰 업체)  ← b.selected 대체(SSOT)
  if not exists (
    select 1 from public.companies c
     where c.owner_id = p_actor_id
       and (
         c.id = (select selected_company_id from public.requests where id = p_request_id)
         or c.id = (select company_id from public.escrow_payments where id = p_contract_id)
         or exists (
              select 1
                from public.bids b
                join public.requests r on r.id = b.request_id
               where b.request_id = p_request_id
                 and b.company_id = c.id
                 and r.selected_bid_id = b.id)
       )
  ) then
    raise exception 'NOT_PROJECT_COMPANY';
  end if;

  insert into public.project_checkpoints (
    request_id, contract_id, site_visit_id, checkpoint_type,
    lat, lng, accuracy, address_full, road_address, jibun_address,
    sido, sigungu, dong, bunji, photos, note, captured_by, captured_at, created_at
  ) values (
    p_request_id, p_contract_id, p_site_visit_id, p_type,
    p_lat, p_lng, p_accuracy, p_address_full, p_road_address, p_jibun_address,
    p_sido, p_sigungu, p_dong, p_bunji, coalesce(p_photos, '{}'), p_note,
    p_actor_id, now(), now()
  ) returning * into v_row;

  return to_jsonb(v_row);
end; $$;

grant execute on function public.project_checkpoint_save(
  uuid,uuid,uuid,uuid,text,numeric,numeric,numeric,text,text,text,text,text,text,text,text[],text
) to anon, authenticated;

notify pgrst, 'reload schema';
