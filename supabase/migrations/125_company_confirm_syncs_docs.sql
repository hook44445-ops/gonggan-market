-- ============================================================
--  Migration 125: 업체 확인과 서류 상태를 맞춘다 (E8, 총점검 09-25)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경
--    관리자가 업체 심사로 사업자 확인을 끝내면(118 admin_review_company → companies.verified = true)
--    업체 상태는 바뀌는데, 같이 제출된 사업자등록증 서류(company_documents)는 「관리자 확인 중」에 남았다.
--    업체 「내 한도 · 서류」 카드와 관리자 서류 목록이 서로 다른 말을 했다.
--
--  하는 일
--    1) 업체의 확인 칸이 false → true 가 되면, 그 항목의 «제출·확인 중» 서류를 승인으로 맞춘다.
--         verified          → business_license
--         has_insurance     → insurance_certificate
--         license_verified  → interior_license
--       (반려·보류·초안 서류는 건드리지 않는다)
--    2) 이미 확인된 업체의 묻힌 서류를 한 번 맞춘다.
--  확인 칸 2개(아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.trg_company_confirm_syncs_docs()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_j_new jsonb := to_jsonb(new); v_j_old jsonb := to_jsonb(old);
begin
  if coalesce((v_j_new ->> 'verified')::boolean, false) and not coalesce((v_j_old ->> 'verified')::boolean, false) then
    update public.company_documents set review_status = 'approved', reviewed_at = coalesce(reviewed_at, now())
     where company_id = new.id and document_type = 'business_license' and review_status in ('submitted','reviewing');
  end if;
  if coalesce((v_j_new ->> 'has_insurance')::boolean, false) and not coalesce((v_j_old ->> 'has_insurance')::boolean, false) then
    update public.company_documents set review_status = 'approved', reviewed_at = coalesce(reviewed_at, now())
     where company_id = new.id and document_type = 'insurance_certificate' and review_status in ('submitted','reviewing');
  end if;
  if coalesce((v_j_new ->> 'license_verified')::boolean, false) and not coalesce((v_j_old ->> 'license_verified')::boolean, false) then
    update public.company_documents set review_status = 'approved', reviewed_at = coalesce(reviewed_at, now())
     where company_id = new.id and document_type = 'interior_license' and review_status in ('submitted','reviewing');
  end if;
  return new;
exception when others then
  return new;   -- 서류 맞추기 실패가 업체 승인을 막지 않는다
end; $$;

drop trigger if exists trg_company_confirm_syncs_docs on public.companies;
create trigger trg_company_confirm_syncs_docs after update on public.companies
  for each row execute function public.trg_company_confirm_syncs_docs();

-- 2) 이미 확인된 업체의 묻힌 서류 한 번 맞추기
update public.company_documents d
   set review_status = 'approved', reviewed_at = coalesce(d.reviewed_at, now())
  from public.companies c
 where c.id = d.company_id
   and d.review_status in ('submitted','reviewing')
   and (   (d.document_type = 'business_license'      and coalesce((to_jsonb(c) ->> 'verified')::boolean, false))
        or (d.document_type = 'insurance_certificate' and coalesce((to_jsonb(c) ->> 'has_insurance')::boolean, false))
        or (d.document_type = 'interior_license'      and coalesce((to_jsonb(c) ->> 'license_verified')::boolean, false)));

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from pg_trigger where tgname = 'trg_company_confirm_syncs_docs') as trigger_ok,
  not exists (
    select 1 from public.company_documents d join public.companies c on c.id = d.company_id
     where d.document_type = 'business_license' and d.review_status in ('submitted','reviewing')
       and coalesce((to_jsonb(c) ->> 'verified')::boolean, false)
  ) as no_buried_biz_docs;
