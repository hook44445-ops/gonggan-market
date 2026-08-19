-- ════════════════════════════════════════════════════════════════════
-- 099_space_token_purchase.sql  (라운지 공간토큰 실결제 연동)
--
-- 공간라운지의 공간토큰 스토어 구매를 실제 토스페이먼츠 결제와 연결한다.
-- 프론트(TokenStoreScreen → MainApp)는 토스 결제창 성공(successUrl) 후
-- /api/confirm-payment 로 승인 검증을 마친 뒤 이 RPC 를 1회 호출한다.
--
-- 원칙(기존 결제 구조와 동일하게 유지):
--   · 자동 송금·자동 정산 없음 — 이 RPC 는 "구매 기록 + 토큰 적립"만 한다.
--   · 멱등(idempotent) — 같은 order_id 재호출 시 재적립/중복 주문 생성 금지
--     (토스 리다이렉트 복귀가 중복 처리돼도 안전).
--   · 추가 전용 — 기존 테이블/컬럼/행 변경 없음.
--   · space_token_logs 실제 컬럼 (user_id, amount, type, description, related_id,
--     created_at) 만 사용한다('action' 컬럼은 존재하지 않음 — 086 참고).
--   · RLS 우회를 위해 security definer. 앱은 전화번호 OTP + localStorage 세션이라
--     auth.uid() 가 NULL 이므로, 결제 기록/적립은 반드시 정의자 권한 RPC 로 처리.
--
-- Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.purchase_space_tokens(
  p_user_id     uuid,
  p_tokens      integer,
  p_price       integer,
  p_order_id    text,
  p_payment_key text,
  p_method      text,
  p_description text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_existing_order uuid;
  v_order_id       uuid;
  v_balance        integer;
begin
  -- 입력 검증 — 잘못된 값이면 적립·기록 없이 반환.
  if p_user_id is null then
    return jsonb_build_object('error', 'MISSING_USER');
  end if;
  if coalesce(p_tokens, 0) <= 0 or coalesce(p_price, 0) <= 0 then
    return jsonb_build_object('error', 'INVALID_AMOUNT');
  end if;
  if p_order_id is null or length(p_order_id) = 0 then
    return jsonb_build_object('error', 'MISSING_ORDER_ID');
  end if;

  -- 멱등 가드 — 같은 order_id 의 토큰 주문이 이미 있으면 재처리하지 않는다.
  select id into v_existing_order
    from public.payment_orders
   where order_id = p_order_id and payment_source = 'token'
   limit 1;

  if v_existing_order is not null then
    select balance into v_balance from public.space_tokens where user_id = p_user_id;
    return jsonb_build_object(
      'status',  'already_processed',
      'order_id', v_existing_order,
      'balance',  coalesce(v_balance, 0)
    );
  end if;

  -- 1) 주문 기록 (payment_orders) — 토큰 구매는 request/bid/contract 무관(null).
  insert into public.payment_orders (
    user_id, amount, customer_fee, vat, total_amount, payment_method,
    status, provider, payment_source, order_id, payment_key, paid_at, raw_response
  ) values (
    p_user_id, p_price, 0, 0, p_price, coalesce(p_method, 'CARD'),
    'PAID', 'TOSS', 'token', p_order_id, p_payment_key, now(),
    jsonb_build_object('tokens', p_tokens, 'description', p_description)
  )
  returning id into v_order_id;

  -- 2) 결제 트랜잭션 기록 (payment_transactions)
  insert into public.payment_transactions (
    payment_order_id, pg_provider, pg_payment_key, provider, payment_method,
    method, amount, status, approved_at, raw_response
  ) values (
    v_order_id, 'toss', p_payment_key, 'TOSS', coalesce(p_method, 'CARD'),
    coalesce(p_method, 'CARD'), p_price, 'DONE', now(),
    jsonb_build_object('order_id', p_order_id, 'tokens', p_tokens)
  );

  -- 3) 토큰 적립 (space_tokens) — 상대 증가(원자적). 행이 없으면 앱 기본값 20 + 구매분.
  update public.space_tokens
     set balance = balance + p_tokens
   where user_id = p_user_id
  returning balance into v_balance;

  if not found then
    v_balance := 20 + p_tokens;  -- useSpaceToken 기본 잔액(20)과 동일하게 보존
    insert into public.space_tokens (user_id, balance)
    values (p_user_id, v_balance);
  end if;

  -- 4) 원장 기록 (space_token_logs) — 실제 컬럼만 사용. 구매는 적립(earn, +)으로 표시.
  insert into public.space_token_logs (user_id, amount, type, description)
  values (p_user_id, p_tokens, 'earn',
          coalesce(p_description, '공간토큰 ' || p_tokens::text || '개 구매'));

  return jsonb_build_object(
    'status',   'credited',
    'order_id',  v_order_id,
    'tokens',    p_tokens,
    'balance',   v_balance
  );
end;
$$;

grant execute on function public.purchase_space_tokens(uuid, integer, integer, text, text, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
