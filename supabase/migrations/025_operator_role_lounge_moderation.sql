-- ════════════════════════════════════════════════════════════════════
-- 025_operator_role_lounge_moderation.sql
-- 운영자(operator) 권한 + 라운지 최소 운영(추천글/숨김) 기능.
--
-- 1) users.role 에 'operator' 추가
-- 2) lounge_posts: is_hot / hot_priority / managed_by / managed_at
--    lounge_comments: hidden_by / hidden_at (is_hidden 은 기존)
-- 3) operator_action_logs (운영자/역할 변경 액션 로그)
-- 4) 직접 권한 상승 차단 트리거(operator/admin 으로의 role 변경은 RPC 경유만)
-- 5) RPC:
--    - set_user_operator_by_phone(p_phone, p_admin_id)  · admin 만
--    - unset_user_operator(p_user_id, p_admin_id)        · admin 만
--    - op_set_post_hot(p_post_id, p_hot, p_priority, p_actor_id)   · operator/admin
--    - op_set_post_hidden(p_post_id, p_hidden, p_actor_id)          · operator/admin
--    - op_set_comment_hidden(p_comment_id, p_hidden, p_actor_id)    · operator/admin
-- 6) 테스트 대상 01027406030 → operator 시드(있을 때만)
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1) role 제약에 operator 추가 ──────────────────────────────────────
-- 기존 role check 제약은 이름이 다를 수 있어 정의 기준으로 모두 제거 후 재생성.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.users'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.users drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.users
  add constraint users_role_check check (role in ('consumer','company','operator','admin'));

-- ── 2) 운영 컬럼 ──────────────────────────────────────────────────────
alter table public.lounge_posts
  add column if not exists is_hot       boolean     not null default false,
  add column if not exists hot_priority integer     not null default 0,
  add column if not exists managed_by   uuid,
  add column if not exists managed_at   timestamptz;

alter table public.lounge_comments
  add column if not exists hidden_by uuid,
  add column if not exists hidden_at timestamptz;

create index if not exists lounge_posts_hot_idx
  on public.lounge_posts (is_hot, hot_priority desc, created_at desc)
  where is_hot = true;

-- ── 3) 운영자 액션 로그 ───────────────────────────────────────────────
create table if not exists public.operator_action_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.users(id) on delete set null,
  actor_role  text,
  action      text not null,
  target_type text,
  target_id   uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists operator_action_logs_created_idx
  on public.operator_action_logs (created_at desc);

-- ── 4) 권한 상승 차단 트리거 ──────────────────────────────────────────
-- operator/admin 으로(혹은 그로부터) 의 role 변경은 RPC(플래그 설정) 경유만 허용.
-- consumer<->company 전환은 영향 없음(기존 흐름 보호).
create or replace function public.block_privileged_role_change()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role)
     and (new.role in ('operator','admin') or old.role in ('operator','admin'))
     and coalesce(current_setting('app.role_change_ok', true), '') <> '1' then
    raise exception 'PRIVILEGED_ROLE_CHANGE_BLOCKED: role 변경은 운영자 설정(RPC)으로만 가능합니다';
  end if;
  return new;
end; $$;
drop trigger if exists trg_block_privileged_role_change on public.users;
create trigger trg_block_privileged_role_change
  before update on public.users
  for each row execute function public.block_privileged_role_change();

-- ── 5) RPC ────────────────────────────────────────────────────────────
create or replace function public.set_user_operator_by_phone(p_phone text, p_admin_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_digits text;
  v_e164   text;
  v_id     uuid;
  v_old    text;
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

  select id, role into v_id, v_old
    from public.users
   where phone = v_e164 or phone = p_phone or phone = v_digits or phone = ('0' || substr(v_digits, greatest(length(v_digits)-9,1)))
   limit 1;

  if v_id is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_old = 'admin' then raise exception 'CANNOT_MODIFY_ADMIN'; end if;

  perform set_config('app.role_change_ok','1', true);
  update public.users set role = 'operator', updated_at = now() where id = v_id;

  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (p_admin_id, 'admin', 'SET_OPERATOR', 'user', v_id,
          jsonb_build_object('phone', p_phone, 'old_role', v_old));

  return jsonb_build_object('user_id', v_id, 'old_role', v_old, 'new_role', 'operator');
end; $$;

create or replace function public.unset_user_operator(p_user_id uuid, p_admin_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_old text;
begin
  if not exists (select 1 from public.users where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  select role into v_old from public.users where id = p_user_id;
  if v_old is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_old <> 'operator' then raise exception 'NOT_OPERATOR'; end if;

  perform set_config('app.role_change_ok','1', true);
  update public.users set role = 'consumer', updated_at = now() where id = p_user_id;

  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (p_admin_id, 'admin', 'UNSET_OPERATOR', 'user', p_user_id, jsonb_build_object('old_role', v_old));
end; $$;

-- 라운지 운영 RPC (operator/admin) — 모두 soft 처리 + 로그
create or replace function public.op_set_post_hot(p_post_id uuid, p_hot boolean, p_priority int, p_actor_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_role text;
begin
  select role into v_role from public.users where id = p_actor_id;
  if v_role is null or v_role not in ('operator','admin') then raise exception 'MODERATOR_ONLY'; end if;
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
declare v_role text;
begin
  select role into v_role from public.users where id = p_actor_id;
  if v_role is null or v_role not in ('operator','admin') then raise exception 'MODERATOR_ONLY'; end if;
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
declare v_role text;
begin
  select role into v_role from public.users where id = p_actor_id;
  if v_role is null or v_role not in ('operator','admin') then raise exception 'MODERATOR_ONLY'; end if;
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
grant execute on function public.op_set_post_hot(uuid, boolean, int, uuid)     to anon, authenticated;
grant execute on function public.op_set_post_hidden(uuid, boolean, uuid)       to anon, authenticated;
grant execute on function public.op_set_comment_hidden(uuid, boolean, uuid)    to anon, authenticated;

-- ── 6) 테스트 대상 01027406030 → operator 시드(존재할 때만) ────────────
do $$
declare v_id uuid;
begin
  select id into v_id from public.users
   where phone in ('+821027406030','01027406030','821027406030') limit 1;
  if v_id is not null then
    perform set_config('app.role_change_ok','1', true);
    update public.users set role = 'operator', updated_at = now()
     where id = v_id and role <> 'admin';
    insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
    values (null, 'system', 'SEED_OPERATOR', 'user', v_id, jsonb_build_object('phone','01027406030'));
  end if;
end $$;

-- (선택) 운영용 admin 부트스트랩 — 아래 phone 을 본인 관리자 번호로 바꿔 주석 해제 후 1회 실행.
-- do $$
-- declare v_id uuid;
-- begin
--   select id into v_id from public.users where phone = '+8210XXXXXXXX' limit 1;
--   if v_id is not null then
--     perform set_config('app.role_change_ok','1', true);
--     update public.users set role = 'admin', updated_at = now() where id = v_id;
--   end if;
-- end $$;
