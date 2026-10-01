-- ============================================================
--  Migration 200: 현장견적(site_visits) · 견적서(estimates) 읽기 — 당사자 · 관리자만 · 견적서 직접 고치기 닫기
--                 계약 타임라인(contract_timeline) · 계약 메모 쓰기 당사자만 · 고객 신고 관리자 처리
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(두 표를 로그인 토큰으로 읽고 · 타임라인을 contract_timeline 으로 · 관리자 화면을 관리자 토큰으로) → 이 SQL.
--  ⚠ 196 이 먼저 들어가 있어야 한다(_escrow_id_party).
--
--  왜(10-01 점검 · 관리자 화면 · 계약 화면 «제대로 도는지»):
--    · site_visits · estimates 읽기가 «로그인만 하면 누구나»(013 — auth.uid() IS NOT NULL) — 로그인한 누구나 모든 현장견적 ·
--      모든 업체 견적서(항목별 단가)를 읽을 수 있었다(197 의 견적서 함수를 고쳐도 표를 직접 읽으면 그만).
--    · estimates «company write»가 FOR ALL USING (auth.uid() IS NOT NULL) — 로그인한 누구나 남의 견적서를 고치거나 지울 수 있었다
--      (앱은 견적서를 서버 함수 estimate_upsert 등으로만 쓴다).
--    · 계약 타임라인: 180 뒤 활동 기록 표는 관리자만 읽어 계약 화면 타임라인이 비어 있었다 → 당사자용 서버 함수.
--    · contract_notes «author write»가 auth.uid() = author_id 만 봐 — 로그인한 누구나 남의 계약에 메모(분쟁 증빙)를 넣을 수 있었다
--      (지금 화면에서 쓰지 않는 기능 — 표만 막는다). 읽기도 업체 id 로 저장된 계약만 맞췄다 → 196 판단으로.
--    · customer_reports(고객 신고): 관리자 «처리 상태 바꾸기» 정책이 없어 관리자 화면에서 바꿀 수 없었다.
--  바꾼 뒤
--    · site_visits 읽기: 요청 주인 · 업체 주인(company_id 가 업체 id 든 주인 id 든) · 관리자 (쓰기 정책 «company write»는 그대로)
--    · estimates 읽기: 요청 주인 · 견적 업체 주인 · 관리자 · 직접 쓰기 정책 없음(서버 함수로만)
--    · contract_timeline(계약) → 그 계약의 활동 기록(당사자 · 관리자만 · 아니면 빈 목록)
--    · contract_notes: 읽기 · 쓰기 모두 그 계약 당사자(쓰기는 본인 이름으로만)
--    · customer_reports: 관리자 처리(update) 정책 추가
--  되돌리기(두 표를 예전처럼):
--    create policy "site_visits: parties read" on public.site_visits for select using (auth.uid() is not null);
--    create policy "estimates: parties read" on public.estimates for select using (auth.uid() is not null);
--    create policy "estimates: company write" on public.estimates for all using (auth.uid() is not null);
--  확인 칸 3개(맨 아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- 요청 · 업체 당사자 또는 관리자인가(내부 · 정책 안에서 부른다 — anon 은 false)
create or replace function public._request_party_of(p_request_id uuid, p_company_id uuid)
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
grant execute on function public._request_party_of(uuid, uuid) to anon, authenticated;

-- 1) site_visits · estimates — «로그인만 하면 누구나» 정책 지우기(조건으로)
do $$
declare t text; p record;
begin
  foreach t in array array['site_visits', 'estimates'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for p in select policyname, cmd from pg_policies
              where schemaname = 'public' and tablename = t
                and replace(lower(coalesce(qual, '')), ' ', '') in ('(auth.uid()isnotnull)', 'true')
                and (cmd = 'SELECT' or (t = 'estimates' and cmd in ('ALL', 'UPDATE', 'DELETE', 'INSERT')))
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

drop policy if exists g200_sv_read on public.site_visits;
create policy g200_sv_read on public.site_visits for select
  using (public._request_party_of(request_id, company_id));

drop policy if exists g200_est_read on public.estimates;
create policy g200_est_read on public.estimates for select
  using (public._request_party_of(request_id, company_id));

-- 2) 계약 타임라인 — 그 계약 당사자 · 관리자만
create or replace function public.contract_timeline(p_contract_id uuid)
returns setof public.activity_logs language sql stable security definer
set search_path = public, extensions as $$
  select * from public.activity_logs
   where target_type = 'contract' and target_id::text = p_contract_id::text
     and public._escrow_id_party(p_contract_id)
   order by created_at asc
   limit 500;
$$;
revoke execute on function public.contract_timeline(uuid) from public, anon;
grant execute on function public.contract_timeline(uuid) to authenticated;

-- 3) 계약 메모 — 읽기 · 쓰기 모두 그 계약 당사자(정책 이름은 schema.sql 그대로)
do $$
begin
  if to_regclass('public.contract_notes') is null then return; end if;
  execute 'drop policy if exists "contract_notes: parties read" on public.contract_notes';
  execute 'create policy "contract_notes: parties read" on public.contract_notes for select
             using (is_deleted = false and public._escrow_id_party(contract_id))';
  execute 'drop policy if exists "contract_notes: author write" on public.contract_notes';
  execute 'create policy "contract_notes: author write" on public.contract_notes for insert
             with check (auth.uid() = author_id and public._escrow_id_party(contract_id))';
end $$;

-- 4) 고객 신고 — 관리자 처리
do $$
begin
  if to_regclass('public.customer_reports') is null then return; end if;
  execute 'drop policy if exists g200_cr_admin_update on public.customer_reports';
  execute 'create policy g200_cr_admin_update on public.customer_reports for update
             using (coalesce(public.is_admin(), false)) with check (coalesce(public.is_admin(), false))';
end $$;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① parties_read: 두 표에 «로그인만 하면 누구나» 정책이 없고 당사자 읽기 정책이 있다
--  ② no_direct_estimate_write: 견적서 표에 직접 쓰기 정책이 없다
--  ③ timeline_fn: 계약 타임라인 함수가 있고 로그인한 사람만 부른다
select
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('site_visits', 'estimates')
               and cmd = 'SELECT' and replace(lower(coalesce(qual, '')), ' ', '') in ('(auth.uid()isnotnull)', 'true'))
  and (select count(*) from pg_policies where schemaname = 'public' and policyname in ('g200_sv_read', 'g200_est_read')) = 2 as parties_read,
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'estimates'
               and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')) as no_direct_estimate_write,
  to_regprocedure('public.contract_timeline(uuid)') is not null
  and not has_function_privilege('anon', 'public.contract_timeline(uuid)', 'execute') as timeline_fn;
