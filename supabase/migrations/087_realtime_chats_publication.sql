-- 087_realtime_chats_publication.sql
-- 라운지/거래 채팅 실시간 동기화 복구.
-- ChatScreen 은 chats INSERT 를 postgres_changes 로 구독하지만, chats 테이블이
-- Supabase realtime publication(supabase_realtime)에 포함돼 있지 않으면 이벤트가
-- 발생하지 않아 "새로고침 전까지 안 보임" 현상이 난다. chats + lounge_chat_requests
-- 를 publication 에 추가한다(멱등 — 이미 있으면 스킵). DB 구조/RLS 변경 없음.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'lounge_chat_requests'
  ) then
    alter publication supabase_realtime add table public.lounge_chat_requests;
  end if;
end $$;
