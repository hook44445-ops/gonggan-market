-- ============================================================
--  Migration 189: 라운지 대화 신청·수락·거절·나가기 — 로그인 토큰의 사용자만 + 고객–업체 대화는 서버에서도 막기
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(이 네 함수를 로그인 토큰으로 부르는 버전) → 이 SQL.
--
--  왜(10-01 점검):
--    · request_comment_chat · accept_lounge_chat · reject_lounge_chat · leave_lounge_chat 가 앱이 보낸 사용자 ID 를 그대로 믿었고
--      로그인 안 한 사람(anon)도 부를 수 있었다 → 남의 이름으로 대화 신청 · 남의 신청을 대신 수락해 신청자 토큰 20 을 빼게 할 수 있었다.
--    · 대표 10-01 «라운지 업체 카드 메시지 끄기»(입찰 전 고객–업체 연결 금지 · 09-30) — 앱은 버튼만 숨겼다(#928). 서버도 막는다.
--  바꾼 뒤
--    · 네 함수 모두 auth.uid() 로만 판단(넘긴 ID 는 무시) · 로그인 안 했으면 42501 LOGIN_REQUIRED · anon 실행 권한 회수
--    · 고객 ↔ 업체(업체 주인 = companies.owner_id) 사이의 새 신청·수락은 {"error":"COMPANY_CHAT_BLOCKED"}
--      (업체끼리 · 고객끼리는 그대로 · 이미 열린 방과 나가기는 그대로)
--    · 그 밖의 동작(이미 열린 방 · 대기 중 · 상대가 먼저 신청 · 토큰 20 확인 · 수락 때 차감)은 134·090 그대로
--  되돌리기: 134 의 request_comment_chat · 090 의 accept/reject/leave 를 다시 실행하고 «grant execute … to anon» 을 다시 준다.
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 업체 주인인가(고객–업체 대화 판정용 · 내부)
create or replace function public._is_company_owner(p_uid uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select p_uid is not null and exists (select 1 from public.companies c where c.owner_id = p_uid);
$$;
revoke execute on function public._is_company_owner(uuid) from public, anon, authenticated;

-- 1) 대화 신청 — 신청자 = 토큰의 사용자
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
  v_uid           uuid := auth.uid();
  v_existing_req  uuid;
  v_accepted_req  uuid;
  v_reverse_req   uuid;
  v_new_id        uuid;
  v_balance       integer;
begin
  if v_uid is null then
    raise exception 'LOGIN_REQUIRED' using errcode = '42501';
  end if;
  if v_uid = p_target_id then
    return jsonb_build_object('error', 'SELF_REQUEST');
  end if;
  if p_target_id is null then
    return jsonb_build_object('error', 'SEED_TARGET');
  end if;

  -- 이미 열린 방 — 누가 먼저 신청했든(양방향). 돈이 더 들지 않고, 앱은 이 방을 연다.
  select id into v_accepted_req
    from public.lounge_chat_requests
   where status = 'accepted'
     and ((requester_id = v_uid and target_id = p_target_id)
       or (requester_id = p_target_id and target_id = v_uid))
   order by created_at desc
   limit 1;
  if v_accepted_req is not null then
    return jsonb_build_object('status', 'already_accepted', 'request_id', v_accepted_req);
  end if;

  -- 고객 ↔ 업체 새 대화는 막는다(입찰 전 연결 금지 · 대표 09-30 · 10-01)
  if public._is_company_owner(v_uid) <> public._is_company_owner(p_target_id) then
    return jsonb_build_object('error', 'COMPANY_CHAT_BLOCKED');
  end if;

  -- 내가 이미 보낸 대기 요청
  select id into v_existing_req
    from public.lounge_chat_requests
   where requester_id = v_uid
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
     and target_id    = v_uid
     and status       = 'pending'
   order by created_at desc
   limit 1;
  if v_reverse_req is not null then
    return jsonb_build_object('status', 'reverse_pending', 'request_id', v_reverse_req);
  end if;

  -- 신청자 잔액(133)
  select balance into v_balance
    from public.space_tokens
   where user_id = v_uid;
  if coalesce(v_balance, 0) < 20 then
    return jsonb_build_object(
      'error',   'INSUFFICIENT_TOKENS',
      'balance', coalesce(v_balance, 0),
      'needed',  20
    );
  end if;

  insert into public.lounge_chat_requests
         (requester_id, target_id, post_id, source_comment_id)
  values (v_uid, p_target_id, p_post_id, p_comment_id)
  returning id into v_new_id;

  return jsonb_build_object('status', 'created', 'request_id', v_new_id);
end;
$$;

-- 2) 수락 — 수락자 = 토큰의 사용자(그 요청의 대상만)
create or replace function public.accept_lounge_chat(
  p_request_id  uuid,
  p_acceptor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_req     record;
  v_balance integer;
begin
  if v_uid is null then
    raise exception 'LOGIN_REQUIRED' using errcode = '42501';
  end if;

  select * into v_req
    from public.lounge_chat_requests
   where id = p_request_id and target_id = v_uid;

  if v_req is null then
    return jsonb_build_object('error', 'NOT_FOUND_OR_NOT_TARGET');
  end if;

  if v_req.status = 'accepted' then
    return jsonb_build_object('status', 'already_accepted', 'request_id', p_request_id);
  end if;

  if v_req.status <> 'pending' then
    return jsonb_build_object('error', 'NOT_PENDING', 'status', v_req.status);
  end if;

  -- 189 이전에 들어온 고객 ↔ 업체 대기 신청도 열지 않는다(토큰도 빼지 않는다)
  if public._is_company_owner(v_req.requester_id) <> public._is_company_owner(v_uid) then
    return jsonb_build_object('error', 'COMPANY_CHAT_BLOCKED');
  end if;

  select balance into v_balance
    from public.space_tokens
   where user_id = v_req.requester_id;

  if coalesce(v_balance, 0) < 20 then
    return jsonb_build_object(
      'error',   'INSUFFICIENT_TOKENS',
      'balance', coalesce(v_balance, 0)
    );
  end if;

  if not coalesce(v_req.token_charged, false) then
    update public.space_tokens
       set balance = balance - 20
     where user_id = v_req.requester_id;

    insert into public.space_token_logs (user_id, type, action, amount, description)
    values (v_req.requester_id, 'spend', 'lounge_chat_accept', -20,
            '라운지 대화 수락 (' || p_request_id::text || ')');
  end if;

  update public.lounge_chat_requests
     set status        = 'accepted',
         token_charged = true,
         accepted_at   = now(),
         updated_at    = now()
   where id = p_request_id;

  return jsonb_build_object('status', 'accepted', 'request_id', p_request_id);
end;
$$;

-- 3) 거절 — 거절자 = 토큰의 사용자(그 요청의 대상만)
create or replace function public.reject_lounge_chat(
  p_request_id  uuid,
  p_rejector_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req record;
begin
  if v_uid is null then
    raise exception 'LOGIN_REQUIRED' using errcode = '42501';
  end if;

  select * into v_req
    from public.lounge_chat_requests
   where id = p_request_id and target_id = v_uid;

  if v_req is null then
    return jsonb_build_object('error', 'NOT_FOUND_OR_NOT_TARGET');
  end if;

  if v_req.status = 'rejected' then
    return jsonb_build_object('status', 'already_rejected', 'request_id', p_request_id);
  end if;

  if v_req.status = 'accepted' then
    return jsonb_build_object('error', 'ALREADY_ACCEPTED');
  end if;

  update public.lounge_chat_requests
     set status     = 'rejected',
         updated_at = now()
   where id = p_request_id;

  return jsonb_build_object('status', 'rejected', 'request_id', p_request_id);
end;
$$;

-- 4) 나가기 — 나가는 사람 = 토큰의 사용자(그 방의 두 사람만 · 내 목록에서만 숨김)
create or replace function public.leave_lounge_chat(
  p_request_id uuid,
  p_user_id    uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req record;
begin
  if v_uid is null then
    raise exception 'LOGIN_REQUIRED' using errcode = '42501';
  end if;

  select * into v_req
    from public.lounge_chat_requests
   where id = p_request_id and (requester_id = v_uid or target_id = v_uid);

  if v_req is null then
    return jsonb_build_object('error', 'NOT_FOUND_OR_NOT_PARTICIPANT');
  end if;

  if v_req.requester_id = v_uid then
    update public.lounge_chat_requests
       set requester_left_at = coalesce(requester_left_at, now()),
           updated_at        = now()
     where id = p_request_id;
  else
    update public.lounge_chat_requests
       set target_left_at = coalesce(target_left_at, now()),
           updated_at     = now()
     where id = p_request_id;
  end if;

  return jsonb_build_object('status', 'left', 'request_id', p_request_id);
end;
$$;

revoke execute on function public.request_comment_chat(uuid, uuid, uuid, uuid) from public, anon;
revoke execute on function public.accept_lounge_chat(uuid, uuid) from public, anon;
revoke execute on function public.reject_lounge_chat(uuid, uuid) from public, anon;
revoke execute on function public.leave_lounge_chat(uuid, uuid) from public, anon;
grant execute on function public.request_comment_chat(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.accept_lounge_chat(uuid, uuid) to authenticated;
grant execute on function public.reject_lounge_chat(uuid, uuid) to authenticated;
grant execute on function public.leave_lounge_chat(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① token_actor: 네 함수가 auth.uid() 로 판단하고 업체 대화를 막는다
--  ② no_anon: 로그인 안 한 사람(anon)은 네 함수를 부를 수 없다
select
  position('COMPANY_CHAT_BLOCKED' in pg_get_functiondef('public.request_comment_chat(uuid,uuid,uuid,uuid)'::regprocedure)) > 0
  and position('auth.uid()' in pg_get_functiondef('public.accept_lounge_chat(uuid,uuid)'::regprocedure)) > 0
  and position('auth.uid()' in pg_get_functiondef('public.reject_lounge_chat(uuid,uuid)'::regprocedure)) > 0
  and position('auth.uid()' in pg_get_functiondef('public.leave_lounge_chat(uuid,uuid)'::regprocedure)) > 0 as token_actor,
  not has_function_privilege('anon', 'public.request_comment_chat(uuid,uuid,uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.accept_lounge_chat(uuid,uuid)', 'execute') as no_anon;
