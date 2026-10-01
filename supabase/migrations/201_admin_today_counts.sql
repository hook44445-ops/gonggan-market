-- ============================================================
--  Migration 201: 관리자 «오늘 할 일» 숫자 한 번에 — admin_today_counts()
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  순서: 상관없음(앱은 함수가 없으면 예전처럼 «열기 ›»만 보인다).
--
--  왜(대표 10-01 «관리자 페이지 보기 쉽고 사용하기 좋게 · 문제 있는 곳»):
--    · «오늘 할 일» 6줄 중 숫자는 2줄(서류 · 가입 심사)뿐 — 분쟁 · 직거래 의심 · 정산 · 파트너 상담은
--      그 화면을 열어야 알 수 있었다. 처리할 게 있는지 보려고 탭을 하나씩 열어야 했다.
--  하는 일 — 관리자만(아니면 42501) · 숫자만(내용 없음) · 표가 없으면 그 칸은 null(«열기 ›»로 보인다):
--    · disputes          : 분쟁 중(dispute_status 가 있고 해결완료 · 환불처리가 아닌 계약)
--    · direct_deal       : 직거래 의심 — 대기 · 조사중
--    · lounge_reports    : 라운지 신고 — 대기 · 검토중
--    · customer_reports  : 업체가 올린 고객 신고 — 대기(PENDING)
--    · payouts_approved  : 고객이 승인해 지급을 기다리는 단계(escrow_payouts APPROVED)
--    · payouts_held      : 보류된 지급(HELD)
--    · partner_leads     : 파트너 상담 — 대기(PENDING)
--  되돌리기: drop function if exists public.admin_today_counts();
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.admin_today_counts()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  v jsonb := '{}'::jsonb;
  n bigint;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;

  begin
    select count(*) into n from public.escrow_payments
     where dispute_status is not null and dispute_status not in ('RESOLVED', 'REFUNDED');
    v := v || jsonb_build_object('disputes', n);
  exception when others then v := v || jsonb_build_object('disputes', null); end;

  begin
    select count(*) into n from public.direct_deal_reports where status in ('pending', 'investigating');
    v := v || jsonb_build_object('direct_deal', n);
  exception when others then v := v || jsonb_build_object('direct_deal', null); end;

  begin
    select count(*) into n from public.lounge_reports where status in ('pending', 'reviewing');
    v := v || jsonb_build_object('lounge_reports', n);
  exception when others then v := v || jsonb_build_object('lounge_reports', null); end;

  begin
    select count(*) into n from public.customer_reports where status = 'PENDING';
    v := v || jsonb_build_object('customer_reports', n);
  exception when others then v := v || jsonb_build_object('customer_reports', null); end;

  begin
    select count(*) into n from public.escrow_payouts where status = 'APPROVED';
    v := v || jsonb_build_object('payouts_approved', n);
  exception when others then v := v || jsonb_build_object('payouts_approved', null); end;

  begin
    select count(*) into n from public.escrow_payouts where status = 'HELD';
    v := v || jsonb_build_object('payouts_held', n);
  exception when others then v := v || jsonb_build_object('payouts_held', null); end;

  begin
    select count(*) into n from public.partner_leads
     where upper(coalesce(status, '')) = 'PENDING'
       and coalesce((to_jsonb(partner_leads) ->> 'is_archived')::boolean, false) = false;
    v := v || jsonb_build_object('partner_leads', n);
  exception when others then v := v || jsonb_build_object('partner_leads', null); end;

  return v;
end; $$;

revoke execute on function public.admin_today_counts() from public, anon;
grant execute on function public.admin_today_counts() to authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① today_fn: 함수가 있고 로그인 안 한 사람(anon)은 못 부른다
--  ② admin_only: 함수 안에서 관리자만 통과시킨다
select
  to_regprocedure('public.admin_today_counts()') is not null
  and not has_function_privilege('anon', 'public.admin_today_counts()', 'execute') as today_fn,
  position('ADMIN_ONLY' in pg_get_functiondef('public.admin_today_counts()'::regprocedure)) > 0 as admin_only;
