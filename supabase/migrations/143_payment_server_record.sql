-- ============================================================
--  Migration 143: 결제 기록은 서버만 — 공짜 토큰 구멍 닫기 · 주문번호 한 번만 · 금액 소수
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  순서: 같은 PR 앱 배포 «뒤»에 실행(앱 배포 전엔 옛 앱이 토큰 적립 함수를 직접 부른다 — 지금은 결제가 꺼져 있어 실제 영향은 없음).
--
--  09-26 «결제 열기 준비» 점검에서 나온 것
--    ① purchase_space_tokens(사용자, 토큰 수, 가격, 주문번호 …) 를 로그인 없이 누구나 부를 수 있었다(099 가 anon 에 열어 둠)
--       → 아무 사용자에게 아무 수의 토큰을 «구매»로 적립할 수 있었다. 이제 서버(api/confirm-payment)만 부른다 —
--       토스 승인 뒤, 로그인 토큰의 본인에게, 상품표의 토큰 수로.
--    ② 같은 주문번호가 두 번 기록되지 않게(복귀 화면 새로고침·동시 요청) — payment_orders.order_id 유일.
--       이미 겹친 주문번호가 있으면 색인을 만들지 않고 아래 확인 칸이 false(대표에게 알림 → 정리 뒤 다시 실행).
--    ③ 금액 칸(amount·customer_fee·vat·total_amount)을 소수 허용(numeric)으로 — 앱 금액은 만원 단위 소수 1자리(예: 247.2)라
--       정수 칸에 넣으면 기록이 실패했다.
--    ⓪ (09-26 실행 중 발견) 운영 payment_orders 에 order_id 칸이 없었다 — 42703 column "order_id" does not exist.
--       이 칸들은 031 이 만들게 돼 있었는데 운영엔 031 이 실행되지 않았다. 그래서 토큰 구매 함수(099)와
--       새 결제 서버(api/confirm-payment, #776)가 모두 «없는 칸»에 쓰고 있었다(결제가 닫혀 있어 아직 피해 없음).
--       → 031 의 «칸 추가» 부분을 여기서 먼저 한다(add column if not exists — 있는 칸은 그대로).
--  확인 칸 4개(아래 select) — 넷 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- ⓪ 결제 기록 칸(031 에 있던 것) — 없으면 만든다
alter table public.payment_orders
  add column if not exists provider        text   not null default 'TOSS',
  add column if not exists fee_amount       numeric,
  add column if not exists net_amount       numeric,
  add column if not exists order_id         text,        -- 토스 주문번호(orderId)
  add column if not exists payment_key      text,        -- 토스 paymentKey(취소·환불에 필요)
  add column if not exists raw_response     jsonb,
  add column if not exists paid_at          timestamptz,
  add column if not exists payment_source   text   not null default 'original',  -- original | change_order | token
  add column if not exists change_order_id  uuid;

alter table public.payment_transactions
  add column if not exists provider       text,
  add column if not exists payment_method text;

-- ① 토큰 적립 함수 — 서버만
revoke execute on function public.purchase_space_tokens(uuid, integer, integer, text, text, text, text) from public, anon, authenticated;
grant  execute on function public.purchase_space_tokens(uuid, integer, integer, text, text, text, text) to service_role;

-- ② 주문번호 한 번만(겹친 게 없을 때만 만든다)
do $$
begin
  if not exists (
    select 1 from public.payment_orders where order_id is not null group by order_id having count(*) > 1
  ) then
    create unique index if not exists payment_orders_order_id_uq on public.payment_orders (order_id) where order_id is not null;
  end if;
end $$;

-- ③ 금액 칸 소수 허용(이미 numeric 이면 그대로)
do $$
declare c text;
begin
  foreach c in array array['amount', 'customer_fee', 'vat', 'total_amount'] loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'payment_orders' and column_name = c and data_type = 'integer') then
      execute format('alter table public.payment_orders alter column %I type numeric', c);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- 확인: 넷 다 true 면 끝
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'payment_orders' and column_name = 'payment_key')                  as order_columns_ok,
  not has_function_privilege('anon', 'public.purchase_space_tokens(uuid, integer, integer, text, text, text, text)', 'execute') as token_fn_closed_ok,
  exists (select 1 from pg_indexes where indexname = 'payment_orders_order_id_uq')                                                  as order_id_unique_ok,
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'payment_orders' and column_name = 'total_amount') = 'numeric'                   as amount_decimal_ok;
