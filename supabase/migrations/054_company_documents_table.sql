-- ════════════════════════════════════════════════════════════════════
-- 054_company_documents_table.sql
-- public.company_documents 테이블 신규 생성 (PGRST205 해소)
--
-- 배경:
--   서류센터(업로드 서류 + 동의/서약 서류)는 public.company_documents 에
--   저장된다. 그러나 이 테이블 정의는 supabase/schema.sql 에만 있고
--   적용 가능한 migration 이 없어 운영 DB 에 반영된 적이 없다.
--     select to_regclass('public.company_documents'); → NULL
--   결과: PostgREST 가 테이블을 찾지 못해
--     PGRST205 "Could not find the table 'public.company_documents'
--     in the schema cache"
--   → 사업자등록증/시공보험증서/통장사본/자격증/포트폴리오 업로드,
--     배지 신청서·각종 동의서류 저장, 관리자 제출서류 조회가 전부 실패.
--
-- 조치:
--   schema.sql 정의를 기준으로 테이블 + 인덱스 + RLS + grant 를 생성한다.
--
-- RLS 정책 (중요):
--   이 앱은 Twilio OTP + anon key 구조로 Supabase auth 세션을 만들지 않는다
--   (auth.uid() = null — 048 signup RPC, 052 FK 제거 주석 참조).
--   따라서 auth.uid() = user_id 기반 정책으로는 anon 클라이언트가 읽기/쓰기를
--   전혀 못 해 테이블이 있어도 동일 증상이 재발한다.
--   companies(public read) / requests 등 기존 운영 테이블과 동일하게
--   anon 접근을 허용하는 정책으로 생성한다.
--
-- 안전성 (회귀 금지):
--   · 신규 테이블 생성 only — 기존 가입/로그인/OTP/AccountPicker/에스크로/
--     결제/리뷰/GPS/보증예치금/배지정책/payment_fee_rules/SETTLED 미변경.
--   · 완전 additive · 멱등(IF NOT EXISTS / DROP POLICY IF EXISTS) — 재실행 안전.
--   · admin_logs target_type 'document' 허용은 'document' 값만 추가하는
--     superset 확장이라 기존 행을 깨지 않는다.
--
-- Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create extension if not exists pgcrypto;

-- 1) 테이블 ──────────────────────────────────────────────────────────────
create table if not exists public.company_documents (
  id            uuid        primary key default gen_random_uuid(),
  company_id    uuid        references public.companies(id) on delete cascade,
  user_id       uuid        references public.users(id)     on delete set null,
  document_type text        not null,
  file_name     text,
  file_url      text,
  file_size     int,
  mime_type     text,
  checklist     jsonb,
  review_status text        not null default 'draft'
    check (review_status in ('draft','submitted','reviewing','approved','held','rejected')),
  review_reason text,
  reviewed_by   uuid        references public.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 클라 upsert onConflict 타깃 (lib/supabase.upsertCompanyDocument)
  unique (company_id, document_type)
);

-- 2) 인덱스 ──────────────────────────────────────────────────────────────
-- 조회 경로: 업체별(getCompanyDocuments), 사용자별, 상태별(관리자 필터).
create index if not exists idx_company_documents_company_id
  on public.company_documents (company_id);
create index if not exists idx_company_documents_user_id
  on public.company_documents (user_id);
create index if not exists idx_company_documents_review_status
  on public.company_documents (review_status);
-- (company_id, document_type) 는 위 UNIQUE 제약이 인덱스를 자동 생성하므로 별도 불요.

-- 3) RLS ────────────────────────────────────────────────────────────────
alter table public.company_documents enable row level security;

-- 멱등: 기존 정책(있다면)을 정리하고 anon 허용 정책으로 재생성.
drop policy if exists "company_documents: owner read"   on public.company_documents;
drop policy if exists "company_documents: owner insert" on public.company_documents;
drop policy if exists "company_documents: owner update" on public.company_documents;
drop policy if exists "company_documents: admin all"    on public.company_documents;
drop policy if exists "company_documents: anon read"    on public.company_documents;
drop policy if exists "company_documents: anon insert"  on public.company_documents;
drop policy if exists "company_documents: anon update"  on public.company_documents;

create policy "company_documents: anon read" on public.company_documents
  for select using (true);
create policy "company_documents: anon insert" on public.company_documents
  for insert with check (true);
create policy "company_documents: anon update" on public.company_documents
  for update using (true) with check (true);

-- 4) Grant ──────────────────────────────────────────────────────────────
-- RLS 정책이 통과해도 테이블 GRANT 가 없으면 anon/authenticated 는 접근 불가.
-- (Supabase 기본 grant 가 누락된 환경 대비 — 명시적으로 부여.)
grant select, insert, update on public.company_documents to anon, authenticated;

-- 5) admin_logs target_type 에 'document' 허용 ───────────────────────────
-- 관리자 서류 승인/보류/반려 시 adminReviewDocument 가 남기는 감사 로그
-- (target_type='document') 가 체크 제약에 막히지 않도록 superset 으로 확장.
alter table public.admin_logs drop constraint if exists admin_logs_target_type_check;
alter table public.admin_logs add constraint admin_logs_target_type_check
  check (target_type in ('company','customer','user','dispute','settlement','payment','lounge','report','document'));

-- 6) PostgREST 스키마 캐시 리로드 ────────────────────────────────────────
notify pgrst, 'reload schema';
