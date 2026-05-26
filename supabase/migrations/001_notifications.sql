-- ============================================================
--  Migration 001: notifications 테이블 생성
--  Supabase SQL Editor에서 실행하세요.
--  확인 쿼리: select * from notifications order by created_at desc limit 20;
-- ============================================================

-- 1. 테이블 생성
create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null,
  type         text        not null,
  title        text,
  message      text,
  related_id   uuid,
  related_type text,
  is_read      boolean     not null default false,
  created_at   timestamptz not null default now()
);

-- 2. 인덱스
create index if not exists notifications_user_id_idx
  on public.notifications (user_id);

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

-- 3. RLS 활성화
alter table public.notifications enable row level security;

-- 4. 정책: 본인 알림 조회
drop policy if exists "notifications: own select" on public.notifications;
create policy "notifications: own select" on public.notifications
  for select
  using (auth.uid() = user_id);

-- 5. 정책: 읽음 처리 (is_read 업데이트)
drop policy if exists "notifications: own update" on public.notifications;
create policy "notifications: own update" on public.notifications
  for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. 정책: 앱(로그인 사용자)이 알림 생성 허용
drop policy if exists "notifications: authenticated insert" on public.notifications;
create policy "notifications: authenticated insert" on public.notifications
  for insert
  with check (auth.role() = 'authenticated');

-- 완료 확인 쿼리 (실행 후 아래 쿼리로 테이블 존재 확인)
-- select * from notifications order by created_at desc limit 20;
