-- ============================================================
--  Migration 198: 매일 미션 3개 — «지금까지 쌓인 합계»가 아니라 «오늘(한국 날짜) 한 것»으로 · 하루 한 번
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(미션 진행도를 token_mission_today 로 받고 «오늘» 문구로 바뀐 버전) → 이 SQL.
--          (먼저 실행해도 망가지진 않는다 — 옛 앱은 합계로 «다 됐다» 싶어 불러도 서버가 not_met 로 거절할 뿐)
--
--  왜(대표 10-01 «오늘 한 것으로 가야 하지 않아?»):
--    · 194 까지 매일 미션(좋아요 20 · 댓글 10 · 글 3)은 «지금까지 쌓인 합계»로 판단했다 —
--      글 3개를 한 번 써 두면 그 뒤로는 앱만 열어도 매일 +5. 미션 이름과도 안 맞고 토큰이 활동 없이 쌓였다.
--  바꾼 뒤
--    · likes_received_20  : 오늘 내 글에 남이 누른 좋아요(lounge_post_likes · 내 좋아요 빼고 · 지운 글 빼고) 20 이상
--    · comments_written_10: 오늘 쓴 댓글(지운 것 빼고) 10 이상
--    · posts_written_3    : 오늘 쓴 글(스토리 · 지운 글 빼고) 3 이상
--    · 받는 횟수: 마지막 적립 후 24시간 → 한국 날짜로 하루 한 번(자정 지나면 다시)
--    · 한 번 보상(첫 글 등) · 가입 · 후기 보상은 194 그대로
--    · token_mission_today() — 로그인한 본인의 오늘 숫자 {posts, comments, likes_received}(앱 진행도 표시용)
--      (좋아요 표는 본인 줄만 읽을 수 있어 앱이 «받은 좋아요»를 직접 셀 수 없다)
--  되돌리기: 194 의 _token_mission_met · token_earn 을 다시 실행한다.
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 오늘(한국) 0시
create or replace function public._kst_today_start()
returns timestamptz language sql stable
set search_path = public, extensions as $$
  select (date_trunc('day', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
$$;

-- 오늘 숫자(내부) — 칸이 없어도 깨지지 않게
create or replace function public._token_today_counts(p_uid uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_from timestamptz := public._kst_today_start(); v_posts bigint := 0; v_comments bigint := 0; v_likes bigint := 0;
begin
  if p_uid is null then return jsonb_build_object('posts', 0, 'comments', 0, 'likes_received', 0); end if;
  begin
    select count(*) into v_posts from public.lounge_posts p
     where p.user_id = p_uid and p.created_at >= v_from
       and coalesce((to_jsonb(p) ->> 'is_deleted')::boolean, false) = false
       and coalesce((to_jsonb(p) ->> 'is_story')::boolean, false) = false;
  exception when others then v_posts := 0; end;
  begin
    select count(*) into v_comments from public.lounge_comments c
     where c.user_id = p_uid and c.created_at >= v_from
       and coalesce((to_jsonb(c) ->> 'is_deleted')::boolean, false) = false;
  exception when others then v_comments := 0; end;
  begin
    select count(*) into v_likes from public.lounge_post_likes k
      join public.lounge_posts p on p.id = k.post_id
     where p.user_id = p_uid and k.user_id <> p_uid and k.created_at >= v_from
       and coalesce((to_jsonb(p) ->> 'is_deleted')::boolean, false) = false;
  exception when others then v_likes := 0; end;
  return jsonb_build_object('posts', v_posts, 'comments', v_comments, 'likes_received', v_likes);
end; $$;
revoke execute on function public._token_today_counts(uuid) from public, anon, authenticated;

-- 앱 진행도 — 로그인한 본인 것만
create or replace function public.token_mission_today()
returns jsonb language sql stable security definer
set search_path = public, extensions as $$
  select public._token_today_counts(auth.uid());
$$;
revoke execute on function public.token_mission_today() from public, anon;
grant execute on function public.token_mission_today() to authenticated;

-- 미션을 했는가 — 매일 미션은 «오늘» 숫자로(194 의 한 번 보상 판단은 그대로)
create or replace function public._token_mission_met(p_uid uuid, p_action text)
returns boolean language plpgsql stable security definer
set search_path = public, extensions as $$
declare v jsonb;
begin
  if p_uid is null then return false; end if;
  case lower(coalesce(p_action, ''))
    when 'likes_received_20' then
      v := public._token_today_counts(p_uid); return (v ->> 'likes_received')::bigint >= 20;
    when 'comments_written_10' then
      v := public._token_today_counts(p_uid); return (v ->> 'comments')::bigint >= 10;
    when 'posts_written_3' then
      v := public._token_today_counts(p_uid); return (v ->> 'posts')::bigint >= 3;
    when 'first_post' then
      return exists (select 1 from public.lounge_posts p
                      where p.user_id = p_uid and coalesce((to_jsonb(p) ->> 'is_story')::boolean, false) = false);
    when 'first_story' then
      return exists (select 1 from public.lounge_posts p
                      where p.user_id = p_uid and coalesce((to_jsonb(p) ->> 'is_story')::boolean, false) = true);
    when 'first_comment' then
      return exists (select 1 from public.lounge_comments c where c.user_id = p_uid);
    when 'first_quote_request' then
      return exists (select 1 from public.requests r where r.user_id = p_uid);
    when 'profile_complete' then
      return exists (select 1 from public.users u
                      where u.id = p_uid
                        and coalesce(trim(to_jsonb(u) ->> 'name'), '') <> ''
                        and coalesce(trim(to_jsonb(u) ->> 'region'), '') <> '');
    else
      return true;   -- signup · construction_review(191 에서 따로 확인)
  end case;
exception when others then
  return false;      -- 표·칸이 없으면 주지 않는다
end; $$;
revoke execute on function public._token_mission_met(uuid, text) from public, anon, authenticated;

-- 적립 — 194 그대로 + 매일 미션은 «한국 날짜로 하루 한 번»
create or replace function public.token_earn(p_user_id uuid, p_action text, p_description text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_action text := lower(coalesce(p_action, ''));
  v_amount int  := public.token_earn_amount(v_action);
  v_bal    int;
  v_dup    boolean;
begin
  p_user_id := auth.uid();   -- 191: 앱이 보낸 값은 쓰지 않는다
  if p_user_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if v_amount <= 0 then
    return jsonb_build_object('status', 'ignored');
  end if;
  if not exists (select 1 from public.users u where u.id = p_user_id) then
    return jsonb_build_object('status', 'ignored');
  end if;
  -- 194: 미션을 정말 했는가(198: 매일 미션은 오늘 숫자)
  if not public._token_mission_met(p_user_id, v_action) then
    return jsonb_build_object('status', 'not_met');
  end if;

  v_bal := public.token_balance_lock(p_user_id);   -- 같은 사용자 동시 호출을 줄 세운다

  v_dup := case
    when v_action in ('likes_received_20', 'comments_written_10', 'posts_written_3') then
      -- 198: 한국 날짜로 하루 한 번
      exists (select 1 from public.space_token_logs l
               where l.user_id = p_user_id and l.type = 'earn' and l.action = v_action
                 and l.created_at >= public._kst_today_start())
    when v_action = 'construction_review' then
      exists (select 1 from public.space_token_logs l
               where l.user_id = p_user_id and l.type = 'earn' and l.action = v_action
                 and l.description is not distinct from p_description)
      -- 191: 받은 후기 보상 수가 내가 쓴 후기 수에 닿으면 더 주지 않는다
      or (select count(*) from public.space_token_logs l
           where l.user_id = p_user_id and l.type = 'earn' and l.action = v_action)
         >= (select count(*) from public.reviews r where r.user_id = p_user_id)
    else
      exists (select 1 from public.space_token_logs l
               where l.user_id = p_user_id and l.type = 'earn' and l.action = v_action)
  end;
  if v_dup then
    return jsonb_build_object('status', 'already', 'balance', v_bal);
  end if;

  update public.space_tokens set balance = balance + v_amount where user_id = p_user_id
  returning balance into v_bal;
  insert into public.space_token_logs (user_id, amount, type, action, description)
  values (p_user_id, v_amount, 'earn', v_action, p_description);

  return jsonb_build_object('status', 'earned', 'amount', v_amount, 'balance', v_bal);
end; $$;

revoke execute on function public.token_earn(uuid, text, text) from public, anon;
grant execute on function public.token_earn(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① today_rule: 매일 미션이 «오늘 숫자 · 하루 한 번»이다(194 · 191 확인은 그대로)
--  ② today_fn: 앱 진행도 함수가 있고 로그인한 사람만 부른다
select
  position('_token_today_counts' in pg_get_functiondef('public._token_mission_met(uuid,text)'::regprocedure)) > 0
  and position('198: 한국 날짜로 하루 한 번' in pg_get_functiondef('public.token_earn(uuid,text,text)'::regprocedure)) > 0
  and position('191: 받은 후기 보상' in pg_get_functiondef('public.token_earn(uuid,text,text)'::regprocedure)) > 0 as today_rule,
  to_regprocedure('public.token_mission_today()') is not null
  and not has_function_privilege('anon', 'public.token_mission_today()', 'execute')
  and has_function_privilege('authenticated', 'public.token_mission_today()', 'execute') as today_fn;
