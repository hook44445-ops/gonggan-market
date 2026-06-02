-- ============================================================
--  Migration 015: 라운지 푸시알림 (FCM 토큰 / 수신설정 / 발송로그)
--  Supabase SQL Editor 에서 한 번 실행.
-- ============================================================

-- ── 1. FCM 토큰 (동일 유저 여러 기기 허용) ────────────────────
create table if not exists public.fcm_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  token        text not null,
  platform     text,                       -- web / android / ios
  device_info  jsonb,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_used_at timestamptz,
  unique (token)
);
create index if not exists idx_fcm_tokens_user on public.fcm_tokens(user_id) where is_active;

-- ── 2. 수신 설정 (유저당 1행, 기본 전체 OFF) ──────────────────
create table if not exists public.push_preferences (
  user_id                uuid primary key,
  push_enabled           boolean not null default false,
  push_local_news        boolean not null default false,
  push_interior_news     boolean not null default false,
  push_estimate_news     boolean not null default false,
  push_company_recommend boolean not null default false,
  push_lounge_activity   boolean not null default false,
  push_chat              boolean not null default false,
  push_escrow            boolean not null default false,
  updated_at             timestamptz not null default now()
);

-- ── 3. 발송 로그 (중복방지 / 상태추적 / 보존정책) ─────────────
create table if not exists public.push_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  type          text not null,             -- pushPolicy.PUSH_TYPE
  title         text,
  body          text,
  target_url    text,
  related_id    text,
  status        text not null default 'queued', -- queued/sent/failed/skipped
  error_message text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index if not exists idx_push_logs_status on public.push_logs(status) where status = 'queued';
-- 같은 글(related_id) · 같은 타입 · 같은 유저 중복 발송 금지
create unique index if not exists uq_push_logs_dedup
  on public.push_logs(user_id, type, related_id)
  where related_id is not null;

-- ── 4. RLS ───────────────────────────────────────────────────
alter table public.fcm_tokens       enable row level security;
alter table public.push_preferences enable row level security;
alter table public.push_logs        enable row level security;

drop policy if exists fcm_tokens_self on public.fcm_tokens;
create policy fcm_tokens_self on public.fcm_tokens for all
  using (user_id::text = auth.uid()::text or auth.uid() is null)        -- TODO: MVP — anon 허용 제거 예정
  with check (user_id::text = auth.uid()::text or auth.uid() is null);

drop policy if exists push_pref_self on public.push_preferences;
create policy push_pref_self on public.push_preferences for all
  using (user_id::text = auth.uid()::text or auth.uid() is null)        -- TODO: MVP — anon 허용 제거 예정
  with check (user_id::text = auth.uid()::text or auth.uid() is null);

drop policy if exists push_logs_self_read on public.push_logs;
create policy push_logs_self_read on public.push_logs for select
  using (user_id::text = auth.uid()::text);
-- insert/update 는 SECURITY DEFINER RPC / service_role 로만 (정책 미부여 = 차단)

-- ── 5. 적격 수신자 산출 + 큐잉 (SECURITY DEFINER) ─────────────
--   라운지 글 등록 시 호출. 지역/카테고리 매칭 · 작성자 제외 ·
--   숨김/삭제/비공개 제외 · 중복(uq 인덱스) 방지 · 활성 토큰 보유자만.
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

  -- 카테고리 → 푸시 타입
  v_type := case v_post.category
    when 'local'       then 'local_news'
    when 'interior'    then 'interior_news'
    when 'review'      then 'review_news'
    when 'quote_worry' then 'estimate_news'
    when 'recommend'   then 'company_news'
    else null end;
  if v_type is null then return 0; end if;

  v_title := case v_type
    when 'local_news'    then '우리 동네 새 공간 이야기 🏠'
    when 'interior_news' then '새로운 리모델링 고민이 도착했어요'
    when 'review_news'   then '새 시공후기가 올라왔어요 🛠️'
    when 'estimate_news' then '새로운 견적 고민이 올라왔어요'
    when 'company_news'  then '믿을 수 있는 업체 이야기가 올라왔어요'
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
          when 'local_news'    then pr.push_local_news
          when 'interior_news' then pr.push_interior_news
          when 'review_news'   then pr.push_estimate_news
          when 'estimate_news' then pr.push_estimate_news
          when 'company_news'  then pr.push_company_recommend
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

grant execute on function public.enqueue_lounge_post_push(uuid) to authenticated, anon;

-- ── 6. 보존정책: 일반 알림 30일 후 삭제 (계약/에스크로 영구) ───
create or replace function public.cleanup_push_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from public.push_logs
  where type <> 'escrow'
    and coalesce(sent_at, created_at) < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
-- 운영: pg_cron 또는 외부 스케줄러로 select public.cleanup_push_logs(); 주기 호출

notify pgrst, 'reload schema';
