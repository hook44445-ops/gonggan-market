-- ════════════════════════════════════════════════════════════════════
-- 123_doc_submitted_admin_notify.sql  (대표 09-25 — 「먼저 선진행돼야 하는 건 에스컬레이션으로 사업자등록과 시공보험 등록 구간」)
--
-- 문제: 업체가 사업자등록증·시공보험 증권·실내건축공사업 등록증을 «제출»해도 관리자에게 아무 알림이 없다.
--       관리자가 문서센터를 열어 보기 전까지 한도 계단이 멈춘다. 선택된 업체는 72시간 안에 사업자 확인이
--       돼야 계약(결제)이 열리는데(116), 여기서 막힐 수 있었다.
-- 고침: company_documents 가 'submitted' 로 바뀌는 순간(한도를 여는 서류 세 가지만) 관리자 전원에게 알림.
--       이 업체가 이미 고객에게 선택돼 계약을 기다리는 공사가 있으면 «급함»(HIGH)으로.
--
-- 추가 전용 · 재실행 안전. Supabase SQL Editor 에서 한 번 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.trg_doc_submitted_admin_notify()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_label text; v_name text; v_waiting int := 0;
begin
  if new.review_status is distinct from 'submitted' then return new; end if;
  if tg_op = 'UPDATE' and old.review_status is not distinct from 'submitted' then return new; end if;
  v_label := case new.document_type
               when 'business_license'      then '사업자등록증'
               when 'insurance_certificate' then '시공보험 증권'
               when 'interior_license'      then '실내건축공사업 등록증'
               else null end;
  if v_label is null then return new; end if;   -- 한도를 여는 서류만

  select coalesce(c.name, '업체') into v_name from public.companies c where c.id = new.company_id;

  -- 이 업체를 고른 뒤 계약(결제)을 기다리는 공사
  select count(*) into v_waiting
    from public.requests r
   where r.selected_company_id = new.company_id
     and coalesce(r.status, '') not in ('cancelled','canceled','completed','expired','closed')
     and not exists (select 1 from public.escrow_payments e where e.request_id = r.id);

  insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
  select u.id, 'ADMIN_DOC_SUBMITTED',
         '서류 확인 요청 · ' || v_label,
         coalesce(v_name, '업체') || '이(가) ' || v_label || '을(를) 올렸어요. 확인하면 한도 계단이 한 칸 올라가요.'
           || case when v_waiting > 0 then ' 이 업체를 고른 고객이 계약을 기다리고 있어요(' || v_waiting || '건).' else '' end,
         new.company_id, 'company',
         case when v_waiting > 0 then 'HIGH' else 'NORMAL' end
    from public.users u where u.role = 'admin';
  return new;
exception when others then
  return new;   -- 알림 실패가 서류 제출을 막지 않게
end; $$;

drop trigger if exists trg_doc_submitted_admin_notify on public.company_documents;
create trigger trg_doc_submitted_admin_notify after insert or update of review_status on public.company_documents
  for each row execute function public.trg_doc_submitted_admin_notify();

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_trigger where tgname = 'trg_doc_submitted_admin_notify') as doc_notify_ok;
