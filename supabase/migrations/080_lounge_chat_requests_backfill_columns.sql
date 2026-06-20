-- 080: lounge_chat_requests 누락 컬럼 백필 (production hotfix)
--
-- 배경: 받은 대화신청 목록이 항상 0건으로 표시되는 문제.
--   원인 — 조회 쿼리(fetchReceivedChatRequests / fetchMyChatRequests /
--   fetchAcceptedReceivedChatRequests)가 target_left_at·requester_left_at(078)·
--   source_comment_id(027 ALTER) 컬럼을 참조하는데, production DB에 해당 컬럼이
--   누락되어 PostgREST 쿼리가 "column does not exist" 로 실패하고, 클라이언트가
--   에러를 빈 목록으로 흡수해 "신청이 안 보이는" 것처럼 나타남.
--
-- 이 마이그레이션은 027/078 이 추가했어야 할 컬럼을 멱등(if not exists)하게
-- 재보장한다. 이미 존재하면 no-op 이라 안전하다.
--
-- 범위 한정(승인된 작업):
--   · 누락 컬럼 추가만 수행. 기존 데이터/컬럼/제약/RLS/RPC/정책 일절 변경 없음.
--   · 기존 행(status, requester_id, target_id 등) 보존.

alter table public.lounge_chat_requests
  add column if not exists target_left_at    timestamptz,
  add column if not exists requester_left_at timestamptz,
  add column if not exists source_comment_id uuid;

-- source_comment_id 의 FK(027 정의: lounge_comments(id) on delete set null)도
-- 누락 시에만 멱등 추가. 이미 있으면 건너뛴다.
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'lounge_chat_requests_source_comment_id_fkey'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'lounge_chat_requests'
       and column_name  = 'source_comment_id'
  ) and exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'lounge_comments'
  ) then
    execute $p$
      alter table public.lounge_chat_requests
        add constraint lounge_chat_requests_source_comment_id_fkey
        foreign key (source_comment_id)
        references public.lounge_comments(id) on delete set null
    $p$;
  end if;
end $$;

-- PostgREST 스키마 캐시 갱신 — 추가된 컬럼이 즉시 쿼리에 반영되도록.
notify pgrst, 'reload schema';
