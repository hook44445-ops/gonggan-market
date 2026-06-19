-- 079: 라운지 새 글 푸시 — 전체 카테고리 연결 (enqueue_lounge_post_push 확장)
--
-- 기존(015)은 5개 카테고리(local/interior/review/quote_worry/recommend)만 push 타입에 매핑하고
-- 그 외 카테고리는 v_type=null → 발송하지 않았다. 본 마이그레이션은 모든 활성 카테고리를
-- 기존 push_preferences 컬럼(스키마 변경 없음)에 매핑해 "선택한 카테고리만 발송" 정책을 전 카테고리로 확장한다.
--
-- 매핑(기존 컬럼 재사용):
--   local                                   → local_news     (push_local_news)
--   interior / room_deco / move_in          → interior_news  (push_interior_news)
--   review / quote_worry                    → estimate_news  (push_estimate_news)
--   recommend(legacy)                       → company_news   (push_company_recommend)
--   그 외 라이프스타일(realestate/marriage/dating/health/stock/jobs/pet/exercise/
--     startup/travel/restaurant/daily/humor/free 등)  → lounge_activity (push_lounge_activity)
--
-- 기존 발송/중복방지/지역매칭/작성자제외/fcm_tokens 조건은 그대로 유지(최소 수정).

create or replace function public.enqueue_lounge_post_push(p_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post   public.lounge_posts%rowtype;
  v_type   text;
  v_title  text;
  v_count  integer := 0;
begin
  select * into v_post from public.lounge_posts where id = p_post_id;
  if not found then return 0; end if;

  -- 비공개/삭제/숨김 글 제외
  if coalesce(v_post.is_deleted,false) or coalesce(v_post.is_hidden,false)
     or v_post.is_visible = false then
    return 0;
  end if;

  -- 카테고리 → 푸시 타입(전 카테고리 매핑). 미지정/기타는 lounge_activity 로 폴백.
  v_type := case v_post.category
    when 'local'       then 'local_news'
    when 'interior'    then 'interior_news'
    when 'room_deco'   then 'interior_news'
    when 'move_in'     then 'interior_news'
    when 'review'      then 'review_news'
    when 'quote_worry' then 'estimate_news'
    when 'recommend'   then 'company_news'
    else 'lounge_activity' end;

  v_title := case v_type
    when 'local_news'      then '우리 동네 새 공간 이야기 🏠'
    when 'interior_news'   then '새로운 리모델링 고민이 도착했어요'
    when 'review_news'     then '새 시공후기가 올라왔어요 🛠️'
    when 'estimate_news'   then '새로운 견적 고민이 올라왔어요'
    when 'company_news'    then '믿을 수 있는 업체 이야기가 올라왔어요'
    when 'lounge_activity' then '라운지에 새 글이 올라왔어요 💬'
    else '공간마켓 라운지' end;

  insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
  select u.id, v_type, v_title,
         coalesce(left(v_post.content, 60), '새 이야기를 확인해보세요'),
         '/lounge/posts/' || v_post.id::text,
         v_post.id::text, 'queued'
  from public.users u
  join public.push_preferences pr on pr.user_id = u.id
  where pr.push_enabled = true
    and u.id <> v_post.user_id                                    -- 작성자 본인 제외
    and case v_type
          when 'local_news'      then pr.push_local_news
          when 'interior_news'   then pr.push_interior_news
          when 'review_news'     then pr.push_estimate_news
          when 'estimate_news'   then pr.push_estimate_news
          when 'company_news'    then pr.push_company_recommend
          when 'lounge_activity' then pr.push_lounge_activity
          else false end
    and (
      v_post.region is null                                       -- 글 지역 없으면 카테고리만 매칭
      or u.region = v_post.region
      or coalesce(u.activity_regions::text, '') ilike '%' || v_post.region || '%'
    )
    and exists (select 1 from public.fcm_tokens t where t.user_id = u.id and t.is_active)
  on conflict (user_id, type, related_id) where related_id is not null do nothing; -- 중복 방지

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

notify pgrst, 'reload schema';
