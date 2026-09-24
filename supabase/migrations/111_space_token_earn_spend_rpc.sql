-- ============================================================
--  Migration 111: 공간토큰 적립·사용을 서버 함수로 (D5)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경 (총점검 09-24 3차)
--    앱(useSpaceToken)이 space_tokens 를 직접 upsert(정책 거부 42501)하고, 원장에 없는 action 칸을 써서(PGRST204)
--    적립·사용이 모두 저장되지 않았다. 화면 잔액만 바뀌고, 다시 들어오면 원래대로.
--    원장이 안 쌓이니 «이미 받았는지» 판단도 못 해 로그인할 때마다 미션 보상을 다시 시도했다.
--    (대화 신청 차감 accept_lounge_chat · 구매 purchase_space_tokens 는 이미 서버 함수라 정상)
--  고침
--    · 원장에 action 칸 추가(없던 칸 — 앱이 쓰던 이름 그대로)
--    · token_earn: 금액·중복 규칙을 서버가 정한다(앱이 금액을 보내지 않는다 → 조작으로 부풀릴 수 없음)
--        한 번만: signup · profile_complete · first_post · first_comment · first_story · first_quote_request
--        24시간마다: likes_received_20 · comments_written_10 · posts_written_3
--        계약마다 한 번: construction_review (설명=계약 식별)
--    · token_spend: 잔액 확인 후 차감(부족하면 거절)
--    · 행이 없으면 기본 잔액 20(앱·기존 함수와 같다)
-- ============================================================

set search_path = public, extensions;

alter table public.space_token_logs add column if not exists action text;

create or replace function public.token_earn_amount(p_action text)
returns integer language sql immutable as $$
  select case lower(p_action)
    when 'signup'               then 20
    when 'profile_complete'     then 15
    when 'first_post'           then 10
    when 'first_comment'        then 5
    when 'first_story'          then 5
    when 'likes_received_20'    then 5
    when 'comments_written_10'  then 5
    when 'posts_written_3'      then 5
    when 'construction_review'  then 15
    when 'first_quote_request'  then 10
    else 0 end;
$$;

-- 잔액 행 확보(없으면 기본 20) 후 잠금
create or replace function public.token_balance_lock(p_user_id uuid)
returns integer language plpgsql security definer
set search_path = public, extensions as $$
declare v int;
begin
  select balance into v from public.space_tokens where user_id = p_user_id for update;
  if v is null then
    insert into public.space_tokens (user_id, balance) values (p_user_id, 20)
    on conflict (user_id) do nothing;
    select balance into v from public.space_tokens where user_id = p_user_id for update;
  end if;
  return coalesce(v, 20);
end; $$;

create or replace function public.token_earn(p_user_id uuid, p_action text, p_description text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_action text := lower(coalesce(p_action, ''));
  v_amount int  := public.token_earn_amount(v_action);
  v_bal    int;
  v_dup    boolean;
begin
  if p_user_id is null or v_amount <= 0 then
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

create or replace function public.token_spend(p_user_id uuid, p_action text, p_amount int, p_description text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_bal int;
begin
  if p_user_id is null or coalesce(p_amount, 0) <= 0 or p_amount > 1000 then
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

grant execute on function public.token_earn(uuid, text, text) to anon, authenticated;
grant execute on function public.token_spend(uuid, text, int, text) to anon, authenticated;

notify pgrst, 'reload schema';
