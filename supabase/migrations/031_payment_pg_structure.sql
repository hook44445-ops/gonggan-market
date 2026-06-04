-- ════════════════════════════════════════════════════════════════════
-- 031_payment_pg_structure.sql  (2차 PR — 결제/PG 확장 구조)
-- TossPayments 중심 구조를 유지하되, 향후 NICE·KB·카카오페이·네이버페이
-- 확장이 가능하도록 provider / payment_method 를 데이터 모델에서 분리하고,
-- 수수료를 코드 하드코딩(3.7%)이 아닌 payment_fee_rules 로 운영한다.
--
-- 원칙(유지):
--   · 자동 송금·자동 환불·자동 정산 금지 — 본 마이그레이션은 구조(스키마)만 추가.
--   · 물리 삭제 없음 / 추가 전용 / 멱등(idempotent) — 재실행 안전.
--   · 기존 payment_orders·payment_transactions·escrow_payouts 행/컬럼 보존
--     (add column if not exists 만 사용).
--   · 실제 연동은 TOSS 만. NICE/KB 는 코드 어댑터 placeholder, 카카오/네이버페이는
--     수단 선택지·수수료행만 준비(is_active=false), 실제 결제는 가맹 승인 후 별도 PR.
--
-- Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1) payment_fee_rules — 결제수단별 수수료 정책 ─────────────────────
--   수수료는 결제수단마다 다를 수 있으므로 3.7% 를 코드에 박지 않는다.
--   fee_rate(비율) + fixed_fee(고정, 원) + is_active(실연동 여부) 로 운영.
create table if not exists public.payment_fee_rules (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null,                 -- TOSS | NICE | KB
  payment_method text not null,                 -- CARD | TRANSFER | VIRTUAL_ACCOUNT | KAKAO_PAY | NAVER_PAY
  fee_rate       numeric(6,5) not null default 0,   -- 0.03700 = 3.7%
  fixed_fee      integer      not null default 0,   -- 건당 고정 수수료(원)
  is_active      boolean      not null default false,
  note           text,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),
  unique (provider, payment_method)
);

-- 초기 임시 기본값(관리자에서 추후 수정 가능). 실연동은 TOSS·CARD/TRANSFER/VIRTUAL_ACCOUNT 만 active.
-- on conflict do nothing → 운영자가 값을 바꾼 뒤 재실행해도 덮어쓰지 않음.
insert into public.payment_fee_rules (provider, payment_method, fee_rate, fixed_fee, is_active, note) values
  ('TOSS','CARD',            0.03700, 0, true,  '임시 기본값 — 추후 계약요율로 조정'),
  ('TOSS','TRANSFER',        0.03700, 0, true,  '임시 기본값 — 추후 계약요율로 조정'),
  ('TOSS','VIRTUAL_ACCOUNT', 0.03700, 0, true,  '임시 기본값 — 추후 계약요율로 조정'),
  ('TOSS','KAKAO_PAY',       0.03700, 0, false, '준비중 — 가맹 승인 후 실요율 적용'),
  ('TOSS','NAVER_PAY',       0.03700, 0, false, '준비중 — 가맹 승인 후 실요율 적용')
on conflict (provider, payment_method) do nothing;

alter table public.payment_fee_rules enable row level security;
drop policy if exists "payment_fee_rules: public read" on public.payment_fee_rules;
create policy "payment_fee_rules: public read" on public.payment_fee_rules
  for select using (true);
-- 쓰기 정책 없음 → anon/authenticated 수정 불가(service_role/SQL/관리자 RPC 만).

-- ── 2) payment_orders — provider/payment_method 분리 + 확장 컬럼 ──────
--   기존 컬럼(amount, payment_method, status, total_amount …) 보존, 누락분만 추가.
alter table public.payment_orders
  add column if not exists provider        text   not null default 'TOSS',
  add column if not exists fee_amount       numeric,
  add column if not exists net_amount       numeric,
  add column if not exists order_id         text,        -- PG 주문번호(orderId)
  add column if not exists payment_key      text,        -- PG paymentKey
  add column if not exists raw_response     jsonb,
  add column if not exists paid_at          timestamptz,
  -- 3차 PR(추가견적 결제)에서 사용할 확장 슬롯 — 지금은 구조만 준비.
  add column if not exists payment_source   text   not null default 'original',  -- original | change_order
  add column if not exists change_order_id  uuid;

-- ── 3) payment_transactions — provider/payment_method 정렬 컬럼 추가 ──
--   기존(pg_provider, pg_payment_key, method …) 보존, 표준 컬럼만 추가.
alter table public.payment_transactions
  add column if not exists provider       text,
  add column if not exists payment_method text;

-- ── 4) escrow_payouts — 지급 추적 컬럼(수동지급 연결) ────────────────
--   status 는 기존 자유값(PENDING/READY/APPROVED/HELD …)에 더해 'MANUAL_PAID'(관리자
--   수동지급완료)를 운영값으로 사용. CHECK 제약이 없으므로 별도 변경 불필요.
alter table public.escrow_payouts
  add column if not exists payment_order_id uuid,
  add column if not exists paid_at          timestamptz;

-- ── 5) payment_calc_fee — 결제수단 수수료 계산 헬퍼(읽기 전용) ───────
--   프론트/서버 공통으로 수수료를 코드에 박지 않고 규칙에서 산출.
create or replace function public.payment_calc_fee(
  p_provider text,
  p_method   text,
  p_amount   numeric
) returns jsonb language plpgsql stable
set search_path = public, extensions as $$
declare r public.payment_fee_rules; v_fee numeric;
begin
  select * into r from public.payment_fee_rules
   where provider = p_provider and payment_method = p_method and is_active
   limit 1;
  if not found then
    return jsonb_build_object('found', false, 'fee_rate', null, 'fixed_fee', 0,
                              'fee_amount', null, 'net_amount', null);
  end if;
  v_fee := round(p_amount * r.fee_rate) + r.fixed_fee;
  return jsonb_build_object('found', true, 'fee_rate', r.fee_rate, 'fixed_fee', r.fixed_fee,
                            'fee_amount', v_fee, 'net_amount', p_amount - v_fee);
end; $$;

grant execute on function public.payment_calc_fee(text, text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';
