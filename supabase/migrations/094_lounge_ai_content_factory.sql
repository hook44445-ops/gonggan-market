-- ════════════════════════════════════════════════════════════════════
-- 094_lounge_ai_content_factory.sql
-- 공간라운지 AI 콘텐츠 자동화 공장 (Phase 1) — 기존 lounge_posts 구조를
-- 최대한 재사용하고, 파이프라인에 꼭 필요한 컬럼만 최소로 추가한다.
--
-- 배경:
--   · 운영(SEO) 콘텐츠는 이미 lounge_posts.is_seed=true 로 표시되고 있다
--     (019/020/021/022 마이그레이션 — 검색유입 자산으로 운영 중, "운영" 배지).
--   · 새 테이블을 만들지 않고, 이 기존 구조에 파이프라인 상태만 얹는다.
--   · lounge_posts 는 이미 anon insert/update 가 열려 있다(005_lounge_owner_update:
--     "lounge_posts: insert" with check(true) · "lounge_posts: anon update" using(true)).
--     이 앱은 anon key + OTP 인증이라 auth.uid() 가 항상 NULL 이므로, 신규 RPC 없이
--     관리자 화면(admin 검증은 애플리케이션 레이어 — 기존 adminUpdateLoungePost 와 동일 원칙)에서
--     바로 이 컬럼들을 쓸 수 있다.
--
-- 추가 컬럼(3개만):
--   · publish_status — 'draft'(초안) / 'scheduled'(예약) / 'published'(발행). 신규 행 기본값은
--     'published' 로 두어 기존 흐름(생성 즉시 노출) 무변경 — Draft 파이프라인은 옵트인이다.
--   · scheduled_at    — 예약 발행 시각(nullable).
--   · ai_topic        — 초안을 만들 때 사용한 이슈/트렌드 키워드(추적용, nullable).
--
-- publish_status 와 is_visible 은 애플리케이션 레이어에서 함께 갱신한다(draft/scheduled →
-- is_visible=false, published → is_visible=true) — 기존 공개 피드 필터(useLounge.js 의
-- `is_visible !== false`)를 그대로 재사용해 초안이 공개 피드에 노출되지 않는다.
--
-- 추가 전용(additive) · 기존 데이터/정책/컬럼 무변경. Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

alter table public.lounge_posts
  add column if not exists publish_status text not null default 'published',
  add column if not exists scheduled_at   timestamptz,
  add column if not exists ai_topic       text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'lounge_posts_publish_status_check'
  ) then
    alter table public.lounge_posts
      add constraint lounge_posts_publish_status_check
      check (publish_status in ('draft', 'scheduled', 'published'));
  end if;
end $$;

-- 관리자 검수 목록(초안/예약)·예약 발행 배치 조회용.
create index if not exists idx_lounge_posts_publish_status
  on public.lounge_posts (publish_status, scheduled_at);

notify pgrst, 'reload schema';
