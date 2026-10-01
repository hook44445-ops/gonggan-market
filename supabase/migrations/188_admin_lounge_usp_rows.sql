-- ============================================================
--  Migration 188: 공간라운지 측정 3줄 — admin_lounge_usp_rows(p_days) (docs/LOUNGE-USP-2026-10-01.md 5절)
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다. (187 과 따로 — 187 은 그대로)
--
--  · 관리자(로그인 토큰)만 · 읽기만 · 관리자 «USP · 사용 → 전환» 표에 13~15번 줄로 붙는다
--    13 라운지 → 견적  : 글에서 «견적 받아보기» 링크를 누른 사람(앱 기록 usp_13) → 3일 안 요청
--    14 사람이 쓴 글   : 기간 안 라운지 글(스토리 제외) → 그중 사람 글(운영 글 is_seed 아님)
--    15 업체 참여      : 업체로 글·답을 쓴 사람(is_expert · is_expert_reply) → 그중 미니 포트폴리오가 열린 업체(앱 기록 usp_15)
--  · 줄마다 따로 계산 — 표·칸이 운영에 없으면 그 줄만 빈다.
--  되돌리기: drop function if exists public.admin_lounge_usp_rows(int);
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.admin_lounge_usp_rows(p_days int default 30)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_rows jsonb := '[]'::jsonb;
  u bigint; c bigint;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  -- 13 라운지 → 견적
  begin
    select count(distinct a.user_id),
           count(distinct a.user_id) filter (where exists (select 1 from public.requests r where r.user_id = a.user_id
                                                            and r.created_at between a.created_at and a.created_at + interval '3 days'))
      into u, c
      from public.activity_logs a where a.action = 'usp_13' and a.created_at >= v_since and a.user_id is not null;
    v_rows := v_rows || jsonb_build_object('usp', 13, 'used', u, 'converted', c);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 13);
  end;

  -- 14 사람이 쓴 글(스토리 제외 · 지운 글 제외)
  begin
    select count(*), count(*) filter (where not coalesce((to_jsonb(p) ->> 'is_seed')::boolean, false))
      into u, c
      from public.lounge_posts p
     where p.created_at >= v_since
       and not coalesce((to_jsonb(p) ->> 'is_story')::boolean, false)
       and not coalesce((to_jsonb(p) ->> 'is_deleted')::boolean, false);
    v_rows := v_rows || jsonb_build_object('usp', 14, 'used', u, 'converted', c);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 14);
  end;

  -- 15 업체 참여 → 미니 포트폴리오가 열린 업체
  begin
    with who as (
      select p.user_id from public.lounge_posts p
       where p.created_at >= v_since and coalesce((to_jsonb(p) ->> 'is_expert')::boolean, false)
         and not coalesce((to_jsonb(p) ->> 'is_seed')::boolean, false) and p.user_id is not null
      union
      select m.user_id from public.lounge_comments m
       where m.created_at >= v_since and coalesce((to_jsonb(m) ->> 'is_expert_reply')::boolean, false) and m.user_id is not null)
    select count(*), count(*) filter (where exists (select 1 from public.activity_logs a
                                                     where a.action = 'usp_15' and a.target_id = w.user_id and a.created_at >= v_since))
      into u, c from who w;
    v_rows := v_rows || jsonb_build_object('usp', 15, 'used', u, 'converted', c);
  exception when others then v_rows := v_rows || jsonb_build_object('usp', 15);
  end;

  return jsonb_build_object('ok', true, 'rows', v_rows);
end; $$;
revoke execute on function public.admin_lounge_usp_rows(int) from public, anon;
grant execute on function public.admin_lounge_usp_rows(int) to authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'admin_lounge_usp_rows') as lounge_usp_ok;
