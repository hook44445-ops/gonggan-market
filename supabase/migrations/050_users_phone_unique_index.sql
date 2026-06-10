-- ════════════════════════════════════════════════════════════════════
-- 050_users_phone_unique_index.sql
-- public.users.phone 유니크 인덱스 추가 (additive · 멱등).
--
-- 배경:
--   repo schema.sql 은 users.phone 을 'text unique not null' 로 정의하지만,
--   운영 DB 에는 유니크 제약/인덱스가 없어, 048 가입 RPC 의
--     insert ... on conflict (phone) do nothing
--   이
--     42P10  there is no unique or exclusion constraint matching the ON CONFLICT specification
--   로 실패했다.
--
-- 왜 '비-부분(full)' 유니크 인덱스인가:
--   · ON CONFLICT (phone) (WHERE 절 없음)은 '부분(partial) 유니크 인덱스'를 arbiter 로
--     추론하지 않는다. 따라서 'where phone is not null' 부분 인덱스로는 42P10 이 안 풀린다.
--   · 비-부분 유니크 인덱스는 NULL 을 서로 distinct 로 취급(다중 NULL 허용)하면서
--     비-NULL 값에만 유니크를 강제한다 → ON CONFLICT (phone) 가 정상 추론된다.
--   · 이는 repo schema 의 'phone text unique' 와 동일한 효과이며, 048 RPC 를
--     수정하지 않고 그대로 동작시킨다(앱 전반이 phone 을 신원키로 가정 —
--     getUserByPhone/verify-otp 의 maybeSingle 도 phone 유일성을 전제).
--
-- ⚠️ 적용 전 필수 확인(비-NULL 중복이 있으면 인덱스 생성이 실패한다):
--     select phone, count(*) from public.users
--      where phone is not null group by phone having count(*) > 1;
--   → 결과가 0건일 때만 본 마이그레이션을 실행한다. 중복이 있으면 먼저 정리 필요.
--
-- 수정:
--   · users(phone) 비-부분 유니크 인덱스만 추가. RLS/RPC/기존 컬럼/데이터 변경 없음.
--   · 기존 가입·로그인·업체·에스크로·결제·리뷰·GPS 흐름에 영향 없음.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(049 이후, 중복 0건 확인 후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create unique index if not exists users_phone_unique_idx
  on public.users (phone);

notify pgrst, 'reload schema';
