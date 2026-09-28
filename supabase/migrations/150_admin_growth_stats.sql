-- ============================================================
--  Migration 150: 관리자 «성장 지표» — 1등 다운로드로 가고 있는지 숫자 한 장
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다(읽기 전용 함수 하나).
--
--  왜(대표 09-28 「1등 다운로드 앱」): 초대(146·148)·테스터 신청(147)·업체 공개 페이지(149)·
--    설치 유도를 넣었는데, 늘고 있는지 볼 곳이 없다.
--  하는 일: admin_growth_stats() — 관리자(로그인 토큰)만. 표·칸이 아직 없으면(147·149 전) 그 칸만 null.
--    개인정보 없음(숫자만 · 초대 순위는 이름 첫 글자 + 수).
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.admin_growth_stats()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  v jsonb := '{}'::jsonb;
  t7  timestamptz := now() - interval '7 days';
  t30 timestamptz := now() - interval '30 days';
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;

  -- 가입
  v := v || jsonb_build_object(
    'users_total', (select count(*) from public.users),
    'users_7d',    (select count(*) from public.users where created_at > t7),
    'users_30d',   (select count(*) from public.users where created_at > t30));

  -- 방문(085) — 하루 방문자 수 평균
  begin
    v := v || jsonb_build_object(
      'visitors_today', (select count(*) from public.user_visits where visit_date = (now() at time zone 'Asia/Seoul')::date),
      'visitors_7d',    (select count(distinct visitor_key) from public.user_visits where visited_at > t7),
      'visitors_30d',   (select count(distinct visitor_key) from public.user_visits where visited_at > t30));
  exception when others then v := v || jsonb_build_object('visitors_today', null, 'visitors_7d', null, 'visitors_30d', null);
  end;

  -- 견적 요청
  begin
    v := v || jsonb_build_object(
      'requests_7d',  (select count(*) from public.requests where created_at > t7),
      'requests_30d', (select count(*) from public.requests where created_at > t30));
  exception when others then v := v || jsonb_build_object('requests_7d', null, 'requests_30d', null);
  end;

  -- 초대(146·148)
  begin
    v := v || jsonb_build_object(
      'referred_total', (select count(*) from public.users where referred_by is not null),
      'referred_7d',    (select count(*) from public.users where referred_at > t7),
      'referral_tokens_30d', (select coalesce(sum(amount), 0) from public.space_token_logs
                               where type = 'earn' and action in ('referral_invite', 'referral_joined') and created_at > t30),
      'top_inviters', coalesce((
        select jsonb_agg(jsonb_build_object('name', left(coalesce(u.name, '회원'), 1) || '○○', 'count', x.n) order by x.n desc)
          from (select referred_by, count(*) n from public.users where referred_by is not null
                 group by referred_by order by count(*) desc limit 5) x
          join public.users u on u.id = x.referred_by), '[]'::jsonb));
  exception when others then v := v || jsonb_build_object('referred_total', null, 'referred_7d', null, 'referral_tokens_30d', null, 'top_inviters', '[]'::jsonb);
  end;

  -- 테스터 신청(147)
  begin
    v := v || jsonb_build_object(
      'testers_total',   (select count(*) from public.tester_signups),
      'testers_waiting', (select count(*) from public.tester_signups where added_at is null));
  exception when others then v := v || jsonb_build_object('testers_total', null, 'testers_waiting', null);
  end;

  -- 업체(직영 146 · 짧은 주소 149 · 공개 페이지에 사례가 있는 곳)
  begin
    v := v || jsonb_build_object(
      'companies_total',      (select count(*) from public.companies),
      'companies_7d',         (select count(*) from public.companies where created_at > t7),
      'companies_with_works', (select count(distinct company_id) from public.portfolios));
  exception when others then v := v || jsonb_build_object('companies_total', null, 'companies_7d', null, 'companies_with_works', null);
  end;
  begin
    v := v || jsonb_build_object('companies_with_slug', (select count(*) from public.companies where slug is not null));
  exception when others then v := v || jsonb_build_object('companies_with_slug', null);
  end;

  return v || jsonb_build_object('at', now());
end; $$;
grant execute on function public.admin_growth_stats() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'admin_growth_stats') as growth_stats_ok;
