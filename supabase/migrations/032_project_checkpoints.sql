-- ════════════════════════════════════════════════════════════════════
-- 032_project_checkpoints.sql
-- 현장방문 견적 흐름 3차 — GPS 체크포인트 4회 저장(현장방문/착공/중간점검/완료).
--
-- 정책:
--   · 실시간 위치추적 금지 — 버튼 클릭 시점에 1회만 좌표 캡처.
--   · 분쟁/정산 증빙 데이터 → 직접 쓰기 개방 금지, security-definer RPC 로만 저장.
--   · RPC 내부에서 p_actor_id(=업체 소유자 user.id) 가 해당 요청의 선택된 업체/
--     계약 업체 소유자인지 검증.
--   · 좌표뿐 아니라 road_address(도로명)·jibun_address(지번)·accuracy 를 함께 저장
--     → 관리자/프로젝트 상세에서 좌표가 아니라 주소로 노출.
--   · 읽기도 RLS(auth.uid 기반)에 막히므로(OTP 커스텀 인증) security-definer 조회 RPC 제공.
--
-- 멱등 · 추가 전용. Supabase SQL Editor 에서 1회 실행(031 다음).
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ────────────────────────────────────────────────────────────────────
-- 0. project_checkpoints 테이블
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.project_checkpoints (
  id              uuid        primary key default gen_random_uuid(),
  request_id      uuid        references public.requests(id)         on delete set null,
  contract_id     uuid        references public.escrow_payments(id)  on delete set null,
  site_visit_id   uuid        references public.site_visits(id)      on delete set null,
  checkpoint_type text        not null check (checkpoint_type in (
                                'site_visit','construction_start','mid_inspection','completion')),
  lat             numeric,
  lng             numeric,
  accuracy        numeric,
  road_address    text,
  jibun_address   text,
  photos          text[]      default '{}',
  note            text,
  captured_by     uuid,
  captured_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

comment on table public.project_checkpoints is
  '시공 단계별 GPS 체크포인트(현장방문/착공/중간/완료) — 버튼 클릭 1회 캡처, 좌표+주소 증빙';

create index if not exists idx_project_checkpoints_request
  on public.project_checkpoints (request_id, captured_at);
create index if not exists idx_project_checkpoints_contract
  on public.project_checkpoints (contract_id, captured_at);

-- RLS 활성 — 직접 접근은 제한, 쓰기/읽기는 security-definer RPC 로만.
alter table public.project_checkpoints enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- 1. 저장 RPC (업체) — actor 검증 후 INSERT
-- ────────────────────────────────────────────────────────────────────
create or replace function public.project_checkpoint_save(
  p_actor_id uuid, p_request_id uuid, p_contract_id uuid, p_site_visit_id uuid,
  p_type text, p_lat numeric, p_lng numeric, p_accuracy numeric,
  p_road_address text, p_jibun_address text, p_photos text[], p_note text
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.project_checkpoints;
begin
  -- 액터가 해당 요청의 선택된 업체 또는 계약 업체의 소유자인지 검증.
  if not exists (
    select 1 from public.companies c
     where c.owner_id = p_actor_id
       and (
         c.id = (select selected_company_id from public.requests where id = p_request_id)
         or c.id = (select company_id from public.escrow_payments where id = p_contract_id)
         or exists (select 1 from public.bids b
                     where b.request_id = p_request_id and b.company_id = c.id and b.selected = true)
       )
  ) then
    raise exception 'NOT_PROJECT_COMPANY';
  end if;

  insert into public.project_checkpoints (
    request_id, contract_id, site_visit_id, checkpoint_type,
    lat, lng, accuracy, road_address, jibun_address, photos, note, captured_by, captured_at, created_at
  ) values (
    p_request_id, p_contract_id, p_site_visit_id, p_type,
    p_lat, p_lng, p_accuracy, p_road_address, p_jibun_address,
    coalesce(p_photos, '{}'), p_note, p_actor_id, now(), now()
  ) returning * into v_row;

  return to_jsonb(v_row);
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- 2. 조회 RPC — 요청 단위 체크포인트(관리자/프로젝트 상세 공용)
--    읽기 RLS 도 막히므로 security definer 로 노출(민감도 낮은 단계/주소 증빙).
-- ────────────────────────────────────────────────────────────────────
create or replace function public.project_checkpoints_for_request(p_request_id uuid)
returns setof public.project_checkpoints language sql stable security definer
set search_path = public, extensions as $$
  select * from public.project_checkpoints
   where request_id = p_request_id
   order by captured_at asc;
$$;

-- ────────────────────────────────────────────────────────────────────
-- 3. 실행 권한
-- ────────────────────────────────────────────────────────────────────
grant execute on function public.project_checkpoint_save(
  uuid,uuid,uuid,uuid,text,numeric,numeric,numeric,text,text,text[],text
) to anon, authenticated;
grant execute on function public.project_checkpoints_for_request(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
