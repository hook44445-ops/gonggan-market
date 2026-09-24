-- ============================================================
--  Migration 109: 공간온도 · 완료 건수를 서버에서 올린다
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경 (총점검 09-24 3차 · C28 · D7 · D15 · D19)
--    공간온도 올리기를 앱(고객 화면)이 직접 companies 를 고쳐서 했다. 고객은 업체 행을 못 고치고(정책),
--    완료 때는 업체 주인 사용자 ID 로 찾아서 매번 실패(406). 그런데 화면·알림은 「공간온도 +1° 상승」.
--    완료 건수(companies.completed_jobs)는 아무도 올리지 않아 파트너 홈 「완료 0건」·지도 「시공 0」 ↔ 통계 「6건」.
--  고침: 후기 저장 · 정산 완료 때 서버 트리거가 올린다. 규칙은 앱 표(TEMP_DELTAS, utils/calculations.js)와 같다.
--    후기: 5점 +1.0 · 4점 +0.5 · 3점 0 · 2점 이하 −1.0 · 사진 있으면 +0.3
--    정산 완료(SETTLED): +0.5, 완료 건수 다시 세기
--    온도 범위 0~99. 「[점검」 후기와 숨긴 후기는 반영하지 않는다.
-- ============================================================

set search_path = public, extensions;

alter table public.companies add column if not exists completed_jobs int not null default 0;

-- companies.id 또는 업체 주인 사용자 id → companies.id
create or replace function public.company_id_of(p_ref uuid)
returns uuid language sql stable security definer
set search_path = public, extensions as $$
  select c.id from public.companies c where c.id = p_ref or c.owner_id = p_ref
   order by (c.id = p_ref) desc limit 1;
$$;

create or replace function public.company_temp_add(p_company uuid, p_delta numeric)
returns void language sql security definer
set search_path = public, extensions as $$
  update public.companies
     set temp = round(least(99, greatest(0, coalesce(temp, 36.5) + p_delta))::numeric, 1)
   where id = p_company;
$$;

-- 완료 건수 = 이 업체(id 또는 주인 id 로 기록된) 정산 완료 거래 수
create or replace function public.company_recount_completed(p_company uuid)
returns void language sql security definer
set search_path = public, extensions as $$
  update public.companies c
     set completed_jobs = (
       select count(*) from public.escrow_payments ep
        where ep.transaction_status = 'SETTLED'
          and (ep.company_id = c.id or ep.company_id = c.owner_id))
   where c.id = p_company;
$$;

-- ① 후기 저장 → 공간온도
create or replace function public.trg_review_company_temp()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_co uuid; v_delta numeric := 0; v_photo boolean;
begin
  if coalesce(new.reviewer_role, 'customer') <> 'customer'
     or coalesce(new.target_role, 'company') <> 'company'
     or coalesce(new.is_hidden, false) or coalesce(new.is_deleted, false)
     or coalesce(new.content, '') like '[점검%' then
    return new;
  end if;
  v_co := public.company_id_of(new.company_id);
  if v_co is null then return new; end if;

  v_delta := case when new.rating >= 5 then 1.0
                  when new.rating >= 4 then 0.5
                  when new.rating >= 3 then 0.0
                  else -1.0 end;
  -- 사진 칸은 배열이든 json 이든 — 하나라도 비어 있지 않으면 사진 후기
  v_photo := exists (
    select 1 from unnest(array['image_urls', 'after_image_urls', 'before_image_urls', 'review_photos']) k
     where jsonb_typeof(to_jsonb(new) -> k) = 'array' and jsonb_array_length(to_jsonb(new) -> k) > 0);
  if v_photo then v_delta := v_delta + 0.3; end if;

  if v_delta <> 0 then perform public.company_temp_add(v_co, v_delta); end if;
  return new;
exception when others then
  return new;   -- 온도 반영 실패가 후기 저장을 막지 않는다
end; $$;

drop trigger if exists trg_review_company_temp on public.reviews;
create trigger trg_review_company_temp after insert on public.reviews
  for each row execute function public.trg_review_company_temp();

-- ② 정산 완료 → 공간온도 +0.5 · 완료 건수
create or replace function public.trg_escrow_settled_company()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_co uuid;
begin
  v_co := public.company_id_of(new.company_id);
  if v_co is null then return new; end if;
  perform public.company_temp_add(v_co, 0.5);
  perform public.company_recount_completed(v_co);
  return new;
exception when others then
  return new;   -- 반영 실패가 정산을 막지 않는다
end; $$;

drop trigger if exists trg_escrow_settled_company on public.escrow_payments;
create trigger trg_escrow_settled_company after update on public.escrow_payments
  for each row
  when (new.transaction_status = 'SETTLED' and old.transaction_status is distinct from new.transaction_status)
  execute function public.trg_escrow_settled_company();

-- ③ 지금까지의 완료 건수 다시 세기(온도는 소급하지 않는다)
update public.companies c
   set completed_jobs = (
     select count(*) from public.escrow_payments ep
      where ep.transaction_status = 'SETTLED'
        and (ep.company_id = c.id or ep.company_id = c.owner_id));

notify pgrst, 'reload schema';

-- 결과 보기
select name, temp, completed_jobs from public.companies order by completed_jobs desc, name limit 20;
