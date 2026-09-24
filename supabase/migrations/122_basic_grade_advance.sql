-- ════════════════════════════════════════════════════════════════════
-- 122_basic_grade_advance.sql  (대표 09-25 — (다) 베이직에 쓰임새, 5등급 유지)
--
-- 공간보증 5등급이 «공사 구간 끝 숫자의 10%»와 한 칸씩 맞물린다:
--   300만~500만 → 50(베이직) · ~1,000만 → 100(스탠다드) · ~2,000만 → 200(프리미엄) · ~5,000만 → 500(마스터) · ~1억 → 1,000(시그니처)
-- 새 계획 2STEPA: 300만~500만원 + 보증금 50만원 이상 → 자재 10(결제 직후) · 착공 20 · 완료 70
--   300만원 미만 소액은 선지급 없이 2STEP(착공 30 · 완료 70) 그대로.
-- 입구는 열어 두고 등급도 열어 둔다 — 보증금은 강제가 아니라 «걸면 자재비를 먼저 받는» 혜택.
-- 이미 맺은 계약은 저장된 계획 그대로. 120 을 대신한다(escrow_stage_plan · escrow_plan_percent 다시 만듦).
--
-- 추가 전용 · 재실행 안전. Supabase SQL Editor 에서 한 번 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.escrow_stage_plan(p_company_ref uuid, p_total numeric)
returns text language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_verified boolean; v_dep numeric; v_manwon numeric; v_need numeric; v_adv boolean;
begin
  select coalesce(c.verified, false),
         case when c.guarantee_status = 'ACTIVE' then coalesce(c.guarantee_amount,
           case c.guarantee_grade when 'BASIC' then 50 when 'STANDARD' then 100 when 'PREMIUM' then 200
                                  when 'MASTER' then 500 when 'SIGNATURE' then 1000 else 0 end) else 0 end
    into v_verified, v_dep
    from public.companies c
   where c.id = p_company_ref or c.owner_id = p_company_ref
   order by (c.id = p_company_ref) desc limit 1;
  if not coalesce(v_verified, false) then return '1STEP'; end if;
  v_manwon := case when coalesce(p_total, 0) >= 100000 then p_total / 10000.0 else coalesce(p_total, 0) end;
  -- 자재비 선지급 — 300만원 이상 + 보증금 ≥ 구간 끝 숫자의 10%
  v_need := case when v_manwon < 500 then 50 when v_manwon <= 1000 then 100 when v_manwon <= 2000 then 200
                 when v_manwon <= 5000 then 500 else 1000 end;
  v_adv := v_manwon >= 300 and coalesce(v_dep, 0) >= v_need;
  if v_manwon < 500 then return case when v_adv then '2STEPA' else '2STEP' end; end if;
  return case when v_adv then '4STEP' else '3STEP' end;
end; $$;
grant execute on function public.escrow_stage_plan(uuid, numeric) to anon, authenticated;

-- 계획 → 지급 단계별 비율(1 자재 · 2 착공 · 3 중간 · 4 완료)
create or replace function public.escrow_plan_percent(p_plan text, p_stage int)
returns int language sql immutable as $$
  select case coalesce(p_plan, '4STEP')
    when '3STEP'  then (array[0, 30, 40, 30])[p_stage]
    when '2STEPA' then (array[10, 20, 0, 70])[p_stage]
    when '2STEP'  then (array[0, 30, 0, 70])[p_stage]
    when '1STEP'  then (array[0, 0, 0, 100])[p_stage]
    else               (array[10, 20, 40, 30])[p_stage]
  end;
$$;

notify pgrst, 'reload schema';

-- 확인: 셋 다 true 면 끝
select
  public.escrow_plan_percent('2STEPA', 1) = 10 as basic_advance_ok,
  public.escrow_plan_percent('2STEPA', 4) = 70 as basic_finish_ok,
  public.escrow_plan_percent('3STEP', 1)  = 0  as no_deposit_ok;
