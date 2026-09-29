-- ============================================================
--  Migration 159: 초대한 사람 이름(첫 글자만) — «김○○님이 초대했어요»
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(조회 전용). 146 뒤에.
--
--  왜(대표 09-29): 초대 링크를 연 사람에게 «친구가»보다 «김○○님이»가 훨씬 잘 먹힌다(첫 화면 띠 · 카톡 카드).
--  규칙
--    · 누구나(로그인 없이) 초대 코드로 부를 수 있다 — 그래서 이름은 첫 글자 + «○○» 만(초대왕 순위판 155 와 같은 모양)
--    · 업체 계정이면 업체 이름 첫 글자가 아니라 «○○ 사장님»처럼 사람 표시만 — 업체 여부는 true/false 로만
--    · 코드 모양이 틀리거나 없는 코드면 ok:false (어떤 코드가 있는지 알려 주지 않는다)
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.referral_inviter(p_code text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_code text := upper(trim(coalesce(p_code, ''))); u record; v_company boolean;
begin
  if v_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then return jsonb_build_object('ok', false); end if;
  select id, name into u from public.users where referral_code = v_code;
  if u.id is null then return jsonb_build_object('ok', false); end if;
  v_company := exists (select 1 from public.companies c where c.owner_id = u.id);
  return jsonb_build_object('ok', true,
    'name', left(coalesce(nullif(trim(u.name), ''), '회원'), 1) || '○○',
    'is_company', v_company);
end; $$;
grant execute on function public.referral_inviter(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'referral_inviter') as referral_inviter_ok;
