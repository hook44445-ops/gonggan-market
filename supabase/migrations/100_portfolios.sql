-- 100_portfolios.sql — 업체 시공 사례(포트폴리오) 표 + 쓰기 RPC
--
-- 왜: 운영 DB에 portfolios 표가 없다(schema.sql에만 있고 적용된 적이 없다 · 2026-09-22 확인).
--     그래서 파트너 대시보드 「+ 시공사례 등록」이 운영에서 저장되지 않았고, 업체 상세의 시공 사례도 늘 비어 있었다.
--     이 표가 있어야 «끝난 공사 사진 → 시공 사례 → 의뢰인 홈 시공 사례 → 그 업체에 견적» 고리가 닫힌다.
--
-- 권한: 이 앱은 Supabase Auth가 아니라 전화번호 세션을 쓴다(auth.uid() 없음).
--     032_project_checkpoints 와 같은 방식 — 표는 누구나 읽기만, 쓰기는 security definer RPC 가
--     «p_actor_id 가 그 업체의 owner_id 인가»를 확인한 뒤에만 한다. 표에 직접 insert/update/delete 는 막는다.
--
-- 되돌리기: drop function portfolio_save(...), portfolio_delete(uuid,uuid); drop table portfolios;
--     (표가 원래 없었으므로 되돌려도 기존 데이터 손실 없음)

-- ── 1. 표 ─────────────────────────────────────────────────────────────
create table if not exists public.portfolios (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  contract_id   uuid,                   -- 어느 공사(escrow_payments.id)로 만든 사례인가 · 없으면 직접 등록
  title         text not null,
  space_type    text,
  area          text,
  size          text,
  budget        integer,                -- 만원 단위
  before_photos text[] not null default '{}',
  after_photos  text[] not null default '{}',
  "desc"        text,
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists portfolios_company_idx on public.portfolios (company_id, created_at desc);
create index if not exists portfolios_recent_idx  on public.portfolios (created_at desc);
create unique index if not exists portfolios_contract_uniq on public.portfolios (contract_id) where contract_id is not null;
comment on table public.portfolios is '업체 시공 사례 — 쓰기는 portfolio_save/portfolio_delete RPC만';

alter table public.portfolios enable row level security;
drop policy if exists "portfolios_public_read" on public.portfolios;
create policy "portfolios_public_read" on public.portfolios for select using (true);
-- insert/update/delete 정책 없음 → anon 직접 쓰기 불가(RPC만)

-- ── 2. 저장 RPC (새로 만들기 · 고치기) ────────────────────────────────
create or replace function public.portfolio_save(
  p_actor_id uuid, p_company_id uuid, p_id uuid,
  p_title text, p_space_type text, p_area text, p_size text, p_budget integer,
  p_desc text, p_tags text[], p_before text[], p_after text[], p_contract_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_row public.portfolios;
begin
  if not exists (select 1 from public.companies c where c.id = p_company_id and c.owner_id = p_actor_id) then
    raise exception 'NOT_COMPANY_OWNER';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'TITLE_REQUIRED';
  end if;

  if p_id is null then
    insert into public.portfolios (company_id, contract_id, title, space_type, area, size, budget,
                                   before_photos, after_photos, "desc", tags)
    values (p_company_id, p_contract_id, trim(p_title), p_space_type, p_area, p_size, p_budget,
            coalesce(p_before, '{}'), coalesce(p_after, '{}'), p_desc, coalesce(p_tags, '{}'))
    returning * into v_row;
  else
    update public.portfolios
       set title = trim(p_title), space_type = p_space_type, area = p_area, size = p_size, budget = p_budget,
           before_photos = coalesce(p_before, '{}'), after_photos = coalesce(p_after, '{}'),
           "desc" = p_desc, tags = coalesce(p_tags, '{}'), updated_at = now()
     where id = p_id and company_id = p_company_id
    returning * into v_row;
    if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  end if;

  return to_jsonb(v_row);
end; $$;

-- ── 3. 삭제 RPC ───────────────────────────────────────────────────────
create or replace function public.portfolio_delete(p_actor_id uuid, p_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  delete from public.portfolios p
   using public.companies c
   where p.id = p_id and c.id = p.company_id and c.owner_id = p_actor_id;
  if not found then raise exception 'NOT_COMPANY_OWNER'; end if;
end; $$;

-- ── 4. 실행 권한 ──────────────────────────────────────────────────────
grant select on public.portfolios to anon, authenticated;
grant execute on function public.portfolio_save(
  uuid,uuid,uuid,text,text,text,text,integer,text,text[],text[],text[],uuid
) to anon, authenticated;
grant execute on function public.portfolio_delete(uuid,uuid) to anon, authenticated;

notify pgrst, 'reload schema';
