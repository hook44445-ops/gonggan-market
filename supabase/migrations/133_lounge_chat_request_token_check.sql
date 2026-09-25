-- ============================================================
--  Migration 133: 라운지 대화 신청 — 잔액을 «신청할 때» 본다 (09-25)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  문제
--    지금은 잔액을 «수락할 때»(accept_lounge_chat)만 본다. 그래서 토큰이 없는 사람도
--    대화 신청을 만들 수 있고, 나중에 «받은 사람»이 수락을 누를 때 INSUFFICIENT_TOKENS 를 본다.
--    자기 지갑은 멀쩡한데 남의 지갑 때문에 막히고, 그 요청은 계속 pending 으로 남는다.
--
--  하는 일
--    request_comment_chat 에 신청자 잔액 검사를 더한다(20토큰 = TOKEN_COSTS.CHAT_REQUEST).
--    부족하면 요청을 만들지 않고 INSUFFICIENT_TOKENS + 잔액을 돌려준다.
--    차감은 지금처럼 «수락될 때»만 일어난다 — 신청만으로는 토큰이 줄지 않는다.
--    나머지(자기자신·시드대상·중복 검사, 반환 모양)는 027 그대로.
--
--  확인 칸 2개(아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

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
  v_new_id        uuid;
  v_balance       integer;
begin
  -- 자기자신 요청 금지
  if p_requester_id = p_target_id then
    return jsonb_build_object('error', 'SELF_REQUEST');
  end if;
  -- 대상 null(시드/익명 댓글) 금지
  if p_target_id is null then
    return jsonb_build_object('error', 'SEED_TARGET');
  end if;

  -- 이미 accepted 된 요청 (이 쌍 사이) — 잔액 검사보다 먼저(이미 열린 방은 돈이 더 들지 않는다)
  select id into v_accepted_req
    from public.lounge_chat_requests
   where requester_id = p_requester_id
     and target_id    = p_target_id
     and status       = 'accepted'
   order by created_at desc
   limit 1;
  if v_accepted_req is not null then
    return jsonb_build_object('status', 'already_accepted', 'request_id', v_accepted_req);
  end if;

  -- 이미 pending 된 요청 (같은 target에게)
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

  -- 신청자 잔액 — 여기서 막아야 «받는 사람»이 남의 지갑 때문에 수락에서 막히지 않는다.
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

  -- 새 요청 생성 (차감은 수락될 때 — accept_lounge_chat)
  insert into public.lounge_chat_requests
         (requester_id, target_id, post_id, source_comment_id)
  values (p_requester_id, p_target_id, p_post_id, p_comment_id)
  returning id into v_new_id;

  return jsonb_build_object('status', 'created', 'request_id', v_new_id);
end;
$$;

grant execute on function public.request_comment_chat(uuid, uuid, uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from pg_proc where proname = 'request_comment_chat')                            as fn_ok,
  position('INSUFFICIENT_TOKENS' in pg_get_functiondef('public.request_comment_chat'::regproc)) > 0 as checks_balance_ok;
