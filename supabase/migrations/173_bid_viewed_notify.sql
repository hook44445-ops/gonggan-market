-- ============================================================
--  Migration 173: «고객이 내 견적을 확인했어요» — 업체 재방문 · 입찰 한 건에 한 번
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  왜: 업체는 견적을 보낸 뒤 고객이 봤는지 몰라 기다리다 잊는다. 고객이 견적 비교 화면을 열면
--      그 요청에 입찰한 업체들에 한 번 알려, 업체가 앱을 열고 대화로 먼저 궁금한 점을 묻게 한다.
--  규칙
--    · 고객(요청 주인 · 로그인 토큰의 사용자)이 부를 때만 · 아직 표시 안 된 입찰만 표시하고 알린다(두 번 X)
--    · 알림함은 언제나, 푸시는 한국 9~21시 + 푸시 켠 업체만(밤에는 알림함만)
--    · 고객 이름·연락처는 알리지 않는다(공사 종류·지역만)
--  되돌리기: drop function if exists public.bids_mark_viewed(uuid);   (viewed_at 칸은 비어 있어도 해가 없다)
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

alter table public.bids add column if not exists viewed_at timestamptz;

create or replace function public.bids_mark_viewed(p_request_id uuid)
returns integer language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_req public.requests;
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  v_where text; v_title text := '고객이 내 견적을 확인했어요'; v_msg text;
  b record; v_owner uuid; v_pref jsonb; v_n int := 0;
begin
  if v_uid is null then return 0; end if;
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null or v_req.user_id is distinct from v_uid then return 0; end if;

  v_where := concat_ws(' · ', nullif(regexp_replace(trim(coalesce(v_req.area, '')), '^.*\s', ''), ''), nullif(v_req.space_type, ''));
  v_msg := coalesce(nullif(v_where, '') || ' 요청 — ', '') || '궁금한 점이 있는지 대화로 먼저 물어보세요.';

  for b in
    update public.bids set viewed_at = now()
     where request_id = p_request_id and viewed_at is null
    returning id, company_id
  loop
    begin
      select c.owner_id into v_owner from public.companies c
       where c.id = b.company_id or c.owner_id = b.company_id
       order by (c.id = b.company_id) desc limit 1;
      if v_owner is null or v_owner = v_uid then continue; end if;
      insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
      values (v_owner, 'BID_VIEWED', v_title, v_msg, p_request_id, 'request', 'NORMAL');
      if v_hour >= 9 and v_hour < 21 then
        select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = v_owner;
        if coalesce((v_pref ->> 'push_enabled')::boolean, false) then
          insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
          values (v_owner, 'BID_VIEWED', v_title, v_msg, '/', b.id::text || ':viewed', 'queued')
          on conflict do nothing;
        end if;
      end if;
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  return v_n;
end; $$;
grant execute on function public.bids_mark_viewed(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bids' and column_name = 'viewed_at') as viewed_col,
  exists (select 1 from pg_proc where proname = 'bids_mark_viewed') as viewed_fn;
