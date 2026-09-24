-- ============================================================
--  총점검 2차(2026-09-24 오후) 정리 — 대표가 Supabase SQL Editor 에서 실행
--  앞 파일(cleanup-check-2026-09-24.sql)은 「[점검]」만 잡아서 「[점검 09-24] …」 후기를 놓친다.
--  「[점검」 으로 시작하는 것만 건드린다. 1) 확인 → 2) 후기 내리기(행은 남김).
-- ============================================================

-- 1) 확인 — 걸리는 것
select 'review' as kind, id::text, left(content, 70) as text, is_hidden, created_at
  from public.reviews where content like '[점검%'
union all
select 'chat', id::text, left(text, 70), null, created_at
  from public.chats where text like '[점검%'
order by created_at;

-- 2) 공개 화면(홈 「믿고 맡긴 후기」 · 업체 프로필)에서 즉시 내리기 — 숨김 + 삭제 표시, 행은 기록으로 남김
update public.reviews
   set is_hidden = true, is_deleted = true
 where content like '[점검%';

-- 3) (선택) 점검 대화 메시지 지우기 — 점검 거래 방의 기록까지 없어지니, 거래를 통째로 정리할 때만.
-- delete from public.chats where text like '[점검%';
