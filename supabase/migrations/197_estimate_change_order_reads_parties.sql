-- ============================================================
--  Migration 197: 최종 견적서(estimate_get_for_request) · 추가공사 목록(change_orders_for_contract) — 당사자 · 관리자만
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(이 두 함수를 로그인 토큰으로 부르는 버전) → 이 SQL.  ⚠ 196 이 먼저 들어가 있어야 한다(_escrow_id_party).
--
--  왜(10-01 점검 — 196 과 같은 종류):
--    · estimate_get_for_request(046) · change_orders_for_contract(033) 는 정의자 권한 + anon 실행 + 확인 없음 —
--      로그인 안 한 누구나 요청 ID 로 업체의 최종 견적서(항목별 단가 · 총액 · 사진)를,
--      계약 ID 로 추가공사 요청(사유 · 금액 · 사진)을 읽을 수 있었다(요청 ID 는 공개 화면에서 보인다).
--  바꾼 뒤
--    · 견적서: 요청 주인 · 견적서를 쓴 업체 주인(company_id 가 업체 id 든 주인 id 든) · 관리자만 — 아니면 빈 값
--    · 추가공사: 그 계약 당사자(196 _escrow_id_party — 고객 · 업체 주인 · 관리자)만 — 아니면 빈 목록
--    · 두 함수 anon 실행 권한 회수 · 돌려주는 모양은 046/033 그대로
--  되돌리기: 046 의 estimate_get_for_request · 033 의 change_orders_for_contract 를 다시 실행한다(«grant … to anon» 포함).
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

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
     -- 197: 요청 주인 · 견적서를 쓴 업체 주인 · 관리자만
     and auth.uid() is not null
     and (coalesce(public.is_admin(), false)
          or exists (select 1 from public.requests r where r.id = e.request_id and r.user_id = auth.uid())
          or e.company_id = auth.uid()
          or exists (select 1 from public.companies c
                      where (c.id = e.company_id or c.owner_id = e.company_id) and c.owner_id = auth.uid()))
   order by e.created_at desc
   limit 1;
$$;

create or replace function public.change_orders_for_contract(p_contract_id uuid)
returns setof public.change_orders language sql stable security definer
set search_path = public, extensions as $$
  select * from public.change_orders
   where contract_id = p_contract_id
     and public._escrow_id_party(p_contract_id)   -- 197: 그 계약 당사자 · 관리자만
   order by created_at desc;
$$;

revoke execute on function public.estimate_get_for_request(uuid) from public, anon;
revoke execute on function public.change_orders_for_contract(uuid) from public, anon;
grant execute on function public.estimate_get_for_request(uuid) to authenticated;
grant execute on function public.change_orders_for_contract(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① parties_only: 두 함수가 당사자만 확인한다
--  ② no_anon: 로그인 안 한 사람(anon)은 두 함수를 부를 수 없다
select
  position('197:' in pg_get_functiondef('public.estimate_get_for_request(uuid)'::regprocedure)) > 0
  and position('_escrow_id_party' in pg_get_functiondef('public.change_orders_for_contract(uuid)'::regprocedure)) > 0 as parties_only,
  not has_function_privilege('anon', 'public.estimate_get_for_request(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.change_orders_for_contract(uuid)', 'execute') as no_anon;
