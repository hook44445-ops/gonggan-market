-- ============================================================
--  Migration 180: 누구나 열려 있던 정책 닫기 — 알림·후기·결제 주문·푸시 설정·기기 토큰·라운지 댓글 수정·활동 기록·시드 후기·후기 보상
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(#891 — 이 표들을 로그인 토큰으로 읽고 쓰는 버전) → 대표 재로그인 → 이 SQL.
--
--  근거: 09-30 대표가 뽑은 운영 정책(pg_policies)
--    · notifications · reviews · payment_orders · activity_logs · seed_reviews · review_rewards: ALL true(누구나 읽고·고치고·지움)
--    · push_preferences · fcm_tokens: «주인 OR 로그인 안 함» — 로그인 안 한 누구나 남의 광고 수신 동의를 바꿀 수 있었다
--    · lounge_comments: UPDATE true(누구나 남의 댓글 고침)
--  바꾼 뒤
--    · 알림: 본인만 읽기·읽음 표시 · 보내기는 로그인(토큰) 사용자 · 관리자 모두
--    · 후기: 누구나 읽기 · 쓰기는 본인 · 고치기는 그 업체 주인(답글 칸만 — 트리거) · 관리자 모두
--    · 결제 주문: 본인·관리자 · 푸시 설정·기기 토큰: 본인만 · 댓글 수정: 본인·관리자
--    · 활동 기록: 쓰기는 누구나(예전처럼) · 읽기는 관리자 · 시드 후기: 읽기 누구나 · 쓰기 관리자 · 후기 보상: 본인 쓰기·읽기 · 관리자
--  서버 함수(security definer)·발송기(service role)는 정책과 무관하게 그대로 돈다.
--  되돌리기: 이 파일 머리의 표마다 «create policy … for all using (true) with check (true)» 를 다시 만들면 예전과 같다.
--  확인 칸 3개(맨 아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- ① 열린 정책 지우기(이름을 몰라도 조건으로 찾는다)
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and (
         (tablename in ('notifications','reviews','payment_orders','activity_logs','seed_reviews','review_rewards')
            and cmd in ('ALL','UPDATE','DELETE','SELECT') and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true'))
      or (tablename in ('push_preferences','fcm_tokens') and (coalesce(qual, '') ilike '%auth.uid() IS NULL%' or coalesce(with_check, '') ilike '%auth.uid() IS NULL%'))
      or (tablename = 'lounge_comments' and cmd in ('UPDATE','ALL') and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true'))
       )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ② 새 정책(이름 앞에 g180_ — 다시 실행해도 같다)
do $$
declare t text;
begin
  foreach t in array array['notifications','reviews','payment_orders','activity_logs','seed_reviews','review_rewards','push_preferences','fcm_tokens','lounge_comments'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

drop policy if exists g180_notif_read on public.notifications;
create policy g180_notif_read on public.notifications for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists g180_notif_update on public.notifications;
create policy g180_notif_update on public.notifications for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
drop policy if exists g180_notif_insert on public.notifications;
create policy g180_notif_insert on public.notifications for insert with check (auth.uid() is not null);
drop policy if exists g180_notif_admin_delete on public.notifications;
create policy g180_notif_admin_delete on public.notifications for delete using (public.is_admin());

drop policy if exists g180_reviews_read on public.reviews;
create policy g180_reviews_read on public.reviews for select using (true);
drop policy if exists g180_reviews_insert on public.reviews;
create policy g180_reviews_insert on public.reviews for insert with check (auth.uid() = user_id or public.is_admin());
drop policy if exists g180_reviews_update on public.reviews;
create policy g180_reviews_update on public.reviews for update
  using (public.is_admin() or exists (select 1 from public.companies c where c.id = reviews.company_id and c.owner_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.companies c where c.id = reviews.company_id and c.owner_id = auth.uid()));
drop policy if exists g180_reviews_delete on public.reviews;
create policy g180_reviews_delete on public.reviews for delete using (public.is_admin());

-- 업체 주인은 답글 칸만 고친다(별점·글·사진·숨김은 못 바꾼다)
create or replace function public._reviews_reply_only()
returns trigger language plpgsql
set search_path = public, extensions as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then return new; end if;
  if (to_jsonb(new) - 'reply' - 'updated_at') is distinct from (to_jsonb(old) - 'reply' - 'updated_at') then
    raise exception 'REPLY_ONLY' using errcode = '42501';
  end if;
  return new;
end; $$;
drop trigger if exists trg_reviews_reply_only on public.reviews;
create trigger trg_reviews_reply_only before update on public.reviews for each row execute function public._reviews_reply_only();

drop policy if exists g180_po_own on public.payment_orders;
create policy g180_po_own on public.payment_orders for all
  using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

-- 활동 기록·시드 후기·후기 보상 — 표가 있을 때만(환경마다 다를 수 있다)
do $$
begin
  if to_regclass('public.activity_logs') is not null then
    execute 'drop policy if exists g180_al_insert on public.activity_logs';
    execute 'create policy g180_al_insert on public.activity_logs for insert with check (true)';
    execute 'drop policy if exists g180_al_admin_read on public.activity_logs';
    execute 'create policy g180_al_admin_read on public.activity_logs for select using (public.is_admin())';
  end if;
  if to_regclass('public.seed_reviews') is not null then
    execute 'drop policy if exists g180_seed_read on public.seed_reviews';
    execute 'create policy g180_seed_read on public.seed_reviews for select using (true)';
    execute 'drop policy if exists g180_seed_admin on public.seed_reviews';
    execute 'create policy g180_seed_admin on public.seed_reviews for all using (public.is_admin()) with check (public.is_admin())';
  end if;
  if to_regclass('public.review_rewards') is not null then
    execute 'drop policy if exists g180_rr_own on public.review_rewards';
    execute 'create policy g180_rr_own on public.review_rewards for select using (auth.uid() = customer_id or public.is_admin())';
    execute 'drop policy if exists g180_rr_insert on public.review_rewards';
    execute 'create policy g180_rr_insert on public.review_rewards for insert with check (auth.uid() = customer_id or public.is_admin())';
    execute 'drop policy if exists g180_rr_admin on public.review_rewards';
    execute 'create policy g180_rr_admin on public.review_rewards for update using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;

drop policy if exists g180_pp_self on public.push_preferences;
create policy g180_pp_self on public.push_preferences for all
  using (user_id::text = auth.uid()::text) with check (user_id::text = auth.uid()::text);
drop policy if exists g180_fcm_self on public.fcm_tokens;
create policy g180_fcm_self on public.fcm_tokens for all
  using (user_id::text = auth.uid()::text) with check (user_id::text = auth.uid()::text);

drop policy if exists g180_lc_update on public.lounge_comments;
create policy g180_lc_update on public.lounge_comments for update
  using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① no_open: 이 표들에 «누구나(true)» 인 수정·지우기·읽기 정책이 남지 않았다(후기·시드 후기 읽기와 활동 기록 쓰기는 일부러 누구나)
--  ② no_null_hole: 푸시 설정·기기 토큰에 «로그인 안 함 허용»이 남지 않았다
--  ③ reply_guard: 후기 답글 전용 트리거가 걸렸다
select
  not exists (select 1 from pg_policies where schemaname = 'public'
               and tablename in ('notifications','payment_orders','review_rewards','lounge_comments','reviews','seed_reviews','activity_logs')
               and cmd in ('ALL','UPDATE','DELETE')
               and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')) as no_open,
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('push_preferences','fcm_tokens')
               and (coalesce(qual, '') ilike '%auth.uid() IS NULL%' or coalesce(with_check, '') ilike '%auth.uid() IS NULL%')) as no_null_hole,
  exists (select 1 from pg_trigger where tgname = 'trg_reviews_reply_only' and not tgisinternal) as reply_guard;
