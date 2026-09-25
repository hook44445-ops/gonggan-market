-- ============================================================
--  Migration 134: 토큰 잔액·내역을 서버에서 읽기(L3) · 대화 신청의 «이미 열린 방»을 양방향으로(L6)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  점검 09-26(라운지 대화 양방향)
--    L3  앱이 space_tokens·space_token_logs 를 직접 읽는데 로그인 세션이 없어 정책에 막힌다 →
--        빈 값 → 화면은 늘 「20토큰 · 내역이 없어요」. (DB: 김태웅 30, 적립 기록 여러 줄)
--        적립·사용은 이미 서버 함수(111)다 — 읽기도 서버 함수로.
--    L6  request_comment_chat 의 «이미 열린 방» 확인이 한쪽 방향(신청자→대상)만 봤다.
--        7/1 에 타일러→김태웅 방이 있었는데, 오늘 김태웅→타일러 신청이 새 방을 만들고 20토큰을 또 뺐다.
--
--  하는 일
--    1) token_summary(사용자) → { balance, logs[최근 50] }  (없으면 balance 0 — 20 으로 부풀리지 않는다)
--    2) request_comment_chat — 이미 열린 방을 양방향으로 확인하고 그 request_id 를 돌려준다(앱이 그 방을 연다).
--       상대가 나에게 보낸 대기 요청이 있으면 새 요청을 만들지 않고 'reverse_pending' 을 돌려준다
--       (대화함에서 수락하면 된다 — 돈은 신청한 쪽이 낸다).
--       잔액 검사(133)는 그대로.
--
--  확인 칸 3개(아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 1) 토큰 잔액·내역 읽기 -------------------------------------------------------------
create or replace function public.token_summary(p_user_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_balance integer; v_logs jsonb;
begin
  if p_user_id is null then
    return jsonb_build_object('balance', 0, 'logs', '[]'::jsonb);
  end if;
  select balance into v_balance from public.space_tokens where user_id = p_user_id;
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v_logs
    from (
      select l.type, l.action, l.amount, l.description, l.created_at
        from public.space_token_logs l
       where l.user_id = p_user_id
       order by l.created_at desc
       limit 50
    ) x;
  return jsonb_build_object('balance', coalesce(v_balance, 0), 'logs', v_logs);
end; $$;
grant execute on function public.token_summary(uuid) to anon, authenticated;

-- 2) 대화 신청 — 이미 열린 방은 양방향으로 ------------------------------------------
create or replace function public.request_comment_chat(
  p_requester_id  uuid,
  p_target_id     uuid,
  p_post_id       uuid,
  p_comment_id    uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_req  uuid;
  v_accepted_req  uuid;
  v_reverse_req   uuid;
  v_new_id        uuid;
  v_balance       integer;
begin
  if p_requester_id = p_target_id then
    return jsonb_build_object('error', 'SELF_REQUEST');
  end if;
  if p_target_id is null then
    return jsonb_build_object('error', 'SEED_TARGET');
  end if;

  -- 이미 열린 방 — 누가 먼저 신청했든(양방향). 돈이 더 들지 않고, 앱은 이 방을 연다.
  select id into v_accepted_req
    from public.lounge_chat_requests
   where status = 'accepted'
     and ((requester_id = p_requester_id and target_id = p_target_id)
       or (requester_id = p_target_id    and target_id = p_requester_id))
   order by created_at desc
   limit 1;
  if v_accepted_req is not null then
    return jsonb_build_object('status', 'already_accepted', 'request_id', v_accepted_req);
  end if;

  -- 내가 이미 보낸 대기 요청
  select id into v_existing_req
    from public.lounge_chat_requests
   where requester_id = p_requester_id
     and target_id    = p_target_id
     and status       = 'pending'
   order by created_at desc
   limit 1;
  if v_existing_req is not null then
    return jsonb_build_object('status', 'already_pending', 'request_id', v_existing_req);
  end if;

  -- 상대가 나에게 보낸 대기 요청 — 새로 만들지 않고 «수락하라»고 알려 준다
  select id into v_reverse_req
    from public.lounge_chat_requests
   where requester_id = p_target_id
     and target_id    = p_requester_id
     and status       = 'pending'
   order by created_at desc
   limit 1;
  if v_reverse_req is not null then
    return jsonb_build_object('status', 'reverse_pending', 'request_id', v_reverse_req);
  end if;

  -- 신청자 잔액(133)
  select balance into v_balance
    from public.space_tokens
   where user_id = p_requester_id;
  if coalesce(v_balance, 0) < 20 then
    return jsonb_build_object(
      'error',   'INSUFFICIENT_TOKENS',
      'balance', coalesce(v_balance, 0),
      'needed',  20
    );
  end if;

  insert into public.lounge_chat_requests
         (requester_id, target_id, post_id, source_comment_id)
  values (p_requester_id, p_target_id, p_post_id, p_comment_id)
  returning id into v_new_id;

  return jsonb_build_object('status', 'created', 'request_id', v_new_id);
end;
$$;
grant execute on function public.request_comment_chat(uuid, uuid, uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 셋 다 true 면 끝
select
  exists (select 1 from pg_proc where proname = 'token_summary')                                        as summary_ok,
  position('reverse_pending' in pg_get_functiondef('public.request_comment_chat'::regproc)) > 0            as both_ways_ok,
  position('INSUFFICIENT_TOKENS' in pg_get_functiondef('public.request_comment_chat'::regproc)) > 0        as balance_check_kept_ok;
