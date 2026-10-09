-- 206 · 서버 함수가 사용자에게 보내는 글의 «공간마켓» → «공간랜드» (10-09)
--
-- 왜: 10-06 이름을 바꿨지만(#961) 이미 DB 에 올라간 함수 본문은 그대로라
--   광고 동의·철회 안내 «공간마켓 이벤트·혜택 알림… (보낸 곳: 공간마켓)», 수신거부 안내, 라운지 푸시 제목,
--   «공간마켓은 사업자등록을 마친 업체와만 계약해요» 같은 글이 아직 옛 이름으로 나간다(대표 10-09 폰).
-- 어떻게: public 함수 중 본문에 «공간마켓»이 든 것을 찾아 글자만 «공간랜드»로 바꿔 다시 만든다.
--   빼는 것(바꾸면 안 되는 곳):
--     · 업체 주소(slug) 예약어 목록 — '공간마켓' 을 남이 못 쓰게 막아 둔 것(149·204)
--     · 보증금 입금 계좌 «예금주»(deposit_owner) — 실제 통장 이름이라 글자만 바꾸면 안 된다
--   여러 번 실행해도 같다(두 번째부터는 바꿀 것이 없음).

-- ① 먼저 보기(읽기만) — 바뀔 함수와 뺄 함수
select p.proname as function_name,
       case when pg_get_functiondef(p.oid) ~ 'v_slug in|deposit_owner' then '뺌(예약어·예금주)' else '바꿈' end as action,
       (length(pg_get_functiondef(p.oid)) - length(replace(pg_get_functiondef(p.oid), '공간마켓', ''))) / length('공간마켓') as hits
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f'
   and pg_get_functiondef(p.oid) like '%공간마켓%'
 order by action, function_name;

-- ② 바꾸기
do $$
declare
  r record;
  v_def text;
  v_n int := 0;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and pg_get_functiondef(p.oid) like '%공간마켓%'
  loop
    v_def := pg_get_functiondef(r.oid);
    if v_def ~ 'v_slug in|deposit_owner' then continue; end if;
    execute replace(v_def, '공간마켓', '공간랜드');
    v_n := v_n + 1;
  end loop;
  raise notice '공간랜드로 바꾼 함수: %개', v_n;
end $$;
