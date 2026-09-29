-- ============================================================
--  Migration 169: 업체 제출 서류 — 그 업체 주인과 관리자만 보고, 심사 결과는 관리자만 (보완 S2)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(서류를 로그인 토큰으로 읽고 쓰는 버전) → 대표 재로그인 → 이 SQL.
--
--  바꾸는 것
--    · company_documents 정책: 누구나 읽기·쓰기(054) → 업체 주인(companies.owner_id = 토큰의 사용자)·관리자만.
--    · 업체가 직접 쓸 때 심사 칸(승인·보류·반려, 심사자·심사 시각·사유)은 못 바꾼다 — 초안(draft)·제출(submitted)만.
--      심사는 관리자 함수(118 admin_review_document)와 업체 확인(125)이 그대로 한다(서버 함수라 통과).
--  되돌리기(054 와 같음):
--    drop trigger if exists trg_company_documents_guard on public.company_documents;
--    drop policy if exists company_documents_owner_read on public.company_documents;
--    drop policy if exists company_documents_owner_insert on public.company_documents;
--    drop policy if exists company_documents_owner_update on public.company_documents;
--    create policy "company_documents: anon read" on public.company_documents for select using (true);
--    create policy "company_documents: anon insert" on public.company_documents for insert with check (true);
--    create policy "company_documents: anon update" on public.company_documents for update using (true) with check (true);
--  확인 칸 3개(맨 아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.company_doc_owner(p_company_id uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select auth.uid() is not null
     and (exists (select 1 from public.companies c where c.id = p_company_id and c.owner_id = auth.uid())
          or public.is_admin());
$$;
grant execute on function public.company_doc_owner(uuid) to anon, authenticated;

do $$
declare r record;
begin
  for r in select polname from pg_policy where polrelid = 'public.company_documents'::regclass loop
    execute format('drop policy if exists %I on public.company_documents', r.polname);
  end loop;
end $$;

alter table public.company_documents enable row level security;
create policy company_documents_owner_read on public.company_documents for select
  using (public.company_doc_owner(company_id));
create policy company_documents_owner_insert on public.company_documents for insert
  with check (public.company_doc_owner(company_id));
create policy company_documents_owner_update on public.company_documents for update
  using (public.company_doc_owner(company_id)) with check (public.company_doc_owner(company_id));

create or replace function public._company_documents_guard()
returns trigger language plpgsql
set search_path = public, extensions as $$
begin
  -- 서버 함수(관리자 심사 118 · 업체 확인 125)·서버 키·관리자 토큰은 그대로
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if public.is_admin() then return new; end if;

  if tg_op = 'INSERT' then
    if new.review_status not in ('draft', 'submitted') then new.review_status := 'draft'; end if;
    new.review_reason := null; new.reviewed_by := null; new.reviewed_at := null;
    return new;
  end if;

  new.company_id := old.company_id;
  if new.review_status is distinct from old.review_status and new.review_status not in ('draft', 'submitted') then
    new.review_status := old.review_status;
  end if;
  new.review_reason := old.review_reason; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
  return new;
end; $$;

drop trigger if exists trg_company_documents_guard on public.company_documents;
create trigger trg_company_documents_guard
  before insert or update on public.company_documents
  for each row execute function public._company_documents_guard();

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① owner_only: 정책이 주인·관리자 정책 3개뿐이다(누구나 정책 없음)
--  ② guard_on: 심사 칸 지킴 트리거가 걸렸다
--  ③ rls_on: 행 보안이 켜져 있다
select
  (select count(*) from pg_policy where polrelid = 'public.company_documents'::regclass) = 3
    and not exists (select 1 from pg_policy where polrelid = 'public.company_documents'::regclass
                     and (pg_get_expr(polqual, polrelid) = 'true' or pg_get_expr(polwithcheck, polrelid) = 'true')) as owner_only,
  exists (select 1 from pg_trigger where tgname = 'trg_company_documents_guard' and not tgisinternal) as guard_on,
  (select relrowsecurity from pg_class where oid = 'public.company_documents'::regclass) as rls_on;
