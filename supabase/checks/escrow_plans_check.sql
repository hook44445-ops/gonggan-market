-- ============================================================
--  점검(실행해도 아무것도 남지 않음): 에스크로 2단계 · 3단계 · 4단계가 끝까지 도는지
--  Supabase SQL Editor 에 통째로 붙여 실행하세요.
--
--  하는 일
--    · 가짜 계약 3건(800만원, 계획 2STEP · 3STEP · 4STEP)을 최근 「[점검」 요청에 붙여 만들고
--      앱과 똑같이 움직인다: 업체 사진 → 고객 승인(착공 · 중간) → 완료
--      완료는 2·3단계는 48시간 자동 승인(escrow_auto_approve_due), 4단계는 고객이 직접 승인.
--    · 끝에서 일부러 오류(ESCROW_CHECK …)를 내서 전부 되돌린다 — 오류 문구 안의 JSON 이 결과다.
--  결과 읽는 법
--    · "ok":false 가 있으면 그 단계가 운영에서 막힌다(err 에 이유).
--    · final_step 5 · final_tx SETTLED · payouts_after 가 계획대로 APPROVED 면 통과.
--    · rls / policies 는 앱(로그인 세션 없음)이 표를 직접 고칠 수 있는지 보는 참고값.
-- ============================================================
do $$
declare
  r      jsonb := '[]'::jsonb;
  pl     text;
  v_req  uuid;
  v_co   uuid;
  v_e    uuid;
  v_st   int;
  v_n    int;
  v_tx   text;
  v_txt  text;
  v_auto jsonb;
begin
  -- 0) 참고값 — 제약 · RLS · 정책 · 자동 승인 시계
  r := r || jsonb_build_object(
    'current_step_check', (select string_agg(pg_get_constraintdef(oid), ' | ') from pg_constraint
                            where conrelid = 'public.escrow_payments'::regclass and contype = 'c'),
    'rls', (select jsonb_object_agg(relname, relrowsecurity) from pg_class
             where oid in ('public.escrow_payments'::regclass, 'public.escrow_payouts'::regclass, 'public.phase_photos'::regclass)),
    'policies', (select string_agg(tablename || ':' || cmd || ':' || array_to_string(roles, ','), ' | ') from pg_policies
                  where schemaname = 'public' and tablename in ('escrow_payments', 'escrow_payouts', 'phase_photos')),
    'auto_hours', (select auto_approve_hours from public.ops_config where id = 1),
    'cron', (select string_agg(jobname || ' ' || schedule, ', ') from cron.job where jobname like 'escrow%'));

  select id into v_co from public.companies where coalesce(verified, false) order by created_at desc limit 1;

  foreach pl in array array['2STEP', '3STEP', '4STEP'] loop
    select q.id into v_req from public.requests q
     where coalesce(q.description, '') like '%[점검%'
       and not exists (select 1 from public.escrow_payments e
                        where e.request_id = q.id and e.transaction_status not in ('CANCELLED', 'SETTLED'))
     order by q.created_at desc limit 1;

    -- 계약 + 지급 4줄(앱처럼 옛 비율 10/20/40/30 으로 넣는다 → 서버가 계획대로 고쳐야 한다)
    insert into public.escrow_payments (request_id, company_id, total_amount, stage_plan, transaction_status, current_step)
    values (v_req, v_co, 800, pl, 'CONTRACTED', 1) returning id into v_e;
    insert into public.escrow_payouts (escrow_id, company_id, stage, percent, amount, platform_fee, vat, net_amount, fee_snapshot, status)
    select v_e, v_co, t.s, t.p, 800 * t.p / 100, 0, 0, 800 * t.p / 100,
           '{"companyFeeRate":0.04,"vatRate":0.1}'::jsonb, 'PENDING'
      from unnest(array[1, 2, 3, 4], array[10, 20, 40, 30]) as t(s, p);
    select string_agg(stage || ':' || percent || '%=' || amount || '만 ' || status, ' · ' order by stage) into v_txt
      from public.escrow_payouts where escrow_id = v_e;
    r := r || jsonb_build_object('plan', pl, 'request', v_req, 'payouts_at_contract', v_txt);

    -- 화면 단계 3 착공 · 4 중간 · 5 완료 (지급 줄 2 · 3 · 4)
    foreach v_st in array array[3, 4, 5] loop
      if v_st = 4 and pl = '2STEP' then continue; end if;   -- 2단계엔 중간 없음
      begin
        -- 업체: 사진 보내기 (EscrowScreen reportPhase)
        update public.escrow_payments
           set transaction_status = case v_st when 3 then 'STARTED' when 4 then 'MID_INSPECTION' else 'COMPLETED' end,
               current_step = v_st - 1, photos_uploaded_at = now()
         where id = v_e;
        update public.escrow_payouts set status = 'READY' where escrow_id = v_e and stage = v_st - 1;
        get diagnostics v_n = row_count;
        if v_n <> 1 then raise exception 'payout % READY rows=%', v_st - 1, v_n; end if;

        if v_st = 5 and pl <> '4STEP' then
          -- 고객 무응답 → 48시간 자동 승인
          update public.escrow_payouts set ready_at = now() - interval '49 hours' where escrow_id = v_e and stage = 4;
          v_auto := public.escrow_auto_approve_due();
        else
          -- 고객 승인 (EscrowScreen advanceStage)
          update public.escrow_payouts set status = 'APPROVED', approved_at = now() where escrow_id = v_e and stage = v_st - 1;
          execute format('update public.escrow_payments set step%s_approved_at = now(), current_step = $1%s where id = $2',
                         v_st - 1,
                         case v_st when 3 then ', transaction_status = ''MID_INSPECTION'''
                                   when 5 then ', transaction_status = ''SETTLED''' else '' end)
            using v_st, v_e;
        end if;
        r := r || jsonb_build_object('plan', pl, 'ui_stage', v_st, 'ok', true);
      exception when others then
        r := r || jsonb_build_object('plan', pl, 'ui_stage', v_st, 'ok', false, 'err', sqlerrm);
      end;
    end loop;

    select current_step, transaction_status into v_n, v_tx from public.escrow_payments where id = v_e;
    select string_agg(stage || ':' || percent || '% ' || status || case when auto_approved then '(자동)' else '' end, ' · ' order by stage)
      into v_txt from public.escrow_payouts where escrow_id = v_e;
    r := r || jsonb_build_object('plan', pl, 'final_step', v_n, 'final_tx', v_tx, 'payouts_after', v_txt, 'auto', v_auto);
    v_auto := null;
  end loop;

  raise exception 'ESCROW_CHECK %', jsonb_pretty(r);
end $$;
