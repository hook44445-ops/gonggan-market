-- ============================================================
--  Migration 148: 친구 초대 보상 — 데려온 사람 +30 · 새로 온 사람 +20 토큰
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다. (146 뒤에)
--
--  왜(대표 09-28 「1등 다운로드 앱」): 초대가 퍼지려면 보내는 사람·받는 사람 둘 다 얻는 게 있어야 한다.
--  규칙(서버만 정한다 — 앱이 금액을 보내지 않는다)
--    · 146 referral_claim 이 기록에 성공한 순간에만 지급(가입 7일 안 · 처음 · 본인 아님은 146 그대로)
--    · 새로 온 사람 +20(한 번) · 데려온 사람 +30(한 사람당 한 번 · 30일에 20명까지 — 부풀리기 방지)
--    · token_earn_amount(앱이 부를 수 있는 적립)에는 넣지 않는다 — 누구나 부르는 함수라 금액표에 넣으면 조작된다.
--    · 데려온 사람에게 알림 «친구가 가입했어요» (+ 푸시 수신을 켠 경우 휴대폰 푸시)
--  금액을 바꾸려면 아래 v_invitee_amt · v_inviter_amt 와 앱 src/lib/referral.js REFERRAL_REWARD 를 같이.
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.referral_claim(p_code text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_ref uuid; v_me public.users;
  v_invitee_amt int := 20; v_inviter_amt int := 30; v_monthly_cap int := 20;
  v_recent int; v_inviter_paid boolean := false; v_pref jsonb;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select id into v_ref from public.users where referral_code = upper(trim(coalesce(p_code, '')));
  if v_ref is null then return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_CODE'); end if;
  if v_ref = v_uid then return jsonb_build_object('ok', false, 'reason', 'SELF'); end if;
  select * into v_me from public.users where id = v_uid;
  if v_me.referred_by is not null then return jsonb_build_object('ok', false, 'reason', 'ALREADY'); end if;
  if v_me.created_at < now() - interval '7 days' then return jsonb_build_object('ok', false, 'reason', 'NOT_NEW'); end if;
  update public.users set referred_by = v_ref, referred_at = now() where id = v_uid and referred_by is null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'ALREADY'); end if;

  -- 보상 — 실패해도 초대 기록은 남긴다
  begin
    -- 새로 온 사람(한 번)
    perform public.token_balance_lock(v_uid);
    if not exists (select 1 from public.space_token_logs where user_id = v_uid and type = 'earn' and action = 'referral_joined') then
      update public.space_tokens set balance = balance + v_invitee_amt where user_id = v_uid;
      insert into public.space_token_logs (user_id, amount, type, action, description)
      values (v_uid, v_invitee_amt, 'earn', 'referral_joined', '친구 초대로 가입');
    end if;

    -- 데려온 사람(이 사람당 한 번 · 30일 20명까지)
    perform public.token_balance_lock(v_ref);
    select count(*) into v_recent from public.space_token_logs
     where user_id = v_ref and type = 'earn' and action = 'referral_invite' and created_at > now() - interval '30 days';
    if v_recent < v_monthly_cap
       and not exists (select 1 from public.space_token_logs where user_id = v_ref and type = 'earn'
                          and action = 'referral_invite' and description = 'invitee:' || v_uid) then
      update public.space_tokens set balance = balance + v_inviter_amt where user_id = v_ref;
      insert into public.space_token_logs (user_id, amount, type, action, description)
      values (v_ref, v_inviter_amt, 'earn', 'referral_invite', 'invitee:' || v_uid);
      v_inviter_paid := true;
    end if;

    -- 데려온 사람에게 알림(+ 푸시 수신을 켰으면 휴대폰으로)
    insert into public.notifications (user_id, type, title, message, priority)
    values (v_ref, 'REFERRAL_JOINED', '친구가 가입했어요',
            case when v_inviter_paid then '초대 링크로 새 회원이 들어왔어요. 공간토큰 ' || v_inviter_amt || '개를 드렸어요.'
                 else '초대 링크로 새 회원이 들어왔어요. 고마워요!' end, 'NORMAL');
    select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = v_ref;
    if coalesce((v_pref ->> 'push_enabled')::boolean, false) then
      insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
      values (v_ref, 'REFERRAL_JOINED', '친구가 가입했어요',
              case when v_inviter_paid then '공간토큰 ' || v_inviter_amt || '개를 드렸어요' else '초대해 줘서 고마워요' end,
              '/my', v_uid::text, 'queued')
      on conflict do nothing;
    end if;
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'reward', v_invitee_amt, 'inviter_paid', v_inviter_paid);
end; $$;
grant execute on function public.referral_claim(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select position('referral_invite' in pg_get_functiondef('public.referral_claim(text)'::regprocedure)) > 0 as referral_reward_ok;
