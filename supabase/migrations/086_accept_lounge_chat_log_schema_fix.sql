-- 086_accept_lounge_chat_log_schema_fix.sql
-- 085 후속 수정. accept_lounge_chat 내부의 space_token_logs INSERT 가 실제 스키마와
-- 불일치해 실패하던 것을 바로잡는다.
--
-- [원인] space_token_logs 실제 컬럼: (id, user_id, amount, type, description,
--        related_id, created_at). 'action' 컬럼은 존재하지 않는데 085/027 은
--        (user_id, type, action, amount, description) 로 insert 해 실패했다.
--
-- [수정] 실제 스키마에 맞춰 (user_id, amount, type, description, related_id) 로 저장.
--        related_id = p_request_id. 그 외 로직(잔액=space_tokens 테이블 기준,
--        요청자 차감, 1회 차감 guard, 대화방/수락 처리)은 085 와 동일.
--        새 컬럼/DB 구조 변경 없음.

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
  -- 요청 조회 + 수락자(=target) 검증 (idempotent)
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

  -- 요청자 잔액 — 앱 원장(space_tokens 테이블) 기준. 행이 없으면 신규 기본 20.
  select balance into v_balance
    from public.space_tokens
   where user_id = v_req.requester_id;

  if v_balance is null then
    v_balance := 20;
  end if;

  if v_balance < 20 then
    return jsonb_build_object('error', 'INSUFFICIENT_TOKENS', 'balance', v_balance);
  end if;

  -- 차감(1회) — 중복 수락 시 재차감 금지. 요청자 space_tokens 테이블 갱신.
  if not v_req.token_charged then
    update public.space_tokens
       set balance = balance - 20
     where user_id = v_req.requester_id;

    if not found then
      -- 행이 없던 신규(기본 20) → 차감 후 0 으로 생성
      insert into public.space_tokens (user_id, balance)
      values (v_req.requester_id, greatest(v_balance - 20, 0));
    end if;

    -- 실제 스키마: (user_id, amount, type, description, related_id)
    insert into public.space_token_logs (user_id, amount, type, description, related_id)
    values (v_req.requester_id, -20, 'spend', '라운지 대화 수락', p_request_id);
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
