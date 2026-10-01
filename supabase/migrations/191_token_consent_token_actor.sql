-- ============================================================
--  Migration 191: 공간토큰 적립·사용·잔액 · 약관 동의 기록 — 로그인 토큰의 사용자만
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(이 다섯 함수를 로그인 토큰으로 부르는 버전) → 이 SQL.
--
--  왜(10-01 점검 — 189 와 같은 종류의 구멍):
--    · token_earn · token_spend · token_summary(111 · 134), consent_record · consent_types_for(121) 가
--      앱이 보낸 사용자 ID 를 그대로 믿었고 로그인 안 한 사람(anon)도 부를 수 있었다.
--      - token_spend: 남의 ID 로 불러 남의 토큰을 0 으로 만들 수 있었다(한 번에 1000 까지).
--      - token_earn : 남의 ID 로 적립을 받게 하거나, 'construction_review'(+15)를 설명 글자만 바꿔 끝없이 받을 수 있었다
--                     (공간토큰은 돈으로 사는 것 — 99 purchase_space_tokens).
--      - token_summary: 아무 사용자의 토큰 잔액·내역을 읽을 수 있었다.
--      - consent_record: 남의 이름으로 «약관·개인정보 동의» 기록을 남길 수 있었다(동의 증빙이 위조된다).
--      - consent_types_for: 아무 사용자의 동의 목록을 읽을 수 있었다.
--  바꾼 뒤
--    · 다섯 함수 모두 auth.uid() 로만 판단(넘긴 ID 는 무시 · 이름만 남김 = 앱 호환)
--      쓰기(token_earn · token_spend)는 로그인 안 했으면 42501 LOGIN_REQUIRED
--      읽기·동의(token_summary · consent_types_for · consent_record)는 로그인 안 했으면 빈 결과 · 0
--      (앱의 동의는 기기에도 남아 다음 로그인 때 다시 올린다 — ConsentGate syncConsents)
--    · construction_review 적립은 «내가 쓴 후기 수»까지만(후기 없이 설명만 바꿔 받기 막기)
--    · 금액·중복 규칙(111)은 그대로 · anon 실행 권한 회수
--  되돌리기: 111 의 token_earn·token_spend, 134 의 token_summary, 121 의 consent_record·consent_types_for 를 다시 실행하고
--            «grant execute … to anon» 을 다시 준다.
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 1) 적립 — 받는 사람 = 토큰의 사용자
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

-- 2) 사용 — 쓰는 사람 = 토큰의 사용자
create or replace function public.token_spend(p_user_id uuid, p_action text, p_amount int, p_description text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_bal int;
begin
  p_user_id := auth.uid();   -- 191
  if p_user_id is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  if coalesce(p_amount, 0) <= 0 or p_amount > 1000 then
    return jsonb_build_object('error', 'INVALID');
  end if;
  v_bal := public.token_balance_lock(p_user_id);
  if v_bal < p_amount then
    return jsonb_build_object('error', 'INSUFFICIENT_TOKENS', 'balance', v_bal);
  end if;
  update public.space_tokens set balance = balance - p_amount where user_id = p_user_id
  returning balance into v_bal;
  insert into public.space_token_logs (user_id, amount, type, action, description)
  values (p_user_id, p_amount, 'spend', lower(coalesce(p_action, 'spend')), p_description);
  return jsonb_build_object('status', 'spent', 'balance', v_bal);
end; $$;

-- 3) 잔액·내역 — 내 것만
create or replace function public.token_summary(p_user_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_balance integer; v_logs jsonb;
begin
  p_user_id := auth.uid();   -- 191
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

-- 4) 동의 기록 — 동의한 사람 = 토큰의 사용자
create or replace function public.consent_record(p_user_id uuid, p_types text[], p_user_agent text default null)
returns integer language plpgsql security definer
set search_path = public, extensions as $$
declare v_n integer := 0;
begin
  p_user_id := auth.uid();   -- 191
  if p_user_id is null or not exists (select 1 from public.users where id = p_user_id) then
    return 0;
  end if;
  insert into public.user_consents (user_id, consent_type, user_agent)
  select p_user_id, t, left(p_user_agent, 300)
    from unnest(coalesce(p_types, '{}'::text[])) as t
   where coalesce(trim(t), '') <> '' and length(t) <= 60
  on conflict (user_id, consent_type) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end; $$;

-- 5) 동의 목록 — 내 것만
create or replace function public.consent_types_for(p_user_id uuid)
returns text[] language sql stable security definer
set search_path = public, extensions as $$
  select coalesce(array_agg(consent_type order by consent_type), '{}'::text[])
    from public.user_consents where auth.uid() is not null and user_id = auth.uid();   -- 191
$$;

revoke execute on function public.token_earn(uuid, text, text) from public, anon;
revoke execute on function public.token_spend(uuid, text, int, text) from public, anon;
revoke execute on function public.token_summary(uuid) from public, anon;
revoke execute on function public.consent_record(uuid, text[], text) from public, anon;
revoke execute on function public.consent_types_for(uuid) from public, anon;
grant execute on function public.token_earn(uuid, text, text) to authenticated;
grant execute on function public.token_spend(uuid, text, int, text) to authenticated;
grant execute on function public.token_summary(uuid) to authenticated;
grant execute on function public.consent_record(uuid, text[], text) to authenticated;
grant execute on function public.consent_types_for(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① token_actor: 다섯 함수가 auth.uid() 로 판단하고, 후기 보상은 후기 수까지만
--  ② no_anon: 로그인 안 한 사람(anon)은 다섯 함수를 부를 수 없다
select
  position('191: 받은 후기 보상' in pg_get_functiondef('public.token_earn(uuid,text,text)'::regprocedure)) > 0
  and position('auth.uid()' in pg_get_functiondef('public.token_spend(uuid,text,int,text)'::regprocedure)) > 0
  and position('auth.uid()' in pg_get_functiondef('public.token_summary(uuid)'::regprocedure)) > 0
  and position('auth.uid()' in pg_get_functiondef('public.consent_record(uuid,text[],text)'::regprocedure)) > 0
  and position('auth.uid()' in pg_get_functiondef('public.consent_types_for(uuid)'::regprocedure)) > 0 as token_actor,
  not has_function_privilege('anon', 'public.token_earn(uuid,text,text)', 'execute')
  and not has_function_privilege('anon', 'public.token_spend(uuid,text,int,text)', 'execute')
  and not has_function_privilege('anon', 'public.token_summary(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.consent_record(uuid,text[],text)', 'execute')
  and not has_function_privilege('anon', 'public.consent_types_for(uuid)', 'execute') as no_anon;
