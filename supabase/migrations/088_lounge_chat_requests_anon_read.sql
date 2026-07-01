-- ════════════════════════════════════════════════════════════════════
-- 088_lounge_chat_requests_anon_read.sql
-- 라운지 대화 신청이 상대(업체/작성자) 화면에 안 보이던 원인 수정 —
-- 받은/보낸/수락된 대화 신청 목록이 1건도 조회되지 않던 문제.
--
-- 원인(081 chats 와 동일한 구조적 버그):
--   · lounge_chat_requests SELECT 정책이 using (auth.uid() = requester_id or
--     auth.uid() = target_id).
--   · 이 앱은 anon key + Twilio OTP 커스텀 인증 → auth.uid() 가 항상 NULL.
--     ∴ 'NULL = requester_id/target_id' 는 항상 거짓 → fetchReceivedChatRequests /
--       fetchMyChatRequests / fetchAcceptedReceivedChatRequests(직접 SELECT)가
--       전부 빈 결과 → 업체 대화 탭에 '수락 요청'이 표시되지 않았다.
--
-- 수정 방향(이 앱의 다른 테이블과 동일한 정렬 — requests/bids/chats 모델):
--   · SELECT 를 using(true) 로 열어 client-신원 기반 조회를 허용한다.
--     (목록 조회는 requester_id/target_id 로 클라이언트에서 필터. 쓰기/수락/거절은
--      기존 security-definer RPC(actor 검증)로만 수행 — 변경 없음.)
--
-- 안전성: additive · 멱등 · 테이블 컬럼/기존 데이터/RPC 무변경. INSERT/UPDATE 정책 무관.
-- Supabase SQL Editor 에서 1회 실행(087 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 기존 auth.uid() 기반 읽기 정책 제거(이름 고정, 멱등) 후 anon 읽기 허용으로 교체.
drop policy if exists "lounge_chat_requests: owner read" on public.lounge_chat_requests;

create policy "lounge_chat_requests: anon read" on public.lounge_chat_requests
  for select using (true);

notify pgrst, 'reload schema';
