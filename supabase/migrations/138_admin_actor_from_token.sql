-- ============================================================
--  Migration 138: 운영 스위치·라운지 운영자 함수 — «토큰의 사용자»로만 판단 · 시드 글 표 쓰기 잠그기
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(이 세 함수를 로그인 토큰으로 부르는 버전) 뒤에. 배포 전 앱은 토큰 없이 불러 막힌다.
--
--  문제(09-26 관리자 페이지 점검)
--    · ops_config_set(108 · 긴급 운영 스위치) · op_set_post_hot / op_set_post_hidden(028 · 라운지 글 추천·숨김)이
--      앱이 보낸 p_actor_id 를 믿었다. 관리자 id 는 공개 데이터로 알 수 있어 누구나 «신규 결제 중지»를 켜거나 글을 숨길 수 있었다.
--    · seed_lounge_posts 정책 "admin_all" 이 using(true) — 누구나 쓰기.
--  고침
--    · 세 함수: 행위자 = auth.uid()(로그인 토큰). p_actor_id 는 이름만 남기고 쓰지 않는다(앱 호환).
--    · seed_lounge_posts: 쓰기는 관리자(is_admin(), 107)만, 읽기는 그대로 누구나.
--  확인 칸 3개(아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- ① 긴급 운영 스위치
create or replace function public.ops_config_set(p_actor_id uuid, p_field text, p_value boolean)
returns public.ops_config language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_row public.ops_config;
begin
  if not exists (select 1 from public.users u where u.id = v_uid and u.role = 'admin') then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if p_field not in ('pause_new_payments', 'pause_new_bids', 'pause_new_approvals') then
    raise exception 'UNKNOWN_FIELD:%', p_field using errcode = '22023';
  end if;
  execute format('update public.ops_config set %I = $1, updated_by = $2, updated_at = now() where id = 1', p_field)
    using p_value, v_uid;
  select * into v_row from public.ops_config where id = 1;
  return v_row;
end; $$;
grant execute on function public.ops_config_set(uuid, text, boolean) to anon, authenticated;

-- ② 라운지 글 추천(HOT)
create or replace function public.op_set_post_hot(p_post_id uuid, p_hot boolean, p_priority int, p_actor_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_role text; v_op boolean;
begin
  select role, is_operator into v_role, v_op from public.users where id = v_uid;
  if v_role is null or (v_role <> 'admin' and coalesce(v_op, false) = false) then raise exception 'MODERATOR_ONLY'; end if;
  update public.lounge_posts
     set is_hot = p_hot, hot_priority = coalesce(p_priority, 0),
         managed_by = v_uid, managed_at = now()
   where id = p_post_id;
  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (v_uid, v_role, case when p_hot then 'SET_HOT' else 'UNSET_HOT' end, 'lounge_post', p_post_id,
          jsonb_build_object('priority', coalesce(p_priority, 0)));
end; $$;
grant execute on function public.op_set_post_hot(uuid, boolean, int, uuid) to anon, authenticated;

-- ③ 라운지 글 숨김
create or replace function public.op_set_post_hidden(p_post_id uuid, p_hidden boolean, p_actor_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_role text; v_op boolean;
begin
  select role, is_operator into v_role, v_op from public.users where id = v_uid;
  if v_role is null or (v_role <> 'admin' and coalesce(v_op, false) = false) then raise exception 'MODERATOR_ONLY'; end if;
  update public.lounge_posts
     set is_hidden = p_hidden,
         hidden_by = case when p_hidden then v_uid else null end,
         hidden_at = case when p_hidden then now() else null end,
         managed_by = v_uid, managed_at = now()
   where id = p_post_id;
  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (v_uid, v_role, case when p_hidden then 'HIDE_POST' else 'UNHIDE_POST' end, 'lounge_post', p_post_id, null);
end; $$;
grant execute on function public.op_set_post_hidden(uuid, boolean, uuid) to anon, authenticated;

-- ④ 시드 글 표 — 쓰기는 관리자만
drop policy if exists "admin_all" on public.seed_lounge_posts;
drop policy if exists "seed_lounge_posts: admin write" on public.seed_lounge_posts;
create policy "seed_lounge_posts: admin write" on public.seed_lounge_posts
  for all using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';

-- 확인: 셋 다 true 면 끝
select
  position('auth.uid()' in pg_get_functiondef('public.ops_config_set(uuid,text,boolean)'::regprocedure)) > 0          as switch_token_ok,
  position('auth.uid()' in pg_get_functiondef('public.op_set_post_hidden(uuid,boolean,uuid)'::regprocedure)) > 0     as moderation_token_ok,
  not exists (select 1 from pg_policies where tablename = 'seed_lounge_posts' and policyname = 'admin_all')          as seed_write_closed_ok;
