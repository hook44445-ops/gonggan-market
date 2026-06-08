-- ════════════════════════════════════════════════════════════════════
-- 041_request_mark_completed.sql
-- 정산 완료(escrow SETTLED) 시 requests.status 를 'completed' 로 동기화.
--
-- 배경:
--   의뢰인이 최종 단계를 승인하면 escrow_payments.transaction_status = 'SETTLED' 로
--   바뀌지만, requests.status 는 직전 값(site_visiting/in_progress 등)으로 남아
--   업체 진행중 탭에 유령으로 남고 완료 상세/리뷰 분기가 꼬였다.
--   OTP 커스텀 인증(auth.uid()=null)이라 프론트의 requests 직접 UPDATE 는 RLS 에
--   막히므로 상태 전이는 SECURITY DEFINER RPC 로만 수행한다.
--
-- 규칙:
--   · 해당 request 의 escrow 가 SETTLED/COMPLETED 일 때만 'completed' 로 전이(임의 완료 방지).
--   · 이미 completed/cancelled 면 그대로(멱등).
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(036 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.request_mark_completed(p_request_id uuid)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_esc public.escrow_payments; v_new text;
begin
  -- 정산/완료된 에스크로가 실제로 있을 때만 완료 전이(임의 completed 방지).
  select * into v_esc from public.escrow_payments
   where request_id = p_request_id
     and coalesce(transaction_status, '') in ('SETTLED', 'COMPLETED')
   order by created_at desc
   limit 1;

  if v_esc.id is null then
    return null;  -- 정산 escrow 없으면 전이하지 않음
  end if;

  update public.requests
     set status     = 'completed',
         updated_at = now()
   where id = p_request_id
     and status not in ('completed', 'cancelled')
   returning status into v_new;

  return v_new;  -- 전이 시 'completed', 이미 완료/취소면 null
end; $$;

grant execute on function public.request_mark_completed(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
