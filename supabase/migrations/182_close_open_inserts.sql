-- ============================================================
--  Migration 182: 남 이름으로 쓰기 막기 — 요청·입찰·라운지 글·댓글·좋아요의 «누구나 쓰기(true)» 닫기
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--
--  먼저: 앱 #897(쓰기를 로그인 토큰으로) 배포 → 하루 지나서(옛 화면이 새로 받도록) → 앱에서 인증번호로 다시 로그인 → 실행
--        Vercel 에 SUPABASE_SERVICE_ROLE_KEY 가 있는지(자동 라운지 글이 쓴다 — 없으면 이 SQL 뒤 자동 글이 멈춘다)
--  · 요청은 본인 이름으로만 · 입찰은 내 업체로만 · 라운지 글·댓글·좋아요는 본인만 · 관리자는 그대로
--  · 서버(service role)·보안 함수는 원래대로 쓴다
--  되돌리기(급할 때 표 하나만): create policy g182_undo_<표> on public.<표> for insert with check (true);
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- ① 누구나 쓰기 정책 지우기(이름을 몰라도 조건으로 찾는다)
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('requests','bids','lounge_posts','lounge_comments','lounge_post_likes')
       and cmd in ('INSERT','ALL')
       and (coalesce(with_check, '') = 'true' or (cmd = 'ALL' and with_check is null and coalesce(qual, '') = 'true'))
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ② 본인만 쓰기(이름 앞에 g182_)
do $$
declare v_req text;
begin
  -- 요청: 운영은 user_id 로 쓴다(예전 customer_id 칸이 있으면 그것도 인정)
  v_req := 'public.is_admin()';
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'requests' and column_name = 'user_id') then
    v_req := v_req || ' or auth.uid() = user_id';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'requests' and column_name = 'customer_id') then
    v_req := v_req || ' or auth.uid() = customer_id';
  end if;
  execute 'drop policy if exists g182_req_insert on public.requests';
  execute format('create policy g182_req_insert on public.requests for insert with check (%s)', v_req);
end $$;

drop policy if exists g182_bids_insert on public.bids;
create policy g182_bids_insert on public.bids for insert with check (
  public.is_admin() or auth.uid() = company_id
  or exists (select 1 from public.companies c where c.id = bids.company_id and c.owner_id = auth.uid()));

drop policy if exists g182_lp_insert on public.lounge_posts;
create policy g182_lp_insert on public.lounge_posts for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists g182_lc_insert on public.lounge_comments;
create policy g182_lc_insert on public.lounge_comments for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists g182_lpl_insert on public.lounge_post_likes;
create policy g182_lpl_insert on public.lounge_post_likes for insert with check (auth.uid() = user_id);

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  not exists (select 1 from pg_policies where schemaname = 'public'
               and tablename in ('requests','bids','lounge_posts','lounge_comments','lounge_post_likes')
               and cmd in ('INSERT','ALL') and coalesce(with_check, '') = 'true') as no_open_insert,
  (select count(*) from pg_policies where schemaname = 'public' and policyname like 'g182\_%') = 5 as owner_only_ok;
