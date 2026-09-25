-- ════════════════════════════════════════════════════════════════════
-- 131_admin_gate.sql  (총점검 09-25 — 관리자 문 잠그기)
--   ⚠ 130 과 앱 배포 뒤, 대표가 인증번호로 다시 로그인해 «토큰이 통한다»(session_whoami → is_admin true)를
--     확인한 다음에만 실행한다. 되돌리기: 맨 아래 «되돌리기» 두 줄.
--
-- 문제: 관리자 DB 함수 대부분이 p_admin_id 로 «앱이 보낸 사용자 ID» 또는 글자 'admin' 을 믿었다.
--       'admin' 을 넣으면 누구나 업체 승인·공간보증·서류 심사·정산 상태를 바꿀 수 있었고,
--       관리자 uuid 는 공개 데이터(요청의 user_id)로 알 수 있었다.
-- 고침:
--   ① _assert_admin(118 함수들이 씀) — p_admin_id 를 무시하고 «토큰의 사용자(auth.uid())»가 관리자일 때만.
--   ② PostgREST 요청 전 검사(db_pre_request) — 관리자 함수 이름(admin_* · settlement_admin_* · 테스트계정/운영자 지정 ·
--      파트너 상담 관리)으로 오는 호출은 관리자 토큰이 없으면 막는다. 함수 본문을 하나하나 고치지 않고 한 곳에서.
--      운영자 로그인(admin_verify_operator_pin)과 업체 신청자가 부르는 partner_lead_* 는 막지 않는다.
--   앱(lib/session isGuardedRpc)이 같은 목록을 토큰 연결로 보낸다.
-- 추가 전용 · 재실행 안전.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 관리자인가(토큰의 사용자)
create or replace function public._is_admin_uid(p_uid uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select p_uid is not null and exists (select 1 from public.users u where u.id = p_uid and u.role = 'admin');
$$;
revoke execute on function public._is_admin_uid(uuid) from public, anon, authenticated;

-- ① 118 의 관리자 확인 — 토큰으로만
create or replace function public._assert_admin(p_admin_id text)
returns uuid language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if public._is_admin_uid(auth.uid()) then return auth.uid(); end if;
  raise exception 'ADMIN_ONLY';
end; $$;
revoke execute on function public._assert_admin(text) from public, anon, authenticated;

-- 관리자 함수 이름인가(앱 src/lib/session.js isGuardedRpc 와 같은 목록)
create or replace function public._is_guarded_rpc(p_fn text)
returns boolean language sql immutable as $$
  select p_fn <> 'admin_verify_operator_pin' and (
       p_fn like 'admin\_%'
    or p_fn like 'settlement\_admin\_%'
    or p_fn in ('list_test_accounts','partner_leads_list','partner_lead_set_status','partner_lead_set_archive',
                'partner_lead_onboarding_set','set_user_operator_by_phone','set_user_test_account_by_phone',
                'unset_user_operator','unset_user_test_account')
  );
$$;

-- ② 요청 전 검사 — 관리자 함수 호출만 본다. 그 밖의 요청은 곧바로 통과(빠르게, 절대 실패하지 않게).
create or replace function public.gm_pre_request()
returns void language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_path text; v_fn text;
begin
  v_path := coalesce(current_setting('request.path', true), '');
  if v_path not like '/rpc/%' then return; end if;
  v_fn := split_part(substr(v_path, 6), '?', 1);
  if not public._is_guarded_rpc(v_fn) then return; end if;
  if public._is_admin_uid(auth.uid()) then return; end if;
  raise exception 'ADMIN_ONLY: 관리자 인증이 필요해요 — 인증번호로 다시 로그인해 주세요'
    using errcode = '42501';
end; $$;
grant execute on function public.gm_pre_request() to anon, authenticated;

alter role authenticator set pgrst.db_pre_request to 'public.gm_pre_request';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- 확인: 셋 다 true 면 끝
select
  public._is_guarded_rpc('admin_review_company')           as gate_admin_ok,
  not public._is_guarded_rpc('admin_verify_operator_pin')  as gate_operator_login_open,
  not public._is_guarded_rpc('partner_lead_submit')        as gate_applicant_open;

-- 되돌리기(문제가 생기면 이 두 줄):
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';
