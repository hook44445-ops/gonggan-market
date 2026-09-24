-- ════════════════════════════════════════════════════════════════════
-- 124_bid_needs_biz.sql  (대표 09-25)
--   「가입 300은 없애고 카드는 500까지 보여지되 사업자등록을 유도」
--   「입찰 전에 사업자등록을 해야 열려요가 써 있어야 해」 → 카드는 보이고 입찰은 잠김
--   「사업자만 등록한 사람들은 1,000만원까지 카드 보이고」 「입찰 카드는 시공보험 등록해야 열리게」
--
-- 서버 한도(101 partner_bid_limit_manwon)를 이렇게:
--   사업자 확인 전(verified=false) → 0  = 입찰 잠김(보험·보증금이 있어도). 예전: 가입만 300 · 보험/보증금 500(숨은 길).
--   사업자 확인 · 보험 없음      → 500 (보증금 200만원 이상이면 1,000까지 — 그대로)
--   사업자 + 보험                → 1,000, 보증금 × 10(면허 없으면 1,500만원 미만) — 그대로
-- 입찰 트리거 메시지: 한도 0 이면 「입찰 전에 사업자등록 확인이 필요해요」.
-- 최종 견적서·추가견적(117)도 같은 함수를 쓰므로 함께 따라온다.
-- 카드가 보이는 범위(가입만 500 · 사업자만 1,000)는 화면에서 정한다(partnerTier cardPreviewLimit).
--
-- 추가 전용 · 재실행 안전. Supabase SQL Editor 에서 한 번 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.partner_bid_limit_manwon(p_company_ref uuid)
returns integer language plpgsql stable security definer
set search_path = public as $$
declare
  c   record;
  dep integer := 0;
  cap integer;
begin
  select verified, has_insurance, guarantee_status, guarantee_grade, guarantee_amount, license_verified
    into c
    from public.companies
   where owner_id = p_company_ref or id = p_company_ref
   order by (owner_id = p_company_ref) desc
   limit 1;

  if not found then
    return null;                                   -- fail-open(업체 행을 못 찾으면 예전처럼 막지 않음)
  end if;

  if c.guarantee_status = 'ACTIVE' then
    dep := coalesce(c.guarantee_amount,
             case c.guarantee_grade
               when 'BASIC'     then 50
               when 'STANDARD'  then 100
               when 'PREMIUM'   then 200
               when 'MASTER'    then 500
               when 'SIGNATURE' then 1000
               else 0 end);
  end if;

  -- 사업자 확인 전 — 입찰 잠김(대표 09-25)
  if not coalesce(c.verified, false) then
    return 0;
  end if;

  -- 사업자 있음 · 보험 없음 — 보증금 20% (× 5), 1,000 까지
  if not coalesce(c.has_insurance, false) then
    return case when dep > 0 then greatest(500, least(dep * 5, 1000)) else 500 end;
  end if;

  -- 사업자 + 보험 — 1,000. 보증금(10%, × 10)이 있으면 더.
  cap := 1000;
  if dep > 0 then
    cap := greatest(cap, least(dep * 10,
             case when coalesce(c.license_verified, false) then 10000 else 1499 end));
  end if;
  return cap;
end; $$;

create or replace function public.enforce_partner_bid_limit()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_limit integer;
begin
  v_limit := public.partner_bid_limit_manwon(new.company_id);
  if v_limit = 0 then
    raise exception 'BIZ_REQUIRED_TO_BID: 입찰 전에 사업자등록 확인이 필요해요(홈택스에서 당일 발급 · 「내 한도 · 서류」에서 올리기)'
      using errcode = 'check_violation';
  end if;
  if v_limit is not null and new.price is not null and new.price > v_limit then
    raise exception 'BID_OVER_LIMIT: 이 업체의 공사 1건 한도는 %만원입니다 (입찰 %만원)', v_limit, new.price
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝(없는 업체 ID 는 null, 함수가 새 규칙인지는 소스에서)
select
  public.partner_bid_limit_manwon('00000000-0000-4000-8000-000000000000') is null as fail_open_ok,
  position('BIZ_REQUIRED_TO_BID' in pg_get_functiondef('public.enforce_partner_bid_limit()'::regprocedure)) > 0 as biz_lock_ok;
