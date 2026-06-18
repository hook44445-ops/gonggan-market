-- 078: 라운지 대화 요청 거절 + 나가기(소프트 숨김)
-- 범위 한정: reject_lounge_chat RPC, leave_lounge_chat RPC, leave 컬럼 추가만.
-- 기존 chats 테이블/accept_lounge_chat 토큰 정책/RLS 정책은 무변경.

-- ── 1. 컬럼 추가 (나가기 = hard delete 금지, 본인 쪽에서만 숨김) ────────────────
alter table public.lounge_chat_requests
  add column if not exists requester_left_at timestamptz,
  add column if not exists target_left_at    timestamptz;

-- ── 2. RPC: reject_lounge_chat ─────────────────────────────────────────────────
-- target만 거절 가능. idempotent. 토큰 차감 없음.
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

-- ── 3. RPC: leave_lounge_chat ───────────────────────────────────────────────────
-- requester 또는 target 본인만 나갈 수 있음. 내 목록에서만 숨김(메시지/행 hard delete 없음). idempotent.
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
grant execute on function public.reject_lounge_chat(uuid, uuid) to authenticated, anon;
grant execute on function public.leave_lounge_chat(uuid, uuid) to authenticated, anon;

notify pgrst, 'reload schema';
