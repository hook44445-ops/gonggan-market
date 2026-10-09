-- 205 · 관리자 기록(admin_logs) 종류 허용 목록 넓히기 (10-09)
--
-- 왜: 054 가 target_type 을 9가지로 묶었는데, 뒤에 생긴 관리자 함수들이 다른 종류로 기록을 남긴다.
--   공지 푸시(139 admin_push_broadcast → 'push')가 «violates check constraint admin_logs_target_type_check» 로
--   통째로 실패했다(대표 10-09 폰에서 확인). 같은 이유로 라운지 글·후기·입점 문의 관리 기록도 막힐 수 있다.
-- 어떻게: 지금 표에 있는 값 + 코드가 쓰는 값을 모두 허용하는 목록으로 다시 만든다(기존 줄은 그대로 통과).
--   여러 번 실행해도 같다.

do $$
declare
  v_types text[] := array[
    -- 054
    'company','customer','user','dispute','settlement','payment','lounge','report','document',
    -- 뒤에 생긴 관리자 함수·화면이 쓰는 값
    'push','lounge_post','lounge_comment','post','comment','review','partner_lead','payment_order',
    'request','bid','contract','escrow','notification','operator','system'
  ];
  v_existing text[];
  v_list text;
begin
  if to_regclass('public.admin_logs') is null then return; end if;
  select coalesce(array_agg(distinct target_type), '{}') into v_existing
    from public.admin_logs where target_type is not null;
  select string_agg(quote_literal(t), ',') into v_list
    from (select distinct unnest(v_types || v_existing) as t) s;
  execute 'alter table public.admin_logs drop constraint if exists admin_logs_target_type_check';
  execute format('alter table public.admin_logs add constraint admin_logs_target_type_check check (target_type is null or target_type in (%s))', v_list);
end $$;
