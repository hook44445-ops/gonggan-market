-- ════════════════════════════════════════════════════════════════════
-- 014_lounge_categories.sql
-- 라운지 카테고리 최종 정리 (2026.06)
--   · lounge_categories 테이블 (id/name/slug/icon/sort_order/is_active)
--   · 추가: 시공후기/견적고민/업체추천/이사입주
--   · 비활성: 게임/반려동물/여행/대화해요 (is_active=false)
--   · lounge_posts.is_visible / hidden_at 컬럼 추가 + 비활성 카테고리 글 soft-hide
--
-- 멱등(idempotent) · 추가 전용 · hard delete 없음(복구 가능).
-- 검수 SQL 호환: name / slug / is_active / sort_order / is_visible / hidden_at / hidden_reason
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 1) lounge_posts 숨김 컬럼 (is_hidden/hidden_reason 은 기존 존재 — hidden_at/is_visible 보강)
alter table public.lounge_posts
  add column if not exists is_visible    boolean not null default true,
  add column if not exists hidden_at     timestamptz,
  add column if not exists hidden_reason text;

-- 2) lounge_categories 테이블
--    name = 표시 라벨, slug = id 와 동일(앱은 category=slug 로 저장)
create table if not exists public.lounge_categories (
  id          text primary key,
  name        text not null,
  slug        text not null,
  icon        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists idx_lounge_categories_slug on public.lounge_categories(slug);

alter table public.lounge_categories enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='lounge_categories' and policyname='lounge_categories: public read') then
    create policy "lounge_categories: public read" on public.lounge_categories for select using (true);
  end if;
end $$;

-- 3) 카테고리 upsert — 최종 순서/아이콘/활성 상태 (id=slug)
insert into public.lounge_categories (id, name, slug, icon, sort_order, is_active) values
  ('all',         '전체',     'all',          null,   0,  true),
  ('popular',     '인기',     'popular',      '🔥',   1,  true),
  ('interior',    '인테리어',  'interior',     null,   2,  true),
  ('review',      '시공후기',  'review',       '📸',   3,  true),
  ('quote_worry', '견적고민',  'quote_worry',  '💬',   4,  true),
  ('recommend',   '업체추천',  'recommend',    '🛡️',  5,  true),
  ('room_deco',   '집꾸미기',  'room_deco',    null,   6,  true),
  ('move_in',     '이사입주',  'move_in',      '🏠',   7,  true),
  ('realestate',  '부동산',    'realestate',   null,   8,  true),
  ('startup',     '창업',     'startup',      null,   9,  true),
  ('local',       '동네',     'local',        null,  10,  true),
  ('daily',       '생활',     'daily',        null,  11,  true),
  ('stock',       '주식',     'stock',        null,  12,  true),
  ('exercise',    '운동',     'exercise',     null,  13,  true),
  ('humor',       '유머',     'humor',        null,  14,  true),
  ('free',        '자유',     'free',         null,  15,  true),
  -- 비활성(삭제) 카테고리 — 행 보존, is_active=false (복구 가능)
  ('game',        '게임',     'game',         null,  90,  false),
  ('pet',         '반려동물',  'pet',          null,  91,  false),
  ('travel',      '여행',     'travel',       null,  92,  false),
  ('chat',        '대화해요',  'chat',         null,  93,  false)
on conflict (id) do update
  set name = excluded.name,
      slug = excluded.slug,
      icon = excluded.icon,
      sort_order = excluded.sort_order,
      is_active  = excluded.is_active,
      updated_at = now();

-- 4) 비활성 카테고리 게시글 soft-hide (hard delete 금지 · 복구 시 되돌림)
update public.lounge_posts
set is_visible    = false,
    hidden_at     = coalesce(hidden_at, now()),
    hidden_reason = coalesce(hidden_reason, 'category_deactivated_2026_06'),
    updated_at    = now()
where category in ('game', 'pet', 'travel', 'chat')
  and is_visible is distinct from false;

-- 확인 로그
do $$
begin
  raise notice '014 lounge_categories: active=%, inactive=%, hidden_posts=%',
    (select count(*) from public.lounge_categories where is_active),
    (select count(*) from public.lounge_categories where not is_active),
    (select count(*) from public.lounge_posts where is_visible = false);
end $$;
