-- ============================================================
--  Migration 146: 직영 업체 표시 · 업체 작업 장부 · 친구 초대 링크
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(추가 전용).
--  순서: 앱 배포 전이든 뒤든 상관없다 — 칸·함수가 없으면 앱은 해당 기능만 조용히 숨긴다.
--
--  왜(대표 09-28 「교육 뒤 직접 1인 사업자로 활동하기 좋게」 · 「다운로드 1등」)
--    ① 직영 표시 — 운영사(대표)가 직접 시공하는 업체임을 카드에 밝힌다.
--       플랫폼이 선수로 뛰면 다른 파트너가 «좋은 요청은 운영자가 가져간다»고 느낄 수 있다 → 숨기지 않고 표시,
--       매칭·노출 순서에는 쓰지 않는다(앱 규칙). 켜고 끄기는 관리자만.
--    ② 작업 장부 — 업체가 공사(지인 공사 포함)마다 시간·자재비·받은 금액을 적고 월별 순이익을 본다.
--       본인 행만 읽고 쓴다(토큰의 사용자 = auth.uid()).
--    ③ 친구 초대 — 사람마다 초대 코드. 가입 7일 안의 새 사용자가 코드로 들어오면 누가 데려왔는지 남긴다.
--       보상은 아직 없음(대표 결정 뒤). 자기 자신 · 이미 기록된 사람은 무시.
--  확인 칸 5개(맨 아래 select) — 모두 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- ── ① 직영 업체 ─────────────────────────────────────────────
alter table public.companies add column if not exists is_direct boolean not null default false;

create or replace function public.admin_set_company_direct(p_company_id uuid, p_direct boolean)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_prev boolean; v_row public.companies;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select is_direct into v_prev from public.companies where id = p_company_id;
  if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
  update public.companies set is_direct = coalesce(p_direct, false) where id = p_company_id returning * into v_row;
  begin
    insert into public.admin_logs (admin_id, action, target_type, target_id, before_val, after_val, reason)
    values (v_uid, case when v_row.is_direct then 'SET_COMPANY_DIRECT' else 'UNSET_COMPANY_DIRECT' end,
            'company', p_company_id,
            jsonb_build_object('is_direct', v_prev), jsonb_build_object('is_direct', v_row.is_direct), null);
  exception when others then null;   -- 기록 실패가 변경을 되돌리지 않게
  end;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'is_direct', v_row.is_direct);
end; $$;
grant execute on function public.admin_set_company_direct(uuid, boolean) to anon, authenticated;

-- ── ② 업체 작업 장부 ────────────────────────────────────────
create table if not exists public.company_job_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  work_date     date not null default current_date,
  title         text not null check (char_length(title) between 1 and 80),
  source        text not null default 'gonggan' check (source in ('gonggan','acquaintance','other')),
  hours         numeric(6,1) not null default 0 check (hours >= 0 and hours <= 999),
  material_cost bigint not null default 0 check (material_cost >= 0),
  revenue       bigint not null default 0 check (revenue >= 0),
  memo          text check (memo is null or char_length(memo) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists company_job_ledger_user_date on public.company_job_ledger (user_id, work_date desc);

alter table public.company_job_ledger enable row level security;
drop policy if exists "company_job_ledger: own" on public.company_job_ledger;
create policy "company_job_ledger: own" on public.company_job_ledger
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.company_job_ledger to authenticated;

-- ── ③ 친구 초대 ────────────────────────────────────────────
alter table public.users add column if not exists referral_code text;
alter table public.users add column if not exists referred_by   uuid;
alter table public.users add column if not exists referred_at   timestamptz;
create unique index if not exists users_referral_code_key on public.users (referral_code) where referral_code is not null;
create index if not exists users_referred_by on public.users (referred_by) where referred_by is not null;

-- 내 초대 코드(없으면 만든다) + 내가 데려온 사람 수
create or replace function public.referral_my_code()
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_code text; v_try int := 0; v_count int;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select referral_code into v_code from public.users where id = v_uid;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  while v_code is null and v_try < 5 loop
    v_try := v_try + 1;
    begin
      -- 헷갈리는 글자(0/O · 1/I/L) 없이 6자리
      v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
                   from generate_series(1, 6));
      update public.users set referral_code = v_code where id = v_uid and referral_code is null;
    exception when unique_violation then v_code := null;
    end;
  end loop;
  select referral_code into v_code from public.users where id = v_uid;
  select count(*) into v_count from public.users where referred_by = v_uid;
  return jsonb_build_object('code', v_code, 'invited', v_count);
end; $$;
grant execute on function public.referral_my_code() to anon, authenticated;

-- 초대 코드로 들어온 새 사용자 — 가입 7일 안 · 아직 기록 없음 · 자기 자신 아님
create or replace function public.referral_claim(p_code text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_ref uuid; v_me public.users;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select id into v_ref from public.users where referral_code = upper(trim(coalesce(p_code, '')));
  if v_ref is null then return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_CODE'); end if;
  if v_ref = v_uid then return jsonb_build_object('ok', false, 'reason', 'SELF'); end if;
  select * into v_me from public.users where id = v_uid;
  if v_me.referred_by is not null then return jsonb_build_object('ok', false, 'reason', 'ALREADY'); end if;
  if v_me.created_at < now() - interval '7 days' then return jsonb_build_object('ok', false, 'reason', 'NOT_NEW'); end if;
  update public.users set referred_by = v_ref, referred_at = now() where id = v_uid and referred_by is null;
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.referral_claim(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 모두 true 면 끝
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'companies' and column_name = 'is_direct') as direct_col_ok,
  exists (select 1 from pg_proc where proname = 'admin_set_company_direct')                                                             as direct_fn_ok,
  exists (select 1 from pg_policies where tablename = 'company_job_ledger' and policyname = 'company_job_ledger: own')                as ledger_ok,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'referred_by') as referral_col_ok,
  exists (select 1 from pg_proc where proname = 'referral_claim') and exists (select 1 from pg_proc where proname = 'referral_my_code') as referral_fn_ok;
