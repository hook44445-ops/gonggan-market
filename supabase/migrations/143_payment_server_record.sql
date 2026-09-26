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
--  확인 칸 3개(아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

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

-- 확인: 셋 다 true 면 끝
select
  not has_function_privilege('anon', 'public.purchase_space_tokens(uuid, integer, integer, text, text, text, text)', 'execute') as token_fn_closed_ok,
  exists (select 1 from pg_indexes where indexname = 'payment_orders_order_id_uq')                                                  as order_id_unique_ok,
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'payment_orders' and column_name = 'total_amount') = 'numeric'                   as amount_decimal_ok;
