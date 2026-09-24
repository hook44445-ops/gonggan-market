-- ════════════════════════════════════════════════════════════════════
-- 120_material_advance_needs_guarantee.sql  (대표 09-24 6차 — 「나로 가자」)
--
-- 문제: 500만원 이상(4단계) 공사는 결제 직후 자재비 10% 가 지급 승인된다(112).
--       업체가 10% 만 받고 착공하지 않으면 담보가 없다 — 500만~1,000만원 구간 업체는 사업자·시공보험만 있고
--       시공보험은 선급금 미이행을 보통 막아 주지 않는다. (1,000만원 초과는 보증금 20% 이상이라 덮인다.)
-- 결정(나): 자재비 선지급은 «보증금(공간보증 ACTIVE)을 건 업체»의 혜택으로. 강제가 아니라 내면 유리한 구조.
--   보증금은 «그 공사 구간 끝 숫자의 10%» 이상이어야 한다(대표 09-25 — 선지급 10%가 늘 보증금 안에 든다):
--     500만~1,000만 → 100만(스탠다드) · ~2,000만 → 200만(프리미엄) · ~5,000만 → 500만(마스터) · ~1억 → 1,000만(시그니처)
--   · 조건 충족 + 500만원 이상 → 4STEP  자재 10 · 착공 20 · 중간 40 · 완료 30 (지금과 같음)
--   · 그 밖 + 500만원 이상    → 3STEP  착공 30(자재비 포함) · 중간 40 · 완료 30
--   (입찰 한도는 101 그대로 — 등급 금액이 정해져 있어 구간표와 같은 한도가 나온다. 1,000만원 초과는 시공보험 필수.)
--   · 500만원 미만 → 2STEP(착공 30 · 완료 70) · 사업자 확인 전 → 1STEP — 그대로
-- 이미 맺은 계약은 계약 때 저장된 계획 그대로(stage_plan). 새 계약부터.
--
-- 추가 전용 · 재실행 안전. Supabase SQL Editor 에서 한 번 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.escrow_stage_plan(p_company_ref uuid, p_total numeric)
returns text language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_verified boolean; v_dep numeric; v_manwon numeric; v_need numeric;
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
  if v_manwon < 500 then return '2STEP'; end if;
  -- 자재비 선지급은 «구간 끝 숫자의 10%» 이상 보증금을 건 업체만
  v_need := case when v_manwon <= 1000 then 100 when v_manwon <= 2000 then 200
                 when v_manwon <= 5000 then 500 else 1000 end;
  if coalesce(v_dep, 0) >= v_need then return '4STEP'; end if;
  return '3STEP';
end; $$;
grant execute on function public.escrow_stage_plan(uuid, numeric) to anon, authenticated;

-- 계획 → 지급 단계별 비율(1 자재 · 2 착공 · 3 중간 · 4 완료)
create or replace function public.escrow_plan_percent(p_plan text, p_stage int)
returns int language sql immutable as $$
  select case coalesce(p_plan, '4STEP')
    when '3STEP' then (array[0, 30, 40, 30])[p_stage]
    when '2STEP' then (array[0, 30, 0, 70])[p_stage]
    when '1STEP' then (array[0, 0, 0, 100])[p_stage]
    else              (array[10, 20, 40, 30])[p_stage]
  end;
$$;

notify pgrst, 'reload schema';

-- 확인: 셋 다 true 면 끝
select
  public.escrow_plan_percent('3STEP', 1) = 0  as advance_off_ok,
  public.escrow_plan_percent('3STEP', 2) = 30 as start_30_ok,
  public.escrow_plan_percent('4STEP', 1) = 10 as guarantee_advance_ok;
