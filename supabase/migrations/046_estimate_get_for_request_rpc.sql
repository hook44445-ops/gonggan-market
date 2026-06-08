-- ════════════════════════════════════════════════════════════════════
-- 046_estimate_get_for_request_rpc.sql
-- 의뢰인(OTP 세션)이 최종 견적서를 읽지 못하는 문제 해결 — SECURITY DEFINER 조회 RPC.
--
-- 증상:
--   의뢰인 BidStatusScreen 에서 finalEstimate=null → 견적 본문/사진 미표시.
--
-- 원인:
--   estimates RLS SELECT 정책이 `auth.uid() IS NOT NULL` 로 제한(013).
--   본 앱은 OTP 커스텀 인증이라 anon 세션의 auth.uid() = null → estimates 직접 SELECT 차단.
--   (requests/bids 는 `using(true)` 라 정상 조회되어 비대칭 발생.)
--   getEstimateForRequest 는 RPC 가 아닌 직접 .from("estimates").select 라 RLS 에 막혀
--   row 가 존재해도 data:null 로 반환됨.
--
-- 처리(최소 범위 · 기존 OTP 우회 패턴과 동일):
--   · estimates RLS 는 그대로 둔다(완화 없음).
--   · request_id 로 최신 estimate 1건을 돌려주는 SECURITY DEFINER 함수 추가 → RLS 우회.
--   · 반환 형태는 기존 getEstimateForRequest(.maybeSingle) 와 동일하게 단일 row(또는 null).
--   · 저장/상태전이/사진 로직(043/045)·다른 흐름은 일절 변경하지 않음.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(045 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.estimate_get_for_request(p_request_id uuid)
returns public.estimates
language sql
security definer
set search_path = public, extensions
as $$
  select e.*
    from public.estimates e
   where e.request_id = p_request_id
   order by e.created_at desc
   limit 1;
$$;

grant execute on function public.estimate_get_for_request(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
