-- ============================================================
--  Migration 139: 관리자 공지 푸시 · 라운지 새 글/인기 글 푸시(블라인드처럼)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  순서: 이 SQL 과 같은 PR 의 앱 배포는 앞뒤 상관없음(앱은 없는 함수를 부르면 안내만 한다).
--
--  대표 지시(09-26): 「관리자에서 푸시알람으로 공지 보내는 기능 · 라운지에서 새 글 올라올 시 ·
--                     관심글 올라올 때 안드로이드·아이폰 앱 사용자에게 핸드폰 푸시 — 블라인드처럼」
--  지금까지
--    · 라운지 새 글 푸시(079 enqueue_lounge_post_push)는 «사용자가 글쓰기 화면에서 올린 글»에만 불렸다
--      → 라운지 글 대부분인 AI 발행 글은 푸시가 없었다.
--    · 그 외 카테고리 새 글을 'lounge_activity'(= 내 글 댓글·하트용 즉시 알림)로 보내 밤에도 나갈 수 있었다.
--    · 관리자 공지 푸시 없음(자기 자신 테스트만). 인기(HOT) 글 푸시 없음.
--  하는 일
--    ① 새 글 푸시 종류 'lounge_news'(소식성 — 하루 3건 · 오전 10시~오후 9시, 앱 pushPolicy 와 같음) — 079 의
--       lounge_activity 자리를 바꾼다. 수신 설정은 그대로 push_lounge_activity(「라운지 새 글」 토글).
--    ② lounge_posts 트리거 — 글이 «공개»되는 순간(새 글 · 예약 발행 · 숨김 해제) 서버가 푸시를 큐에 넣는다.
--       AI 발행 글 포함. 3일 지난 글·스토리·시드는 뺀다. 같은 글 두 번 안 감(push_logs 중복 방지).
--    ③ 인기 글 — 운영자가 HOT 으로 올리면 'lounge_hot'(소식성) 을 라운지 알림 켠 사람에게.
--    ④ 관리자 공지 — admin_push_broadcast(제목, 내용, 주소, 대상) · admin_push_audience_count(대상).
--       대상: all(전체) · consumer(고객) · company(업체) · lounge(라운지 새 글 켠 사람).
--       알림함(notifications, 'ANNOUNCEMENT') + 푸시(수신 켠 사람·토큰 있는 기기). 서비스 공지만 —
--       광고성 정보는 별도 광고 수신 동의·「(광고)」 표시·야간 금지가 필요해 여기서 보내지 않는다.
--       관리자 토큰 필수(131 이 admin_* 이름을 지킨다).
--  확인 칸 3개(아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- ① 새 글 푸시 — 'lounge_news' ---------------------------------------------------------
create or replace function public.enqueue_lounge_post_push(p_post_id uuid)
returns integer language plpgsql security definer
set search_path = public as $$
declare
  v_post   public.lounge_posts%rowtype;
  v_type   text;
  v_title  text;
  v_count  integer := 0;
begin
  select * into v_post from public.lounge_posts where id = p_post_id;
  if not found then return 0; end if;
  if coalesce(v_post.is_deleted, false) or coalesce(v_post.is_hidden, false) or v_post.is_visible = false then
    return 0;
  end if;

  v_type := case v_post.category
    when 'local'       then 'local_news'
    when 'interior'    then 'interior_news'
    when 'room_deco'   then 'interior_news'
    when 'move_in'     then 'interior_news'
    when 'review'      then 'review_news'
    when 'quote_worry' then 'estimate_news'
    when 'recommend'   then 'company_news'
    else 'lounge_news' end;

  v_title := case v_type
    when 'local_news'    then '우리 동네 새 공간 이야기'
    when 'interior_news' then '새로운 리모델링 고민이 올라왔어요'
    when 'review_news'   then '새 시공후기가 올라왔어요'
    when 'estimate_news' then '새로운 견적 고민이 올라왔어요'
    when 'company_news'  then '믿을 수 있는 업체 이야기가 올라왔어요'
    else '라운지에 새 글이 올라왔어요' end;

  insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
  select u.id, v_type, v_title,
         coalesce(nullif(left(coalesce(v_post.title, ''), 60), ''), left(v_post.content, 60), '새 이야기를 확인해 보세요'),
         '/lounge/posts/' || v_post.id::text, v_post.id::text, 'queued'
    from public.users u
    join public.push_preferences pr on pr.user_id = u.id
   where pr.push_enabled = true
     and u.id is distinct from v_post.user_id
     and case v_type
           when 'local_news'    then pr.push_local_news
           when 'interior_news' then pr.push_interior_news
           when 'review_news'   then pr.push_estimate_news
           when 'estimate_news' then pr.push_estimate_news
           when 'company_news'  then pr.push_company_recommend
           else pr.push_lounge_activity end
     and (v_post.region is null
          or u.region = v_post.region
          or coalesce(u.activity_regions::text, '') ilike '%' || v_post.region || '%')
     and exists (select 1 from public.fcm_tokens t where t.user_id = u.id and t.is_active)
  on conflict (user_id, type, related_id) where related_id is not null do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end; $$;
grant execute on function public.enqueue_lounge_post_push(uuid) to anon, authenticated;

-- ② 공개되는 순간 서버가 보낸다(AI 발행 글 포함) ----------------------------------------
create or replace function public.trg_lounge_post_push()
returns trigger language plpgsql security definer
set search_path = public as $$
declare v_now_public boolean; v_was_public boolean;
begin
  v_now_public := not coalesce(new.is_deleted, false) and not coalesce(new.is_hidden, false)
                  and coalesce(new.is_visible, true) and coalesce(new.publish_status, 'published') = 'published'
                  and not coalesce(new.is_story, false) and not coalesce(new.is_seed, false)
                  and new.created_at > now() - interval '3 days';
  if tg_op = 'UPDATE' then
    v_was_public := not coalesce(old.is_deleted, false) and not coalesce(old.is_hidden, false)
                    and coalesce(old.is_visible, true) and coalesce(old.publish_status, 'published') = 'published';
  else
    v_was_public := false;
  end if;

  if v_now_public and not v_was_public then
    begin perform public.enqueue_lounge_post_push(new.id); exception when others then null; end;
  end if;

  -- ③ 인기(HOT)로 올라간 순간
  if tg_op = 'UPDATE' and coalesce(new.is_hot, false) and not coalesce(old.is_hot, false) and v_now_public is not false then
    begin
      insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
      select u.id, 'lounge_hot', '지금 라운지 인기 글',
             coalesce(nullif(left(coalesce(new.title, ''), 60), ''), left(new.content, 60), '많이 보는 이야기를 확인해 보세요'),
             '/lounge/posts/' || new.id::text, new.id::text, 'queued'
        from public.users u
        join public.push_preferences pr on pr.user_id = u.id
       where pr.push_enabled = true and pr.push_lounge_activity = true
         and u.id is distinct from new.user_id
         and exists (select 1 from public.fcm_tokens t where t.user_id = u.id and t.is_active)
      on conflict (user_id, type, related_id) where related_id is not null do nothing;
    exception when others then null;
    end;
  end if;
  return new;
end; $$;

drop trigger if exists trg_lounge_post_push on public.lounge_posts;
create trigger trg_lounge_post_push after insert or update on public.lounge_posts
  for each row execute function public.trg_lounge_post_push();

-- ④ 관리자 공지 -------------------------------------------------------------------------
create or replace function public._push_audience(p_audience text)
returns table (user_id uuid, can_push boolean) language sql stable security definer
set search_path = public as $$
  select u.id,
         coalesce(pr.push_enabled, false)
           and exists (select 1 from public.fcm_tokens t where t.user_id = u.id and t.is_active)
    from public.users u
    left join public.push_preferences pr on pr.user_id = u.id
   where case p_audience
           when 'all'      then true
           when 'company'  then exists (select 1 from public.companies c where c.owner_id = u.id)
           when 'consumer' then not exists (select 1 from public.companies c where c.owner_id = u.id)
           when 'lounge'   then coalesce(pr.push_lounge_activity, false)
           else false end;
$$;
revoke execute on function public._push_audience(text) from public, anon, authenticated;

create or replace function public.admin_push_audience_count(p_audience text)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare v_all int; v_push int;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') then raise exception 'ADMIN_ONLY'; end if;
  select count(*), count(*) filter (where can_push) into v_all, v_push from public._push_audience(p_audience);
  return jsonb_build_object('audience', p_audience, 'users', v_all, 'push', v_push);
end; $$;
grant execute on function public.admin_push_audience_count(text) to anon, authenticated;

create or replace function public.admin_push_broadcast(p_title text, p_body text, p_url text default '/', p_audience text default 'all')
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_id    uuid := gen_random_uuid();
  v_url   text := coalesce(nullif(trim(p_url), ''), '/');
  v_rel   uuid;
  v_rtype text;
  v_note  int;
  v_push  int;
begin
  if not exists (select 1 from public.users u where u.id = v_uid and u.role = 'admin') then raise exception 'ADMIN_ONLY'; end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then raise exception 'TITLE_BODY_REQUIRED'; end if;
  if p_audience not in ('all', 'consumer', 'company', 'lounge') then raise exception 'BAD_AUDIENCE'; end if;
  if v_url !~ '^/' then raise exception 'URL_MUST_BE_INTERNAL'; end if;     -- 우리 앱 안 주소만

  -- 알림함에서 누르면 갈 곳(라운지 글 · 견적 요청이면 연결)
  if v_url ~ '^/lounge/posts/[0-9a-f-]{36}' then
    v_rel := substring(v_url from '/lounge/posts/([0-9a-f-]{36})')::uuid; v_rtype := 'lounge';
  elsif v_url ~ '^/requests/[0-9a-f-]{36}' then
    v_rel := substring(v_url from '/requests/([0-9a-f-]{36})')::uuid; v_rtype := 'request';
  end if;

  insert into public.notifications (user_id, type, title, message, related_id, related_type)
  select a.user_id, 'ANNOUNCEMENT', left(p_title, 60), left(p_body, 300), v_rel, v_rtype
    from public._push_audience(p_audience) a;
  get diagnostics v_note = row_count;

  insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
  select a.user_id, 'ANNOUNCEMENT', left(p_title, 60), left(p_body, 120), v_url, v_id::text, 'queued'
    from public._push_audience(p_audience) a
   where a.can_push
  on conflict (user_id, type, related_id) where related_id is not null do nothing;
  get diagnostics v_push = row_count;

  insert into public.admin_logs (admin_id, action, target_type, target_id, after_val, reason)
  values (v_uid, 'PUSH_BROADCAST', 'push', v_id,
          jsonb_build_object('audience', p_audience, 'title', p_title, 'url', v_url, 'notifications', v_note, 'push', v_push), null);

  return jsonb_build_object('id', v_id, 'notifications', v_note, 'push', v_push);
end; $$;
grant execute on function public.admin_push_broadcast(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 셋 다 true 면 끝
select
  exists (select 1 from pg_trigger where tgname = 'trg_lounge_post_push')                                                    as lounge_trigger_ok,
  position('lounge_news' in pg_get_functiondef('public.enqueue_lounge_post_push(uuid)'::regprocedure)) > 0                    as lounge_news_ok,
  exists (select 1 from pg_proc where proname = 'admin_push_broadcast')                                                      as broadcast_ok;
