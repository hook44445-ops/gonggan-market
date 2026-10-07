-- ============================================================
--  Migration 205: 공정 묶음 분할 결제(10-07 대표 결정 · 특허 10-2026-0192050 청구항 14)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 지금은 실행하지 않는다 — 토스페이먼츠 회신(«한 판매 단위를 여러 결제 건으로 나눠 받는 것» 허용) 뒤 대표가 «실행».
--    실행해도 결제는 열리지 않는다: ops_config.bundle_pay_open = false(기본)면 결제 시작 함수가 NOT_OPEN 으로 거절한다.
--
--  왜
--    토스는 «1회 판매 금액 1천만 원 초과»면 입점 불가(KG이니시스도 불가, 10-07). 그래서 최종 견적서를
--    «공정 묶음»(판매 단위, 각 1천만 원 미만)으로 나눠 받는다. 한 공정이 1천만 원 이상이면 «목공 1차·2차»처럼 차수로.
--  규칙(앱 src/lib/bundlePay.js 와 같다 — 숫자를 바꾸면 둘 다)
--    · 묶음 = 견적서 순서대로, 더해도 1천만 «미만»이면 한 묶음. 1천만 이상 공정은 900만씩 차수(2,500만 → 900/900/700).
--    · 묶음 하나를 여러 번에 나눠 낸다 — 결제 1회 = 주문번호(orderId) 1개(gb_…). 가상계좌면 결제마다 새 계좌번호.
--      카드 여러 장 + 가상계좌 여러 개 섞어 내기 허용. 이번에 낼 금액은 고객이 정한다(남은 금액 이하) — 서버가 다시 잰다.
--    · 묶음이 다 채워지면 그 묶음 PAID. «모든» 묶음 PAID = 계약 확정 → 계약(escrow_payments) 생성 → 공사 시작.
--    · 업체 지급은 묶음과 무관하게 «계약 전체 금액» 기준 단계 그대로(112·120 트리거: 30/70 · 30/40/30 · 10/20/40/30 · 48시간 자동 승인).
--    · 수수료(카드 약 3.5% · 가상계좌 건당 660원)는 공간사이 부담 — 고객 금액에 더하지 않는다(여신전문금융업법 19조).
--  표
--    payment_bundles       묶음(요청당 여러 줄) — 금액은 «원», 1천만 원 미만(검사 제약)
--    payment_bundle_parts  결제 한 건(주문번호 하나) — REQUESTED → WAITING_FOR_DEPOSIT(가상계좌) → DONE / EXPIRED / CANCELED / FAILED
--    두 표 모두 RLS 켜고 정책 없음 = 앱이 직접 읽고 쓰지 못한다. 아래 함수로만.
--  함수
--    bundle_split(줄, 상한, 차수)               순수 계산(앱과 같은 규칙) — 확인 칸에서 2,500만 → 900/900/700 을 본다
--    bundle_plan_get(요청)                      당사자(고객·선택 업체·관리자)만 — 묶음·진행·남은 금액. 저장 전이면 «미리 보기» 계산
--    bundle_part_start(요청, 묶음, 금액, 수단)    고객(로그인 토큰)만 — 금액·상태 검사 뒤 주문번호 발급
--    bundle_part_for_confirm(주문번호)           서버(api/confirm-payment)만 — 토스 승인 «전» 검사
--    bundle_part_settle(주문번호, 토스 결과)      서버만 — 토스 승인·입금 통보 결과 반영 → 묶음 PAID → 모두면 계약 확정
--    bundle_part_abandon(주문번호)               고객만 — 결제창을 닫고 돌아오면 그 건을 닫아 남은 금액을 바로 다시 연다
--    bundle_va_due_tick()                       서버·pg_cron — 입금 기한 하루 전 알림 · 기한 지난 계좌 닫기
--  대표에게 물을 것(코드는 설정값·TODO): 기한 지나 일부만 낸 계약 처리(자동 환불 여부) → ops_config.bundle_expired_policy
--  확인 칸(맨 아래 select) — 모두 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 1) 설정 ------------------------------------------------------------------------
alter table public.ops_config add column if not exists bundle_pay_open       boolean not null default false; -- 토스 OK 뒤 대표가 true
alter table public.ops_config add column if not exists bundle_va_due_days    int     not null default 7;     -- 가상계좌 입금 기한(일)
alter table public.ops_config add column if not exists bundle_card_hold_min  int     not null default 30;    -- 카드 창을 열고 끝내지 않은 건이 금액을 잡는 시간
-- 기한 지나 일부만 낸 계약 — 지금은 'HOLD'(낸 돈 그대로 두고 고객·관리자 알림)만 구현. 'REFUND'(자동 환불)는 대표 결정 뒤.
alter table public.ops_config add column if not exists bundle_expired_policy text    not null default 'HOLD';

-- 2) 표 --------------------------------------------------------------------------
create table if not exists public.payment_bundles (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null,
  estimate_id uuid,
  seq         int  not null,
  label       text not null,
  lines       jsonb not null default '[]'::jsonb,       -- [{ name, won, round?, rounds? }]
  amount_won  bigint not null check (amount_won > 0 and amount_won < 10000000),   -- 토스 1회 판매 상한 «미만»
  paid_won    bigint not null default 0,
  status      text not null default 'OPEN' check (status in ('OPEN', 'PAID')),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz,
  unique (request_id, seq)
);
create index if not exists payment_bundles_request_idx on public.payment_bundles (request_id);

create table if not exists public.payment_bundle_parts (
  id              uuid primary key default gen_random_uuid(),
  bundle_id       uuid not null references public.payment_bundles(id) on delete restrict,
  request_id      uuid not null,
  order_id        text not null unique,                 -- 결제 1회 = 주문번호 1개
  method          text not null check (method in ('CARD', 'VIRTUAL_ACCOUNT')),
  amount_won      bigint not null check (amount_won > 0 and amount_won < 10000000),
  status          text not null default 'REQUESTED'
                  check (status in ('REQUESTED', 'WAITING_FOR_DEPOSIT', 'DONE', 'EXPIRED', 'CANCELED', 'FAILED')),
  due_at          timestamptz,                          -- 가상계좌 입금 기한
  reminded_at     timestamptz,                          -- 하루 전 알림 보낸 때
  payment_key     text,
  virtual_account jsonb,                                -- { bankCode, accountNumber, customerName, dueDate } — 고객에게만 보인다
  toss_secret     text,                                 -- 입금 통보(웹훅) 확인용 — 앱에 내보내지 않는다
  raw             jsonb,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  paid_at         timestamptz
);
create index if not exists payment_bundle_parts_bundle_idx  on public.payment_bundle_parts (bundle_id);
create index if not exists payment_bundle_parts_request_idx on public.payment_bundle_parts (request_id);
create index if not exists payment_bundle_parts_due_idx     on public.payment_bundle_parts (due_at) where status = 'WAITING_FOR_DEPOSIT';

alter table public.payment_bundles      enable row level security;
alter table public.payment_bundle_parts enable row level security;
revoke all on public.payment_bundles, public.payment_bundle_parts from anon, authenticated;

-- 3) 순수 계산 -------------------------------------------------------------------
create or replace function public._num(p text)
returns numeric language sql immutable as $$
  select case when p ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then p::numeric else 0 end;
$$;

create or replace function public._bundle_label(p_lines jsonb)
returns text language sql immutable as $$
  with n as (
    select ord, (l ->> 'name') || case when l ? 'round' then ' ' || (l ->> 'round') || '차' else '' end as nm
      from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality t(l, ord)
  )
  select case when (select count(*) from n) <= 3 then (select string_agg(nm, '·' order by ord) from n)
              else (select string_agg(nm, '·' order by ord) from n where ord <= 2) || ' 외 ' || ((select count(*) from n) - 2) || '개' end;
$$;

-- 공정 줄([{name, won}]) → 묶음([{seq, label, lines, amount_won}]) — src/lib/bundlePay.js splitIntoBundles 와 같은 규칙
create or replace function public.bundle_split(p_lines jsonb, p_limit bigint default 10000000, p_round bigint default 9000000)
returns jsonb language plpgsql immutable as $$
declare
  l jsonb; v_name text; v_won bigint; n int; i int; v_part bigint;
  v_out jsonb := '[]'::jsonb; v_cur jsonb := null; v_amt bigint := 0;
begin
  if not (p_round > 0 and p_round < p_limit) then raise exception 'BAD_ROUND'; end if;
  for l in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_won := round(public._num(l ->> 'won'));
    continue when v_won <= 0;
    v_name := coalesce(nullif(l ->> 'name', ''), '공정');
    if v_won >= p_limit then
      if v_cur is not null then
        v_out := v_out || jsonb_build_array(jsonb_build_object('lines', v_cur, 'amount_won', v_amt));
        v_cur := null; v_amt := 0;
      end if;
      n := ceil(v_won::numeric / p_round);
      for i in 1..n loop
        v_part := case when i < n then p_round else v_won - p_round * (n - 1) end;
        v_out := v_out || jsonb_build_array(jsonb_build_object(
          'lines', jsonb_build_array(jsonb_build_object('name', v_name, 'won', v_part, 'round', i, 'rounds', n)),
          'amount_won', v_part));
      end loop;
    elsif v_cur is not null and v_amt + v_won < p_limit then
      v_cur := v_cur || jsonb_build_array(jsonb_build_object('name', v_name, 'won', v_won));
      v_amt := v_amt + v_won;
    else
      if v_cur is not null then
        v_out := v_out || jsonb_build_array(jsonb_build_object('lines', v_cur, 'amount_won', v_amt));
      end if;
      v_cur := jsonb_build_array(jsonb_build_object('name', v_name, 'won', v_won));
      v_amt := v_won;
    end if;
  end loop;
  if v_cur is not null then
    v_out := v_out || jsonb_build_array(jsonb_build_object('lines', v_cur, 'amount_won', v_amt));
  end if;
  return coalesce((
    select jsonb_agg(b || jsonb_build_object('seq', ord, 'label', public._bundle_label(b -> 'lines')) order by ord)
      from jsonb_array_elements(v_out) with ordinality t(b, ord)), '[]'::jsonb);
end; $$;
grant execute on function public.bundle_split(jsonb, bigint, bigint) to anon, authenticated;

-- 최종 견적서 → 공정 줄(원) — src/lib/bundlePay.js quoteLines 와 같은 규칙. 견적서가 없으면 계약 금액(입찰가) 한 줄.
create or replace function public._bundle_source(p_request_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare e public.estimates; v_lines jsonb; v_sum bigint; v_total bigint; v_base numeric;
begin
  select * into e from public.estimates
   where request_id = p_request_id and status in ('submitted', 'accepted') and coalesce(total_price, 0) > 0
   order by created_at desc limit 1;
  if e.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('name', nm, 'won', won) order by first_ord), '[]'::jsonb), coalesce(sum(won), 0)
      into v_lines, v_sum
      from (select coalesce(nullif(trim(it ->> 'name'), ''), '공정') as nm, min(ord) as first_ord,
                   sum(round(public._num(it ->> 'qty') * public._num(coalesce(it ->> 'unit_price', it ->> 'unitPrice')) * 10000))::bigint as won
              from jsonb_array_elements(case when jsonb_typeof(e.items) = 'array' then e.items else '[]'::jsonb end) with ordinality t(it, ord)
             group by 1) s
     where won > 0;
    v_total := round(e.total_price * 10000);
  else
    v_base := public.contract_base_price(p_request_id);                       -- 119: 입찰가(만원)
    v_total := case when coalesce(v_base, 0) >= 100000 then round(v_base) else round(coalesce(v_base, 0) * 10000) end;
    v_lines := '[]'::jsonb; v_sum := 0;
  end if;
  if v_total <= 0 then return jsonb_build_object('estimate_id', e.id, 'total_won', 0, 'lines', '[]'::jsonb); end if;
  if jsonb_array_length(v_lines) = 0 or v_total < v_sum then
    v_lines := jsonb_build_array(jsonb_build_object('name', '공사 전체', 'won', v_total));
  elsif v_total > v_sum then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('name', '기타', 'won', v_total - v_sum));
  end if;
  return jsonb_build_object('estimate_id', e.id, 'total_won', v_total, 'lines', v_lines);
end; $$;
revoke execute on function public._bundle_source(uuid) from public, anon, authenticated;

-- 4) 진행 계산 --------------------------------------------------------------------
-- 결제 한 건이 금액을 잡고 있는가 — DONE = 낸 금액 · 입금 대기(기한 안)·카드 진행 중(잠깐) = 잡힌 금액
create or replace function public._bundle_part_holds(p public.payment_bundle_parts, p_hold_min int)
returns boolean language sql stable as $$
  select (p.status = 'WAITING_FOR_DEPOSIT' and (p.due_at is null or p.due_at > now()))
      or (p.status = 'REQUESTED' and p.created_at > now() - make_interval(mins => greatest(coalesce(p_hold_min, 30), 1)));
$$;

create or replace function public._bundle_progress(p_bundle_id uuid, p_except uuid default null)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare b public.payment_bundles; v_hold int; v_paid bigint; v_pending bigint;
begin
  select * into b from public.payment_bundles where id = p_bundle_id;
  select coalesce(bundle_card_hold_min, 30) into v_hold from public.ops_config where id = 1;
  select coalesce(sum(amount_won) filter (where status = 'DONE'), 0),
         coalesce(sum(amount_won) filter (where status <> 'DONE' and public._bundle_part_holds(p, v_hold)), 0)
    into v_paid, v_pending
    from public.payment_bundle_parts p
   where p.bundle_id = p_bundle_id and (p_except is null or p.id <> p_except);
  return jsonb_build_object('amount_won', b.amount_won, 'paid_won', v_paid, 'pending_won', v_pending,
    'remaining_won', greatest(0, b.amount_won - v_paid - v_pending),
    'status', case when v_paid >= b.amount_won then 'PAID' when v_pending > 0 then 'PENDING' when v_paid > 0 then 'PARTIAL' else 'OPEN' end);
end; $$;
revoke execute on function public._bundle_progress(uuid, uuid) from public, anon, authenticated;

create or replace function public._bundle_recalc(p_bundle_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_paid bigint;
begin
  select coalesce(sum(amount_won), 0) into v_paid from public.payment_bundle_parts where bundle_id = p_bundle_id and status = 'DONE';
  update public.payment_bundles
     set paid_won = v_paid,
         status   = case when v_paid >= amount_won then 'PAID' else 'OPEN' end,
         paid_at  = case when v_paid >= amount_won then coalesce(paid_at, now()) else null end
   where id = p_bundle_id;
end; $$;
revoke execute on function public._bundle_recalc(uuid) from public, anon, authenticated;

-- 요청의 업체 주인(알림용)
create or replace function public._bundle_company_owner(p_request_id uuid)
returns uuid language sql stable security definer
set search_path = public, extensions as $$
  select c.owner_id from public.requests r join public.companies c on c.id = r.selected_company_id or c.owner_id = r.selected_company_id
   where r.id = p_request_id order by (c.id = r.selected_company_id) desc limit 1;
$$;
revoke execute on function public._bundle_company_owner(uuid) from public, anon, authenticated;

create or replace function public._won_text(p bigint)
returns text language sql immutable as $$
  select case when p >= 10000 and p % 10000 = 0 then to_char(p / 10000, 'FM999,999,999') || '만 원'
              when p >= 10000 then to_char(p / 10000, 'FM999,999,999') || '만 ' || to_char(p % 10000, 'FM9,999') || '원'
              else to_char(p, 'FM9,999') || '원' end;
$$;

-- 5) 읽기 — 당사자만 -----------------------------------------------------------------
create or replace function public.bundle_plan_get(p_request_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_req public.requests; v_cust boolean; v_comp boolean; v_admin boolean;
  v_ops public.ops_config; v_saved boolean; v_bundles jsonb; v_src jsonb; v_escrow uuid;
begin
  if v_uid is null then return jsonb_build_object('error', 'LOGIN_REQUIRED'); end if;
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  v_cust  := v_uid = v_req.user_id;
  v_admin := exists (select 1 from public.users u where u.id = v_uid and u.role = 'admin');
  v_comp  := exists (select 1 from public.companies c where c.owner_id = v_uid
                      and v_req.selected_company_id in (c.id, c.owner_id));
  if not (v_cust or v_comp or v_admin) then return jsonb_build_object('error', 'NOT_PARTY'); end if;

  select * into v_ops from public.ops_config where id = 1;
  v_saved := exists (select 1 from public.payment_bundles where request_id = p_request_id);
  select id into v_escrow from public.escrow_payments
   where request_id = p_request_id and coalesce(transaction_status, '') not in ('CANCELLED', 'REFUNDED')
   order by created_at desc limit 1;

  if v_saved then
    select coalesce(jsonb_agg(
             jsonb_build_object('id', b.id, 'seq', b.seq, 'label', b.label, 'lines', b.lines, 'amount_won', b.amount_won)
             || public._bundle_progress(b.id)
             || jsonb_build_object('parts', coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'method', p.method, 'amount_won', p.amount_won, 'status', p.status, 'due_at', p.due_at,
                           'created_at', p.created_at, 'paid_at', p.paid_at,
                           -- 계좌번호는 입금할 고객(·관리자)에게만
                           'virtual_account', case when (v_cust or v_admin) and p.status = 'WAITING_FOR_DEPOSIT' then p.virtual_account end)
                         order by p.created_at)
                    from public.payment_bundle_parts p
                   where p.bundle_id = b.id
                     and (p.status = 'DONE' or public._bundle_part_holds(p, v_ops.bundle_card_hold_min))), '[]'::jsonb))
             order by b.seq), '[]'::jsonb)
      into v_bundles
      from public.payment_bundles b where b.request_id = p_request_id;
  else
    v_src := public._bundle_source(p_request_id);
    select coalesce(jsonb_agg(x || jsonb_build_object('id', null, 'paid_won', 0, 'pending_won', 0,
                                'remaining_won', x -> 'amount_won', 'status', 'OPEN', 'parts', '[]'::jsonb) order by (x ->> 'seq')::int), '[]'::jsonb)
      into v_bundles
      from jsonb_array_elements(public.bundle_split(v_src -> 'lines')) x;
  end if;

  return jsonb_build_object(
    'saved', v_saved, 'open', coalesce(v_ops.bundle_pay_open, false) and not coalesce(v_ops.pause_new_payments, false),
    'va_due_days', coalesce(v_ops.bundle_va_due_days, 7), 'escrow_id', v_escrow,
    'bundles', v_bundles,
    'count', jsonb_array_length(v_bundles),
    'paid_count', (select count(*) from jsonb_array_elements(v_bundles) x where x ->> 'status' = 'PAID'),
    'total_won', (select coalesce(sum((x ->> 'amount_won')::bigint), 0) from jsonb_array_elements(v_bundles) x),
    'paid_won', (select coalesce(sum(least((x ->> 'paid_won')::bigint, (x ->> 'amount_won')::bigint)), 0) from jsonb_array_elements(v_bundles) x),
    'contract_ready', jsonb_array_length(v_bundles) > 0
                      and not exists (select 1 from jsonb_array_elements(v_bundles) x where x ->> 'status' <> 'PAID'));
end; $$;
revoke execute on function public.bundle_plan_get(uuid) from public, anon;
grant execute on function public.bundle_plan_get(uuid) to authenticated;

-- 6) 결제 시작 — 고객(로그인 토큰)만 ----------------------------------------------------
create or replace function public.bundle_part_start(p_request_id uuid, p_seq int, p_amount_won bigint, p_method text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_req public.requests; v_ops public.ops_config; v_src jsonb; v_cur_total bigint;
  v_saved_total bigint; v_saved_est uuid; b public.payment_bundles; v_prog jsonb; v_remain bigint; v_count int;
  v_order text; v_days int; v_due timestamptz;
begin
  if v_uid is null then return jsonb_build_object('error', 'LOGIN_REQUIRED'); end if;
  select * into v_ops from public.ops_config where id = 1;
  if not coalesce(v_ops.bundle_pay_open, false) then return jsonb_build_object('error', 'NOT_OPEN'); end if;
  if coalesce(v_ops.pause_new_payments, false) then return jsonb_build_object('error', 'PAYMENTS_PAUSED'); end if;
  if p_method not in ('CARD', 'VIRTUAL_ACCOUNT') then return jsonb_build_object('error', 'BAD_METHOD'); end if;

  perform pg_advisory_xact_lock(hashtextextended('bundle:' || p_request_id::text, 0));
  select * into v_req from public.requests where id = p_request_id for update;
  if v_req.id is null then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  if v_req.user_id is distinct from v_uid then return jsonb_build_object('error', 'NOT_OWNER'); end if;
  if coalesce(v_req.status, '') not in ('final_quote_submitted', 'escrow_pending') then
    return jsonb_build_object('error', 'NOT_QUOTE_PHASE', 'status', v_req.status);
  end if;
  if exists (select 1 from public.escrow_payments e where e.request_id = p_request_id
              and coalesce(e.transaction_status, '') not in ('CANCELLED', 'REFUNDED')) then
    return jsonb_build_object('error', 'ALREADY_CONTRACTED');
  end if;
  -- 예전 한 번에 결제(gm_)로 이미 낸 공사면 막는다
  if exists (select 1 from public.payment_orders o where o.request_id = p_request_id and o.status = 'PAID'
              and coalesce(o.payment_source, 'original') <> 'bundle') then
    return jsonb_build_object('error', 'ALREADY_PAID');
  end if;
  -- 계약은 사업자부터(A안) — 선택 업체의 사업자 확인 전이면 결제를 시작하지 않는다
  if not exists (select 1 from public.companies c where v_req.selected_company_id in (c.id, c.owner_id) and coalesce(c.verified, false)) then
    return jsonb_build_object('error', 'BIZ_REQUIRED');
  end if;

  -- 묶음 저장 — 처음 결제할 때. 결제 건이 하나도 없으면 견적서가 바뀐 경우 다시 나눈다(결제가 시작된 뒤엔 그대로).
  v_src := public._bundle_source(p_request_id);
  v_cur_total := coalesce((v_src ->> 'total_won')::bigint, 0);
  if v_cur_total <= 0 then return jsonb_build_object('error', 'NO_QUOTE'); end if;
  select coalesce(sum(amount_won), 0), (array_agg(estimate_id))[1] into v_saved_total, v_saved_est
    from public.payment_bundles where request_id = p_request_id;
  if v_saved_total > 0 and (v_saved_total <> v_cur_total or v_saved_est is distinct from nullif(v_src ->> 'estimate_id', '')::uuid)
     and not exists (select 1 from public.payment_bundle_parts where request_id = p_request_id) then
    delete from public.payment_bundles where request_id = p_request_id;
    v_saved_total := 0;
  end if;
  if v_saved_total = 0 then
    insert into public.payment_bundles (request_id, estimate_id, seq, label, lines, amount_won)
    select p_request_id, nullif(v_src ->> 'estimate_id', '')::uuid, (x ->> 'seq')::int, x ->> 'label', x -> 'lines', (x ->> 'amount_won')::bigint
      from jsonb_array_elements(public.bundle_split(v_src -> 'lines')) x;
  end if;

  -- 기한 지난 입금 대기 · 끝내지 않은 카드 창 → 닫는다(남은 금액이 다시 열린다)
  update public.payment_bundle_parts p
     set status = 'EXPIRED'
   where p.request_id = p_request_id
     and p.status in ('REQUESTED', 'WAITING_FOR_DEPOSIT')
     and not public._bundle_part_holds(p, v_ops.bundle_card_hold_min);

  select * into b from public.payment_bundles where request_id = p_request_id and seq = p_seq for update;
  if b.id is null then return jsonb_build_object('error', 'NO_BUNDLE'); end if;
  v_prog := public._bundle_progress(b.id);
  v_remain := (v_prog ->> 'remaining_won')::bigint;
  if v_remain <= 0 then
    return jsonb_build_object('error', case when (v_prog ->> 'pending_won')::bigint > 0 then 'WAITING_DEPOSIT' else 'BUNDLE_PAID' end);
  end if;
  if p_amount_won is null or p_amount_won <= 0 then return jsonb_build_object('error', 'BAD_AMOUNT'); end if;
  if p_amount_won > v_remain then return jsonb_build_object('error', 'OVER_REMAINING', 'remaining_won', v_remain); end if;
  if p_amount_won < least(10000, v_remain) then return jsonb_build_object('error', 'UNDER_MIN'); end if;

  v_days := greatest(coalesce(v_ops.bundle_va_due_days, 7), 1);
  v_due := case when p_method = 'VIRTUAL_ACCOUNT' then now() + make_interval(days => v_days) end;
  v_order := 'gb_' || replace(b.id::text, '-', '') || '_' || substr(md5(gen_random_uuid()::text), 1, 12);
  insert into public.payment_bundle_parts (bundle_id, request_id, order_id, method, amount_won, due_at, created_by)
  values (b.id, p_request_id, v_order, p_method, p_amount_won, v_due, v_uid);
  select count(*) into v_count from public.payment_bundles where request_id = p_request_id;

  return jsonb_build_object('status', 'ok', 'order_id', v_order, 'amount_won', p_amount_won, 'method', p_method,
    'order_name', left('공간랜드 시공 · ' || b.label || ' (' || b.seq || '/' || v_count || ')', 100),
    'valid_hours', case when p_method = 'VIRTUAL_ACCOUNT' then v_days * 24 end, 'due_at', v_due);
end; $$;
revoke execute on function public.bundle_part_start(uuid, int, bigint, text) from public, anon;
grant execute on function public.bundle_part_start(uuid, int, bigint, text) to authenticated;

-- 7) 토스 승인 전 검사 — 서버만 -----------------------------------------------------
create or replace function public.bundle_part_for_confirm(p_order_id text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare p public.payment_bundle_parts; v_owner uuid; v_prog jsonb;
begin
  select * into p from public.payment_bundle_parts where order_id = p_order_id;
  if p.id is null then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  select user_id into v_owner from public.requests where id = p.request_id;
  if p.status in ('DONE', 'WAITING_FOR_DEPOSIT') then
    return jsonb_build_object('status', 'already', 'part_status', p.status, 'user_id', v_owner, 'amount_won', p.amount_won);
  end if;
  if p.status <> 'REQUESTED' then return jsonb_build_object('error', 'PART_CLOSED', 'part_status', p.status); end if;
  -- 카드 창을 오래 열어 둔 건 — 그새 다른 결제가 남은 금액을 채웠으면 승인하지 않는다(= 매입 안 됨)
  v_prog := public._bundle_progress(p.bundle_id, p.id);
  if (v_prog ->> 'remaining_won')::bigint < p.amount_won then
    update public.payment_bundle_parts set status = 'EXPIRED' where id = p.id;
    return jsonb_build_object('error', 'OVER_REMAINING');
  end if;
  return jsonb_build_object('status', 'ok', 'user_id', v_owner, 'request_id', p.request_id,
                            'amount_won', p.amount_won, 'method', p.method);
end; $$;
revoke execute on function public.bundle_part_for_confirm(text) from public, anon, authenticated;
grant  execute on function public.bundle_part_for_confirm(text) to service_role;

-- 8) 토스 결과 반영 — 서버만(승인 직후 · 가상계좌 입금 통보) -------------------------------
create or replace function public.bundle_part_settle(p_order_id text, p_toss jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  p public.payment_bundle_parts; b public.payment_bundles; v_req public.requests;
  v_status text := p_toss ->> 'status'; v_total bigint := round(public._num(p_toss ->> 'totalAmount'));
  v_va jsonb := p_toss -> 'virtualAccount'; v_owner uuid; v_left bigint; v_ready boolean := false; v_esc jsonb; v_escrow uuid;
  v_plan_total bigint; v_count int; v_paid_count int;
begin
  select * into p from public.payment_bundle_parts where order_id = p_order_id for update;
  if p.id is null then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  perform pg_advisory_xact_lock(hashtextextended('bundle:' || p.request_id::text, 0));
  select * into b from public.payment_bundles where id = p.bundle_id;
  select * into v_req from public.requests where id = p.request_id;
  v_owner := public._bundle_company_owner(p.request_id);
  if p.status = 'DONE' then return jsonb_build_object('status', 'already', 'part_status', 'DONE'); end if;

  if v_status = 'DONE' then
    if v_total <> p.amount_won then
      update public.payment_bundle_parts set status = 'FAILED', raw = p_toss - 'secret' where id = p.id;
      return jsonb_build_object('error', 'AMOUNT_MISMATCH');
    end if;
    update public.payment_bundle_parts
       set status = 'DONE', payment_key = coalesce(p_toss ->> 'paymentKey', payment_key),
           paid_at = coalesce(nullif(p_toss ->> 'approvedAt', '')::timestamptz, now()), raw = p_toss - 'secret'
     where id = p.id;
    perform public._bundle_recalc(b.id);

    -- 결제 기록(관리자 결제 관리) — 만원 단위(예전 기록과 같게). 실패해도 묶음 반영은 지킨다.
    begin
      insert into public.payment_orders (user_id, request_id, bid_id, amount, customer_fee, vat, total_amount, payment_method,
                                         status, provider, payment_source, order_id, payment_key, paid_at, raw_response)
      values (v_req.user_id, p.request_id, v_req.selected_bid_id, round(p.amount_won / 1000.0) / 10.0, 0, 0, round(p.amount_won / 1000.0) / 10.0,
              p_toss ->> 'method', 'PAID', 'TOSS', 'bundle', p.order_id, p_toss ->> 'paymentKey', now(),
              jsonb_build_object('bundleSeq', b.seq, 'bundleLabel', b.label, 'amountWon', p.amount_won, 'method', p_toss ->> 'method'));
    exception when others then null;
    end;

    select count(*), count(*) filter (where status = 'PAID'), coalesce(sum(amount_won), 0),
           coalesce(sum(amount_won), 0) - coalesce(sum(least(paid_won, amount_won)), 0)
      into v_count, v_paid_count, v_plan_total, v_left
      from public.payment_bundles where request_id = p.request_id;
    v_ready := v_count > 0 and v_paid_count = v_count;

    -- ⑤ 입금 즉시 고객·업체 알림
    insert into public.notifications (user_id, type, title, message, related_id, related_type)
    values (v_req.user_id, 'BUNDLE_PAID_PART', public._won_text(p.amount_won) || ' 결제가 확인됐어요',
            b.label || ' 묶음 · ' || v_count || '개 중 ' || v_paid_count || '개 결제 완료 · 남은 금액 ' || public._won_text(v_left),
            p.request_id, 'request');
    if v_owner is not null then
      insert into public.notifications (user_id, type, title, message, related_id, related_type)
      values (v_owner, 'BUNDLE_PAID_PART', '고객이 공사비 ' || public._won_text(p.amount_won) || '을 냈어요',
              v_count || '개 묶음 중 ' || v_paid_count || '개 완료 · 모두 채워지면 계약이 확정돼요', p.request_id, 'request');
    end if;

    -- 모든 묶음 완료 = 계약 확정 → 계약(전체 금액 기준 단계 지급) · 공사 시작
    if v_ready then
      v_esc := public.escrow_get_or_create(p.request_id, v_req.selected_company_id, round(v_plan_total / 10000.0)::int);
      v_escrow := nullif(v_esc #>> '{row,id}', '')::uuid;
      if v_escrow is not null then
        if not exists (select 1 from public.escrow_payouts where escrow_id = v_escrow) then
          -- 비율·금액·상태는 112·120 트리거가 계약 전체 금액과 업체 상태로 채운다(묶음별로 따로 계산하지 않는다)
          insert into public.escrow_payouts (escrow_id, company_id, stage, percent, amount, platform_fee, vat, net_amount, fee_snapshot, status)
          select v_escrow, v_req.selected_company_id, s, 0, 0, 0, 0, 0,
                 jsonb_build_object('companyFeeRate', 0.04, 'vatRate', 0.1, 'snapshotAt', now(), 'source', 'bundle'), 'PENDING'
            from generate_series(1, 4) s;
        end if;
        begin
          update public.payment_orders set contract_id = v_escrow
           where request_id = p.request_id and payment_source = 'bundle' and contract_id is null;
        exception when others then null;
        end;
        begin perform public.request_mark_in_progress(p.request_id); exception when others then null; end;
        insert into public.notifications (user_id, type, title, message, related_id, related_type)
        values (v_req.user_id, 'BUNDLE_CONTRACT_READY', '결제가 모두 끝나 계약이 확정됐어요',
                '착공 단계가 열렸어요. 업체에는 단계를 확인할 때마다 나눠 지급돼요.', p.request_id, 'request');
        if v_owner is not null then
          insert into public.notifications (user_id, type, title, message, related_id, related_type)
          values (v_owner, 'BUNDLE_CONTRACT_READY', '계약 체결! 공사비 결제가 모두 끝났어요',
                  '착공 사진을 올리면 단계가 시작돼요.', p.request_id, 'request');
        end if;
      end if;
    end if;
    return jsonb_build_object('status', 'ok', 'part_status', 'DONE', 'bundle_seq', b.seq,
                              'paid_count', v_paid_count, 'count', v_count, 'left_won', v_left,
                              'contract_ready', v_ready, 'escrow_id', v_escrow);

  elsif v_status = 'WAITING_FOR_DEPOSIT' then
    update public.payment_bundle_parts
       set status = 'WAITING_FOR_DEPOSIT', payment_key = coalesce(p_toss ->> 'paymentKey', payment_key),
           virtual_account = jsonb_build_object('bankCode', v_va ->> 'bankCode', 'bank', v_va ->> 'bank',
                               'accountNumber', v_va ->> 'accountNumber', 'customerName', v_va ->> 'customerName',
                               'dueDate', v_va ->> 'dueDate'),
           due_at = coalesce(nullif(v_va ->> 'dueDate', '')::timestamptz, due_at),
           toss_secret = coalesce(p_toss ->> 'secret', toss_secret), raw = p_toss - 'secret'
     where id = p.id returning * into p;
    insert into public.notifications (user_id, type, title, message, related_id, related_type)
    values (v_req.user_id, 'BUNDLE_VA_ISSUED', '입금할 계좌가 나왔어요 · ' || public._won_text(p.amount_won),
            b.label || ' 묶음 · ' || coalesce(to_char(p.due_at at time zone 'Asia/Seoul', 'MM"월" DD"일" HH24:MI') || '까지 입금해 주세요. ', '')
            || '하루 이체 한도를 넘으면 며칠에 나눠 넣으셔도 됩니다.',
            p.request_id, 'request');
    return jsonb_build_object('status', 'ok', 'part_status', 'WAITING_FOR_DEPOSIT', 'due_at', p.due_at);

  elsif v_status in ('CANCELED', 'PARTIAL_CANCELED', 'ABORTED', 'EXPIRED') then
    -- 결제 완료 뒤 취소(환불)는 관리자 취소 흐름(api/confirm-payment action=cancel)이 따로 다룬다 — 여기서는 미완료 건만 닫는다.
    update public.payment_bundle_parts
       set status = case when v_status = 'EXPIRED' then 'EXPIRED' else 'CANCELED' end, raw = p_toss - 'secret'
     where id = p.id;
    perform public._bundle_recalc(b.id);
    return jsonb_build_object('status', 'ok', 'part_status', case when v_status = 'EXPIRED' then 'EXPIRED' else 'CANCELED' end);
  end if;

  return jsonb_build_object('status', 'ignored', 'toss_status', v_status);
end; $$;
revoke execute on function public.bundle_part_settle(text, jsonb) from public, anon, authenticated;
grant  execute on function public.bundle_part_settle(text, jsonb) to service_role;

-- 입금 통보(웹훅) 확인용 — 저장해 둔 secret 이 맞는가(서버만)
create or replace function public.bundle_part_secret_ok(p_order_id text, p_secret text)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from public.payment_bundle_parts
                  where order_id = p_order_id and toss_secret is not null and toss_secret = p_secret);
$$;
revoke execute on function public.bundle_part_secret_ok(text, text) from public, anon, authenticated;
grant  execute on function public.bundle_part_secret_ok(text, text) to service_role;

-- 결제창을 닫고 돌아옴(토스 실패·취소 복귀) — 고객 본인의 «진행 중(REQUESTED)» 건만 닫는다.
--   안 닫으면 카드 창 금액이 30분 동안 «남은 금액»을 잡고 있어 다른 수단으로 바로 못 낸다.
create or replace function public.bundle_part_abandon(p_order_id text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare p public.payment_bundle_parts;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'LOGIN_REQUIRED'); end if;
  select * into p from public.payment_bundle_parts where order_id = p_order_id for update;
  if p.id is null then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  if not exists (select 1 from public.requests r where r.id = p.request_id and r.user_id = auth.uid()) then
    return jsonb_build_object('error', 'NOT_OWNER');
  end if;
  if p.status <> 'REQUESTED' then return jsonb_build_object('status', 'unchanged', 'part_status', p.status); end if;
  update public.payment_bundle_parts set status = 'CANCELED' where id = p.id;
  return jsonb_build_object('status', 'ok', 'part_status', 'CANCELED');
end; $$;
revoke execute on function public.bundle_part_abandon(text) from public, anon;
grant execute on function public.bundle_part_abandon(text) to authenticated;

-- 9) 입금 기한 — 하루 전 알림 · 기한 지난 계좌 닫기 (pg_cron 매시간 · 없으면 /api/push/dispatch 가 돌 때) ------
create or replace function public.bundle_va_due_tick()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare r record; v_reminded int := 0; v_expired int := 0; v_policy text;
begin
  select coalesce(bundle_expired_policy, 'HOLD') into v_policy from public.ops_config where id = 1;
  v_policy := coalesce(v_policy, 'HOLD');

  -- ① 하루 전 알림 — 한 번만
  for r in
    select p.id, p.request_id, p.amount_won, b.label, q.user_id
      from public.payment_bundle_parts p
      join public.payment_bundles b on b.id = p.bundle_id
      join public.requests q on q.id = p.request_id
     where p.status = 'WAITING_FOR_DEPOSIT' and p.reminded_at is null
       and p.due_at > now() and p.due_at <= now() + interval '24 hours'
  loop
    insert into public.notifications (user_id, type, title, message, related_id, related_type)
    values (r.user_id, 'BUNDLE_VA_DUE_SOON', '내일까지 ' || public._won_text(r.amount_won) || '을 입금해 주세요',
            r.label || ' 묶음 · 이체 한도에 걸리면 남은 금액만 카드로 내셔도 돼요.', r.request_id, 'request');
    update public.payment_bundle_parts set reminded_at = now() where id = r.id;
    v_reminded := v_reminded + 1;
  end loop;

  -- ② 기한 지난 입금 대기 → 닫기(그 금액은 다시 «남은 금액»으로)
  for r in
    select p.id, p.request_id, p.amount_won, q.user_id
      from public.payment_bundle_parts p join public.requests q on q.id = p.request_id
     where p.status = 'WAITING_FOR_DEPOSIT' and p.due_at <= now()
     for update of p skip locked
  loop
    update public.payment_bundle_parts set status = 'EXPIRED' where id = r.id;
    insert into public.notifications (user_id, type, title, message, related_id, related_type)
    values (r.user_id, 'BUNDLE_VA_EXPIRED', '입금 기한이 지나 계좌가 닫혔어요',
            public._won_text(r.amount_won) || ' 계좌는 더 이상 받지 않아요. 남은 금액은 결제 화면에서 다시 나눠 낼 수 있어요.',
            r.request_id, 'request');
    -- TODO(대표 결정): 일부만 낸 채 멈춘 계약 — v_policy = 'REFUND' 면 낸 금액 자동 환불(토스 취소 API, 서버).
    --   지금은 'HOLD'만: 낸 금액은 그대로 두고 관리자에게 알린다(관리자가 연락·환불 판단).
    if exists (select 1 from public.payment_bundle_parts x where x.request_id = r.request_id and x.status = 'DONE') then
      insert into public.notifications (user_id, type, title, message, related_id, related_type)
      select u.id, 'BUNDLE_STALLED', '분할 결제가 멈춘 공사가 있어요',
             '입금 기한이 지난 계좌가 있고 일부 묶음만 결제됐어요(처리: ' || v_policy || '). 고객에게 연락해 주세요.', r.request_id, 'request'
        from public.users u where u.role = 'admin';
    end if;
    v_expired := v_expired + 1;
  end loop;

  return jsonb_build_object('status', 'ok', 'reminded', v_reminded, 'expired', v_expired, 'policy', v_policy);
end; $$;
revoke execute on function public.bundle_va_due_tick() from public, anon, authenticated;
grant  execute on function public.bundle_va_due_tick() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bundle_va_due_hourly';
    perform cron.schedule('bundle_va_due_hourly', '17 * * * *', 'select public.bundle_va_due_tick()');
  end if;
end $$;

notify pgrst, 'reload schema';

-- 확인: 모두 true 면 끝
select
  (select jsonb_agg((x ->> 'amount_won')::bigint order by (x ->> 'seq')::int)
     from jsonb_array_elements(public.bundle_split('[{"name":"목공","won":25000000}]')) x) = '[9000000, 9000000, 7000000]'::jsonb as split_2500_ok,
  (select string_agg(x ->> 'label', ',' order by (x ->> 'seq')::int)
     from jsonb_array_elements(public.bundle_split('[{"name":"철거","won":4000000},{"name":"도배","won":5999999},{"name":"바닥","won":10000000}]')) x)
     = '철거·도배,바닥 1차,바닥 2차'                                                                  as split_limit_ok,
  not has_function_privilege('anon', 'public.bundle_part_start(uuid,int,bigint,text)', 'execute')    as start_no_anon_ok,
  not has_function_privilege('authenticated', 'public.bundle_part_settle(text,jsonb)', 'execute')    as settle_server_only_ok,
  (select not bundle_pay_open from public.ops_config where id = 1)                                    as still_closed_ok;
