-- ============================================================
--  Migration 202: «이번 요청은 다른 업체가 선택됐어요» — 떨어진 업체에 결과 알림 · 입찰 한 건에 한 번
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  순서: 상관없음(앱은 알림 이름 · 누르면 갈 곳만 더했다 — 앱 배포 전이면 알림함에 그대로 보이고 누르면 홈).
--
--  왜(본질 개선 · 대표 10-01 «떨어진 업체에 결과 알림» · 업체 USP 10 «허공에 던지는 견적»):
--    · 고객이 업체를 고르면 고른 업체에만 소식이 가고, 견적을 낸 다른 업체는 아무 소식도 못 받았다 —
--      결과를 모르니 다음 견적을 고칠 수도 없고, «던져 놓고 끝»이라 업체가 떠난다.
--  하는 일 — 요청에 «선택된 입찰»이 처음 기록되거나 바뀌면(requests.selected_bid_id · selected_company_id):
--    · 그 요청의 나머지 입찰 업체(주인)에게 알림 한 번(bids.result_notified_at 로 두 번 X)
--      제목 «이번 요청은 다른 업체가 선택됐어요»
--      내용 «{동네 · 공간} — 내 견적은 {N}곳 중 {k}번째로 낮았어요»(1등은 «가장 낮았어요» · 꼴찌는 «가장 높았어요») + 팁 한 줄(아래)
--        · 내 견적이 포함 항목(부가세·철거·폐기물·자재·AS — 186)을 고른 견적보다 적게 적었으면
--          «고른 견적은 포함 항목을 더 자세히 적었어요 — 다음엔 포함 항목을 적어 보세요»
--        · 내 견적이 가장 낮았으면 «금액만으로 정해지지 않았어요 — 증빙·포함 항목·대화가 함께 보였어요»
--      경쟁 업체의 이름 · 금액 · 고객 이름은 알리지 않는다
--    · 알림함은 언제나, 푸시는 한국 9~21시 + 푸시 켠 업체(«견적 소식» 칸이 꺼져 있으면 안 보냄 — 153 과 같다)
--    · 실패해도 고객의 선택(요청 저장)은 막지 않는다
--  되돌리기: drop trigger if exists trg_bid_result_notify on public.requests;
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

alter table public.bids add column if not exists result_notified_at timestamptz;

-- 포함 항목을 몇 개 적었나(186 — 부가세 · 철거 · 폐기물 · 자재 true 하나당 1 · AS 개월 > 0 이면 1)
create or replace function public._bid_includes_count(p jsonb)
returns int language sql immutable as $$
  select case when p is null or jsonb_typeof(p) <> 'object' then 0 else
    (case when (p ->> 'vat')        = 'true' then 1 else 0 end)
  + (case when (p ->> 'demolition') = 'true' then 1 else 0 end)
  + (case when (p ->> 'waste')      = 'true' then 1 else 0 end)
  + (case when (p ->> 'material')   = 'true' then 1 else 0 end)
  + (case when coalesce(nullif(p ->> 'as_months', ''), '0') ~ '^\d+$' and (p ->> 'as_months')::int > 0 then 1 else 0 end)
  end;
$$;

create or replace function public.trg_bid_result_notify()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_sel_bid  uuid := new.selected_bid_id;
  v_sel_inc  int  := 0;
  v_total    int;
  v_hour     int  := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  v_where    text;
  v_title    text := '이번 요청은 다른 업체가 선택됐어요';
  v_msg      text;
  b record; v_owner uuid; v_rank int; v_pref jsonb; v_sel_owner uuid;
begin
  if new.selected_bid_id is not distinct from old.selected_bid_id
     and new.selected_company_id is not distinct from old.selected_company_id then
    return new;
  end if;
  if new.selected_bid_id is null and new.selected_company_id is null then return new; end if;

  -- 고른 입찰 — 칸이 비었으면 고른 업체의 입찰로
  if v_sel_bid is null then
    select bb.id into v_sel_bid from public.bids bb
      left join public.companies c on c.id = bb.company_id or c.owner_id = bb.company_id
     where bb.request_id = new.id
       and (bb.company_id = new.selected_company_id or c.id = new.selected_company_id or c.owner_id = new.selected_company_id)
     limit 1;
  end if;
  if v_sel_bid is null then return new; end if;

  select public._bid_includes_count(to_jsonb(bb) -> 'includes') into v_sel_inc from public.bids bb where bb.id = v_sel_bid;
  select c.owner_id into v_sel_owner from public.bids bb join public.companies c on c.id = bb.company_id or c.owner_id = bb.company_id
   where bb.id = v_sel_bid limit 1;
  select count(*) into v_total from public.bids where request_id = new.id and price is not null;
  v_where := concat_ws(' · ', nullif(regexp_replace(trim(coalesce(new.area, '')), '^.*\s', ''), ''), nullif(new.space_type, ''));

  for b in
    update public.bids set result_notified_at = now()
     where request_id = new.id and id <> v_sel_bid and result_notified_at is null
    returning id, company_id, price, to_jsonb(bids) -> 'includes' as inc
  loop
    begin
      select c.owner_id into v_owner from public.companies c
       where c.id = b.company_id or c.owner_id = b.company_id
       order by (c.id = b.company_id) desc limit 1;
      if v_owner is null then v_owner := b.company_id; end if;
      if v_owner is null or v_owner = new.user_id or v_owner = v_sel_owner then continue; end if;

      select count(*) + 1 into v_rank from public.bids x
       where x.request_id = new.id and x.price is not null and b.price is not null and x.price < b.price;
      v_msg := coalesce(nullif(v_where, '') || ' — ', '')
        || case when b.price is null or v_total <= 1 then '고객이 다른 견적을 골랐어요.'
                when v_rank = 1 then '내 견적은 ' || v_total || '곳 중 가장 낮았어요.'
                when v_rank >= v_total then '내 견적은 ' || v_total || '곳 중 가장 높았어요.'
                else '내 견적은 ' || v_total || '곳 중 ' || v_rank || '번째로 낮았어요.' end
        || case
             when public._bid_includes_count(b.inc) < v_sel_inc
               then ' 고른 견적은 포함 항목을 더 자세히 적었어요 — 다음엔 포함 항목(부가세·철거 등)을 적어 보세요.'
             when b.price is not null and v_total > 1 and v_rank = 1
               then ' 금액만으로 정해지지 않았어요 — 증빙·포함 항목·대화가 함께 보였어요.'
             else ' 동네에 새 요청이 오면 다시 알려 드릴게요.' end;

      insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
      values (v_owner, 'BID_NOT_SELECTED', v_title, v_msg, new.id, 'request', 'NORMAL');

      if v_hour >= 9 and v_hour < 21 then
        select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = v_owner;
        if coalesce((v_pref ->> 'push_enabled')::boolean, false) and coalesce(v_pref ->> 'push_estimate_news', 'true') <> 'false' then
          insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
          values (v_owner, 'BID_NOT_SELECTED', v_title, v_msg, '/', b.id::text || ':result', 'queued')
          on conflict do nothing;
        end if;
      end if;
    exception when others then null;
    end;
  end loop;
  return new;
exception when others then
  return new;   -- 알림이 실패해도 고객의 선택은 막지 않는다
end; $$;

drop trigger if exists trg_bid_result_notify on public.requests;
create trigger trg_bid_result_notify after update of selected_bid_id, selected_company_id on public.requests
  for each row execute function public.trg_bid_result_notify();

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① result_col: 입찰에 «결과 알림 보냄» 칸이 있다(두 번 보내지 않게)
--  ② result_trigger: 요청에 업체가 골라지면 떨어진 업체에 알리는 장치가 있다
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'bids' and column_name = 'result_notified_at') as result_col,
  exists (select 1 from pg_trigger where tgname = 'trg_bid_result_notify') as result_trigger;
