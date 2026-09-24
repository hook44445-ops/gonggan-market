-- ============================================================
--  총점검(2026-09-24) 데이터 정리 — 대표가 Supabase SQL Editor 에서 실행
--  「[점검]」 표시가 붙은 것만 건드린다. 먼저 1) 로 무엇이 걸리는지 보고, 2) 를 실행하세요.
-- ============================================================

-- 1) 확인 — 지워질 대상
select 'review' as kind, id::text, left(content, 60) as text, created_at from public.reviews
 where content like '[점검]%'
union all
select 'request', id::text, left(coalesce(to_jsonb(r)->>'description', to_jsonb(r)->>'desc', ''), 60), created_at from public.requests r
 where id = '1ef11c53-ef17-4556-93b1-d180e331669b'
union all
select 'chat', id::text, left(text, 60), created_at from public.chats
 where text like '[점검]%'
order by created_at;

-- 2) 공개 화면에서 즉시 내리기 — 후기는 숨김+삭제 표시(행은 남겨 기록 보존)
update public.reviews
   set is_hidden = true, is_deleted = true
 where content like '[점검]%';

-- 점검 채팅 메시지(업체 → 다른 고객 방에 잘못 보낸 1건 포함)
delete from public.chats where text like '[점검]%';

-- ※ 점검 거래(요청·입찰·견적·에스크로·지급 기록)는 관리자 「테스트 데이터 정리」
--   (admin_cleanup_user_test_data) 로 한꺼번에 지우는 편이 안전하다 — 표에 흩어져 있다.
