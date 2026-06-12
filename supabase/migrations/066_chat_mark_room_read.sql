-- ════════════════════════════════════════════════════════════════════
-- 066_chat_mark_room_read.sql
-- 채팅 읽음 처리(C-4) — 방 단위 read_at 갱신 RPC.
--
-- 배경:
--   chats 테이블에는 read_at 컬럼이 이미 존재하나 미사용 상태였다.
--   이 앱은 Twilio OTP + anon key 구조라 Supabase Auth 세션이 없어
--   (auth.uid()=null) chats 의 UPDATE 를 클라이언트에서 RLS 로 직접 하기
--   어렵다. 058/065 와 동일하게 SECURITY DEFINER RPC 로 우회한다.
--
-- 동작:
--   · 특정 room 의 '내가 보내지 않은' 안읽음 메시지(read_at IS NULL)를 읽음 처리.
--   · 본인이 보낸 메시지는 갱신하지 않는다(sender_id 와 reader 가 다를 때만).
--   · 갱신 행 수를 반환(클라 디버깅/카운트 보정용).
--
-- 안전성(회귀 금지):
--   · 신규 함수 1개만 추가. chats 스키마/기존 정책/sendMessage/realtime/
--     채팅방 생성 로직 일절 미변경. 완전 additive · 멱등(create or replace).
--   · 읽음 처리가 실패해도 채팅 송수신에는 영향 없음(앱에서 graceful 처리).
--
-- Supabase SQL Editor 에서 1회 실행(065 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.chat_mark_room_read(
  p_room_id   text,
  p_reader_id uuid
) returns integer
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_count integer := 0;
begin
  if coalesce(trim(p_room_id), '') = '' or p_reader_id is null then
    return 0;
  end if;

  update public.chats
     set read_at = now()
   where room_id = p_room_id
     and read_at is null
     and sender_id is distinct from p_reader_id;

  get diagnostics v_count = row_count;
  return v_count;
end; $fn$;

grant execute on function public.chat_mark_room_read(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
