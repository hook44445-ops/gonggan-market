-- ============================================================
--  Migration 101: 파트너 수주 한도 — 서버에서 강제 (+ 면허 확인 칸)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경
--    입찰 금액 한도가 화면(BidCard)에서만 막혔다. 화면을 거치지 않고 API 로 직접 넣으면
--    한도를 넘는 입찰이 들어갔다. 게다가 예전 한도는 companies.badge 로 정했는데,
--    그 값은 가입 화면에서 결제 없이 기록되던 값이었다.
--
--  규칙 — src/lib/partnerTier.js 의 bidLimit 과 같다. ⚠ 숫자를 바꾸면 두 곳을 같이 바꿀 것.
--    한도는 «관리자가 확인한 값»으로만 정한다.
--      사업자   companies.verified          (관리자가 업체 승인)
--      시공보험 companies.has_insurance     (보험 증권 승인 — adminReviewDocument 가 맞춘다)
--      보증금   공간보증 ACTIVE 일 때 guarantee_amount(없으면 등급 금액) — 만원
--      면허     companies.license_verified  (실내건축공사업 등록증 승인 — 이 마이그레이션이 칸을 만든다)
--
--    사업자 없음      가입만 300 / 시공보험 또는 보증금 500
--    사업자 있음      500
--      + 시공보험      1,000
--      보험 없이 보증금(20%)   보증금 × 5, 500~1,000
--      + 시공보험 + 보증금(10%) = 프리미엄   보증금 × 10, 면허 없으면 1,499(1,500 미만) / 있으면 10,000(1억)
--
--  설계 원칙 (009 와 같다)
--    · fail-open: 입찰의 company_id 로 업체 기록을 못 찾으면 통과시킨다(시드/예외 데이터 보존).
--    · 새 입찰(INSERT)과 금액을 바꾸는 수정(UPDATE OF price)만 본다. 이미 들어간 입찰은 건드리지 않는다.
--    · bids.company_id 에는 코드상 «소유자 users.id» 가 들어간다(009 참고). 혹시 companies.id 가
--      들어온 경우도 찾도록 둘 다 본다.
-- ============================================================

set search_path = public, extensions;

-- STEP 1: 면허(실내건축공사업 등록증) 확인 칸
alter table public.companies
  add column if not exists license_verified boolean not null default false;

-- STEP 2: 업체 한 곳의 1건 최대 공사 금액(만원). 업체를 못 찾으면 NULL.
create or replace function public.partner_bid_limit_manwon(p_company_ref uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
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
    return null;                                   -- fail-open
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

  -- 사업자 없음
  if not coalesce(c.verified, false) then
    return case when coalesce(c.has_insurance, false) or dep > 0 then 500 else 300 end;
  end if;

  -- 사업자 있음 · 보험 없음 — 보증금 20% (× 5), 1,000 까지
  if not coalesce(c.has_insurance, false) then
    return case when dep > 0 then greatest(500, least(dep * 5, 1000)) else 500 end;
  end if;

  -- 사업자 + 보험 — 1,000. 보증금(10%, × 10)이 있으면 프리미엄.
  cap := 1000;
  if dep > 0 then
    cap := greatest(cap, least(dep * 10,
             case when coalesce(c.license_verified, false) then 10000 else 1499 end));
  end if;
  return cap;
end;
$$;

-- STEP 3: 입찰 트리거
create or replace function public.enforce_partner_bid_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
begin
  v_limit := public.partner_bid_limit_manwon(new.company_id);
  if v_limit is not null and new.price is not null and new.price > v_limit then
    raise exception 'BID_OVER_LIMIT: 이 업체의 공사 1건 한도는 %만원입니다 (입찰 %만원)', v_limit, new.price
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_partner_bid_limit on public.bids;
create trigger trg_enforce_partner_bid_limit
  before insert or update of price on public.bids
  for each row execute function public.enforce_partner_bid_limit();

-- 확인용(실행 후 한 번 돌려 보세요) — 업체별 한도
--   select c.name, c.verified, c.has_insurance, c.guarantee_status, c.guarantee_amount, c.license_verified,
--          public.partner_bid_limit_manwon(c.owner_id) as limit_manwon
--     from public.companies c order by limit_manwon desc nulls last;
