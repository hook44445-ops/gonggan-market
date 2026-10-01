-- ============================================================
--  Migration 196: 계약(escrow_payments) · 지급 단계(escrow_payouts) · 단계 사진(phase_photos) — 당사자 · 관리자만 읽기
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(세 표를 로그인 토큰으로 읽고, 업체 «완료 프로젝트» 숫자를 company_done_projects 로 받는 버전) → 이 SQL.
--
--  왜(10-01 점검):
--    · 137 이 세 표의 직접 쓰기는 닫았지만 읽기는 «누구나(using true)»로 남겼다 —
--      로그인 안 한 누구나 모든 계약의 금액 · 업체 · 요청 · 단계 상태 · 분쟁 여부, 단계별 지급액, 현장 사진을 읽을 수 있었다.
--  바꾼 뒤
--    · 읽기: 그 계약의 고객(requests.user_id) · 업체 주인(companies.owner_id — company_id 가 업체 id 든 주인 id 든) · 관리자만
--            (단계 사진은 올린 사람도). 정책 g196_* · 판단은 내부 함수 _escrow_party_of / _escrow_id_party.
--    · 쓰기: 그대로(정책 없음 — 136 escrow_action · phase_photos_add 등 서버 함수로만)
--    · 공개 숫자: company_done_projects(업체) → {count, recent[날짜 3개]} — 업체 프로필 «완료 프로젝트»(금액·고객 없이 숫자·날짜만)
--    · 서버 키(service_role — /api/confirm-payment)는 RLS 를 거치지 않아 그대로
--  되돌리기(세 표 읽기를 다시 누구나):
--    do $$ declare t text; begin foreach t in array array['escrow_payments','escrow_payouts','phase_photos'] loop
--      execute format('create policy %I on public.%I for select using (true)', t || ': read', t); end loop; end $$;
--  확인 칸 3개(맨 아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 그 계약의 당사자(고객 · 업체 주인) 또는 관리자인가 — 내부
create or replace function public._escrow_party_of(p_request_id uuid, p_company_id uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select auth.uid() is not null and (
       coalesce(public.is_admin(), false)
    or p_company_id = auth.uid()
    or exists (select 1 from public.requests r where r.id = p_request_id and r.user_id = auth.uid())
    or exists (select 1 from public.companies c
                where (c.id = p_company_id or c.owner_id = p_company_id) and c.owner_id = auth.uid())
  );
$$;

create or replace function public._escrow_id_party(p_escrow_id uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from public.escrow_payments e
                  where e.id = p_escrow_id and public._escrow_party_of(e.request_id, e.company_id));
$$;

-- 정책 안에서 부르므로 anon 도 실행할 수 있어야 한다(로그인 안 했으면 false — «0줄»이 되고 오류가 나지 않게).
--   돌려주는 것은 «지금 사용자가 그 계약 당사자인가» 참/거짓뿐이다.
grant execute on function public._escrow_party_of(uuid, uuid) to anon, authenticated;
grant execute on function public._escrow_id_party(uuid) to anon, authenticated;

-- 세 표: «누구나 읽기»(qual = true) 정책 지우기 — 이름을 몰라도 조건으로
do $$
declare t text; p record;
begin
  foreach t in array array['escrow_payments', 'escrow_payouts', 'phase_photos'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies
              where schemaname = 'public' and tablename = t
                and cmd in ('SELECT', 'ALL') and coalesce(qual, '') = 'true'
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

drop policy if exists g196_escrow_read on public.escrow_payments;
create policy g196_escrow_read on public.escrow_payments for select
  using (public._escrow_party_of(request_id, company_id));

drop policy if exists g196_payout_read on public.escrow_payouts;
create policy g196_payout_read on public.escrow_payouts for select
  using (public._escrow_id_party(escrow_id));

drop policy if exists g196_phase_read on public.phase_photos;
create policy g196_phase_read on public.phase_photos for select
  using (uploaded_by::text = auth.uid()::text or public._escrow_id_party(contract_id));

-- 공개 숫자 — 업체의 완료 프로젝트 수 · 최근 완료 날짜 3개(금액·고객 없음)
create or replace function public.company_done_projects(p_company_id uuid)
returns jsonb language sql stable security definer
set search_path = public, extensions as $$
  select jsonb_build_object(
    'count',  (select count(*) from public.escrow_payments e
                where e.company_id = p_company_id and e.transaction_status in ('SETTLED', 'COMPLETED')),
    'recent', coalesce((select jsonb_agg(x.created_at order by x.created_at desc)
                          from (select e.created_at from public.escrow_payments e
                                 where e.company_id = p_company_id and e.transaction_status in ('SETTLED', 'COMPLETED')
                                 order by e.created_at desc limit 3) x), '[]'::jsonb));
$$;
grant execute on function public.company_done_projects(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① no_public_read: 세 표에 «누구나 읽기» 정책이 없다
--  ② party_read: 세 표에 당사자 읽기 정책(g196_*)이 있다
--  ③ done_count_fn: 공개 숫자 함수가 있고 누구나 부를 수 있다
select
  not exists (select 1 from pg_policies where schemaname = 'public'
               and tablename in ('escrow_payments', 'escrow_payouts', 'phase_photos')
               and cmd in ('SELECT', 'ALL') and coalesce(qual, '') = 'true') as no_public_read,
  (select count(*) from pg_policies where schemaname = 'public'
     and policyname in ('g196_escrow_read', 'g196_payout_read', 'g196_phase_read')) = 3 as party_read,
  to_regprocedure('public.company_done_projects(uuid)') is not null
  and has_function_privilege('anon', 'public.company_done_projects(uuid)', 'execute') as done_count_fn;
