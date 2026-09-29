-- ============================================================
--  Migration 167: 업체 표 — 인증·점수·상태 칸은 업체가 직접 못 바꾼다 (보완 S3)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  순서: 앱 배포 뒤(공간온도 자동 차감을 관리자 토큰으로 보내는 버전). 166 과 같은 날 실행해도 된다.
--
--  문제(09-29 보안 점검 S3)
--    · 업체 표 쓰기 정책(schema "companies: owner write" · 운영 DB 에 따로 연 정책)이 칸을 가리지 않아,
--      업체가 앱 밖에서 직접 verified(인증)·license_verified·has_insurance(보험)·temp(공간온도)·
--      company_status(정지 해제)·guarantee_*(공간보증)·fee_rate(수수료)·owner_id 등을 바꿀 수 있었다.
--      고객이 믿고 고르는 «인증·보험·보증·온도» 가 거짓이 될 수 있다.
--  고침(정책은 건드리지 않는다 — 운영 DB 정책이 저장소와 달라도 똑같이 막힌다)
--    · 앱(anon·authenticated)에서 직접 쓸 때만 칸을 지킨다. 서버 함수(security definer)·서버 키·관리자 토큰은 그대로.
--    · 새로 만들 때: 인증·점수·수수료는 기본값. 상태는 ACTIVE/PENDING 만. 공간보증은 관리자 승인 가입상담(069)이
--      같은 전화번호·같은 등급으로 있을 때만 그대로 둔다(가입상담 복사 흐름 유지).
--    · 고칠 때: 아래 칸은 예전 값 그대로(조용히 되돌림 — 이름·소개·지역 등 나머지 저장은 막지 않는다).
--  되돌리기: drop trigger if exists trg_companies_guard on public.companies;
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public._companies_guard()
returns trigger language plpgsql
set search_path = public, extensions as $$
declare v_digits text; v_lead public.partner_leads;
begin
  -- 서버 함수(소유자 권한)·서버 키(service_role)·관리자 토큰은 그대로 통과
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if public.is_admin() then return new; end if;

  if tg_op = 'INSERT' then
    new.verified := false; new.license_verified := false; new.has_insurance := false; new.is_direct := false;
    new.doc_status := 'draft'; new.reject_note := null; new.reviewed_at := null;
    new.badge := 'basic'; new.deposit_amount := 0; new.fee_rate := 0.04;
    new.temp := 70; new.completed_jobs := 0; new.recontract_rate := 0; new.as_rate := 0;
    new.avg_response_hours := 0; new.response_rate := 0; new.conversion_rate := 0; new.completion_rate := 0; new.dispute_rate := 0;
    new.total_transaction_volume := 0; new.change_order_count := 0;
    if coalesce(new.company_status, 'PENDING') not in ('ACTIVE', 'PENDING') then new.company_status := 'PENDING'; end if;
    if coalesce(new.guarantee_status, 'NONE') <> 'NONE' or new.guarantee_grade is not null then
      select nullif(regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g'), '') into v_digits
        from public.users u where u.id = new.owner_id;
      select * into v_lead from public.partner_leads l
       where v_digits is not null
         and regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') in (v_digits, '0' || substr(v_digits, 3))
         and l.onboarding_status = 'APPROVED' and l.company_id is null
         and l.guarantee_grade is not distinct from new.guarantee_grade
       limit 1;
      if v_lead.id is null then
        new.guarantee_grade := null; new.guarantee_amount := null; new.guarantee_status := 'NONE';
        new.guarantee_badge_visible := false; new.guarantee_updated_at := null;
      else
        new.guarantee_amount := v_lead.guarantee_amount;
      end if;
    end if;
    return new;
  end if;

  -- UPDATE: 지키는 칸은 예전 값 그대로
  new.owner_id := old.owner_id;
  new.verified := old.verified; new.license_verified := old.license_verified; new.has_insurance := old.has_insurance;
  new.is_direct := old.is_direct;
  new.doc_status := old.doc_status; new.reject_note := old.reject_note; new.reviewed_at := old.reviewed_at;
  new.badge := old.badge; new.deposit_amount := old.deposit_amount; new.fee_rate := old.fee_rate;
  new.is_early_partner := old.is_early_partner; new.early_partner_joined_at := old.early_partner_joined_at;
  new.early_partner_benefit_until := old.early_partner_benefit_until;
  new.temp := old.temp; new.completed_jobs := old.completed_jobs; new.recontract_rate := old.recontract_rate; new.as_rate := old.as_rate;
  new.avg_response_hours := old.avg_response_hours; new.response_rate := old.response_rate;
  new.conversion_rate := old.conversion_rate; new.completion_rate := old.completion_rate; new.dispute_rate := old.dispute_rate;
  new.total_transaction_volume := old.total_transaction_volume; new.change_order_count := old.change_order_count;
  new.company_status := old.company_status;
  new.guarantee_grade := old.guarantee_grade; new.guarantee_amount := old.guarantee_amount; new.guarantee_status := old.guarantee_status;
  new.guarantee_badge_visible := old.guarantee_badge_visible; new.guarantee_updated_at := old.guarantee_updated_at;
  return new;
end; $$;

drop trigger if exists trg_companies_guard on public.companies;
create trigger trg_companies_guard
  before insert or update on public.companies
  for each row execute function public._companies_guard();

-- ── 확인 ──────────────────────────────────────────────────────
--  ① guard_on: 업체 표에 지킴 트리거가 걸렸다
--  ② admin_fn: 관리자 판정 함수(107 is_admin)가 있다
select
  exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
           where c.relname = 'companies' and t.tgname = 'trg_companies_guard' and not t.tgisinternal) as guard_on,
  exists (select 1 from pg_proc where proname = 'is_admin' and pronargs = 0) as admin_fn;
