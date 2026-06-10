-- ════════════════════════════════════════════════════════════════════
-- 053_admin_set_company_badge.sql
-- 관리자 공간보증 배지 등급 변경 — security-definer RPC.
--
-- 배경:
--   관리자(코드 sentinel 'admin', auth.uid()=NULL)가 업체관리에서 배지 등급을
--   부여/변경할 수 있어야 한다. 040/046/048 과 동일한 security-definer + sentinel
--   허용 패턴으로 RLS 를 우회해 companies.badge 를 갱신하고, 변경 이력을
--   admin_logs 에 남기며, 업체 소유자에게 notifications 를 생성한다.
--
-- 원칙:
--   · 표시/상태/관리값만 변경 — 실제 입·출금/정산 처리 없음.
--   · badge 컬럼만 UPDATE. 수주한도·보증예치 비율·필요 보증예치금은 프론트
--     파생 계산(badges.js)이므로 컬럼/스키마 변경 없음.
--   · p_badge='none' → 배지 해제(null). 그 외는 화이트리스트 검증.
--   · admin sentinel('admin') 또는 비-uuid admin_id 는 admin_logs.admin_id 에 NULL 로 저장.
--   · 멱등/추가 전용 — RLS 정책·기존 컬럼 변경 없음. 신규 함수 1개만 추가.
--
-- Supabase SQL Editor 에서 1회 실행(052 이후).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create or replace function public.admin_set_company_badge(
  p_admin_id   text,
  p_company_id uuid,
  p_badge      text,
  p_reason     text default null
) returns public.companies
language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_prev    text;
  v_owner   uuid;
  v_name    text;
  v_new     text;
  v_admin   uuid;
  v_row     public.companies;
begin
  -- 화이트리스트 — 'none' 은 배지 해제(null).
  if p_badge not in ('basic','standard','premium','enterprise','signature','none') then
    raise exception 'INVALID_BADGE: %', p_badge;
  end if;
  v_new := nullif(p_badge, 'none');

  -- admin sentinel/비-uuid 는 NULL 로 보관(admin_logs.admin_id uuid 호환).
  begin
    v_admin := p_admin_id::uuid;
  exception when others then
    v_admin := null;
  end;

  select badge, owner_id, name into v_prev, v_owner, v_name
    from public.companies where id = p_company_id;
  if not found then raise exception 'COMPANY_NOT_FOUND: %', p_company_id; end if;

  update public.companies set badge = v_new where id = p_company_id
    returning * into v_row;

  -- 변경 이력
  insert into public.admin_logs (admin_id, action, target_type, target_id, before_val, after_val, reason)
  values (v_admin, 'SET_COMPANY_BADGE', 'company', p_company_id,
          jsonb_build_object('badge', v_prev),
          jsonb_build_object('badge', v_new),
          p_reason);

  -- 업체 소유자 알림(있을 때만)
  if v_owner is not null then
    insert into public.notifications (user_id, type, title, message, related_id, related_type)
    values (v_owner, 'BADGE_UPDATED', '공간보증 배지 변경',
            case when v_new is null
                 then '관리자에 의해 공간보증 배지가 해제되었습니다.'
                 else '공간보증 배지 등급이 변경되었습니다.' end,
            p_company_id, 'company');
  end if;

  return v_row;
end; $$;

grant execute on function public.admin_set_company_badge(text, uuid, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
