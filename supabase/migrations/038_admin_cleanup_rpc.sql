-- ════════════════════════════════════════════════════════════════════
-- 038_admin_cleanup_rpc.sql
-- 관리자 강제 정리(테스트/꼬인 거래) — security-definer RPC.
--   · role='admin' 만 실행(operator/일반 불가) — 기존 어드민 RPC 패턴(ADMIN_ONLY) 동일.
--   · mode='soft_cancel'           : 상태 변경(취소/숨김)만. 운영 안전 기본값.
--     mode='hard_delete_test_only' : 행 삭제(테스트 전용). UI 확인 모달 필수.
--   · 모든 실행은 admin_logs 에 before/after 스냅샷과 함께 기록.
--   · 계정(users/companies)은 절대 삭제하지 않음.
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 내부: request_id 묶음 정리(soft/hard). 각 테이블은 예외 격리(스키마 차이 안전). ──
create or replace function public._admin_cleanup_request_ids(p_ids uuid[], p_mode text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;

  if p_mode = 'hard_delete_test_only' then
    begin delete from public.project_checkpoints where request_id = any(p_ids)
            or contract_id in (select id from public.escrow_payments where request_id = any(p_ids)); exception when others then null; end;
    begin delete from public.estimates where request_id = any(p_ids)
            or site_visit_id in (select id from public.site_visits where request_id = any(p_ids)); exception when others then null; end;
    begin delete from public.change_orders where contract_id in (select id from public.escrow_payments where request_id = any(p_ids)); exception when others then null; end;
    begin delete from public.escrow_payouts where contract_id in (select id from public.escrow_payments where request_id = any(p_ids)); exception when others then null; end;
    begin delete from public.payment_transactions where order_id in (select id from public.payment_orders where request_id = any(p_ids)); exception when others then null; end;
    begin delete from public.payment_orders where request_id = any(p_ids); exception when others then null; end;
    begin delete from public.escrow_payments where request_id = any(p_ids); exception when others then null; end;
    begin delete from public.site_visits where request_id = any(p_ids); exception when others then null; end;
    begin delete from public.bids where request_id = any(p_ids); exception when others then null; end;
    begin delete from public.requests where id = any(p_ids); exception when others then null; end;
  else
    begin update public.requests set status = 'cancelled', selected_company_id = null,
             selected_bid_id = null, is_hidden = true, updated_at = now()
           where id = any(p_ids); exception when others then null; end;
    begin update public.bids set selected = false where request_id = any(p_ids); exception when others then null; end;
    begin update public.escrow_payments set transaction_status = 'CANCELLED', status = 'cancelled',
             updated_at = now() where request_id = any(p_ids); exception when others then null; end;
    begin update public.site_visits set status = 'cancelled', updated_at = now()
           where request_id = any(p_ids); exception when others then null; end;
    begin update public.change_orders set status = 'cancelled', updated_at = now()
           where contract_id in (select id from public.escrow_payments where request_id = any(p_ids)); exception when others then null; end;
    begin update public.escrow_payouts set status = 'CANCELLED'
           where contract_id in (select id from public.escrow_payments where request_id = any(p_ids)); exception when others then null; end;
    begin update public.payment_orders set status = 'cancelled'
           where request_id = any(p_ids); exception when others then null; end;
  end if;
end; $$;

-- ── 내부: request_id 묶음 카운트 스냅샷(JSON) ──
create or replace function public._admin_cleanup_snapshot(p_ids uuid[])
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v jsonb := '{}'::jsonb; n int;
begin
  if p_ids is null then return v; end if;
  begin select count(*) into n from public.requests where id = any(p_ids); v := v || jsonb_build_object('requests', n); exception when others then null; end;
  begin select count(*) into n from public.bids where request_id = any(p_ids); v := v || jsonb_build_object('bids', n); exception when others then null; end;
  begin select count(*) into n from public.escrow_payments where request_id = any(p_ids); v := v || jsonb_build_object('escrow_payments', n); exception when others then null; end;
  begin select count(*) into n from public.site_visits where request_id = any(p_ids); v := v || jsonb_build_object('site_visits', n); exception when others then null; end;
  return v;
end; $$;

-- ── 내부: admin 검증 + 실행 + 로깅 공통 ──
create or replace function public._admin_cleanup_exec(
  p_admin_id uuid, p_ids uuid[], p_mode text, p_target_type text, p_target_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_before jsonb; v_after jsonb;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  if p_mode not in ('soft_cancel', 'hard_delete_test_only') then
    raise exception 'BAD_MODE';
  end if;

  v_before := public._admin_cleanup_snapshot(p_ids);
  perform public._admin_cleanup_request_ids(p_ids, p_mode);
  v_after := public._admin_cleanup_snapshot(p_ids);

  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, reason)
    values (p_admin_id, 'CLEANUP_' || upper(p_mode), p_target_type, p_target_id,
            jsonb_build_object('mode', p_mode, 'request_count', coalesce(array_length(p_ids,1),0),
                               'before', v_before, 'after', v_after)::text);
  exception when others then null; end;

  return jsonb_build_object('ok', true, 'mode', p_mode,
    'request_count', coalesce(array_length(p_ids,1),0), 'before', v_before, 'after', v_after);
end; $$;

-- ── 1) request 단위 ──
create or replace function public.admin_cleanup_request(p_admin_id uuid, p_request_id uuid, p_mode text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
begin
  return public._admin_cleanup_exec(p_admin_id, array[p_request_id], p_mode, 'report', p_request_id);
end; $$;

-- ── 2) user 단위(의뢰인이 만든 요청 전체) ──
create or replace function public.admin_cleanup_user_test_data(p_admin_id uuid, p_user_id uuid, p_mode text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.requests where user_id = p_user_id;
  return public._admin_cleanup_exec(p_admin_id, v_ids, p_mode, 'user', p_user_id);
end; $$;

-- ── 3) company 단위(선택/입찰/에스크로로 엮인 요청) ──
create or replace function public.admin_cleanup_company_test_data(p_admin_id uuid, p_company_id uuid, p_mode text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_ids uuid[];
begin
  select array_agg(distinct rid) into v_ids from (
    select id as rid from public.requests where selected_company_id = p_company_id
    union select request_id from public.escrow_payments where company_id = p_company_id
    union select request_id from public.bids where company_id = p_company_id
  ) s where rid is not null;
  return public._admin_cleanup_exec(p_admin_id, v_ids, p_mode, 'company', p_company_id);
end; $$;

grant execute on function public.admin_cleanup_request(uuid,uuid,text)            to anon, authenticated;
grant execute on function public.admin_cleanup_user_test_data(uuid,uuid,text)     to anon, authenticated;
grant execute on function public.admin_cleanup_company_test_data(uuid,uuid,text)  to anon, authenticated;

notify pgrst, 'reload schema';
