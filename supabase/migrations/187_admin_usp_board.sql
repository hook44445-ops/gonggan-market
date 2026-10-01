-- ============================================================
--  Migration 187: USP 12 «사용 → 전환» 표 — admin_usp_board(p_days) (docs/USP-2026-10-01.md · lib/uspBoard.js)
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--
--  · 관리자(로그인 토큰)만 · 읽기만 한다(표·정책·다른 함수는 바꾸지 않는다)
--  · USP 마다 «사용 N → 전환 M»과(있으면) «안 쓴 쪽» 비교. 화면에서만 생기는 «사용»(1·3·4·12)은 앱이 activity_logs 에
--    action «usp_<번호>» 로 남긴 것을 세고, 나머지는 이미 있는 DB 사실(요청·입찰·선택·계약·방문·알림·서류·초대 가입)로 센다.
--  · 운영 스키마가 저장소와 다를 수 있어 USP 하나씩 따로 계산한다 — 하나가 실패해도(표·칸 없음) 그 줄만 비고 나머지는 나온다.
--  되돌리기: drop function if exists public.admin_usp_board(int);
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.admin_usp_board(p_days int default 30)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_rows jsonb := '[]'::jsonb;
  u bigint; c bigint; bu bigint; bc bigint;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  -- ① 30초 요청서: 랜딩에서 고르고 로그인(usp_1) → 3일 안에 요청 · 비교: 새 가입 고객의 3일 안 요청률
  begin
    select count(distinct a.user_id),
           count(distinct a.user_id) filter (where exists (select 1 from public.requests r where r.user_id = a.user_id
                                                            and r.created_at between a.created_at - interval '1 hour' and a.created_at + interval '3 days'))
      into u, c
      from public.activity_logs a where a.action = 'usp_1' and a.created_at >= v_since and a.user_id is not null;
    select count(*), count(*) filter (where exists (select 1 from public.requests r where r.user_id = x.id
                                                      and r.created_at <= x.created_at + interval '3 days'))
      into bu, bc
      from public.users x where x.created_at >= v_since and coalesce(to_jsonb(x) ->> 'role', 'consumer') = 'consumer';
    v_rows := v_rows || jsonb_build_object('usp', 1, 'used', u, 'converted', c, 'base_used', bu, 'base_converted', bc);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 1);
  end;

  -- ② 현장 사진: 사진 붙은 요청 → 입찰 1곳+ · 비교: 사진 없는 요청
  begin
    with q as (
      select r.id,
             (jsonb_typeof(to_jsonb(r) -> 'photos') = 'array' and jsonb_array_length(to_jsonb(r) -> 'photos') > 0) as has_photo,
             exists (select 1 from public.bids b where b.request_id = r.id) as got_bid
        from public.requests r where r.created_at >= v_since)
    select count(*) filter (where has_photo), count(*) filter (where has_photo and got_bid),
           count(*) filter (where not has_photo), count(*) filter (where not has_photo and got_bid)
      into u, c, bu, bc from q;
    v_rows := v_rows || jsonb_build_object('usp', 2, 'used', u, 'converted', c, 'base_used', bu, 'base_converted', bc);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 2);
  end;

  -- ③ 비교표를 본 요청(usp_3) → 업체 선택 · 비교: 견적 2곳+ 인데 표를 안 본 요청
  -- ④ 시세 줄을 본 요청(usp_4) → 업체 선택 · 비교: 견적 1곳+ 인데 시세를 안 본 요청
  for i in 3..4 loop
    begin
      with seen as (
        select distinct a.target_id as rid from public.activity_logs a
         where a.action = 'usp_' || i and a.created_at >= v_since and a.target_id is not null),
      q as (
        select r.id,
               r.id in (select rid from seen) as seen,
               coalesce(to_jsonb(r) ->> 'selected_bid_id', to_jsonb(r) ->> 'selected_company_id') is not null as picked,
               (select count(*) from public.bids b where b.request_id = r.id) as nb
          from public.requests r
         where r.id in (select rid from seen) or r.created_at >= v_since)
      select count(*) filter (where seen), count(*) filter (where seen and picked),
             count(*) filter (where not seen and nb >= (case when i = 3 then 2 else 1 end)),
             count(*) filter (where not seen and nb >= (case when i = 3 then 2 else 1 end) and picked)
        into u, c, bu, bc from q;
      v_rows := v_rows || jsonb_build_object('usp', i, 'used', u, 'converted', c, 'base_used', bu, 'base_converted', bc);
    exception when others then v_rows := v_rows || jsonb_build_object('usp', i);
    end;
  end loop;

  -- ⑤ 증빙 1개+ 업체의 입찰 → 선택됨 · 비교: 증빙 없는 업체의 입찰
  begin
    with q as (
      select exists (select 1 from public.companies cc
                      where (cc.id = b.company_id or cc.owner_id = b.company_id)
                        and (coalesce((to_jsonb(cc) ->> 'verified')::boolean, false)
                             or coalesce((to_jsonb(cc) ->> 'has_insurance')::boolean, false)
                             or to_jsonb(cc) ->> 'guarantee_status' = 'ACTIVE')) as proof,
             exists (select 1 from public.requests r where r.id = b.request_id
                       and (to_jsonb(r) ->> 'selected_bid_id' = b.id::text
                            or to_jsonb(r) ->> 'selected_company_id' = b.company_id::text
                            or to_jsonb(r) ->> 'selected_company_id' in (select cc.id::text from public.companies cc where cc.owner_id = b.company_id))) as sel
        from public.bids b where b.created_at >= v_since)
    select count(*) filter (where proof), count(*) filter (where proof and sel),
           count(*) filter (where not proof), count(*) filter (where not proof and sel)
      into u, c, bu, bc from q;
    v_rows := v_rows || jsonb_build_object('usp', 5, 'used', u, 'converted', c, 'base_used', bu, 'base_converted', bc);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 5);
  end;

  -- ⑦ 포함 항목을 적은 입찰(186) → 선택됨 · 비교: 안 적은 입찰
  begin
    with q as (
      select (jsonb_typeof(to_jsonb(b) -> 'includes') = 'object' and to_jsonb(b) -> 'includes' <> '{}'::jsonb) as inc,
             exists (select 1 from public.requests r where r.id = b.request_id
                       and (to_jsonb(r) ->> 'selected_bid_id' = b.id::text
                            or to_jsonb(r) ->> 'selected_company_id' = b.company_id::text
                            or to_jsonb(r) ->> 'selected_company_id' in (select cc.id::text from public.companies cc where cc.owner_id = b.company_id))) as sel
        from public.bids b where b.created_at >= v_since)
    select count(*) filter (where inc), count(*) filter (where inc and sel),
           count(*) filter (where not inc), count(*) filter (where not inc and sel)
      into u, c, bu, bc from q;
    v_rows := v_rows || jsonb_build_object('usp', 7, 'used', u, 'converted', c, 'base_used', bu, 'base_converted', bc);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 7);
  end;

  -- ⑥ 업체를 고른 요청 → 계약 기록(escrow_payments)까지
  begin
    select count(*), count(*) filter (where exists (select 1 from public.escrow_payments e where e.request_id = r.id))
      into u, c
      from public.requests r
     where r.created_at >= v_since and coalesce(to_jsonb(r) ->> 'selected_bid_id', to_jsonb(r) ->> 'selected_company_id') is not null;
    v_rows := v_rows || jsonb_build_object('usp', 6, 'used', u, 'converted', c);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 6);
  end;

  -- ⑧ 집 관리 수첩에 적은 사람 → 그 뒤 다른 날 다시 방문(user_visits)
  begin
    select count(distinct i.user_id),
           count(distinct i.user_id) filter (where exists (select 1 from public.user_visits v where v.user_id = i.user_id
                                                            and v.visit_date > (i.created_at at time zone 'Asia/Seoul')::date))
      into u, c
      from public.home_care_items i where i.created_at >= v_since;
    v_rows := v_rows || jsonb_build_object('usp', 8, 'used', u, 'converted', c);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 8);
  end;

  -- ⑨ 월요일 동네 요청 알림 받은 업체 → 7일 안에 입찰 · ⑩ «고객이 내 견적 확인» 받은 업체 → 14일 안에 다른 요청에 입찰
  begin
    select count(distinct n.user_id),
           count(distinct n.user_id) filter (where exists (
             select 1 from public.bids b
              where (b.company_id = n.user_id or b.company_id in (select cc.id from public.companies cc where cc.owner_id = n.user_id))
                and b.created_at between n.created_at and n.created_at + interval '7 days'))
      into u, c
      from public.notifications n where n.type = 'REGION_REQUESTS_WEEKLY' and n.created_at >= v_since;
    v_rows := v_rows || jsonb_build_object('usp', 9, 'used', u, 'converted', c);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 9);
  end;
  begin
    select count(distinct n.user_id),
           count(distinct n.user_id) filter (where exists (
             select 1 from public.bids b
              where (b.company_id = n.user_id or b.company_id in (select cc.id from public.companies cc where cc.owner_id = n.user_id))
                and b.request_id::text is distinct from n.related_id::text
                and b.created_at between n.created_at and n.created_at + interval '14 days'))
      into u, c
      from public.notifications n where n.type = 'BID_VIEWED' and n.created_at >= v_since;
    v_rows := v_rows || jsonb_build_object('usp', 10, 'used', u, 'converted', c);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 10);
  end;

  -- ⑪ 승인된 서류가 있는 업체 → 기간 안에 입찰 · 비교: 승인 서류가 없는 업체
  begin
    with q as (
      select cc.id,
             exists (select 1 from public.company_documents d where d.company_id = cc.id and d.review_status = 'approved') as docs,
             exists (select 1 from public.bids b where (b.company_id = cc.id or b.company_id = cc.owner_id) and b.created_at >= v_since) as bid
        from public.companies cc)
    select count(*) filter (where docs), count(*) filter (where docs and bid),
           count(*) filter (where not docs), count(*) filter (where not docs and bid)
      into u, c, bu, bc from q;
    v_rows := v_rows || jsonb_build_object('usp', 11, 'used', u, 'converted', c, 'base_used', bu, 'base_converted', bc);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 11);
  end;

  -- ⑫ 공유한 사람(usp_12) → 그 사람 초대로 1명+ 가입(기간 안)
  begin
    select count(distinct a.user_id),
           count(distinct a.user_id) filter (where exists (select 1 from public.users x
                                                            where x.referred_by = a.user_id and x.referred_at >= v_since))
      into u, c
      from public.activity_logs a where a.action = 'usp_12' and a.created_at >= v_since and a.user_id is not null;
    v_rows := v_rows || jsonb_build_object('usp', 12, 'used', u, 'converted', c);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 12);
  end;

  return jsonb_build_object('ok', true, 'days', v_days, 'since', v_since, 'rows', v_rows);
end; $$;
revoke execute on function public.admin_usp_board(int) from public, anon;
grant execute on function public.admin_usp_board(int) to authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'admin_usp_board') as usp_board_ok;
