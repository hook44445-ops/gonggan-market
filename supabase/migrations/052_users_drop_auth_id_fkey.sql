-- ════════════════════════════════════════════════════════════════════
-- 052_users_drop_auth_id_fkey.sql
-- public.users.id 의 auth.users 외래키(users_id_fkey) 제거 — 가드 적용.
--
-- 배경:
--   운영 DB 의 public.users.id 에 users_id_fkey 외래키가 걸려 있어
--     23503  insert or update on table "users" violates foreign key constraint "users_id_fkey"
--     Key (id)=(...) is not present in table "users"
--   로 신규 가입이 실패했다. (메시지의 "users" 는 스키마 생략된 auth.users)
--
--   이 FK 는 초기 Supabase Auth 스캐폴딩 잔재로 public.users.id → auth.users(id)
--   를 강제한다. 그러나 이 앱은 Supabase Auth 를 쓰지 않고 Twilio OTP + anon key
--   기반이라 auth.users 행이 없다. 따라서 gen_random_uuid() 로 만든 신규 id 가
--   auth.users 에 없어 INSERT 가 거부된다. repo schema.sql 에는 이 FK 가 없다
--   (users.id 는 'uuid primary key default gen_random_uuid()' 뿐).
--
-- 수정(가드 — auth.users 참조일 때만 드롭):
--   · users_id_fkey 가 auth.users 를 참조하면 → 드롭(repo 스키마와 일치시킴).
--   · 그 외(존재하지만 다른 테이블 참조 / 부재)면 → 드롭하지 않고 notice 만.
--   · 컬럼/데이터/RLS/RPC/타 테이블·플로우 변경 없음. 기존 행/타 FK 무영향
--     (companies.owner_id, requests.user_id 등은 public.users 를 참조 — 영향 없음).
--
-- 적용 전 확인(선택):
--     select conname, conrelid::regclass as tbl, confrelid::regclass as ref,
--            pg_get_constraintdef(oid) as def
--     from pg_constraint where conname = 'users_id_fkey';
--
-- 멱등 · Supabase SQL Editor 에서 1회 실행(051 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

do $$
declare v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conname = 'users_id_fkey'
     and conrelid = 'public.users'::regclass;

  if v_def is null then
    raise notice '[052] users_id_fkey 없음 — 처리할 것 없음(이미 제거됐거나 미존재).';
  elsif v_def ilike '%auth.users%' then
    alter table public.users drop constraint users_id_fkey;
    raise notice '[052] users_id_fkey 드롭 완료(auth.users 참조 잔재 제거): %', v_def;
  else
    raise notice '[052] users_id_fkey 가 auth.users 를 참조하지 않음(%) — 드롭하지 않음. 수동 검토 필요.', v_def;
  end if;
end $$;

notify pgrst, 'reload schema';
