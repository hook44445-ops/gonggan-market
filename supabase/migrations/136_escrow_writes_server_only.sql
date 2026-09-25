-- ============================================================
--  Migration 136: 에스크로 쓰기 서버 함수 (E20 1/2 · 결제 열기 전 필수 · 131 뒤)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  순서: ① 이 136(함수만 추가 — 옛 앱은 그대로 동작) → ② 앱 배포(이 함수들을 부름) → ③ 137(표 직접 쓰기 닫기).
--
--  문제(8차 4-3 · 점검 6차 확인)
--    escrow_payments · escrow_payouts · phase_photos 정책이 사실상 «누구나 쓰기(ALL:public)».
--    앱이 지급 승인·단계 전환·정산 완료(SETTLED)·이의 신청·지급 줄 생성을 표에 직접 쓴다
--    → 앱을 조작하면 남의 공사를 «완료·정산»으로 바꾸거나 지급을 승인할 수 있다.
--  고침
--    · escrow_action(계약, 동작, 단계, 값) — 당사자는 «로그인 토큰의 사용자(auth.uid())»로만 판단한다(앱이 보낸 ID 는 안 믿음).
--        company_report   업체: 단계 사진 보고(착공 3 · 중간 4 · 완료 5) → 상태·단계 + 지급 줄 READY
--        customer_approve 고객: 단계 승인 → 지급 줄 APPROVED + stepN 승인 + (완료면) SETTLED·요청 완료
--        dispute          고객·업체: 이의 신청 → 미지급 줄 HELD · DISPUTE
--        expected_end     고객·업체: 예상 완공일
--        create_payouts   고객·업체: 지급 줄 4개(이미 있으면 그대로) — 비율·금액은 112 트리거가 계획대로
--        rollback_delete  고객·업체: 막 만든(15분 안) 빈 계약 되돌리기(지급 승인된 줄이 없을 때만)
--    · phase_photos_add — 업체 당사자만 단계 사진 기록
--    · 관리자: admin_escrow_set_dispute · admin_payout_set_status · admin_escrow_hold_all (131 이 관리자 토큰을 요구)
--    · 표 직접 쓰기 닫기는 137(앱 배포 뒤).
--  확인 칸 2개(아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 계약 한 건의 당사자 판정(토큰의 사용자) — 고객·업체·관리자를 «각각» 본다
--   (한 사람이 고객이자 업체일 수 있다 — 점검 계정처럼. 하나만 고르면 업체 보고가 «고객»으로 막힌다)
drop function if exists public._escrow_party(public.escrow_payments) cascade;
create or replace function public._escrow_party(p_escrow public.escrow_payments)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_customer uuid; v_owner uuid;
begin
  if v_uid is null then return null; end if;
  select r.user_id into v_customer from public.requests r where r.id = p_escrow.request_id;
  select c.owner_id into v_owner from public.companies c
   where c.id = p_escrow.company_id or c.owner_id = p_escrow.company_id
   order by (c.id = p_escrow.company_id) desc limit 1;
  return jsonb_build_object(
    'customer', v_uid = v_customer,
    'company',  (v_uid = v_owner or v_uid = p_escrow.company_id),
    'admin',    exists (select 1 from public.users u where u.id = v_uid and u.role = 'admin'));
end; $$;
revoke execute on function public._escrow_party(public.escrow_payments) from public, anon, authenticated;

create or replace function public.escrow_action(p_escrow_id uuid, p_action text, p_stage int default null, p_value text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  e        public.escrow_payments;
  v_party  jsonb;
  v_cust   boolean;
  v_comp   boolean;
  v_tx     text;
  v_cur    int;
  v_pstage int;
  v_row    public.escrow_payouts;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'LOGIN_REQUIRED'); end if;
  select * into e from public.escrow_payments where id = p_escrow_id;
  if e.id is null then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  v_party := public._escrow_party(e);
  v_cust  := coalesce((v_party ->> 'customer')::boolean, false) or coalesce((v_party ->> 'admin')::boolean, false);
  v_comp  := coalesce((v_party ->> 'company')::boolean, false)  or coalesce((v_party ->> 'admin')::boolean, false);
  if not (v_cust or v_comp) then return jsonb_build_object('error', 'NOT_PARTY'); end if;

  if p_action = 'company_report' then
    if not v_comp then return jsonb_build_object('error', 'COMPANY_ONLY'); end if;
    if p_stage not in (3, 4, 5) then return jsonb_build_object('error', 'BAD_STAGE'); end if;
    if coalesce(e.transaction_status, '') in ('DISPUTE', 'SETTLED', 'CANCELLED', 'REFUNDED') then
      return jsonb_build_object('error', 'LOCKED', 'status', e.transaction_status);
    end if;
    v_tx  := case p_stage when 3 then 'STARTED' when 4 then 'MID_INSPECTION' else 'COMPLETED' end;
    v_cur := p_stage - 1;
    update public.escrow_payments
       set transaction_status = v_tx, current_step = v_cur, photos_uploaded_at = now()
     where id = e.id;
    update public.escrow_payouts set status = 'READY'
     where escrow_id = e.id and stage = p_stage - 1 and status in ('PENDING', 'CANCELLED', 'READY');
    return jsonb_build_object('status', 'ok', 'transaction_status', v_tx, 'current_step', v_cur);

  elsif p_action = 'customer_approve' then
    if not v_cust then return jsonb_build_object('error', 'CUSTOMER_ONLY'); end if;
    if p_stage not in (3, 4, 5) then return jsonb_build_object('error', 'BAD_STAGE'); end if;
    if coalesce(e.transaction_status, '') = 'DISPUTE' then return jsonb_build_object('error', 'DISPUTE'); end if;
    v_pstage := p_stage - 1;
    select * into v_row from public.escrow_payouts where escrow_id = e.id and stage = v_pstage;
    if v_row.id is not null and v_row.status = 'HELD' then return jsonb_build_object('error', 'HELD'); end if;
    update public.escrow_payouts
       set status = 'APPROVED', approved_by = auth.uid(), approved_at = coalesce(approved_at, now())
     where escrow_id = e.id and stage = v_pstage;
    -- 고객 승인과 같은 이동(EscrowScreen advanceStage): 3→step2·다음3·MID_INSPECTION, 4→step3·다음4, 5→step4·다음5·SETTLED
    v_tx := case p_stage when 3 then 'MID_INSPECTION' when 5 then 'SETTLED' else null end;
    execute format(
      'update public.escrow_payments set step%s_approved_at = coalesce(step%s_approved_at, now()), current_step = greatest(coalesce(current_step, 0), $1)%s where id = $2',
      v_pstage, v_pstage, case when v_tx is null then '' else ', transaction_status = ' || quote_literal(v_tx) end)
      using p_stage, e.id;
    if p_stage = 5 then
      begin perform public.request_mark_completed(e.request_id); exception when others then null; end;
    end if;
    return jsonb_build_object('status', 'ok', 'transaction_status', coalesce(v_tx, e.transaction_status), 'current_step', p_stage);

  elsif p_action = 'dispute' then
    update public.escrow_payouts set status = 'HELD'
     where escrow_id = e.id and status in ('PENDING', 'READY', 'APPROVED');
    update public.escrow_payments set transaction_status = 'DISPUTE', dispute_status = 'DISPUTE_OPEN' where id = e.id;
    return jsonb_build_object('status', 'ok');

  elsif p_action = 'expected_end' then
    update public.escrow_payments set expected_end_date = nullif(p_value, '')::date where id = e.id;
    return jsonb_build_object('status', 'ok', 'expected_end_date', p_value);

  elsif p_action = 'create_payouts' then
    if exists (select 1 from public.escrow_payouts where escrow_id = e.id) then
      return jsonb_build_object('status', 'exists');
    end if;
    -- 비율·금액·상태는 112 트리거(trg_payout_apply_plan)가 계약의 지급 계획대로 채운다
    insert into public.escrow_payouts (escrow_id, company_id, stage, percent, amount, platform_fee, vat, net_amount, fee_snapshot, status)
    select e.id, e.company_id, s, 0, 0, 0, 0, 0,
           jsonb_build_object('companyFeeRate', 0.04, 'vatRate', 0.1, 'snapshotAt', now()), 'PENDING'
      from generate_series(1, 4) s;
    return jsonb_build_object('status', 'created');

  elsif p_action = 'rollback_delete' then
    if e.created_at < now() - interval '15 minutes'
       or exists (select 1 from public.escrow_payouts where escrow_id = e.id and status = 'APPROVED' and stage > 1)
       or coalesce(e.transaction_status, 'CONTRACTED') not in ('CONTRACTED', 'PAID') then
      return jsonb_build_object('error', 'CANNOT_ROLLBACK');
    end if;
    delete from public.escrow_payouts where escrow_id = e.id;
    delete from public.escrow_payments where id = e.id;
    return jsonb_build_object('status', 'deleted');
  end if;

  return jsonb_build_object('error', 'UNKNOWN_ACTION');
end; $$;
grant execute on function public.escrow_action(uuid, text, int, text) to anon, authenticated;

-- 단계 사진 기록 — 업체 당사자만
create or replace function public.phase_photos_add(p_contract_id uuid, p_step int, p_photos text[], p_caption text default null)
returns public.phase_photos language plpgsql security definer
set search_path = public, extensions as $$
declare e public.escrow_payments; v_party jsonb; v_row public.phase_photos;
begin
  select * into e from public.escrow_payments where id = p_contract_id;
  if e.id is null then raise exception 'NOT_FOUND'; end if;
  v_party := public._escrow_party(e);
  if not (coalesce((v_party ->> 'company')::boolean, false) or coalesce((v_party ->> 'admin')::boolean, false)) then
    raise exception 'COMPANY_ONLY' using errcode = '42501';
  end if;
  insert into public.phase_photos (contract_id, step, photos, uploaded_by, uploader_role, caption)
  values (e.id, p_step, coalesce(p_photos, '{}'), auth.uid(), 'company', p_caption)
  returning * into v_row;
  return v_row;
end; $$;
grant execute on function public.phase_photos_add(uuid, int, text[], text) to anon, authenticated;

-- 관리자 3종 — 131 이 admin_* 이름에 관리자 토큰을 요구한다. 안에서도 한 번 더 확인.
create or replace function public.admin_escrow_set_dispute(p_escrow_id uuid, p_resolution text, p_reason text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_prev text;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') then raise exception 'ADMIN_ONLY'; end if;
  select dispute_status into v_prev from public.escrow_payments where id = p_escrow_id;
  update public.escrow_payments set dispute_status = p_resolution where id = p_escrow_id;
  insert into public.admin_logs (admin_id, action, target_type, target_id, before_val, after_val, reason)
  values (auth.uid(), 'DISPUTE_' || p_resolution, 'dispute', p_escrow_id,
          jsonb_build_object('dispute_status', v_prev), jsonb_build_object('dispute_status', p_resolution), p_reason);
  return jsonb_build_object('id', p_escrow_id, 'dispute_status', p_resolution);
end; $$;
grant execute on function public.admin_escrow_set_dispute(uuid, text, text) to anon, authenticated;

create or replace function public.admin_payout_set_status(p_payout_id uuid, p_status text, p_reason text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_prev text;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') then raise exception 'ADMIN_ONLY'; end if;
  select status into v_prev from public.escrow_payouts where id = p_payout_id;
  update public.escrow_payouts
     set status = p_status,
         approved_by = case when p_status = 'APPROVED' then auth.uid() else approved_by end,
         approved_at = case when p_status = 'APPROVED' then now() else approved_at end
   where id = p_payout_id;
  insert into public.admin_logs (admin_id, action, target_type, target_id, before_val, after_val, reason)
  values (auth.uid(), 'SET_PAYOUT_' || p_status, 'settlement', p_payout_id,
          jsonb_build_object('status', v_prev), jsonb_build_object('status', p_status), p_reason);
  return jsonb_build_object('id', p_payout_id, 'status', p_status);
end; $$;
grant execute on function public.admin_payout_set_status(uuid, text, text) to anon, authenticated;

create or replace function public.admin_escrow_hold_all(p_escrow_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') then raise exception 'ADMIN_ONLY'; end if;
  update public.escrow_payouts set status = 'HELD'
   where escrow_id = p_escrow_id and status in ('PENDING', 'READY', 'APPROVED');
  return jsonb_build_object('status', 'ok');
end; $$;
grant execute on function public.admin_escrow_hold_all(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from pg_proc where proname = 'escrow_action')    as action_ok,
  exists (select 1 from pg_proc where proname = 'phase_photos_add') as photos_ok;
