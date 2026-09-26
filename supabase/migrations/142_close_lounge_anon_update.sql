-- ============================================================
--  Migration 142: 라운지 글 「누구나 수정」 권한 닫기
--  ⚠️ 순서: 141 실행(넷 다 true) → 같은 PR 앱 배포 확인 → 그다음 이것.
--     앱 배포 전에 실행하면 옛 앱의 공감·본인 글 수정·관리자 노출 토글이 막힌다.
--  005 의 "lounge_posts: anon update"(using true) 를 지운다. 남는 수정 권한:
--    · 본인 글 — 로그인 토큰의 본인(auth.uid() = user_id)
--    · 관리자 — 관리자 토큰(095)
--    · 서버 함수(조회수·댓글 수·공감·삭제·운영자 HOT/숨김·AI 자율 사이클의 서버 키)
--  확인 칸 2개 — 둘 다 true 면 끝.
-- ============================================================

drop policy if exists "lounge_posts: anon update" on public.lounge_posts;

notify pgrst, 'reload schema';

select
  not exists (select 1 from pg_policies where tablename = 'lounge_posts' and policyname = 'lounge_posts: anon update') as anon_update_closed_ok,
  exists     (select 1 from pg_policies where tablename = 'lounge_posts' and policyname = 'lounge_posts: owner update') as owner_update_kept_ok;
