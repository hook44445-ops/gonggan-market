-- ============================================================
--  Migration 160: 10월 초대왕 — 순위가 3등 안에 들거나 밀리면 알림
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(추가 전용). 155·157 뒤에.
--
--  왜(대표 09-29): 순위가 바뀐 걸 알아야 한 명 더 초대한다.
--  규칙
--    · 진행 중인 이벤트에서만 · 3등 안에 새로 들면 «지금 N등이에요» · 3등 밖으로 밀리면 «한 명만 더 초대하면…»
--    · 알림함은 참여자(한 명 이상 초대한 사람) 모두 · 한 사람에 하루(한국 날짜) 한 번까지
--    · 폰 푸시는 «이벤트·혜택 알림(광고)»에 동의하고 푸시를 켠 사람만 · 제목 「(광고)」 · 한국 9~20시만(157 과 같은 규칙)
--    · 마지막으로 본 순위를 referral_event_rank_seen 에 남겨 같은 변화로 두 번 알리지 않는다
--    · /api/push/dispatch 가 돌 때마다 부른다
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create table if not exists public.referral_event_rank_seen (
  event_id   text not null,
  user_id    uuid not null,
  last_rank  int,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.referral_event_rank_seen enable row level security;
-- 정책 없음 — 아래 함수로만

create or replace function public.referral_event_rank_notify_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  e public.referral_events; r record; v_prev int; v_title text; v_msg text; v_pref jsonb; v_n int := 0;
  v_optout text := ' 수신거부: 공간마켓 마이 > 알림 설정';
begin
  select * into e from public.referral_events
   where now() >= starts_at and now() < ends_at and settled_at is null order by starts_at limit 1;
  if e.id is null then return jsonb_build_object('status', 'no_live_event'); end if;

  for r in select inviter, cnt, rnk from public._referral_event_rank(e.id) loop
    select last_rank into v_prev from public.referral_event_rank_seen where event_id = e.id and user_id = r.inviter;
    v_title := null;
    if r.rnk <= 3 and (v_prev is null or v_prev > 3) then
      v_title := e.title || ' ' || r.rnk || '등이에요!';
      v_msg := '초대 ' || r.cnt || '명으로 지금 ' || r.rnk || '등이에요. 마감까지 자리를 지키면 공간토큰 ' || e.prizes[r.rnk] || '개.';
    elsif r.rnk > 3 and v_prev is not null and v_prev <= 3 then
      v_title := e.title || ' 3등 밖으로 밀렸어요';
      v_msg := '지금 ' || r.rnk || '등(초대 ' || r.cnt || '명)이에요. 친구 한 명만 더 초대하면 다시 올라갈 수 있어요.';
    end if;

    -- 알림은 하루 한 번까지 — 오늘 이미 보냈으면 순위만 기억하고 넘어간다(다음 변화 때 다시)
    if v_title is not null and not exists (
         select 1 from public.notifications n
          where n.user_id = r.inviter and n.type = 'REFERRAL_RANK'
            and (n.created_at at time zone 'Asia/Seoul')::date = v_today) then
      begin
        insert into public.notifications (user_id, type, title, message, priority)
        values (r.inviter, 'REFERRAL_RANK', v_title, v_msg, 'NORMAL');
        if v_hour >= 9 and v_hour < 20 then
          select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = r.inviter;
          if coalesce((v_pref ->> 'push_enabled')::boolean, false) and coalesce((v_pref ->> 'push_marketing')::boolean, false) then
            insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
            values (r.inviter, 'event_promo', '(광고) ' || v_title, v_msg || v_optout, '/?open=invite',
                    e.id || ':rank:' || to_char(v_today, 'YYYYMMDD'), 'queued')
            on conflict do nothing;
          end if;
        end if;
        v_n := v_n + 1;
      exception when others then null;
      end;
    end if;

    insert into public.referral_event_rank_seen (event_id, user_id, last_rank, updated_at)
    values (e.id, r.inviter, r.rnk, now())
    on conflict (event_id, user_id) do update set last_rank = excluded.last_rank, updated_at = now();
  end loop;
  return jsonb_build_object('status', 'ok', 'notified', v_n);
end; $$;
grant execute on function public.referral_event_rank_notify_due() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'referral_event_rank_seen') as rank_seen_ok,
  exists (select 1 from pg_proc where proname = 'referral_event_rank_notify_due') as rank_notify_ok;
