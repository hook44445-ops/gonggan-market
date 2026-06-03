-- ════════════════════════════════════════════════════════════════════
-- 016_space_temperature_logs.sql
-- 공간온도 변화 로그 — 신뢰데이터 누적(충성도 3/6 STEP2)
--   온도가 바뀐 이유/변화량/시각을 기록해 프로필에서 "왜 올랐는지" 가시화.
-- 추가 전용 · 멱등. 기존 흐름 영향 없음(앱은 로그 없으면 숫자만 표시).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create table if not exists public.space_temperature_logs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete cascade,
  delta       numeric(4,1) not null,            -- 변화량(+5.0 / -2.0 ...)
  reason      text not null,                    -- 'review_written' | 'recontract' | 'response_rate' | 'job_complete' | 'dispute' ...
  reason_label text,                            -- 표시용 한글 라벨
  result_temp numeric(4,1),                     -- 변경 후 온도(옵션)
  created_at  timestamptz not null default now()
);

create index if not exists idx_space_temp_logs_company
  on public.space_temperature_logs (company_id, created_at desc);

alter table public.space_temperature_logs enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='space_temperature_logs' and policyname='space_temp_logs: public read') then
    create policy "space_temp_logs: public read" on public.space_temperature_logs for select using (true);
  end if;
end $$;
