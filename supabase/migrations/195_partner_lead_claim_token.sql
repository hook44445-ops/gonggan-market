-- ============================================================
--  Migration 195: 업체 신청서 이어받기(partner_lead_claim_for_company · partner_lead_mark_claimed) — 로그인한 본인 번호로만
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(이 두 함수를 로그인 토큰으로 부르는 버전) → 이 SQL.
--
--  왜(10-01 점검):
--    · partner_lead_claim_for_company(070)는 anon 실행 + «넘긴 전화번호»를 그대로 믿었다 —
--      업체 전화번호만 알면 로그인 없이 그 업체 신청서의 대표자 이름 · 사업자등록번호 · 보증 등급 ·
--      사업자등록증 · 보험증권 파일 주소를 받아 갈 수 있었다(업체 전화번호는 공개된 경우가 많다).
--    · partner_lead_mark_claimed(069)는 anon 실행 + 확인 없음 — 남의 신청서를 아무 업체에 «이어받음» 처리할 수 있었다
--      (진짜 업체가 나중에 가입하면 보증 정보가 복사되지 않는다).
--  바꾼 뒤
--    · claim: 로그인 토큰의 사용자 «본인 전화번호(users.phone)»로만 찾는다(넘긴 번호는 관리자일 때만 씀).
--             토큰이 없으면 null(앱은 null 이면 그냥 넘어간다).
--    · mark_claimed: 토큰 필요(없으면 42501) · 업체 주인이 본인이고 · 신청서 전화번호가 본인 번호일 때만.
--             아니면 {"claimed":false,"error":"NOT_OWNER"} — 관리자는 그대로.
--    · 두 함수 anon 실행 권한 회수 · 돌려주는 값은 070/069 그대로
--  되돌리기: 070 의 partner_lead_claim_for_company · 069 의 partner_lead_mark_claimed 를 다시 실행한다(«grant … to anon» 포함).
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 1) 승인된 신청서 찾기 — 본인 번호로만
create or replace function public.partner_lead_claim_for_company(
  p_phone text
) returns jsonb
language plpgsql stable security definer
set search_path = public, extensions as $fn$
declare
  v_uid   uuid := auth.uid();
  v_phone text;
  v_row   public.partner_leads;
begin
  if v_uid is null then return null; end if;
  -- 195: 본인 번호(관리자만 넘긴 번호로 찾을 수 있다)
  if coalesce(public.is_admin(), false) then
    v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  else
    select nullif(regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g'), '') into v_phone
      from public.users u where u.id = v_uid;
  end if;
  if v_phone is null then return null; end if;

  select * into v_row from public.partner_leads l
   where regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = v_phone
     and l.onboarding_status = 'APPROVED'
     and l.company_id is null
   order by l.approved_at desc nulls last, l.created_at desc
   limit 1;

  if v_row.id is null then return null; end if;

  return jsonb_build_object(
    'lead_id',              v_row.id,
    'company_name',         v_row.company_name,
    'owner_name',           v_row.owner_name,
    'business_number',      v_row.business_number,
    'service_area',         v_row.service_area,
    'specialty',            v_row.specialty,
    'insurance_yn',         v_row.insurance_yn,
    'guarantee_grade',      v_row.guarantee_grade,
    'guarantee_amount',     v_row.guarantee_amount,
    'business_license_url', v_row.business_license_url,
    'insurance_file_url',   v_row.insurance_file_url
  );
end; $fn$;

-- 2) 이어받음 확정 — 내 업체 · 내 번호의 신청서만
create or replace function public.partner_lead_mark_claimed(
  p_lead_id    uuid,
  p_company_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_uid   uuid := auth.uid();
  v_phone text;
  v_row   public.partner_leads;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if p_lead_id is null or p_company_id is null then
    raise exception 'LEAD_AND_COMPANY_REQUIRED';
  end if;

  -- 195: 관리자가 아니면 «내 업체» + «내 번호로 낸 신청서»만
  if not coalesce(public.is_admin(), false) then
    select nullif(regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g'), '') into v_phone
      from public.users u where u.id = v_uid;
    if v_phone is null
       or not exists (select 1 from public.companies c where c.id = p_company_id and c.owner_id = v_uid)
       or not exists (select 1 from public.partner_leads l
                       where l.id = p_lead_id
                         and regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = v_phone) then
      return jsonb_build_object('claimed', false, 'lead_id', p_lead_id, 'error', 'NOT_OWNER');
    end if;
  end if;

  update public.partner_leads set
    company_id = p_company_id,
    updated_at = now()
  where id = p_lead_id and company_id is null   -- idempotent: 최초 1회만
  returning * into v_row;

  return jsonb_build_object('claimed', v_row.id is not null, 'lead_id', p_lead_id);
end; $fn$;

revoke execute on function public.partner_lead_claim_for_company(text) from public, anon;
revoke execute on function public.partner_lead_mark_claimed(uuid, uuid) from public, anon;
grant execute on function public.partner_lead_claim_for_company(text) to authenticated;
grant execute on function public.partner_lead_mark_claimed(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① own_phone_only: 두 함수가 로그인한 본인 번호로만 판단한다
--  ② no_anon: 로그인 안 한 사람(anon)은 두 함수를 부를 수 없다
select
  position('195: 본인 번호' in pg_get_functiondef('public.partner_lead_claim_for_company(text)'::regprocedure)) > 0
  and position('NOT_OWNER' in pg_get_functiondef('public.partner_lead_mark_claimed(uuid,uuid)'::regprocedure)) > 0 as own_phone_only,
  not has_function_privilege('anon', 'public.partner_lead_claim_for_company(text)', 'execute')
  and not has_function_privilege('anon', 'public.partner_lead_mark_claimed(uuid,uuid)', 'execute') as no_anon;
