-- 라운지 사본 숨기기 (10-09 · PR #974 배포 뒤 · 대표 승인 후 Supabase SQL Editor 에서)
-- 규칙(lib/loungeDuplicates 와 같음): 제목을 정규화(꼬리 번호 «(2)» 빼고 · 글자/숫자만 · 소문자)해서 같고,
--   본문도 공백만 다르게 같으면 «가장 먼저 만든 공개 글» 하나만 남기고 나머지를 숨긴다(is_hidden=true).
--   지우지 않는다(되돌릴 수 있게). 숨긴 사본 주소는 봇이 오면 301 로 원본에 모인다(api/prerender).
--   제목만 같고 본문이 다른 글은 건드리지 않는다.

-- ① 먼저 보기(읽기만) — 몇 장이 숨겨지는지
with base as (
  select id, title, created_at,
         lower(regexp_replace(regexp_replace(coalesce(title,''), '\s*[\(\[][0-9]+[\)\]]\s*$', ''), '[^[:alnum:]가-힣]+', '', 'g')) as tkey,
         regexp_replace(btrim(coalesce(content,'')), '\s+', ' ', 'g') as bkey
  from public.lounge_posts
  where coalesce(is_story,false) = false and coalesce(is_deleted,false) = false
    and coalesce(is_hidden,false) = false and coalesce(is_visible,true) = true
),
ranked as (
  select *, row_number() over (partition by tkey, bkey order by created_at, id) as rn
  from base where tkey <> ''
)
select count(*) filter (where rn > 1) as hide_count,
       count(*) filter (where rn = 1) as keep_count,
       count(distinct tkey)          as titles
from ranked;

-- ② 숨기기 — ①의 hide_count 를 확인한 뒤 실행. 되돌리기용으로 id 를 표에 남긴다.
create table if not exists public.lounge_dup_hidden_20261009 (id uuid primary key, hidden_at timestamptz default now());

with base as (
  select id, created_at,
         lower(regexp_replace(regexp_replace(coalesce(title,''), '\s*[\(\[][0-9]+[\)\]]\s*$', ''), '[^[:alnum:]가-힣]+', '', 'g')) as tkey,
         regexp_replace(btrim(coalesce(content,'')), '\s+', ' ', 'g') as bkey
  from public.lounge_posts
  where coalesce(is_story,false) = false and coalesce(is_deleted,false) = false
    and coalesce(is_hidden,false) = false and coalesce(is_visible,true) = true
),
ranked as (
  select id, row_number() over (partition by tkey, bkey order by created_at, id) as rn
  from base where tkey <> ''
),
picked as (
  insert into public.lounge_dup_hidden_20261009 (id)
  select id from ranked where rn > 1
  on conflict do nothing
  returning id
)
update public.lounge_posts p set is_hidden = true
from picked where p.id = picked.id;

-- ③ 되돌리기(필요할 때만)
-- update public.lounge_posts set is_hidden = false where id in (select id from public.lounge_dup_hidden_20261009);
