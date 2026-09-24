-- ════════════════════════════════════════════════════════════════════
-- 113_chats_read_at_fee_rules.sql  (총점검 09-24 · C25 + 라운지 신고)
--
-- ① 대화 안읽음·읽음 처리가 운영에서 늘 실패한다.
--    운영 chats 표에 read_at 칸이 없다(42703 "column chats.read_at does not exist").
--    → 대화 목록 안읽음 숫자 조회(400)와 읽음 처리 함수 chat_mark_room_read(066)가 매번 실패.
--    066 은 「read_at 이 이미 있다」고 보고 칸을 만들지 않았다.
--    고침: 칸만 추가(기존 메시지는 읽음 표시 없음 = null). 안읽음 조회용 인덱스.
--
-- ② 결제 수수료 규칙 표(payment_fee_rules, 031 ①)가 운영에 없다(404 PGRST205).
--    앱은 없으면 같은 값(3.7%)으로 대신 계산하므로 동작은 같다 — 콘솔 404 만 없앤다.
--    031 ①과 같은 내용(멱등). 값을 바꾼 적이 있으면 덮어쓰지 않는다(on conflict do nothing).
--
-- 추가 전용 · 재실행 안전. Supabase SQL Editor 에서 한 번 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ① chats.read_at
alter table public.chats add column if not exists read_at timestamptz;

create index if not exists chats_room_unread_idx
  on public.chats (room_id)
  where read_at is null;

-- ② payment_fee_rules (031 ① 그대로)
create table if not exists public.payment_fee_rules (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null,
  payment_method text not null,
  fee_rate       numeric(6,5) not null default 0,
  fixed_fee      integer      not null default 0,
  is_active      boolean      not null default false,
  note           text,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),
  unique (provider, payment_method)
);

insert into public.payment_fee_rules (provider, payment_method, fee_rate, fixed_fee, is_active, note) values
  ('TOSS','CARD',            0.03700, 0, true,  '임시 기본값 — 추후 계약요율로 조정'),
  ('TOSS','TRANSFER',        0.03700, 0, true,  '임시 기본값 — 추후 계약요율로 조정'),
  ('TOSS','VIRTUAL_ACCOUNT', 0.03700, 0, true,  '임시 기본값 — 추후 계약요율로 조정'),
  ('TOSS','KAKAO_PAY',       0.03700, 0, false, '준비중 — 가맹 승인 후 실요율 적용'),
  ('TOSS','NAVER_PAY',       0.03700, 0, false, '준비중 — 가맹 승인 후 실요율 적용')
on conflict (provider, payment_method) do nothing;

alter table public.payment_fee_rules enable row level security;
drop policy if exists "payment_fee_rules: public read" on public.payment_fee_rules;
create policy "payment_fee_rules: public read" on public.payment_fee_rules
  for select using (true);

-- ③ 라운지 신고(lounge_reports) — 운영에 표가 없다(404). 신고가 신고한 사람 브라우저에만 남아
--    관리자는 한 건도 못 봤다(「신고가 접수됐어요」는 없는 기능 약속). 앱은 Supabase 로그인 세션이 없어
--    (auth.uid() = null) 표에 직접 쓰고 읽지 못한다 → 쓰기·읽기·처리는 security definer 함수로만.
create table if not exists public.lounge_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid references public.users(id) on delete set null,
  target_type  text not null check (target_type in ('post','comment','story','user')),
  target_id    text not null,
  reason       text not null,
  description  text,
  status       text not null default 'pending'
    check (status in ('pending','reviewing','resolved','dismissed')),
  admin_note   text,
  created_at   timestamptz not null default now()
);
create index if not exists lounge_reports_status_idx on public.lounge_reports (status, created_at desc);
create index if not exists lounge_reports_target_idx on public.lounge_reports (target_type, target_id);
alter table public.lounge_reports enable row level security;   -- 정책 없음 = 표 직접 접근 불가

-- 신고 넣기 — 같은 사람이 같은 대상을 처리 전 상태로 이미 신고했으면 그 건을 돌려준다(중복 방지).
create or replace function public.lounge_report_create(
  p_reporter_id uuid, p_target_type text, p_target_id text, p_reason text, p_description text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_id uuid;
begin
  if p_target_type not in ('post','comment','story','user') then raise exception 'BAD_TARGET_TYPE'; end if;
  if coalesce(trim(p_target_id), '') = '' then raise exception 'NO_TARGET'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'NO_REASON'; end if;
  if p_reporter_id is not null and not exists (select 1 from public.users where id = p_reporter_id) then
    p_reporter_id := null;
  end if;

  select id into v_id from public.lounge_reports
   where target_type = p_target_type and target_id = p_target_id
     and reporter_id is not distinct from p_reporter_id
     and status in ('pending','reviewing')
   limit 1;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
  end if;

  insert into public.lounge_reports (reporter_id, target_type, target_id, reason, description)
  values (p_reporter_id, p_target_type, trim(p_target_id), left(trim(p_reason), 100), left(p_description, 1000))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
end; $$;
grant execute on function public.lounge_report_create(uuid,text,text,text,text) to anon, authenticated;

-- 관리자 목록(신고자 이름 포함). p_admin_id = 관리자 uuid 또는 코드관리자 'admin'(085 와 같은 규칙).
create or replace function public.admin_lounge_reports(p_admin_id text, p_status text default null)
returns table (
  id uuid, reporter_id uuid, reporter_name text, target_type text, target_id text,
  reason text, description text, status text, admin_note text, created_at timestamptz
) language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_admin_uuid uuid;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY';
    end if;
  elsif coalesce(p_admin_id, '') not in ('admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  return query
    select r.id, r.reporter_id, u.name, r.target_type, r.target_id,
           r.reason, r.description, r.status, r.admin_note, r.created_at
      from public.lounge_reports r
      left join public.users u on u.id = r.reporter_id
     where p_status is null or r.status = p_status
     order by r.created_at desc
     limit 500;
end; $$;
grant execute on function public.admin_lounge_reports(text,text) to anon, authenticated;

-- 관리자 처리(검토중·해결·기각 + 메모)
create or replace function public.admin_lounge_report_update(
  p_admin_id text, p_id uuid, p_status text, p_note text default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_admin_uuid uuid;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY';
    end if;
  elsif coalesce(p_admin_id, '') not in ('admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  if p_status not in ('pending','reviewing','resolved','dismissed') then raise exception 'BAD_STATUS'; end if;

  update public.lounge_reports
     set status = p_status, admin_note = coalesce(p_note, admin_note)
   where id = p_id;
  return jsonb_build_object('ok', found, 'id', p_id, 'status', p_status);
end; $$;
grant execute on function public.admin_lounge_report_update(text,uuid,text,text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 셋 다 true 면 끝
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'chats' and column_name = 'read_at') as chats_read_at,
  exists (select 1 from public.payment_fee_rules where provider = 'TOSS' and payment_method = 'CARD') as fee_rules_ok,
  exists (select 1 from information_schema.tables
           where table_schema = 'public' and table_name = 'lounge_reports') as lounge_reports_ok;
