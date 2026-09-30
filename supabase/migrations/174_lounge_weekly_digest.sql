-- ============================================================
--  Migration 174: 라운지 주간 인기 글 — 월요일 «지난주 라운지 인기 글 3개» (라운지 재방문)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  규칙
--    · 한국 월요일 9시~20시에 한 번 · 지난주(월~일) 글 중 숨김·삭제·비공개 빼고 인기 순 3개(공감×3 + 댓글×2 + 조회÷20)
--      운영 글(is_seed)보다 사용자 글을 먼저
--    · 받는 사람: 최근 60일 안에 라운지에 글·댓글을 쓴 사람만(라운지를 쓰는 사람) · 주 1회
--    · 알림함은 그 사람들에게, 푸시는 «라운지 알림»을 켠 사람만 — 139 의 인기 글 푸시(lounge_hot)와 같은 기준
--      (소식성: 한국 10~21시 · 하루 3건 캡은 발송기가 지킨다)
--  되돌리기: drop function if exists public.lounge_weekly_digest_due();
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.lounge_weekly_digest_due()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_local timestamp := now() at time zone 'Asia/Seoul';
  v_today date := v_local::date;
  v_hour int := extract(hour from v_local)::int;
  v_mon date; v_last_mon date;
  v_top uuid; v_titles text; v_n int := 0; v_title text := '지난주 라운지 인기 글';
  r record; v_pref jsonb;
begin
  if extract(isodow from v_today) <> 1 then return jsonb_build_object('status', 'not_monday'); end if;
  if v_hour < 9 or v_hour >= 20 then return jsonb_build_object('status', 'quiet_hours'); end if;
  v_mon := v_today; v_last_mon := v_mon - 7;

  select (array_agg(id order by rk))[1],
         string_agg(rk || '. ' || left(regexp_replace(title, '\s+', ' ', 'g'), 22), ' · ' order by rk)
    into v_top, v_titles
    from (
      select p.id, p.title,
             row_number() over (order by coalesce(p.is_seed, false) asc,
                                         coalesce(p.like_count, 0) * 3 + coalesce(p.comment_count, 0) * 2 + coalesce(p.view_count, 0) / 20.0 desc,
                                         p.created_at desc) as rk
        from public.lounge_posts p
       where (p.created_at at time zone 'Asia/Seoul')::date >= v_last_mon
         and (p.created_at at time zone 'Asia/Seoul')::date <  v_mon
         and coalesce(p.is_hidden, false) = false
         and coalesce(p.is_deleted, false) = false
         and coalesce(p.is_visible, true) = true
         and coalesce(p.publish_status, 'published') = 'published'
         and coalesce(trim(p.title), '') <> ''
    ) t
   where rk <= 3;
  if v_top is null then return jsonb_build_object('status', 'no_posts'); end if;

  for r in
    select distinct x.user_id from (
      select p.user_id from public.lounge_posts p
       where p.created_at > now() - interval '60 days' and coalesce(p.is_seed, false) = false
      union
      select c.user_id from public.lounge_comments c where c.created_at > now() - interval '60 days'
    ) x
     where x.user_id is not null
     limit 3000
  loop
    if exists (select 1 from public.notifications n
                where n.user_id = r.user_id and n.type = 'LOUNGE_WEEKLY'
                  and (n.created_at at time zone 'Asia/Seoul')::date >= v_mon) then
      continue;
    end if;
    begin
      insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
      values (r.user_id, 'LOUNGE_WEEKLY', v_title, v_titles, v_top, 'lounge_post', 'LOW');
      select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = r.user_id;
      if coalesce((v_pref ->> 'push_enabled')::boolean, false)
         and coalesce((v_pref ->> 'push_lounge_activity')::boolean, false) then
        insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
        values (r.user_id, 'lounge_hot', v_title, v_titles, '/lounge/posts/' || v_top, 'lw:' || to_char(v_mon, 'YYYYMMDD'), 'queued')
        on conflict do nothing;
      end if;
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  return jsonb_build_object('status', 'ok', 'sent', v_n);
end; $$;
grant execute on function public.lounge_weekly_digest_due() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'lounge_weekly_digest_due') as lounge_weekly_ok;
