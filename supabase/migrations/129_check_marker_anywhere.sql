-- ============================================================
--  Migration 129: 점검용 요청은 설명 어디에 「[점검」이 있어도 알아본다 (E19, 총점검 09-25)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경
--    E3 뒤로 공사 종류를 고르면 설명이 「욕실, 주방 — [점검 …」 처럼 저장된다.
--    128 의 번복 온도 트리거는 설명이 「[점검」으로 «시작»할 때만 점검용으로 봐서,
--    점검 요청을 취소해도 테스트 계정 온도가 깎였다.
--  하는 일
--    trg_request_customer_reversal — 128 과 같고, 점검 판별만 like '%[점검%' 로.
--  확인 칸 1개(아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.trg_request_customer_reversal()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_kind text; v_delta numeric; co public.companies; v_quoted boolean;
begin
  v_quoted := coalesce(old.status, '') in ('final_quote_submitted','escrow_pending');

  -- 업체 쪽이 멈춘 경우 — 고른 뒤 72시간이 지났는데 최종 견적이 없거나, 사업자 확인이 안 된 업체
  if old.selected_company_id is not null
     and old.selected_at is not null
     and old.selected_at < now() - interval '72 hours' then
    if not v_quoted then return new; end if;
    co := public.company_row_of(old.selected_company_id);
    if co.id is not null and not coalesce(co.verified, false) then return new; end if;
  end if;

  if old.selected_company_id is not null
     and new.status in ('cancelled','canceled')
     and coalesce(old.status, '') not in ('cancelled','canceled','completed','expired','closed') then
    v_kind := 'cancel_after_select';
    v_delta := case when v_quoted then -1.0 else -0.5 end;
  elsif old.selected_company_id is not null
     and new.selected_company_id is not null
     and new.selected_company_id <> old.selected_company_id then
    v_kind := 'switch_company'; v_delta := -0.5;
  else
    return new;
  end if;

  -- 점검용 — 설명 어디에든 「[점검」 (공사 종류가 앞에 붙어도)
  if coalesce((to_jsonb(new) ->> 'description'), '') like '%[점검%'
     or coalesce((to_jsonb(new) ->> 'desc'), '') like '%[점검%' then
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

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select position('%[점검%' in pg_get_functiondef('public.trg_request_customer_reversal'::regproc)) > 0 as marker_anywhere_ok;
