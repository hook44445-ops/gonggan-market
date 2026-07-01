-- ════════════════════════════════════════════════════════════════════
-- 090_lounge_chat_token_fix_reject_fn.sql
-- 라운지 대화 수락/거절 마지막 버그 2건 수정.
--
-- 버그 1 — 수락 실패: column "space_tokens" does not exist
--   · accept_lounge_chat(027) 이 users.space_tokens 컬럼을 읽고/차감했다.
--   · 그러나 이 앱의 실제 토큰 잔액은 별도 테이블 space_tokens(user_id, balance)
--     에 저장된다(useSpaceToken · getSpaceToken/upsertSpaceToken · space_token_logs).
--     users.space_tokens 컬럼은 실 DB 에 존재하지 않아 수락이 항상 실패했다.
--   → accept_lounge_chat 을 space_tokens 테이블(balance) 기준으로 재작성.
--     (차감 대상=신청자, 20토큰, token_charged 로 idempotent — 기존 정책/문구 동일)
--
-- 버그 2 — 거절 실패: Could not find function reject_lounge_chat(...) in schema cache
--   · 078 이 reject_lounge_chat / leave_lounge_chat 함수를 정의했으나 실 DB 에
--     미적용(080 은 컬럼만 backfill). 앱 호출명/시그니처는 078 과 일치하므로
--     함수 자체가 없어 발생.
--   → 078 과 동일한 시그니처로 reject_lounge_chat / leave_lounge_chat 재생성(멱등).
--
-- 원칙: additive · 멱등. 토큰 정책(신청자 20 차감)·대화 로직·RLS·문구 무변경.
--       balance 저장소만 실제 스키마(space_tokens 테이블)에 맞춘다.
-- Supabase SQL Editor 에서 1회 실행(089 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1. accept_lounge_chat — space_tokens 테이블(balance) 기준으로 재작성 ──────────
create or replace function public.accept_lounge_chat(
  p_request_id  uuid,
  p_acceptor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req     record;
  v_balance integer;
begin
  -- 대상(target) 검증 + 현재 요청 상태 확인
  select * into v_req
    from public.lounge_chat_requests
   where id = p_request_id and target_id = p_acceptor_id;

  if v_req is null then
    return jsonb_build_object('error', 'NOT_FOUND_OR_NOT_TARGET');
  end if;

  if v_req.status = 'accepted' then
    return jsonb_build_object('status', 'already_accepted', 'request_id', p_request_id);
  end if;

  if v_req.status <> 'pending' then
    return jsonb_build_object('error', 'NOT_PENDING', 'status', v_req.status);
  end if;

  -- 신청자(requester) 잔액 확인 — 실제 토큰 저장소: space_tokens 테이블(balance).
  select balance into v_balance
    from public.space_tokens
   where user_id = v_req.requester_id;

  if coalesce(v_balance, 0) < 20 then
    return jsonb_build_object(
      'error',   'INSUFFICIENT_TOKENS',
      'balance', coalesce(v_balance, 0)
    );
  end if;

  -- 토큰 차감 (idempotent guard: token_charged) — space_tokens.balance 갱신 + 로그.
  if not coalesce(v_req.token_charged, false) then
    update public.space_tokens
       set balance = balance - 20
     where user_id = v_req.requester_id;

    insert into public.space_token_logs (user_id, type, action, amount, description)
    values (v_req.requester_id, 'spend', 'lounge_chat_accept', -20,
            '라운지 대화 수락 (' || p_request_id::text || ')');
  end if;

  -- 수락 처리
  update public.lounge_chat_requests
     set status        = 'accepted',
         token_charged = true,
         accepted_at   = now(),
         updated_at    = now()
   where id = p_request_id;

  return jsonb_build_object('status', 'accepted', 'request_id', p_request_id);
end;
$$;

-- ── 2. reject_lounge_chat — 078 과 동일 시그니처로 재생성(실 DB 누락 복구) ─────────
create or replace function public.reject_lounge_chat(
  p_request_id  uuid,
  p_rejector_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
begin
  select * into v_req
    from public.lounge_chat_requests
   where id = p_request_id and target_id = p_rejector_id;

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

-- ── 3. leave_lounge_chat — 078 과 동일 시그니처로 재생성(같은 배치 누락 방지) ───────
create or replace function public.leave_lounge_chat(
  p_request_id uuid,
  p_user_id    uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
begin
  select * into v_req
    from public.lounge_chat_requests
   where id = p_request_id and (requester_id = p_user_id or target_id = p_user_id);

  if v_req is null then
    return jsonb_build_object('error', 'NOT_FOUND_OR_NOT_PARTICIPANT');
  end if;

  if v_req.requester_id = p_user_id then
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

-- ── 4. 권한 부여 ──────────────────────────────────────────────────────────────
grant execute on function public.accept_lounge_chat(uuid, uuid) to anon, authenticated;
grant execute on function public.reject_lounge_chat(uuid, uuid) to anon, authenticated;
grant execute on function public.leave_lounge_chat(uuid, uuid)  to anon, authenticated;

notify pgrst, 'reload schema';
