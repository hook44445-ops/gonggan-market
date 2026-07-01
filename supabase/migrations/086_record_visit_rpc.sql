-- ════════════════════════════════════════════════════════════════════
-- 086_record_visit_rpc.sql
-- 방문 기록 저장을 security-definer RPC 로 전환 — anon 직접 INSERT 가 GRANT/RLS 로
-- 막혀 user_visits 가 0건이던 문제 확실 해결. (085 의 테이블/집계 RPC 는 그대로 유지)
--
-- 원칙:
--   · record_visit() 는 owner 권한으로 INSERT → 호출측(anon)의 테이블 GRANT/RLS 불확실성 제거.
--   · (visitor_key, visit_date) UNIQUE 로 하루 1회만(중복 무시 = ON CONFLICT DO NOTHING).
--   · 개인정보 미저장 — visitor_key(익명/유저id)·role·screen·대략적 UA 만.
--   · 안전망: user_visits 직접 INSERT GRANT 도 명시(직접 경로 대비, 무해).
--
-- Supabase SQL Editor 에서 1회 실행(085 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 안전망 — 직접 insert 경로도 열어둔다(security-definer RPC 를 주로 쓰지만 무해).
grant insert on public.user_visits to anon, authenticated;

-- 방문 기록 RPC — owner 권한으로 INSERT(anon RLS/GRANT 무관하게 확실히 기록).
create or replace function public.record_visit(
  p_visitor_key text,
  p_user_id     uuid default null,
  p_role        text default null,
  p_screen      text default null,
  p_user_agent  text default null
) returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if p_visitor_key is null or length(btrim(p_visitor_key)) = 0 then
    return;
  end if;
  insert into public.user_visits (user_id, role, visitor_key, screen, user_agent)
  values (p_user_id, p_role, p_visitor_key, p_screen, left(p_user_agent, 300))
  on conflict (visitor_key, visit_date) do nothing;
end; $$;

grant execute on function public.record_visit(text, uuid, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
