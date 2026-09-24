-- ============================================================
--  Migration 115: 내부 함수 잠그기 + 고객 공간온도 읽기
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  1) 보안 — 누구나 부를 수 있던 내부 쓰기 함수 잠그기 (총점검 09-24 5차 창에서 발견)
--     Postgres 는 새 함수의 실행 권한을 PUBLIC 에 준다. 아래 다섯은 security definer 인데
--     revoke 가 없어, 앱 밖에서 anon 키로 rpc 를 부르면 누구나
--       · 아무 업체의 공간온도를 올리거나 내리고(company_temp_add)
--       · 아무 고객의 공간온도를 올리거나 내리고(customer_temp_add)
--       · 완료 건수 재계산·토큰 잠금·새 요청 알림을 마음대로 돌릴 수 있었다.
--     다섯 모두 앱·api 가 부르지 않고, 부르는 쪽은 전부 security definer 트리거/함수다
--     (소유자 권한으로 돈다) → 여기서 권한을 거둬도 정상 흐름은 그대로다.
--     ⚠️ escrow_auto_approve_due 는 /api/push/dispatch 가 anon 으로 부르므로 그대로 둔다(112).
--
--  2) 고객 공간온도 읽기 — users 는 RLS 로 anon 에 안 보인다(빈 목록).
--     114 로 users.space_temp 가 생겼지만 화면은 읽을 길이 없어 기본값 36.5° 를 그렸다.
--     숫자 하나만 돌려주는 읽기 함수. (업체가 대화방에서 보는 고객 온도도 같은 값이다.)
-- ============================================================

set search_path = public, extensions;

revoke execute on function public.company_temp_add(uuid, numeric)   from public, anon, authenticated;
revoke execute on function public.customer_temp_add(uuid, numeric)  from public, anon, authenticated;
revoke execute on function public.company_recount_completed(uuid)   from public, anon, authenticated;
revoke execute on function public.token_balance_lock(uuid)          from public, anon, authenticated;
revoke execute on function public.request_notify_partners(uuid)     from public, anon, authenticated;

create or replace function public.user_space_temp(p_user uuid)
returns numeric language sql stable security definer
set search_path = public, extensions as $$
  select space_temp from public.users where id = p_user;
$$;
grant execute on function public.user_space_temp(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 여섯 칸 모두 true 면 끝
select
  not has_function_privilege('anon', 'public.company_temp_add(uuid, numeric)', 'execute')  as company_temp_locked,
  not has_function_privilege('anon', 'public.customer_temp_add(uuid, numeric)', 'execute') as customer_temp_locked,
  not has_function_privilege('anon', 'public.company_recount_completed(uuid)', 'execute')  as recount_locked,
  not has_function_privilege('anon', 'public.token_balance_lock(uuid)', 'execute')         as token_lock_locked,
  not has_function_privilege('anon', 'public.request_notify_partners(uuid)', 'execute')    as notify_locked,
  has_function_privilege('anon', 'public.user_space_temp(uuid)', 'execute')                 as temp_read_ok;
