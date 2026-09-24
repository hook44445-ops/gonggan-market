-- ============================================================
--  Migration 112: 파트너 상태에 따른 지급 계획(A3) + 48시간 자동 승인
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  대표 결정(09-24)
--    · 사업자등록증 없는 업체: 금액과 상관없이 완료 뒤 100% (착공은 사진·GPS 기록만, 지급 없음)
--    · 사업자등록 업체 500만원 미만: 착공 30 → 완료 70
--    · 사업자등록 업체 500만원 이상: 자재 10 → 착공 20 → 중간 40 → 완료 30
--    · 계약할 때 정해 계약에 저장 — 이미 맺은 계약은 그대로(stage_plan 비어 있으면 4단계)
--    · 단계 사진 뒤 48시간 무응답 → 자동 승인, 마감 12시간 전 고객 알림, 이의 신청(보류) 시 멈춤
--  구조
--    · escrow_payments.stage_plan: '4STEP' | '2STEP' | '1STEP'  (계약 생성 때 서버가 채움)
--    · escrow_payouts 은 지금처럼 4줄(1 자재 · 2 착공 · 3 중간 · 4 완료). 계획에 없는 줄은 0% · CANCELLED.
--      앱이 옛 비율(10/20/40/30)로 넣어도 서버가 계획대로 고쳐 넣는다(한 곳이 기준).
--    · 자재비(1단계)가 있는 계획이면 계약 즉시 APPROVED — 예전엔 화면에만 「지급 완료」, 기록은 PENDING 이었다.
--    · 자동 승인: escrow_auto_approve_due() — pg_cron 이 있으면 매시간, 없으면 푸시 발송(/api/push/dispatch)이 돌 때 함께.
-- ============================================================

set search_path = public, extensions;

-- 1) 칸 ---------------------------------------------------------------------------
alter table public.escrow_payments add column if not exists stage_plan text;
alter table public.escrow_payouts  add column if not exists ready_at    timestamptz;
alter table public.escrow_payouts  add column if not exists reminded_at timestamptz;
alter table public.escrow_payouts  add column if not exists auto_approved boolean not null default false;
alter table public.ops_config      add column if not exists auto_approve_hours int not null default 48;

-- 2) 계획 고르기 -------------------------------------------------------------------
-- p_total: 계약 금액(만원). 원 단위로 들어오면(10만 이상) 만원으로 바꿔 본다.
create or replace function public.escrow_stage_plan(p_company_ref uuid, p_total numeric)
returns text language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_verified boolean; v_manwon numeric;
begin
  select coalesce(c.verified, false) into v_verified
    from public.companies c
   where c.id = p_company_ref or c.owner_id = p_company_ref
   order by (c.id = p_company_ref) desc limit 1;
  if not coalesce(v_verified, false) then return '1STEP'; end if;
  v_manwon := case when coalesce(p_total, 0) >= 100000 then p_total / 10000.0 else coalesce(p_total, 0) end;
  if v_manwon < 500 then return '2STEP'; end if;
  return '4STEP';
end; $$;
grant execute on function public.escrow_stage_plan(uuid, numeric) to anon, authenticated;

-- 계획 → 지급 단계별 비율(1 자재 · 2 착공 · 3 중간 · 4 완료)
create or replace function public.escrow_plan_percent(p_plan text, p_stage int)
returns int language sql immutable as $$
  select case coalesce(p_plan, '4STEP')
    when '2STEP' then (array[0, 30, 0, 70])[p_stage]
    when '1STEP' then (array[0, 0, 0, 100])[p_stage]
    else              (array[10, 20, 40, 30])[p_stage]
  end;
$$;

-- 3) 계약 생성 때 계획 저장 ---------------------------------------------------------
create or replace function public.trg_escrow_set_plan()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if new.stage_plan is null then
    begin
      new.stage_plan := public.escrow_stage_plan(new.company_id, new.total_amount);
    exception when others then
      new.stage_plan := '4STEP';
    end;
  end if;
  return new;
end; $$;

drop trigger if exists trg_escrow_set_plan on public.escrow_payments;
create trigger trg_escrow_set_plan before insert on public.escrow_payments
  for each row execute function public.trg_escrow_set_plan();

-- 4) 지급 줄을 계획대로 --------------------------------------------------------------
create or replace function public.trg_payout_apply_plan()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_plan  text;
  v_total numeric;
  v_pct   int;
  v_fee   numeric;
  v_vat   numeric;
begin
  select coalesce(e.stage_plan, '4STEP'), e.total_amount into v_plan, v_total
    from public.escrow_payments e where e.id = new.escrow_id;
  if v_total is null then return new; end if;

  v_pct := public.escrow_plan_percent(v_plan, new.stage);
  v_fee := coalesce((new.fee_snapshot ->> 'companyFeeRate')::numeric, 0.04);
  v_vat := coalesce((new.fee_snapshot ->> 'vatRate')::numeric, 0.1);

  new.percent      := v_pct;
  new.amount       := round(v_total * v_pct / 100.0);
  new.platform_fee := round(new.amount * v_fee);
  new.vat          := round(new.platform_fee * v_vat);
  new.net_amount   := new.amount - new.platform_fee - new.vat;

  if v_pct = 0 then
    new.status := 'CANCELLED';                 -- 이 계획에는 없는 단계
  elsif new.stage = 1 then
    new.status      := 'APPROVED';             -- 자재비 — 계약 즉시 지급 승인
    new.approved_at := coalesce(new.approved_at, now());
  end if;
  return new;
exception when others then
  return new;
end; $$;

drop trigger if exists trg_payout_apply_plan on public.escrow_payouts;
create trigger trg_payout_apply_plan before insert on public.escrow_payouts
  for each row execute function public.trg_payout_apply_plan();

-- 사진이 올라가 READY 가 된 순간을 기록(48시간 계산의 기준)
create or replace function public.trg_payout_ready_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'READY' and old.status is distinct from 'READY' then
    new.ready_at    := now();
    new.reminded_at := null;
  end if;
  return new;
end; $$;

drop trigger if exists trg_payout_ready_at on public.escrow_payouts;
create trigger trg_payout_ready_at before update on public.escrow_payouts
  for each row execute function public.trg_payout_ready_at();

-- 5) 48시간 자동 승인 ----------------------------------------------------------------
create or replace function public.escrow_auto_approve_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_hours    int;
  p          record;
  v_dbstep   int;
  v_next     int;
  v_tx       text;
  v_owner    uuid;
  v_label    text;
  v_approved int := 0;
  v_reminded int := 0;
begin
  select coalesce(auto_approve_hours, 48) into v_hours from public.ops_config where id = 1;
  v_hours := coalesce(v_hours, 48);
  if v_hours <= 0 then return jsonb_build_object('status', 'off'); end if;

  -- (a) 마감 12시간 전 고객 알림 — 한 번만
  for p in
    select po.id, po.stage, e.request_id, r.user_id as customer_id
      from public.escrow_payouts po
      join public.escrow_payments e on e.id = po.escrow_id
      join public.requests r on r.id = e.request_id
     where po.status = 'READY' and po.ready_at is not null and po.reminded_at is null
       and po.ready_at < now() - make_interval(hours => greatest(v_hours - 12, 1))
       and po.ready_at >= now() - make_interval(hours => v_hours)
       and coalesce(e.transaction_status, '') not in ('DISPUTE', 'CANCELLED', 'REFUNDED', 'SETTLED')
  loop
    v_label := case p.stage when 2 then '착공' when 3 then '중간 점검' else '완료' end;
    insert into public.notifications (user_id, type, title, message, related_id, related_type)
    values (p.customer_id, 'STAGE_APPROVE_REMINDER', v_label || ' 사진을 확인해 주세요',
            '12시간 뒤 자동으로 승인돼요. 문제가 있으면 공사 화면에서 「이의 신청」을 눌러 주세요.',
            p.request_id, 'request');
    update public.escrow_payouts set reminded_at = now() where id = p.id;
    v_reminded := v_reminded + 1;
  end loop;

  -- (b) 마감 지난 단계 자동 승인
  for p in
    select po.id, po.stage, po.escrow_id, e.request_id, e.company_id, r.user_id as customer_id
      from public.escrow_payouts po
      join public.escrow_payments e on e.id = po.escrow_id
      join public.requests r on r.id = e.request_id
     where po.status = 'READY' and po.ready_at is not null
       and po.ready_at < now() - make_interval(hours => v_hours)
       and coalesce(e.transaction_status, '') not in ('DISPUTE', 'CANCELLED', 'REFUNDED', 'SETTLED')
     order by po.ready_at
     for update of po skip locked
  loop
    -- 고객 승인(EscrowScreen advanceStage)과 같은 이동
    v_dbstep := p.stage;                                   -- 지급 2·3·4 = step2·3·4 승인
    v_next   := p.stage + 1;
    v_tx     := case p.stage when 2 then 'MID_INSPECTION' when 4 then 'SETTLED' else null end;

    update public.escrow_payouts
       set status = 'APPROVED', approved_at = now(), auto_approved = true
     where id = p.id;

    execute format(
      'update public.escrow_payments set step%s_approved_at = now(), current_step = $1%s where id = $2',
      v_dbstep, case when v_tx is null then '' else ', transaction_status = ' || quote_literal(v_tx) end)
      using v_next, p.escrow_id;

    if p.stage = 4 then
      begin
        perform public.request_mark_completed(p.request_id);
      exception when others then null;
      end;
    end if;

    v_label := case p.stage when 2 then '착공' when 3 then '중간 점검' else '완료' end;
    insert into public.notifications (user_id, type, title, message, related_id, related_type)
    values (p.customer_id, 'STAGE_AUTO_APPROVED', v_label || ' 단계가 자동 승인됐어요',
            v_hours || '시간 동안 확인이 없어 자동으로 승인했어요.', p.request_id, 'request');

    select c.owner_id into v_owner from public.companies c
     where c.id = p.company_id or c.owner_id = p.company_id
     order by (c.id = p.company_id) desc limit 1;
    if v_owner is not null then
      insert into public.notifications (user_id, type, title, message, related_id, related_type)
      values (v_owner, 'STAGE_AUTO_APPROVED', v_label || ' 단계가 자동 승인됐어요',
              '고객 확인 기한(' || v_hours || '시간)이 지나 자동 승인됐어요.', p.request_id, 'request');
    end if;

    v_approved := v_approved + 1;
  end loop;

  return jsonb_build_object('status', 'ok', 'approved', v_approved, 'reminded', v_reminded, 'hours', v_hours);
end; $$;

grant execute on function public.escrow_auto_approve_due() to anon, authenticated;

-- 6) 매시간 돌리기 — pg_cron 이 켜져 있을 때만(없으면 /api/push/dispatch 가 돌 때 함께 호출)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'escrow_auto_approve_hourly';
    perform cron.schedule('escrow_auto_approve_hourly', '7 * * * *', 'select public.escrow_auto_approve_due()');
  end if;
end $$;

notify pgrst, 'reload schema';

-- 확인 — pg_cron 사용 여부
select exists (select 1 from pg_extension where extname = 'pg_cron') as pg_cron_on;
