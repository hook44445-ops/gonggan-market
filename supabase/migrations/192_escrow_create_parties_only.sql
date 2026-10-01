-- ============================================================
--  Migration 192: 계약(에스크로) 만들기 — 요청 주인 · 그 요청에 입찰한 업체 · 서버(결제 확인)만
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(escrow_get_or_create 를 로그인 토큰으로 부르는 버전) → 이 SQL.
--
--  왜(10-01 점검):
--    · escrow_get_or_create(036)는 정의자 권한 + anon 실행 + 확인 없음 — 로그인 안 한 누구나 남의 요청 ID 로
--      «입금됨(deposited) · CONTRACTED» 계약을 아무 업체·금액으로 만들 수 있었다.
--      그 뒤 request_mark_in_progress(105)가 그 계약을 보고 요청을 «공사 중»으로 바꾸고
--      selected_company_id 를 그 업체로 채운다 → 남의 견적 요청을 가로챌 수 있었다.
--      (137 이 표 직접 쓰기를 닫았지만 이 함수는 «서버 함수라» 그대로 열려 있었다)
--  바꾼 뒤
--    · 서버 키(service_role — /api/confirm-payment 결제 확인)는 그대로
--    · 그 밖에는 로그인 토큰 필요(없으면 42501 LOGIN_REQUIRED) — 그리고 아래 중 하나일 때만:
--        요청 주인(requests.user_id) · 관리자 ·
--        그 요청에 입찰했거나 선택된 업체의 주인(넘긴 p_company_id 가 그 업체일 때)
--      아니면 {"error":"NOT_PARTY"} 를 돌려주고 아무것도 만들지 않는다(앱은 row 가 없으면 진행하지 않는다)
--    · 이미 있는 계약을 돌려주는 동작 · 동시 진입 잠금 · 만드는 값은 036 그대로
--  되돌리기: 036 의 escrow_get_or_create 를 다시 실행하고 «grant execute … to anon» 을 다시 준다.
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.escrow_get_or_create(
  p_request_id uuid, p_company_id uuid, p_total_amount integer
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_row    public.escrow_payments;
  v_uid    uuid := auth.uid();
  v_claims jsonb;
  v_server boolean := false;
  v_req    record;
begin
  if p_request_id is null then raise exception 'NO_REQUEST_ID'; end if;

  -- 192: 누가 부르는가 — 서버 키 · 요청 주인 · 관리자 · 입찰(선택) 업체 주인만
  begin v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb; exception when others then v_claims := null; end;
  v_server := coalesce(v_claims ->> 'role', current_setting('request.jwt.claim.role', true), '') = 'service_role';
  if not v_server then
    if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
    select r.user_id, r.selected_company_id into v_req from public.requests r where r.id = p_request_id;
    if not (
         v_uid = v_req.user_id
      or coalesce(public.is_admin(), false)
      or exists (
           select 1 from public.companies c
            where c.owner_id = v_uid
              and (p_company_id is null or p_company_id = c.id or p_company_id = c.owner_id)
              and (v_req.selected_company_id in (c.id, c.owner_id)
                   or exists (select 1 from public.bids b
                               where b.request_id = p_request_id and b.company_id in (c.id, c.owner_id))))
    ) then
      return jsonb_build_object('error', 'NOT_PARTY');
    end if;
  end if;

  -- 같은 요청에 대한 동시 진입을 직렬화(트랜잭션 종료 시 자동 해제)
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  select * into v_row from public.escrow_payments
   where request_id = p_request_id
     and transaction_status not in ('CANCELLED', 'SETTLED')
   order by created_at desc
   limit 1;

  if v_row.id is not null then
    return jsonb_build_object('row', to_jsonb(v_row), 'created', false);
  end if;

  insert into public.escrow_payments (
    request_id, company_id, total_amount,
    transaction_status, status, current_step, step1_deposited_at, created_at, updated_at
  ) values (
    p_request_id, p_company_id, coalesce(p_total_amount, 0),
    'CONTRACTED', 'deposited', 1, now(), now(), now()
  )
  returning * into v_row;

  return jsonb_build_object('row', to_jsonb(v_row), 'created', true);
end; $$;

revoke execute on function public.escrow_get_or_create(uuid, uuid, integer) from public, anon;
grant execute on function public.escrow_get_or_create(uuid, uuid, integer) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① parties_only: 함수가 서버 키 · 요청 주인 · 입찰 업체만 받는다
--  ② no_anon: 로그인 안 한 사람(anon)은 부를 수 없다
select
  position('NOT_PARTY' in pg_get_functiondef('public.escrow_get_or_create(uuid,uuid,integer)'::regprocedure)) > 0
  and position('service_role' in pg_get_functiondef('public.escrow_get_or_create(uuid,uuid,integer)'::regprocedure)) > 0 as parties_only,
  not has_function_privilege('anon', 'public.escrow_get_or_create(uuid,uuid,integer)', 'execute') as no_anon;
