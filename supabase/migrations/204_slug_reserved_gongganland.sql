-- ============================================================
--  Migration 204: 업체 짧은 주소 예약어에 «공간랜드»·gongganland 추가 (앱 이름 변경 10-06)
--  149 의 company_set_slug 를 그대로 다시 만들고 예약어만 늘린다. 여러 번 실행해도 안전.
--  Supabase SQL Editor 에서 대표가 실행. 되돌리기: 149 다시 실행.
-- ============================================================
create or replace function public.company_set_slug(p_company_id uuid, p_slug text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_slug text := lower(regexp_replace(trim(coalesce(p_slug, '')), '\s+', '-', 'g'));
        v_owner uuid;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED' using errcode = '42501'; end if;
  select owner_id into v_owner from public.companies where id = p_company_id;
  if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
  if v_owner is distinct from v_uid and not public.is_admin() then raise exception 'OWNER_ONLY' using errcode = '42501'; end if;

  if v_slug = '' then   -- 비우기 = 짧은 주소 없애기
    update public.companies set slug = null where id = p_company_id;
    return jsonb_build_object('ok', true, 'slug', null);
  end if;
  if v_slug !~ '^[가-힣a-z0-9]([가-힣a-z0-9-]{0,18}[가-힣a-z0-9])?$' or char_length(v_slug) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'BAD_SLUG');
  end if;
  if v_slug in ('admin', 'api', 'app', 'download', 'testers', 'lounge', 'partner', 'privacy', 'terms', 'refund', 'tokens', 'my', 'p', 'login', 'gongganmarket', 'gongganland', '공간마켓', '공간랜드', '공간사이', '운영자', '관리자', 'test', '테스트') then
    return jsonb_build_object('ok', false, 'reason', 'RESERVED');
  end if;
  if exists (select 1 from public.companies where lower(slug) = v_slug and id <> p_company_id) then
    return jsonb_build_object('ok', false, 'reason', 'TAKEN');
  end if;
  update public.companies set slug = v_slug where id = p_company_id;
  return jsonb_build_object('ok', true, 'slug', v_slug);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'TAKEN');
end; $$;
grant execute on function public.company_set_slug(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 둘 다 true 면 끝
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'companies' and column_name = 'slug') as slug_col_ok,
  exists (select 1 from pg_proc where proname = 'company_set_slug')                                                                as slug_fn_ok;
