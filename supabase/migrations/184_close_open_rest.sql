-- ============================================================
--  Migration 184: 남은 열린 정책 닫기(결제 기록·시드 라운지 글·옛 표 2개) + 본인 요청 마감·만료·숨기기를 서버 함수로
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(요청 마감·만료·숨기기를 request_owner_state 로 · 결제 기록을 로그인 토큰으로 쓰는 버전) → 이 SQL.
--
--  근거: 09-30 대표가 뽑은 운영 정책(보안 점검 ⑤)
--    · payment_transactions: ALL true — 누구나 남의 결제 기록을 읽고·고치고·지울 수 있었다
--    · seed_lounge_posts: ALL true(이름은 admin_all) — 누구나 시드 글을 고치고·지울 수 있었다
--    · portfolio_projects: ALL true · escrow_contracts: INSERT true — 앱 코드가 쓰지 않는 옛 표(이 저장소에 참조 0)
--    · requests UPDATE 는 «auth.uid() = customer_id» 하나 — 앱은 user_id 로 쓰므로 본인 마감·만료·숨기기가 0건(조용히 실패)
--      · 관리자 «숨긴 요청 되돌리기»도 고치기 정책이 없어 0건
--  그대로 두는 것(일부러 누구나 쓰기): activity_logs(활동 기록) · user_visits(방문 수) · partner_leads(파트너 문의 양식)
--  바꾼 뒤
--    · 결제 기록: 그 결제 주문의 주인만 읽기·쓰기 · 고치기·지우기는 관리자 · 서버(결제 승인)는 service role 이라 그대로
--    · 시드 라운지 글: 읽기 누구나 · 쓰기 관리자
--    · portfolio_projects: 읽기 누구나(혹시 밖에서 읽는 곳이 있어도 안 깨지게) · 쓰기 관리자 · escrow_contracts: 쓰기 관리자
--    · 요청: 본인 마감(close)·만료(expire)·숨기기(archive) = request_owner_state(토큰의 사용자) · 관리자 고치기 정책 추가
--  되돌리기(한 줄): drop function if exists public.request_owner_state(uuid, text, text); 그리고 아래 g184_ 정책을 지우고
--    예전 «for all using (true) with check (true)» 를 다시 만들면 예전과 같다.
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
       and tablename in ('payment_transactions', 'seed_lounge_posts', 'portfolio_projects', 'escrow_contracts')
       and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
       and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ② 새 정책(이름 앞에 g184_ — 표가 있을 때만)
do $$
begin
  if to_regclass('public.payment_transactions') is not null then
    execute 'alter table public.payment_transactions enable row level security';
    execute 'drop policy if exists g184_pt_read on public.payment_transactions';
    execute 'create policy g184_pt_read on public.payment_transactions for select using (public.is_admin() or exists (select 1 from public.payment_orders o where o.id = payment_transactions.payment_order_id and o.user_id = auth.uid()))';
    execute 'drop policy if exists g184_pt_insert on public.payment_transactions';
    execute 'create policy g184_pt_insert on public.payment_transactions for insert with check (public.is_admin() or exists (select 1 from public.payment_orders o where o.id = payment_transactions.payment_order_id and o.user_id = auth.uid()))';
    execute 'drop policy if exists g184_pt_admin on public.payment_transactions';
    execute 'create policy g184_pt_admin on public.payment_transactions for all using (public.is_admin()) with check (public.is_admin())';
  end if;
  if to_regclass('public.seed_lounge_posts') is not null then
    execute 'alter table public.seed_lounge_posts enable row level security';
    execute 'drop policy if exists g184_slp_read on public.seed_lounge_posts';
    execute 'create policy g184_slp_read on public.seed_lounge_posts for select using (true)';
    execute 'drop policy if exists g184_slp_admin on public.seed_lounge_posts';
    execute 'create policy g184_slp_admin on public.seed_lounge_posts for all using (public.is_admin()) with check (public.is_admin())';
  end if;
  if to_regclass('public.portfolio_projects') is not null then
    execute 'alter table public.portfolio_projects enable row level security';
    execute 'drop policy if exists g184_pfp_read on public.portfolio_projects';
    execute 'create policy g184_pfp_read on public.portfolio_projects for select using (true)';
    execute 'drop policy if exists g184_pfp_admin on public.portfolio_projects';
    execute 'create policy g184_pfp_admin on public.portfolio_projects for all using (public.is_admin()) with check (public.is_admin())';
  end if;
  if to_regclass('public.escrow_contracts') is not null then
    execute 'alter table public.escrow_contracts enable row level security';
    execute 'drop policy if exists g184_ec_admin on public.escrow_contracts';
    execute 'create policy g184_ec_admin on public.escrow_contracts for all using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;

-- ③ 요청 — 관리자 고치기(숨긴 요청 되돌리기 등)
drop policy if exists g184_req_admin_update on public.requests;
create policy g184_req_admin_update on public.requests for update using (public.is_admin()) with check (public.is_admin());

-- ④ 본인 요청 마감·만료·숨기기 — 토큰의 사용자만(앱이 보낸 사용자 ID 를 믿지 않는다)
--    close  : 계약·공사 단계가 아니면 → status 'closed'
--    expire : 아직 'open' 일 때만 → status 'expired'
--    archive: 내 목록에서 숨기기(is_hidden · archived_at · hidden_reason) — 상태는 그대로
create or replace function public.request_owner_state(p_request_id uuid, p_action text, p_reason text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_row jsonb; v_owner text; v_cust text; v_status text;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select to_jsonb(r) into v_row from public.requests r where r.id = p_request_id for update;
  if v_row is null then return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;
  v_owner := v_row ->> 'user_id'; v_cust := v_row ->> 'customer_id'; v_status := lower(coalesce(v_row ->> 'status', ''));
  if coalesce(v_owner, '') <> v_uid::text and coalesce(v_cust, '') <> v_uid::text and not coalesce(public.is_admin(), false) then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;

  if p_action = 'close' then
    if v_status in ('in_progress', 'contracting', 'escrow_pending', 'selected', 'completed', 'settled') then
      return jsonb_build_object('ok', false, 'reason', 'IN_CONTRACT', 'status', v_status);
    end if;
    update public.requests set status = 'closed' where id = p_request_id;
  elsif p_action = 'expire' then
    if v_status <> 'open' then return jsonb_build_object('ok', true, 'skipped', true, 'status', v_status); end if;
    update public.requests set status = 'expired' where id = p_request_id;
  elsif p_action = 'archive' then
    begin
      update public.requests set is_hidden = true, archived_at = now(), hidden_reason = left(p_reason, 60) where id = p_request_id;
    exception when undefined_column then
      update public.requests set is_hidden = true, archived_at = now() where id = p_request_id;
    end;
  else
    return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_ACTION');
  end if;

  select to_jsonb(r) into v_row from public.requests r where r.id = p_request_id;
  return jsonb_build_object('ok', true, 'id', p_request_id, 'status', v_row ->> 'status', 'is_hidden', coalesce((v_row ->> 'is_hidden')::boolean, false));
end; $$;
revoke execute on function public.request_owner_state(uuid, text, text) from public, anon;
grant execute on function public.request_owner_state(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① no_open: 이 네 표에 «누구나(true)» 쓰기·고치기·지우기가 남지 않았다
--  ② req_admin_update: 요청 관리자 고치기 정책이 있다
--  ③ owner_state_fn: 본인 요청 마감·만료·숨기기 함수가 있다
select
  not exists (select 1 from pg_policies where schemaname = 'public'
               and tablename in ('payment_transactions', 'seed_lounge_posts', 'portfolio_projects', 'escrow_contracts')
               and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
               and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')) as no_open,
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'requests' and policyname = 'g184_req_admin_update') as req_admin_update,
  exists (select 1 from pg_proc where proname = 'request_owner_state') as owner_state_fn;
