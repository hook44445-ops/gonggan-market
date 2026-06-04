-- ════════════════════════════════════════════════════════════════════
-- 030_request_status_rpc.sql
-- 계약(에스크로) 성립 시 requests.status 가 in_progress 로 전이되도록 security definer RPC.
--
-- 배경:
--   setRequestInProgress 는 anon 키로 requests 를 직접 UPDATE 했는데, 이 앱은 전화번호(OTP)
--   커스텀 인증이라 auth.uid()=null 이고 requests UPDATE 정책은
--     "requests: owner write" = auth.uid() = user_id
--   하나뿐이라 상태 전이가 RLS 에 막혀 0행 갱신됨(리뷰 어드민과 동일 원인).
--   그 결과 계약/착공이 진행돼도 request.status 가 'open' 으로 남아:
--     · 업체 "새 견적 요청"(status=open)에 계속 노출(이중 노출)
--     · 의뢰인 통계/목록이 open 으로 집계
--   되는 정합성 문제가 발생.
--
-- 수정:
--   request_mark_in_progress(p_request_id) — security definer.
--   해당 요청에 활성(정산 전) 에스크로가 실제로 존재할 때만 open → in_progress 로 전이.
--   (임의 상태 변경 방지: 에스크로 없는 요청은 전이하지 않음)
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.request_mark_in_progress(p_request_id uuid)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_has_escrow boolean;
  v_new        text;
begin
  -- 실제 계약(에스크로)이 있는 요청만 전이 — 정산/취소/환불 건은 제외.
  select exists (
    select 1 from public.escrow_payments
     where request_id = p_request_id
       and coalesce(transaction_status, '') not in ('SETTLED', 'CANCELLED', 'REFUNDED')
  ) into v_has_escrow;

  if not v_has_escrow then
    return null;  -- 에스크로 없으면 전이하지 않음
  end if;

  update public.requests
     set status = 'in_progress', updated_at = now()
   where id = p_request_id
     and status = 'open'
   returning status into v_new;

  return v_new;  -- 전이 시 'in_progress', 이미 진행/완료/마감 등이면 null
end; $$;

grant execute on function public.request_mark_in_progress(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
