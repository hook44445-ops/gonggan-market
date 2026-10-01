-- ============================================================
--  Migration 194: 공간토큰 미션 적립 — 서버가 «정말 했는지» 세어 보고 준다
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  순서: 앱 배포와 상관없음(앱은 바뀌지 않는다 — 조건이 안 되면 'not_met' 를 받고 화면은 그대로).
--
--  왜(10-01 점검 · 191 에서 남긴 것):
--    · token_earn(111 → 191)은 금액·중복만 서버가 정하고 «미션을 했는지»는 확인하지 않았다.
--      191 로 남의 것은 못 건드리게 됐지만, 본인이 앱 밖에서 부르면
--        매일 미션 3개(좋아요 20 · 댓글 10 · 글 3) 하루 +15, 한 번 보상(첫 글 · 첫 댓글 · 첫 스토리 · 첫 견적 · 프로필 완성) +45 를
--      아무것도 안 하고 받을 수 있었다.
--  바꾼 뒤 — 앱이 화면에서 쓰는 기준(useSpaceToken · getUserMissionStats)과 같게 서버가 센다:
--    · likes_received_20  : 내 글(지운 글 빼고)의 좋아요 합 20 이상
--    · comments_written_10: 내 댓글(지운 것 빼고) 10 이상
--    · posts_written_3    : 내 글(스토리·지운 글 빼고) 3 이상
--    · first_post · first_story · first_comment · first_quote_request : 그것이 하나 이상 있을 때
--    · profile_complete   : 이름 · 지역이 채워져 있을 때
--    · signup · construction_review(191 후기 수 확인) : 그대로
--    · 조건이 안 되면 {"status":"not_met"} — 적립·원장 없음
--  되돌리기: 191 의 token_earn 을 다시 실행한다.
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 미션을 했는가(내부) — 칸이 없어도 깨지지 않게 to_jsonb 로 읽는다
create or replace function public._token_mission_met(p_uid uuid, p_action text)
returns boolean language plpgsql stable security definer
set search_path = public, extensions as $$
declare v bigint;
begin
  if p_uid is null then return false; end if;
  case lower(coalesce(p_action, ''))
    when 'likes_received_20' then
      select coalesce(sum(coalesce((to_jsonb(p) ->> 'like_count')::bigint, 0)), 0) into v
        from public.lounge_posts p
       where p.user_id = p_uid and coalesce((to_jsonb(p) ->> 'is_deleted')::boolean, false) = false;
      return v >= 20;
    when 'comments_written_10' then
      select count(*) into v from public.lounge_comments c
       where c.user_id = p_uid and coalesce((to_jsonb(c) ->> 'is_deleted')::boolean, false) = false;
      return v >= 10;
    when 'posts_written_3' then
      select count(*) into v from public.lounge_posts p
       where p.user_id = p_uid and coalesce((to_jsonb(p) ->> 'is_deleted')::boolean, false) = false
         and coalesce((to_jsonb(p) ->> 'is_story')::boolean, false) = false;
      return v >= 3;
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

-- 적립 — 191 그대로 + «했는지» 확인
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
  -- 194: 미션을 정말 했는가
  if not public._token_mission_met(p_user_id, v_action) then
    return jsonb_build_object('status', 'not_met');
  end if;

  v_bal := public.token_balance_lock(p_user_id);   -- 같은 사용자 동시 호출을 줄 세운다

  v_dup := case
    when v_action in ('likes_received_20', 'comments_written_10', 'posts_written_3') then
      exists (select 1 from public.space_token_logs l
               where l.user_id = p_user_id and l.type = 'earn' and l.action = v_action
                 and l.created_at > now() - interval '24 hours')
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
--  ① mission_check: token_earn 이 «했는지»를 확인한다(191 의 토큰 사용자 · 후기 수 확인도 그대로)
--  ② helper_closed: 확인 함수는 앱에서 직접 못 부른다
select
  position('_token_mission_met' in pg_get_functiondef('public.token_earn(uuid,text,text)'::regprocedure)) > 0
  and position('191: 받은 후기 보상' in pg_get_functiondef('public.token_earn(uuid,text,text)'::regprocedure)) > 0
  and position('auth.uid()' in pg_get_functiondef('public.token_earn(uuid,text,text)'::regprocedure)) > 0 as mission_check,
  not has_function_privilege('anon', 'public._token_mission_met(uuid,text)', 'execute')
  and not has_function_privilege('authenticated', 'public._token_mission_met(uuid,text)', 'execute') as helper_closed;
