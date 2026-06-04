-- ════════════════════════════════════════════════════════════════════
-- 028_operator_flag_split.sql
-- 운영자 권한을 users.role 에서 분리 → users.is_operator 플래그로 전환.
--
-- 배경: 025 에서 운영자 등록 시 role 을 'operator' 로 덮어써서,
--       company/consumer 등 기존 사용자 유형이 사라지고 화면 라우팅이 깨짐.
--
-- 변경:
-- 1) users.is_operator boolean default false 추가
-- 2) 기존 role='operator' 계정 복구:
--    - is_operator=true 설정
--    - role 은 (a) operator_action_logs 의 old_role,
--               (b) companies(owner_id) 존재 시 'company',
--               (c) 그 외 'consumer' 로 복원
-- 3) set_user_operator_by_phone / unset_user_operator → role 변경 금지, is_operator 만 토글
-- 4) op_* RPC 권한 체크: role='admin' OR is_operator=true
-- 5) 01027406030 → role=company(업체row 있으면) + is_operator=true 복구
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1) is_operator 컬럼 ────────────────────────────────────────────────
alter table public.users
  add column if not exists is_operator boolean not null default false;

create index if not exists users_is_operator_idx
  on public.users (is_operator) where is_operator = true;

-- ── 2) 기존 role='operator' 계정 복구 ─────────────────────────────────
-- 트리거(block_privileged_role_change) 우회 위해 set_config 사용.
do $$
declare
  r           record;
  v_old_role  text;
begin
  perform set_config('app.role_change_ok','1', true);

  for r in select id from public.users where role = 'operator' loop
    -- (a) 가장 최근 SET_OPERATOR 로그의 old_role 복원
    select detail->>'old_role' into v_old_role
      from public.operator_action_logs
     where target_type = 'user' and target_id = r.id
       and action = 'SET_OPERATOR'
       and detail ? 'old_role'
     order by created_at desc
     limit 1;

    -- (b) 로그 없으면 업체(owner) 여부로 판별
    if v_old_role is null or v_old_role not in ('consumer','company') then
      if exists (select 1 from public.companies where owner_id = r.id) then
        v_old_role := 'company';
      else
        v_old_role := 'consumer';
      end if;
    end if;

    update public.users
       set role = v_old_role, is_operator = true, updated_at = now()
     where id = r.id;

    insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
    values (null, 'system', 'MIGRATE_OPERATOR_FLAG', 'user', r.id,
            jsonb_build_object('restored_role', v_old_role));
  end loop;
end $$;

-- ── 3) RPC 재정의: role 대신 is_operator 토글 ─────────────────────────
create or replace function public.set_user_operator_by_phone(p_phone text, p_admin_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_digits text;
  v_e164   text;
  v_id     uuid;
  v_role   text;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  v_digits := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  if left(v_digits,2) = '82' then
    v_e164 := '+' || v_digits;
  elsif left(v_digits,1) = '0' then
    v_e164 := '+82' || substr(v_digits,2);
  else
    v_e164 := '+' || v_digits;
  end if;

  select id, role into v_id, v_role
    from public.users
   where phone = v_e164 or phone = p_phone or phone = v_digits or phone = ('0' || substr(v_digits, greatest(length(v_digits)-9,1)))
   limit 1;

  if v_id is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_role = 'admin' then raise exception 'CANNOT_MODIFY_ADMIN'; end if;

  -- role 은 그대로 유지(company/consumer), is_operator 만 부여
  update public.users set is_operator = true, updated_at = now() where id = v_id;

  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (p_admin_id, 'admin', 'SET_OPERATOR', 'user', v_id,
          jsonb_build_object('phone', p_phone, 'old_role', v_role));

  return jsonb_build_object('user_id', v_id, 'role', v_role, 'is_operator', true);
end; $$;

create or replace function public.unset_user_operator(p_user_id uuid, p_admin_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_role text;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  select role into v_role from public.users where id = p_user_id;
  if v_role is null then raise exception 'USER_NOT_FOUND'; end if;

  -- role 은 건드리지 않고 is_operator 만 해제
  update public.users set is_operator = false, updated_at = now() where id = p_user_id;

  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (p_admin_id, 'admin', 'UNSET_OPERATOR', 'user', p_user_id, jsonb_build_object('role', v_role));
end; $$;

-- ── 4) 라운지 운영 RPC 권한 체크: admin OR is_operator ────────────────
create or replace function public.op_set_post_hot(p_post_id uuid, p_hot boolean, p_priority int, p_actor_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_role text; v_op boolean;
begin
  select role, is_operator into v_role, v_op from public.users where id = p_actor_id;
  if v_role is null or (v_role <> 'admin' and coalesce(v_op,false) = false) then raise exception 'MODERATOR_ONLY'; end if;
  update public.lounge_posts
     set is_hot = p_hot, hot_priority = coalesce(p_priority,0),
         managed_by = p_actor_id, managed_at = now()
   where id = p_post_id;
  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (p_actor_id, v_role, case when p_hot then 'SET_HOT' else 'UNSET_HOT' end, 'lounge_post', p_post_id,
          jsonb_build_object('priority', coalesce(p_priority,0)));
end; $$;

create or replace function public.op_set_post_hidden(p_post_id uuid, p_hidden boolean, p_actor_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_role text; v_op boolean;
begin
  select role, is_operator into v_role, v_op from public.users where id = p_actor_id;
  if v_role is null or (v_role <> 'admin' and coalesce(v_op,false) = false) then raise exception 'MODERATOR_ONLY'; end if;
  update public.lounge_posts
     set is_hidden = p_hidden,
         hidden_by = case when p_hidden then p_actor_id else null end,
         hidden_at = case when p_hidden then now() else null end,
         managed_by = p_actor_id, managed_at = now()
   where id = p_post_id;
  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (p_actor_id, v_role, case when p_hidden then 'HIDE_POST' else 'UNHIDE_POST' end, 'lounge_post', p_post_id, null);
end; $$;

create or replace function public.op_set_comment_hidden(p_comment_id uuid, p_hidden boolean, p_actor_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_role text; v_op boolean;
begin
  select role, is_operator into v_role, v_op from public.users where id = p_actor_id;
  if v_role is null or (v_role <> 'admin' and coalesce(v_op,false) = false) then raise exception 'MODERATOR_ONLY'; end if;
  update public.lounge_comments
     set is_hidden = p_hidden,
         hidden_by = case when p_hidden then p_actor_id else null end,
         hidden_at = case when p_hidden then now() else null end
   where id = p_comment_id;
  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (p_actor_id, v_role, case when p_hidden then 'HIDE_COMMENT' else 'UNHIDE_COMMENT' end, 'lounge_comment', p_comment_id, null);
end; $$;

grant execute on function public.set_user_operator_by_phone(text, uuid) to anon, authenticated;
grant execute on function public.unset_user_operator(uuid, uuid)        to anon, authenticated;

-- ── 5) 01027406030 복구 (업체면 company 유지 + is_operator=true) ───────
do $$
declare v_id uuid;
begin
  select id into v_id from public.users
   where phone in ('+821027406030','01027406030','821027406030') limit 1;
  if v_id is not null then
    perform set_config('app.role_change_ok','1', true);
    update public.users
       set role = case
                    when role = 'admin' then role
                    when exists (select 1 from public.companies where owner_id = v_id) then 'company'
                    when role = 'operator' then 'consumer'
                    else role
                  end,
           is_operator = true,
           updated_at = now()
     where id = v_id;
    insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
    values (null, 'system', 'RECOVER_OPERATOR_FLAG', 'user', v_id, jsonb_build_object('phone','01027406030'));
  end if;
end $$;

notify pgrst, 'reload schema';
