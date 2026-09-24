-- ============================================================
--  Migration 108: 긴급 운영 스위치 실제 동작 · 고객 요청 수정 저장 · 요청 숨김 사유 칸
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  배경 (총점검 09-24 3차)
--  ① 관리자 「긴급 운영 스위치」(신규 결제·입찰·승인 중지) — ops_config 표가 운영에 없어(404) 저장이 안 되고,
--     저장돼도 앱 어디서도 읽지 않았다. → 표 + 관리자 전용 저장 함수 + 입찰은 서버에서 막는다.
--     (결제는 /api/confirm-payment 가, 승인은 관리자 화면이 이 표를 읽는다.)
--  ② 고객 「견적 요청 수정」 — 앱이 없는 requests.updated_at 을 쓰고, 이 앱 로그인은 Supabase 세션이 없어
--     직접 수정이 정책에 막힌다 → 「수정됐어요」 뜨지만 저장 안 됨. → 본인 확인하는 함수로 저장.
--  ③ 요청 숨김 사유 — 앱은 requests.hidden_reason 을 쓰는데 칸이 없다(42703) → 관리자 「숨김요청관리」 빈 화면,
--     「이전 요청 정리하고 새로 요청」 자동 숨김 실패. → 칸 추가.
-- ============================================================

set search_path = public, extensions;

-- 관리자 확인(행위자 id 기준 — 이 앱의 다른 함수들과 같은 방식)
create or replace function public.is_admin_actor(p_actor_id uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from public.users u where u.id = p_actor_id and u.role = 'admin');
$$;
grant execute on function public.is_admin_actor(uuid) to anon, authenticated;

-- ① 긴급 운영 스위치 ------------------------------------------------------------
create table if not exists public.ops_config (
  id                   int primary key default 1 check (id = 1),   -- 한 줄만
  pause_new_payments   boolean not null default false,
  pause_new_bids       boolean not null default false,
  pause_new_approvals  boolean not null default false,
  updated_by           uuid,
  updated_at           timestamptz not null default now()
);
insert into public.ops_config (id) values (1) on conflict (id) do nothing;

alter table public.ops_config enable row level security;
drop policy if exists "ops_config: public read" on public.ops_config;
create policy "ops_config: public read" on public.ops_config for select using (true);
-- 쓰기는 아래 함수로만(정책 없음 = 직접 쓰기 불가)

create or replace function public.ops_config_set(p_actor_id uuid, p_field text, p_value boolean)
returns public.ops_config language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.ops_config;
begin
  if not public.is_admin_actor(p_actor_id) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if p_field not in ('pause_new_payments', 'pause_new_bids', 'pause_new_approvals') then
    raise exception 'UNKNOWN_FIELD:%', p_field using errcode = '22023';
  end if;
  execute format('update public.ops_config set %I = $1, updated_by = $2, updated_at = now() where id = 1', p_field)
    using p_value, p_actor_id;
  select * into v_row from public.ops_config where id = 1;
  return v_row;
end; $$;
grant execute on function public.ops_config_set(uuid, text, boolean) to anon, authenticated;

-- 신규 입찰 중지 — 서버에서 막는다(화면을 우회해도 막힘)
create or replace function public.enforce_ops_pause_bids()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if exists (select 1 from public.ops_config where id = 1 and pause_new_bids) then
    raise exception 'BIDS_PAUSED' using errcode = 'P0001',
      hint = '지금은 새 입찰을 잠시 멈췄어요. 잠시 후 다시 시도해 주세요.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_ops_pause_bids on public.bids;
create trigger trg_ops_pause_bids before insert on public.bids
  for each row execute function public.enforce_ops_pause_bids();

-- ② 고객 요청 수정 --------------------------------------------------------------
create or replace function public.request_update_by_owner(
  p_request_id uuid, p_actor_id uuid,
  p_space_type text, p_size text, p_style text, p_description text)
returns public.requests language plpgsql security definer
set search_path = public, extensions as $$
declare v_req public.requests;
begin
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_req.user_id is distinct from p_actor_id then
    raise exception 'NOT_REQUEST_OWNER' using errcode = '42501';
  end if;
  -- 업체를 고른 뒤에는 조건을 바꾸지 않는다(입찰 조건이 달라진다)
  if v_req.status not in ('open') then
    raise exception 'REQUEST_LOCKED' using errcode = 'P0001';
  end if;

  update public.requests
     set space_type  = coalesce(p_space_type, space_type),
         size        = coalesce(p_size, size),
         style       = coalesce(p_style, style),
         description = coalesce(p_description, description)
   where id = p_request_id
  returning * into v_req;
  return v_req;
end; $$;
grant execute on function public.request_update_by_owner(uuid, uuid, text, text, text, text) to anon, authenticated;

-- ③ 요청 숨김 사유 칸 -------------------------------------------------------------
alter table public.requests add column if not exists hidden_reason text;

notify pgrst, 'reload schema';
