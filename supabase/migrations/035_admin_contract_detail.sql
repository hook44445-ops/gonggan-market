-- ════════════════════════════════════════════════════════════════════
-- 035_admin_contract_detail.sql  (4차 PR — 관리자 정산/분쟁 통합 화면)
-- 관리자가 한 화면에서 원계약 결제·추가견적 결제·정산·GPS 현장기록·분쟁을
-- 확인할 수 있도록, 계약 단위 통합 조회 RPC 를 제공한다.
--
-- 원칙:
--   · 읽기 전용 집계. 돈 이동/상태 변경 없음(자동 송금/환불/정산 금지).
--   · role='admin' 만 조회. operator(라운지 운영자)·anon 직접 select 차단.
--   · 기존 테이블/컬럼 재사용 — 신규 스키마 없음. security-definer 로 RLS 우회 조회.
--
-- 반환(jsonb): { request, escrow, company, customer, payment_orders,
--               payment_transactions, payouts, checkpoints, change_orders }
--   · 분쟁 정보는 escrow(dispute_status/dispute_reason/disputed_at)에 포함.
--   · payment_orders 는 원계약/추가견적(payment_source) 모두 — 화면에서 분리 표시.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(034 다음).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.admin_contract_detail(
  p_admin_id    uuid,
  p_request_id  uuid default null,
  p_contract_id uuid default null
) returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  v_escrow  public.escrow_payments;
  v_req_id  uuid;
  v_esc_id  uuid;
  v_request public.requests;
begin
  -- 관리자 검증 — operator/anon 차단.
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  -- 계약(에스크로) 해석: contract_id 우선, 없으면 request_id 기준 최신 1건.
  if p_contract_id is not null then
    select * into v_escrow from public.escrow_payments where id = p_contract_id;
  elsif p_request_id is not null then
    select * into v_escrow from public.escrow_payments
     where request_id = p_request_id order by created_at desc limit 1;
  end if;

  v_esc_id := v_escrow.id;
  v_req_id := coalesce(v_escrow.request_id, p_request_id);
  if v_req_id is not null then
    select * into v_request from public.requests where id = v_req_id;
  end if;

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'escrow',  to_jsonb(v_escrow),
    'company', (
      select jsonb_build_object('id', c.id, 'name', c.name, 'owner_id', c.owner_id)
        from public.companies c where c.id = v_escrow.company_id
    ),
    'customer', (
      select jsonb_build_object('id', u.id, 'name', u.name, 'phone', u.phone)
        from public.users u where u.id = v_request.user_id
    ),
    'payment_orders', coalesce((
      select jsonb_agg(to_jsonb(po) order by po.created_at)
        from public.payment_orders po
       where (v_esc_id is not null and po.contract_id = v_esc_id)
          or (v_req_id is not null and po.request_id = v_req_id)
    ), '[]'::jsonb),
    'payment_transactions', coalesce((
      select jsonb_agg(to_jsonb(pt) order by pt.created_at)
        from public.payment_transactions pt
        join public.payment_orders po2 on po2.id = pt.payment_order_id
       where (v_esc_id is not null and po2.contract_id = v_esc_id)
          or (v_req_id is not null and po2.request_id = v_req_id)
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(to_jsonb(pay) order by pay.stage)
        from public.escrow_payouts pay where pay.escrow_id = v_esc_id
    ), '[]'::jsonb),
    'checkpoints', coalesce((
      select jsonb_agg(to_jsonb(cp) order by cp.captured_at)
        from public.project_checkpoints cp where cp.request_id = v_req_id
    ), '[]'::jsonb),
    'change_orders', coalesce((
      select jsonb_agg(to_jsonb(co) order by co.created_at desc)
        from public.change_orders co where co.contract_id = v_esc_id
    ), '[]'::jsonb)
  );
end; $$;

grant execute on function public.admin_contract_detail(uuid, uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
