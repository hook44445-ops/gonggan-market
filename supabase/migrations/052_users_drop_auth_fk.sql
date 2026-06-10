-- ════════════════════════════════════════════════════════════════════
-- 052_users_drop_auth_fk.sql
-- public.users.id 의 auth.users 종속 FK 제거 (23503 FK violation 해소)
--
-- 배경:
--   공간마켓은 커스텀 전화번호 OTP(서버 API/Twilio) 인증을 쓰며 Supabase
--   auth.users 행을 생성하지 않는다(auth.uid() = null). 그런데 표준 Supabase
--   템플릿으로 만든 public.users.id 에는 users_id_fkey (→ auth.users.id) FK 가
--   걸려 있어, 051 에서 default 를 gen_random_uuid() 로 바꾼 뒤 신규 users INSERT
--   (upsertUserByPhone, id 미지정)가 생성한 uuid 가 auth.users 에 없어
--   [23503] users_id_fkey 위반으로 실패한다.
--
-- 조치:
--   auth.users 를 참조하는 FK 를 제거해 public.users 를 독립 식별자
--   (gen_random_uuid) 테이블로 만든다.
--
-- 안전성 (회귀 금지):
--   · 행 데이터 미변경 / 기존 user id 그대로 유지.
--   · companies.owner_id, bids, reviews, escrow_*, project_* 등은 모두
--     public.users.id 를 참조하므로 영향 없음(auth.users 참조 아님).
--   · 멱등(idempotent) — 재실행 안전. FK 가 이미 없으면 아무 일도 안 함.
--
-- Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 1) id 기본값 보장 — 051 미적용/부분적용 환경 대비(멱등).
alter table public.users alter column id set default gen_random_uuid();

-- 2) public.users 에서 auth.users 를 참조하는 외래키를 이름과 무관하게 동적 제거.
--    (보통 users_id_fkey 지만, 환경에 따라 이름이 다를 수 있어 confrelid 로 탐지)
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class      rel on rel.oid = con.conrelid
      join pg_namespace  ns  on ns.oid  = rel.relnamespace
     where ns.nspname  = 'public'
       and rel.relname = 'users'
       and con.contype = 'f'
       and con.confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.users drop constraint %I', c.conname);
    raise notice '[052] dropped FK on public.users -> auth.users: %', c.conname;
  end loop;
end $$;

notify pgrst, 'reload schema';
