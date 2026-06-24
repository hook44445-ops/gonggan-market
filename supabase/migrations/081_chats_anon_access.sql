-- ════════════════════════════════════════════════════════════════════
-- 081_chats_anon_access.sql
-- 채팅 INSERT/SELECT 차단 복구 — 의뢰인↔업체 상담 채팅이 1건도 저장되지 않던 원인 수정.
--
-- 원인(운영 DB 확인됨, chats 0건):
--   · 기존 정책이  with check / using (auth.uid() = sender_id).
--   · 이 앱은 anon key + Twilio OTP 커스텀 인증 → auth.uid() 가 항상 NULL.
--     ∴ 'NULL = sender_id' 는 항상 거짓 → 모든 채팅 insert/read 가 RLS 에 거부됨.
--   · 또한 sender_type CHECK 가 ('consumer','company','system') 인데 클라이언트는
--     사람 메시지를 sender_type='user' 로 전송 → CHECK 위반.
--
-- 수정 방향(이 앱의 다른 테이블과 동일한 정렬):
--   · requests/bids 등은 이미 select using(true) 의 클라이언트-신원 기반 모델.
--     chats 도 동일하게 anon 읽기/쓰기를 허용한다(room_id=`${userId}_${companyId}` 기반 1:1).
--   · sender_type CHECK 를 superset 으로 확장('user' 추가, 기존 값 보존).
--
-- 안전성: additive · 멱등 · 테이블 컬럼/기존 메시지/스키마 구조 무변경.
-- Supabase SQL Editor 에서 1회 실행(080 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1. 차단 정책 제거(이름 무관, 멱등) ────────────────────────────────
do $$
declare r record;
begin
  for r in
    select polname from pg_policy
     where polrelid = 'public.chats'::regclass
  loop
    execute format('drop policy if exists %I on public.chats', r.polname);
  end loop;
end $$;

-- ── 2. anon/authenticated 읽기·쓰기 허용 (클라이언트-신원 기반 1:1 채팅) ──
alter table public.chats enable row level security;
create policy "chats_anon_read"   on public.chats for select using (true);
create policy "chats_anon_insert" on public.chats for insert with check (true);

-- ── 3. sender_type CHECK 확장: 'user' 허용(클라 전송값) + 기존 값 보존 ──
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.chats'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%sender_type%'
  loop
    execute format('alter table public.chats drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.chats
  add constraint chats_sender_type_check
  check (sender_type in ('consumer','user','company','system'));

notify pgrst, 'reload schema';
