-- ============================================================
--  Migration 137: 에스크로 표 직접 쓰기 닫기 (E20 2/2 · 결제 열기 전 필수)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 136 실행 + 앱 배포(escrow_action 을 부르는 버전) 뒤에만. 옛 앱이 남아 있으면 단계 보고·승인이 막힌다.
--
--  escrow_payments · escrow_payouts · phase_photos 의 정책을 모두 지우고 «읽기»만 남긴다
--  (지금 화면들이 읽는 방식 그대로). 쓰기는 136 의 서버 함수(당사자 = 로그인 토큰의 사용자)와
--  기존 서버 함수(escrow_get_or_create · 자동 승인 등, 정의자 권한)로만.
--  확인 칸 2개(아래 select) — 둘 다 true 면 끝. 문제면 맨 아래 «되돌리기».
-- ============================================================

set search_path = public, extensions;

-- 세 표: 쓰기 정책 전부 지우고 읽기만(지금 화면들이 읽는 방식 그대로) ---------------------
do $$
declare t text; p record;
begin
  foreach t in array array['escrow_payments', 'escrow_payouts', 'phase_photos'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy %I on public.%I for select using (true)', t || ': read', t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  not exists (select 1 from pg_policies where schemaname = 'public'
               and tablename in ('escrow_payments', 'escrow_payouts', 'phase_photos') and cmd <> 'SELECT')  as writes_closed_ok,
  (select count(*) from pg_policies where schemaname = 'public'
     and tablename in ('escrow_payments', 'escrow_payouts', 'phase_photos') and cmd = 'SELECT') = 3          as reads_open_ok;

-- 되돌리기(문제 시 — 쓰기를 다시 열기):
--   do $$ declare t text; begin foreach t in array array['escrow_payments','escrow_payouts','phase_photos'] loop
--     execute format('create policy %I on public.%I for all using (true) with check (true)', t || ': rollback all', t);
--   end loop; end $$;
