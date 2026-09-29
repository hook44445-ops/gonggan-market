-- ============================================================
--  Migration 163: 우리 동네 이번 주 공사 소식 — 요청·견적 수 · 많이 찾은 공사(숫자만)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(조회 전용).
--
--  왜(대표 09-29 「1등 재방문」): 홈을 열 때마다 우리 동네 숫자가 바뀌어 있으면 다시 연다.
--  규칙
--    · 누구나(로그인 없이) — 지역 이름으로 최근 7일 새 요청 수 · 그 요청에 들어온 견적 수 · 많이 찾은 공간 3개
--    · 구(예: «서울 강서구»의 강서구)로 3건이 안 되면 시(서울)로 넓힌다 — scope 로 알려 준다
--    · 누가 요청했는지·주소·금액은 돌려주지 않는다(숫자와 공간 종류만) · 숨김·삭제·취소 요청 제외
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.region_pulse(p_region text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  v_region text := trim(coalesce(p_region, ''));
  v_city text := nullif(split_part(v_region, ' ', 1), '');
  v_dist text := nullif(case when position(' ' in v_region) > 0 then regexp_replace(v_region, '^.*\s', '') end, '');
  v_scope text; v_label text; v_pat text; v_req int; v_bids int; v_top jsonb;
begin
  if v_city is null or char_length(v_region) > 40 then return jsonb_build_object('ok', false); end if;

  -- 구 먼저, 3건 안 되면 시
  if v_dist is not null then
    select count(*) into v_req from public.requests q
     where q.created_at > now() - interval '7 days' and coalesce(q.area, '') ilike '%' || v_dist || '%'
       and coalesce(q.status, 'open') not in ('cancelled', 'canceled')
       and coalesce(q.is_hidden, false) = false and coalesce(q.is_deleted, false) = false;
    if v_req >= 3 then v_scope := 'district'; v_label := v_dist; v_pat := v_dist; end if;
  end if;
  if v_scope is null then v_scope := 'city'; v_label := v_city; v_pat := v_city; end if;

  select count(*), coalesce(sum((select count(*) from public.bids b where b.request_id = q.id)), 0)
    into v_req, v_bids
    from public.requests q
   where q.created_at > now() - interval '7 days' and coalesce(q.area, '') ilike '%' || v_pat || '%'
     and coalesce(q.status, 'open') not in ('cancelled', 'canceled')
     and coalesce(q.is_hidden, false) = false and coalesce(q.is_deleted, false) = false;

  select coalesce(jsonb_agg(t.space_type order by t.n desc, t.space_type), '[]'::jsonb) into v_top
    from (select q.space_type, count(*) n from public.requests q
           where q.created_at > now() - interval '7 days' and coalesce(q.area, '') ilike '%' || v_pat || '%'
             and nullif(trim(coalesce(q.space_type, '')), '') is not null
             and coalesce(q.status, 'open') not in ('cancelled', 'canceled')
             and coalesce(q.is_hidden, false) = false and coalesce(q.is_deleted, false) = false
           group by q.space_type order by count(*) desc, q.space_type limit 3) t;

  return jsonb_build_object('ok', true, 'scope', v_scope, 'label', v_label, 'requests', v_req, 'bids', v_bids, 'top', v_top);
end; $$;
grant execute on function public.region_pulse(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'region_pulse') as region_pulse_ok;
