-- ============================================================
--  Migration 114: 고객 공간온도 — 업체의 고객 평가 · 선택 뒤 번복을 서버에서 반영 (A4)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경 (총점검 09-24 3차 · 대표: 「고객은 공사 간 공간온도에 영향, 파트너는 레벨·공간온도에 영향 —
--        그런 글이 있어야 상호 존중이 있다」, 「고객의 견적요청 번복 자체는 매너온도를 결정하는 요소」)
--    업체 공간온도는 후기·정산으로 서버가 올린다(109). 그런데 고객 쪽은
--    업체가 공사 뒤 남기는 «고객 신뢰평가»(reviews, reviewer_role='company', target_role='customer')가
--    users.space_temp 에 반영되지 않았고, 선택 뒤 취소·업체 변경도 아무 흔적이 없었다.
--    화면에 「고객 매너가 공간온도에 반영돼요」라고 쓰려면 먼저 실제로 반영돼야 한다.
--
--  규칙 (앱 문구와 같게 — 숫자를 바꾸면 두 곳을 같이)
--    업체의 고객 평가: 5점 +0.5 · 4점 +0.3 · 3점 0 · 2점 이하 −1.0 · 분쟁 이력 표시 −0.5
--    선택 뒤 번복(한 요청에 한 번씩): 업체 선택 뒤 요청 취소 −1.0 · 선택한 업체를 다른 업체로 바꿈 −0.5
--    범위 0~99. 「[점검」 평가·숨긴 평가는 반영하지 않는다. 반영 실패가 저장을 막지 않는다.
-- ============================================================

set search_path = public, extensions;

-- 한 요청에 같은 종류의 번복은 한 번만 — 기록 표(관리자 확인용)
create table if not exists public.customer_temp_events (
  request_id  uuid not null,
  kind        text not null check (kind in ('cancel_after_select','switch_company')),
  user_id     uuid,
  delta       numeric not null,
  created_at  timestamptz not null default now(),
  primary key (request_id, kind)
);
alter table public.customer_temp_events enable row level security;   -- 정책 없음 = 직접 접근 불가

create or replace function public.customer_temp_add(p_user uuid, p_delta numeric)
returns void language sql security definer
set search_path = public, extensions as $$
  update public.users
     set space_temp = round(least(99, greatest(0, coalesce(space_temp, 36.5) + p_delta))::numeric, 1)
   where id = p_user;
$$;

-- 1) 업체가 남긴 고객 평가 → 고객 공간온도
create or replace function public.trg_review_customer_temp()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_j jsonb := to_jsonb(new); v_user uuid; v_delta numeric := 0;
begin
  if coalesce(v_j ->> 'reviewer_role', '') <> 'company'
     or coalesce(v_j ->> 'target_role', '') <> 'customer'
     or coalesce((v_j ->> 'is_hidden')::boolean, false) or coalesce((v_j ->> 'is_deleted')::boolean, false)
     or coalesce(v_j ->> 'content', '') like '[점검%' then
    return new;
  end if;
  v_user := public._safe_uuid(coalesce(v_j ->> 'target_user_id', v_j ->> 'customer_id'));
  if v_user is null then return new; end if;

  v_delta := case when coalesce((v_j ->> 'rating')::numeric, 0) >= 5 then 0.5
                  when coalesce((v_j ->> 'rating')::numeric, 0) >= 4 then 0.3
                  when coalesce((v_j ->> 'rating')::numeric, 0) >= 3 then 0.0
                  else -1.0 end;
  if coalesce((v_j ->> 'dispute_history')::boolean, false) then v_delta := v_delta - 0.5; end if;

  if v_delta <> 0 then perform public.customer_temp_add(v_user, v_delta); end if;
  return new;
exception when others then
  return new;
end; $$;

drop trigger if exists trg_review_customer_temp on public.reviews;
create trigger trg_review_customer_temp after insert on public.reviews
  for each row execute function public.trg_review_customer_temp();

-- 2) 선택 뒤 번복 → 고객 공간온도 (요청마다 종류별 한 번)
create or replace function public.trg_request_customer_reversal()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_kind text; v_delta numeric;
begin
  if old.selected_company_id is not null
     and new.status in ('cancelled','canceled')
     and coalesce(old.status, '') not in ('cancelled','canceled','completed','expired','closed') then
    v_kind := 'cancel_after_select'; v_delta := -1.0;
  elsif old.selected_company_id is not null
     and new.selected_company_id is not null
     and new.selected_company_id <> old.selected_company_id then
    v_kind := 'switch_company'; v_delta := -0.5;
  else
    return new;
  end if;

  if coalesce((to_jsonb(new) ->> 'description'), '') like '[점검%'
     or coalesce((to_jsonb(new) ->> 'desc'), '') like '[점검%' then
    return new;
  end if;

  insert into public.customer_temp_events (request_id, kind, user_id, delta)
  values (new.id, v_kind, new.user_id, v_delta)
  on conflict (request_id, kind) do nothing;
  if found then perform public.customer_temp_add(new.user_id, v_delta); end if;
  return new;
exception when others then
  return new;
end; $$;

drop trigger if exists trg_request_customer_reversal on public.requests;
create trigger trg_request_customer_reversal after update on public.requests
  for each row execute function public.trg_request_customer_reversal();

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from pg_trigger where tgname = 'trg_review_customer_temp') as review_trigger_ok,
  exists (select 1 from pg_trigger where tgname = 'trg_request_customer_reversal') as reversal_trigger_ok;
