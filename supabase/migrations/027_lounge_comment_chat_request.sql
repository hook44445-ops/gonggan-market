-- 027: 라운지 댓글 작성자 → 대화 신청 (lounge_chat_requests 확장 + RPCs)
-- lounge_chat_requests 테이블이 없으면 생성, 있으면 컬럼 추가
-- RPC request_comment_chat  : 중복/자기자신/시드 검사 후 요청 생성 (idempotent)
-- RPC accept_lounge_chat     : 수락 + 요청자 20토큰 차감 (idempotent)

-- ── 1. 테이블 보장 ─────────────────────────────────────────────────────────────
create table if not exists public.lounge_chat_requests (
  id              uuid        primary key default gen_random_uuid(),
  post_id         uuid        references public.lounge_posts(id)    on delete cascade,
  requester_id    uuid        references public.users(id)            on delete cascade,
  target_id       uuid        references public.users(id)            on delete cascade,
  status          text        not null default 'pending'
                              check (status in ('pending','accepted','rejected','expired')),
  token_charged   boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.lounge_chat_requests enable row level security;

-- RLS (중복 create 시 skip)
do $$ begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'lounge_chat_requests' and policyname = 'lounge_chat_requests: owner read'
  ) then
    execute $p$
      create policy "lounge_chat_requests: owner read" on public.lounge_chat_requests
        for select using (auth.uid() = requester_id or auth.uid() = target_id)
    $p$;
  end if;
  if not exists (
    select 1 from pg_policies
     where tablename = 'lounge_chat_requests' and policyname = 'lounge_chat_requests: auth insert'
  ) then
    execute $p$
      create policy "lounge_chat_requests: auth insert" on public.lounge_chat_requests
        for insert with check (auth.uid() = requester_id)
    $p$;
  end if;
  if not exists (
    select 1 from pg_policies
     where tablename = 'lounge_chat_requests' and policyname = 'lounge_chat_requests: target update'
  ) then
    execute $p$
      create policy "lounge_chat_requests: target update" on public.lounge_chat_requests
        for update using (auth.uid() = target_id or auth.uid() = requester_id)
    $p$;
  end if;
end $$;

-- ── 2. 컬럼 추가 ──────────────────────────────────────────────────────────────
alter table public.lounge_chat_requests
  add column if not exists source_comment_id uuid
    references public.lounge_comments(id) on delete set null,
  add column if not exists accepted_at timestamptz;

-- ── 3. RPC: request_comment_chat ──────────────────────────────────────────────
-- security definer: RLS 우회로 중복 pending/accepted 안전 확인
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
begin
  -- 자기자신 요청 금지
  if p_requester_id = p_target_id then
    return jsonb_build_object('error', 'SELF_REQUEST');
  end if;
  -- 대상 null(시드/익명 댓글) 금지
  if p_target_id is null then
    return jsonb_build_object('error', 'SEED_TARGET');
  end if;
  -- 이미 accepted 된 요청 (이 쌍 사이)
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
  -- 새 요청 생성
  insert into public.lounge_chat_requests
         (requester_id, target_id, post_id, source_comment_id)
  values (p_requester_id, p_target_id, p_post_id, p_comment_id)
  returning id into v_new_id;

  return jsonb_build_object('status', 'created', 'request_id', v_new_id);
end;
$$;

-- ── 4. RPC: accept_lounge_chat ────────────────────────────────────────────────
-- 수락 + 요청자(requester) 20토큰 차감. token_charged 로 idempotent 보장.
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
  -- 이미 accepted 인지 먼저 확인 (idempotent)
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

  -- 요청자 잔액 확인
  select space_tokens into v_balance
    from public.users
   where id = v_req.requester_id;

  if coalesce(v_balance, 0) < 20 then
    return jsonb_build_object(
      'error',   'INSUFFICIENT_TOKENS',
      'balance', coalesce(v_balance, 0)
    );
  end if;

  -- 토큰 차감 (idempotent guard)
  if not v_req.token_charged then
    update public.users
       set space_tokens = space_tokens - 20
     where id = v_req.requester_id;

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

-- ── 5. 권한 부여 ──────────────────────────────────────────────────────────────
grant execute on function public.request_comment_chat(uuid, uuid, uuid, uuid) to authenticated, anon;
grant execute on function public.accept_lounge_chat(uuid, uuid) to authenticated, anon;

notify pgrst, 'reload schema';
