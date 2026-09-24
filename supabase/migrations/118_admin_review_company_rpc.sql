-- ════════════════════════════════════════════════════════════════════
-- 118_admin_review_company_rpc.sql  (총점검 09-24 · 5차 — 관리자 승인이 운영에서 안 된다)
--
-- 증상: 관리자 「업체관리 → ✓ 승인하기 → 확인」을 눌러도 companies 가 그대로
--       (verified=false · doc_status=pending), 화면엔 아무 안내도 없다.
--       문서센터에서 사업자등록증·시공보험·면허를 승인해도 verified · has_insurance ·
--       license_verified 가 켜지지 않는다.
-- 원인: 앱이 companies 를 직접 UPDATE 한다. 앱은 Supabase 로그인 세션이 없어(auth.uid() = null)
--       RLS 가 막고, 0건이 바뀌어도 오류로 보이지 않았다. → 운영에서 승인된 업체 0곳.
--       A안(계약은 사업자부터, 116)에서는 이 때문에 어떤 업체도 계약(결제)을 받을 수 없다.
-- 고침: 관리자만 부를 수 있는 security definer 함수 두 개(다른 관리자 함수 068 과 같은 확인 규칙).
--   ① admin_review_company  — 업체 심사(승인 → verified 켬 · 반려/보류 → 사유)
--   ② admin_review_document — 서류 한 장 심사 + 그 서류가 뜻하는 칸을 함께
--        사업자등록증 승인 → verified 켬(반려는 끄지 않음 — 이미 심사로 확인된 업체 보호)
--        시공보험 승인/반려 → has_insurance · 실내건축공사업 등록증 승인/반려 → license_verified
--   verified 가 false → true 로 바뀌면 116 트리거가 의뢰인에게 「결제할 수 있어요」를 보낸다.
--
-- 추가 전용 · 재실행 안전. Supabase SQL Editor 에서 한 번 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 관리자 확인(068 admin_set_guarantee 와 같은 규칙): 관리자 uuid 또는 코드관리자 'admin'.
create or replace function public._assert_admin(p_admin_id text)
returns uuid language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_admin_uuid uuid;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY';
    end if;
    return v_admin_uuid;
  elsif lower(coalesce(trim(p_admin_id), '')) <> 'admin' then
    raise exception 'ADMIN_ONLY';
  end if;
  return null;
end; $$;
revoke execute on function public._assert_admin(text) from public, anon, authenticated;

-- ① 업체 심사
create or replace function public.admin_review_company(
  p_admin_id text, p_company_id uuid, p_status text, p_note text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_admin uuid; v_prev public.companies; v_row public.companies;
begin
  v_admin := public._assert_admin(p_admin_id);
  if p_status not in ('approved','rejected','pending') then   -- 보류 = pending(앱 「⏸ 보류」)
    raise exception 'BAD_STATUS: %', p_status;
  end if;

  select * into v_prev from public.companies where id = p_company_id;
  if v_prev.id is null then raise exception 'COMPANY_NOT_FOUND'; end if;

  update public.companies
     set doc_status  = p_status,
         reject_note = p_note,
         reviewed_at = now(),
         verified    = case when p_status = 'approved' then true else verified end
   where id = p_company_id
  returning * into v_row;

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, before_val, after_val, reason)
    values (v_admin, case when p_status = 'approved' then 'APPROVE_COMPANY' else 'REVIEW_COMPANY_' || upper(p_status) end,
            'company', p_company_id,
            jsonb_build_object('doc_status', v_prev.doc_status, 'verified', v_prev.verified),
            jsonb_build_object('doc_status', v_row.doc_status, 'verified', v_row.verified),
            p_note);
  exception when others then null;   -- 기록 실패가 심사를 되돌리지 않게
  end;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'doc_status', v_row.doc_status,
                            'verified', v_row.verified, 'owner_id', v_row.owner_id, 'name', v_row.name);
end; $$;
grant execute on function public.admin_review_company(text,uuid,text,text) to anon, authenticated;

-- ② 서류 한 장 심사 + 회사 칸
create or replace function public.admin_review_document(
  p_admin_id text, p_doc_id uuid, p_status text, p_reason text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_admin uuid; v_doc public.company_documents;
begin
  v_admin := public._assert_admin(p_admin_id);
  if p_status not in ('submitted','reviewing','approved','held','rejected') then   -- 054 의 check 와 같다
    raise exception 'BAD_STATUS: %', p_status;
  end if;

  update public.company_documents
     set review_status = p_status,
         review_reason = p_reason,
         reviewed_by   = v_admin,
         reviewed_at   = now(),
         updated_at    = now()
   where id = p_doc_id
  returning * into v_doc;
  if v_doc.id is null then raise exception 'DOC_NOT_FOUND'; end if;

  if v_doc.company_id is not null then
    if v_doc.document_type = 'business_license' and p_status = 'approved' then
      update public.companies set verified = true where id = v_doc.company_id;
    elsif v_doc.document_type = 'insurance_certificate' and p_status in ('approved','rejected') then
      update public.companies set has_insurance = (p_status = 'approved') where id = v_doc.company_id;
    elsif v_doc.document_type = 'interior_license' and p_status in ('approved','rejected') then
      update public.companies set license_verified = (p_status = 'approved') where id = v_doc.company_id;
    end if;
  end if;

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, after_val, reason)
    values (v_admin, 'DOC_' || upper(p_status), 'document', p_doc_id,
            jsonb_build_object('review_status', p_status, 'document_type', v_doc.document_type), p_reason);
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'id', v_doc.id, 'review_status', v_doc.review_status,
                            'document_type', v_doc.document_type, 'company_id', v_doc.company_id);
end; $$;
grant execute on function public.admin_review_document(text,uuid,text,text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 셋 다 true 면 끝
select
  exists (select 1 from pg_proc where proname = 'admin_review_company')  as review_company_ok,
  exists (select 1 from pg_proc where proname = 'admin_review_document') as review_document_ok,
  not has_function_privilege('anon', 'public._assert_admin(text)', 'execute') as assert_locked;
