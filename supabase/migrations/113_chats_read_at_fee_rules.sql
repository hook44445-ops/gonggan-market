-- ════════════════════════════════════════════════════════════════════
-- 113_chats_read_at_fee_rules.sql  (총점검 09-24 · C25)
--
-- ① 대화 안읽음·읽음 처리가 운영에서 늘 실패한다.
--    운영 chats 표에 read_at 칸이 없다(42703 "column chats.read_at does not exist").
--    → 대화 목록 안읽음 숫자 조회(400)와 읽음 처리 함수 chat_mark_room_read(066)가 매번 실패.
--    066 은 「read_at 이 이미 있다」고 보고 칸을 만들지 않았다.
--    고침: 칸만 추가(기존 메시지는 읽음 표시 없음 = null). 안읽음 조회용 인덱스.
--
-- ② 결제 수수료 규칙 표(payment_fee_rules, 031 ①)가 운영에 없다(404 PGRST205).
--    앱은 없으면 같은 값(3.7%)으로 대신 계산하므로 동작은 같다 — 콘솔 404 만 없앤다.
--    031 ①과 같은 내용(멱등). 값을 바꾼 적이 있으면 덮어쓰지 않는다(on conflict do nothing).
--
-- 추가 전용 · 재실행 안전. Supabase SQL Editor 에서 한 번 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ① chats.read_at
alter table public.chats add column if not exists read_at timestamptz;

create index if not exists chats_room_unread_idx
  on public.chats (room_id)
  where read_at is null;

-- ② payment_fee_rules (031 ① 그대로)
create table if not exists public.payment_fee_rules (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null,
  payment_method text not null,
  fee_rate       numeric(6,5) not null default 0,
  fixed_fee      integer      not null default 0,
  is_active      boolean      not null default false,
  note           text,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),
  unique (provider, payment_method)
);

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

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'chats' and column_name = 'read_at') as chats_read_at,
  exists (select 1 from public.payment_fee_rules where provider = 'TOSS' and payment_method = 'CARD') as fee_rules_ok;
