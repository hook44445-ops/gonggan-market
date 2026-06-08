-- ════════════════════════════════════════════════════════════════════
-- 042_cancel_test_request.sql
-- 테스트용 견적 요청 1건 정리(취소+숨김). request_id 로만 타겟(값/예산 기준 아님).
--
-- 대상: 5b1bcbdf-80e2-4321-b378-1183a06724da (status=open, 테스트 데이터)
--   · 소비자 "견적요청"·업체 "입찰" 탭에 계속 노출되어 정리한다.
--   · 계정/입찰/에스크로/완료 데이터는 건드리지 않음(요청 행 상태만 변경).
--
-- 멱등 · 단건 타겟. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

update public.requests
   set status     = 'cancelled',
       is_hidden  = true,
       is_deleted = true,
       updated_at = now()
 where id = '5b1bcbdf-80e2-4321-b378-1183a06724da';

notify pgrst, 'reload schema';
