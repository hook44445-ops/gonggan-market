-- ════════════════════════════════════════════════════════════════════
-- 014_lounge_categories.sql
-- 라운지 카테고리 최종 정리 (2026.06)
--   · lounge_categories 테이블 생성 (id/label/icon/sort_order/is_active)
--   · 추가: 시공후기/견적고민/업체추천/이사입주
--   · 비활성: 게임/반려동물/여행/대화해요 (is_active=false)
--   · lounge_posts.is_visible 컬럼 추가 + 비활성 카테고리 글 soft-hide
--
-- 멱등(idempotent) · 추가 전용. hard delete 없음(복구 가능).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 1) lounge_posts.is_visible (기본 true) — 비활성 카테고리 글 숨김용 soft flag
alter table public.lounge_posts
  add column if not exists is_visible boolean not null default true;

-- 2) lounge_categories 테이블
create table if not exists public.lounge_categories (
  id          text primary key,           -- 'interior', 'review' ...
  label       text not null,
  icon        text,                        -- 이모지(옵션)
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.lounge_categories enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='lounge_categories' and policyname='lounge_categories: public read') then
    create policy "lounge_categories: public read" on public.lounge_categories for select using (true);
  end if;
end $$;

-- 3) 카테고리 upsert — 최종 순서/아이콘/활성 상태
insert into public.lounge_categories (id, label, icon, sort_order, is_active) values
  ('all',         '전체',     null,   0,  true),
  ('popular',     '인기',     '🔥',   1,  true),
  ('interior',    '인테리어',  null,   2,  true),
  ('review',      '시공후기',  '📸',   3,  true),
  ('quote_worry', '견적고민',  '💬',   4,  true),
  ('recommend',   '업체추천',  '🛡️',  5,  true),
  ('room_deco',   '집꾸미기',  null,   6,  true),
  ('move_in',     '이사입주',  '🏠',   7,  true),
  ('realestate',  '부동산',    null,   8,  true),
  ('startup',     '창업',     null,   9,  true),
  ('local',       '동네',     null,  10,  true),
  ('daily',       '생활',     null,  11,  true),
  ('stock',       '주식',     null,  12,  true),
  ('exercise',    '운동',     null,  13,  true),
  ('humor',       '유머',     null,  14,  true),
  ('free',        '자유',     null,  15,  true),
  -- 비활성(삭제) 카테고리 — 행은 보존, is_active=false (복구 가능)
  ('game',        '게임',     null,  90,  false),
  ('pet',         '반려동물',  null,  91,  false),
  ('travel',      '여행',     null,  92,  false),
  ('chat',        '대화해요',  null,  93,  false)
on conflict (id) do update
  set label = excluded.label,
      icon  = excluded.icon,
      sort_order = excluded.sort_order,
      is_active  = excluded.is_active,
      updated_at = now();

-- 4) 비활성 카테고리 게시글 soft-hide (hard delete 금지 · 복구 시 true 로 되돌림)
update public.lounge_posts
set is_visible = false, updated_at = now()
where category in ('game', 'pet', 'travel', 'chat');

-- 확인
do $$
begin
  raise notice '014 lounge_categories: active=%, inactive=%, hidden_posts=%',
    (select count(*) from public.lounge_categories where is_active),
    (select count(*) from public.lounge_categories where not is_active),
    (select count(*) from public.lounge_posts where is_visible = false);
end $$;
