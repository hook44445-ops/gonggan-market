-- ════════════════════════════════════════════════════════════════════
-- 066_partner_lead_check_approved.sql
-- 승인업체 로그인 게이트(읽기 전용) — Partner Landing v1.2
--
-- 목적: /partner '업체 로그인' 진입 시, 전화번호+사업자등록번호로
--   partner_leads 에 status='APPROVED' 행이 있는지 anon 이 확인할 수 있는
--   읽기 전용 RPC 1개만 추가한다.
--
-- 범위(최소):
--   · 신규 테이블 없음. partner_leads 기존 컬럼만 읽음(스키마/컬럼 변경 없음).
--   · RLS 정책 변경 없음(anon SELECT 정책 추가 안 함) — SECURITY DEFINER RPC
--     로만 우회 조회(065 의 admin RPC 패턴과 동일한 사상, 단 admin 검증 없이
--     "승인 여부(boolean)"만 반환 — 개별 행/필드는 노출하지 않음).
--   · 기존 partner_leads_list / partner_lead_submit / partner_lead_set_status
--     변경 없음.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행. notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── RPC: 전화번호+사업자등록번호로 승인 여부 확인(anon 호출 가능) ────
-- 숫자만 비교(하이픈/공백 등 표기 차이 무시)하여 가입상담 시 입력값과
-- 로그인 시 입력값의 포맷이 달라도 매칭되도록 한다.
-- 응답은 boolean(approved)만 반환 — 리드 상세 정보는 노출하지 않음.
create or replace function public.partner_lead_check_approved(
  p_phone           text,
  p_business_number text
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_phone   text;
  v_biz     text;
  v_approved boolean;
begin
  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_biz   := nullif(regexp_replace(coalesce(p_business_number, ''), '[^0-9]', '', 'g'), '');

  if v_phone is null or v_biz is null then
    return jsonb_build_object('approved', false);
  end if;

  select exists (
    select 1
    from public.partner_leads l
    where regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = v_phone
      and regexp_replace(coalesce(l.business_number, ''), '[^0-9]', '', 'g') = v_biz
      and l.status = 'APPROVED'
  ) into v_approved;

  return jsonb_build_object('approved', v_approved);
end;
$fn$;

grant execute on function public.partner_lead_check_approved(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
