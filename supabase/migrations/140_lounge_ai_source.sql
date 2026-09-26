-- ============================================================
--  Migration 140: AI 초안 출처 표시(ai_source) — 서버가 틀로 만든 초안만 자동 승인
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  순서: 앱 배포와 앞뒤 상관없음.
--    · 이 SQL 전: 서버는 표시 없이 초안을 만들고(자동 재시도), 자동 승인은 0건(안전한 쪽)으로 멈춘다.
--    · 이 SQL 뒤: 서버 초안에 'server_template' 표시 → 그것만 자동 승인·발행.
--  대표 지시(09-26) 「AI 운영센터 점검」 — 예전엔 ai_topic 만 있으면 누가 만든 초안이든(브라우저 AI 초안 포함)
--  관리자 확인 없이 자동 발행됐다.
--  확인 칸 1개(아래 select) — true 면 끝.
-- ============================================================

alter table public.lounge_posts add column if not exists ai_source text;
comment on column public.lounge_posts.ai_source is
  'AI 초안 출처 — server_template(서버 자율 사이클의 틀 글)만 자동 승인. null = 사람 글 또는 수동 검수 대상';

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'lounge_posts' and column_name = 'ai_source') as ai_source_ok;
