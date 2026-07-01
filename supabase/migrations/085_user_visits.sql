-- ════════════════════════════════════════════════════════════════════
-- 085_user_visits.sql
-- 방문자/DAU/MAU 운영 통계 — 최소 데이터만 기록(개인정보 미수집).
--
-- 목적: 관리자 대시보드에서 오늘/7일/30일 방문자·DAU·MAU 확인.
-- 원칙:
--   · 전화번호/이메일/이름/위치 등 개인정보 저장 금지. user_id(참조)·role·방문일자만.
--   · 하루 중 같은 방문자는 (visitor_key, visit_date) UNIQUE 로 1회만 기록(중복 무시).
--   · 기록(insert)은 anon/authenticated 허용(앱 시작 시 1회). 원시 행 조회(select)는 차단 —
--     집계는 security-definer RPC(admin_visit_stats)로만, 관리자 검증 후 '카운트'만 반환.
--   · 신규 테이블 1개 + RPC 1개만. 기존 테이블/기능/RLS 무변경(additive only).
--
-- Supabase SQL Editor 에서 1회 실행(084 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── 1. user_visits 테이블 ──────────────────────────────────────────────
create table if not exists public.user_visits (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references public.users(id) on delete set null,  -- 로그인 사용자(선택)
  role         text,                                                        -- consumer/company/admin/guest 등(선택)
  visitor_key  text        not null,      -- 로그인=user.id, 비로그인=익명 세션 id. 날짜당 1행 dedupe 키.
  visit_date   date        not null default (now() at time zone 'Asia/Seoul')::date,
  visited_at   timestamptz not null default now(),
  screen       text,                                                        -- 진입 화면(선택)
  user_agent   text,                                                        -- 대략적 기기/브라우저(선택)
  created_at   timestamptz not null default now()
);

comment on table public.user_visits is '운영 통계용 방문 기록(방문자/DAU/MAU). 개인정보 미수집 — user_id 참조·role·방문일자만.';

-- 날짜당 방문자 1행(중복 무시) — DAU/방문자 집계 기준.
create unique index if not exists user_visits_key_date_uniq on public.user_visits (visitor_key, visit_date);
-- 기간 집계용.
create index if not exists user_visits_date_idx on public.user_visits (visit_date);

-- ── 2. RLS — 기록 허용 / 원시 조회 차단 ────────────────────────────────
alter table public.user_visits enable row level security;

-- 기록: anon/authenticated insert 허용(운영 통계, PII 없음). 하루 1회 upsert(중복 무시)로 호출.
drop policy if exists "user_visits_insert" on public.user_visits;
create policy "user_visits_insert" on public.user_visits for insert with check (true);
-- 조회(select) 정책 미생성 → RLS 활성 상태에서 원시 행 조회 전면 차단(일반 사용자 노출 금지).
-- 집계는 아래 security-definer RPC 로만 관리자에게 카운트만 노출.

-- ── 3. 집계 RPC — 관리자 전용(카운트만 반환) ───────────────────────────
-- admin_project_flow_list 와 동일한 관리자 검증 패턴(_safe_uuid + role='admin' / 코드관리자 'admin' sentinel).
create or replace function public.admin_visit_stats(p_admin_id text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  v_admin_uuid uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_result jsonb;
begin
  v_admin_uuid := public._safe_uuid(p_admin_id);
  if v_admin_uuid is not null then
    if not exists (select 1 from public.users where id = v_admin_uuid and role = 'admin') then
      raise exception 'ADMIN_ONLY';
    end if;
  elsif coalesce(p_admin_id, '') not in ('admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  select jsonb_build_object(
    'today', (select count(distinct visitor_key) from public.user_visits where visit_date = v_today),
    'd7',    (select count(distinct visitor_key) from public.user_visits where visit_date >= v_today - 6),
    'd30',   (select count(distinct visitor_key) from public.user_visits where visit_date >= v_today - 29),
    'dau',   (select count(distinct visitor_key) from public.user_visits where visit_date = v_today),
    'mau',   (select count(distinct visitor_key) from public.user_visits where visit_date >= v_today - 29),
    'total_rows', (select count(*) from public.user_visits)
  ) into v_result;

  return v_result;
end; $$;

grant execute on function public.admin_visit_stats(text) to anon, authenticated;

notify pgrst, 'reload schema';
