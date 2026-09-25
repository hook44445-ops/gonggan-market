-- ============================================================
--  점검 6차(09-25): «사진 올리기 → 고객 확인» 과정을 운영 화면으로 보기 위한 점검 공사 1건 만들기
--  Supabase SQL Editor 에 통째로 붙여 실행하세요. (이번엔 되돌리지 않고 남깁니다 — 끝나면 맨 아래 «정리» 실행)
--
--  왜 SQL 로: 지금은 결제가 닫혀 있어(PAYMENTS_LIVE=false) 앱에서 계약(공사 화면)까지 갈 수 없다.
--            그래서 결제 직후 앱이 하는 일(요청 공사중 · 업체 선택 · 계약 1건 · 지급 4줄)만 SQL 로 대신한다.
--  무엇을:  테스트업체가 입찰한 가장 최근 「[점검」 요청을 본떠 새 요청 「[점검 6차 09-25] 사진 확인 과정」 1건 +
--           같은 입찰 1건(선택됨) + 계약(3STEP 이 나와야 함 — 테스트업체는 공간보증 입금 대기라 보증금 0) + 지급 4줄.
--  결과:    마지막 줄에 요청 · 입찰 · 계약 ID 와 계획(stage_plan) · 지급 줄이 나온다. 3STEP · 착공 30 · 중간 40 · 완료 30 이면 통과.
-- ============================================================
do $$
declare
  v_src_req uuid; v_src_bid uuid; v_req uuid := gen_random_uuid(); v_bid uuid := gen_random_uuid();
  v_co uuid := '03438ba2-5cd0-468a-bd5b-957b5555b580'; v_e uuid; v_cols text; v_row jsonb;
begin
  -- 본뜰 입찰: 테스트업체(업체 ID 또는 업체 주인 사용자 ID)가 「[점검」 요청에 넣은 가장 최근 입찰.
  --   입찰의 업체 칸엔 두 값이 다 쓰인다 → 계약·지급도 그 입찰과 같은 값으로 만든다(앱과 같게).
  select b.id, b.request_id, b.company_id into v_src_bid, v_src_req, v_co
    from public.bids b join public.requests q on q.id = b.request_id
   where coalesce(q.description, '') like '%[점검%'
     and coalesce(q.description, '') not like '%[점검 6차 09-25]%'
     and (b.company_id = v_co or b.company_id = (select c.owner_id from public.companies c where c.id = v_co))
   order by b.created_at desc limit 1;
  if v_src_bid is null then raise exception '테스트업체가 입찰한 「[점검」 요청이 없어요'; end if;

  -- 1) 요청 복사 — 칸 목록은 운영 스키마에서 읽는다(생성 칸 제외)
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'requests' and is_generated = 'NEVER';
  select to_jsonb(q) || jsonb_build_object(
           'id', v_req, 'status', 'in_progress', 'created_at', now(),
           'description', '[점검 6차 09-25] 사진 확인 과정 — ' || regexp_replace(coalesce(q.description, ''), '\[점검[^\]]*\]\s*', '', 'g'),
           'selected_bid_id', v_bid, 'selected_company_id', v_co,
           'budget_min', 500, 'budget_max', 1000)   -- 800만원 공사(3단계 구간)
    into v_row from public.requests q where q.id = v_src_req;
  execute format('insert into public.requests (%s) select %s from jsonb_populate_record(null::public.requests, $1)', v_cols, v_cols) using v_row;

  -- 2) 입찰 복사 — 선택됨
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'bids' and is_generated = 'NEVER';
  select to_jsonb(b) || jsonb_build_object('id', v_bid, 'request_id', v_req, 'status', 'selected', 'created_at', now(), 'price', 800)
    into v_row from public.bids b where b.id = v_src_bid;
  execute format('insert into public.bids (%s) select %s from jsonb_populate_record(null::public.bids, $1)', v_cols, v_cols) using v_row;

  -- 3) 계약
  -- 운영엔 escrow_get_or_create 가 없다 → 앱의 폴백(createEscrowRecord)과 같은 insert. 계획(stage_plan)은 서버 트리거(112)가 채운다.
  insert into public.escrow_payments (request_id, company_id, total_amount, transaction_status, status, step1_deposited_at, current_step)
  values (v_req, v_co, 800, 'CONTRACTED', 'deposited', now(), 1) returning id into v_e;
  update public.escrow_payments set stage_plan = public.escrow_stage_plan(v_co, 800) where id = v_e and stage_plan is null;

  -- 4) 지급 4줄 — 앱처럼 옛 비율로 넣는다(서버가 계획대로 고친다)
  insert into public.escrow_payouts (escrow_id, company_id, stage, percent, amount, platform_fee, vat, net_amount, fee_snapshot, status)
  select v_e, v_co, t.s, t.p, 800 * t.p / 100, 0, 0, 800 * t.p / 100, '{"companyFeeRate":0.04,"vatRate":0.1}'::jsonb, 'PENDING'
    from unnest(array[1, 2, 3, 4], array[10, 20, 40, 30]) as t(s, p);

  raise notice '점검 공사 요청 % · 입찰 % · 계약 %', v_req, v_bid, v_e;
end $$;

-- 확인: 한 줄이 나오고 plan = 3STEP, payouts = 1:0% · 2:30% · 3:40% · 4:30% 이면 끝
select q.id as request_id, e.id as contract_id, e.stage_plan as plan, e.transaction_status as tx, e.current_step,
       (select string_agg(p.stage || ':' || p.percent || '% ' || p.status, ' · ' order by p.stage)
          from public.escrow_payouts p where p.escrow_id = e.id) as payouts
  from public.requests q join public.escrow_payments e on e.request_id = q.id
 where q.description like '[점검 6차 09-25]%'
 order by e.created_at desc limit 1;

-- ============================================================
--  정리(점검이 끝난 뒤에만 — 위 점검 공사와 거기 올린 사진·기록을 지운다)
-- ============================================================
-- delete from public.phase_photos   where contract_id in (select e.id from public.escrow_payments e join public.requests q on q.id = e.request_id where q.description like '[점검 6차 09-25]%');
-- delete from public.escrow_payouts where escrow_id in (select e.id from public.escrow_payments e join public.requests q on q.id = e.request_id where q.description like '[점검 6차 09-25]%');
-- delete from public.escrow_payments where request_id in (select id from public.requests where description like '[점검 6차 09-25]%');
-- delete from public.bids           where request_id in (select id from public.requests where description like '[점검 6차 09-25]%');
-- delete from public.requests       where description like '[점검 6차 09-25]%';
