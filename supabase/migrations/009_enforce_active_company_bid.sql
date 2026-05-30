-- ============================================================
--  Migration 009: 비활성 업체 입찰 서버사이드 차단 (H-5)
--  Supabase SQL Editor에서 한 번만 실행하세요.
--
--  배경: 현재 "승인된(ACTIVE) 업체만 입찰" 규칙이 클라이언트(addBid)에서만
--        검사된다. 클라이언트 우회 시 PENDING/SUSPENDED 업체도 입찰 가능.
--
--  설계 원칙 (기존 정상 플로우 손상 금지):
--    - companies 테이블의 public read 정책은 그대로 둔다.
--      (관리자 승인 대시보드가 PENDING 업체를 읽어야 하므로 RLS를 조이지 않음)
--    - 강제는 bids INSERT 시점의 트리거로만 한다.
--    - bids.company_id 는 실제로 '소유자 users.id' 를 담는다(코드 기준).
--      companies.owner_id 와 매칭해 상태를 조회한다.
--    - ⚠️ fail-open: 매칭되는 업체 레코드가 없으면(시드/예외 데이터 등) 통과시킨다.
--      → 정상 ACTIVE 업체와 매핑 불명확 케이스는 절대 막지 않는다.
--    - fail-closed: 업체 레코드가 존재하고 상태가 명시적으로 'ACTIVE' 가 아닐 때만 차단.
-- ============================================================

create or replace function public.enforce_active_company_bid()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  -- bids.company_id = 소유자 users.id → companies.owner_id 로 상태 조회
  select c.company_status
    into v_status
    from public.companies c
   where c.owner_id = new.company_id
   limit 1;

  -- 업체 레코드가 존재하고 명시적으로 비활성일 때만 차단.
  -- (v_status IS NULL = 매핑되는 업체 없음 → 통과: 기존 흐름 보존)
  if v_status is not null and v_status <> 'ACTIVE' then
    raise exception 'COMPANY_NOT_ACTIVE: 승인된 업체만 입찰할 수 있습니다 (현재 상태: %)', v_status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_active_company_bid on public.bids;

create trigger trg_enforce_active_company_bid
  before insert on public.bids
  for each row
  execute function public.enforce_active_company_bid();

notify pgrst, 'reload schema';
