-- 085_accept_lounge_chat_space_tokens_ledger.sql
-- 라운지 대화 수락 시 "상대방 토큰이 부족해요 (잔액 0)" 오류 수정.
--
-- [원인] 토큰 원장이 이중화되어 불일치.
--   · 앱 UI/경제(useSpaceToken)는 space_tokens 테이블의 balance 를 읽고(행이 없으면
--     기본 20), spend/earn 도 upsertSpaceToken 으로 이 테이블에 기록한다.
--   · 그런데 accept_lounge_chat RPC(027)는 users.space_tokens 컬럼(기본 0, 앱 경제와
--     미동기)을 읽어 잔액을 판정 → 고객 UI 가 20 이어도 RPC 는 0 을 읽어
--     INSUFFICIENT_TOKENS(잔액 0) 를 반환했다.
--
-- [수정] RPC 의 잔액 조회/차감을 앱의 실제 원장인 space_tokens 테이블로 통일한다.
--   · 차감 대상은 요청자(requester_id) — 수락자(업체) 토큰은 건드리지 않음.
--   · 수락 시 1회만 차감(token_charged guard) — 동일 요청 중복 수락 재차감 금지.
--   · 잔액 20 미만이면 INSUFFICIENT_TOKENS. 행이 없으면 기본 20(useSpaceToken 과 동일).
--   · space_token_logs 기록 유지. users.space_tokens 컬럼/admin 조정 경로는 무변경.
--   (하트/댓글 무료, 신청 로직, 대화방 생성 로직은 변경 없음.)

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
