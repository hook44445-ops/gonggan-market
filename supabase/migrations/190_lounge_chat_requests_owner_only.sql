-- ============================================================
--  Migration 190: 라운지 대화 신청 표(lounge_chat_requests) — 두 사람(과 관리자)만 읽기 · 직접 쓰기 닫기
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(대화함·대화방이 이 표를 로그인 토큰으로 읽는 버전) → 이 SQL.
--
--  왜(10-01 점검):
--    · 읽기 «anon read»(088 · using true) — 로그인 안 한 누구나 «누가 누구에게 대화를 신청했는지» 전부 읽을 수 있었다
--    · 직접 쓰기 «auth insert»(requester 본인) · «target update»(두 사람) — 앱은 이 표를 서버 함수(189)로만 쓰는데
--      표가 직접 쓰기를 열어 두어, 처음부터 status='accepted' 로 넣거나 내 줄을 accepted 로 바꿔
--      토큰 20 차감·고객–업체 차단(189)을 건너뛰고 대화방(168 당사자 판정)에 들어갈 수 있었다
--  바꾼 뒤
--    · 읽기: 신청한 사람 · 받은 사람 · 관리자만(g190_lcr_read)
--    · 쓰기(INSERT·UPDATE·DELETE): 정책 없음 = 직접 못 쓴다. 신청·수락·거절·나가기는 189 서버 함수(security definer)로만
--  되돌리기: create policy "lounge_chat_requests: anon read" on public.lounge_chat_requests for select using (true);
--  확인 칸 2개(맨 아래 select) — 둘 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

alter table public.lounge_chat_requests enable row level security;

-- ① 열린 읽기(true) · 직접 쓰기 정책 지우기(이름을 몰라도 조건으로)
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'lounge_chat_requests'
       and (cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
            or (cmd = 'SELECT' and coalesce(qual, '') = 'true'))
  loop
    execute format('drop policy if exists %I on public.lounge_chat_requests', r.policyname);
  end loop;
end $$;

-- ② 읽기 — 두 사람 · 관리자
drop policy if exists g190_lcr_read on public.lounge_chat_requests;
create policy g190_lcr_read on public.lounge_chat_requests for select
  using (auth.uid() = requester_id or auth.uid() = target_id or coalesce(public.is_admin(), false));

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① owner_read: 읽기는 두 사람·관리자 정책만 남았다(누구나 읽기 없음)
--  ② no_direct_write: 직접 쓰기(INSERT·UPDATE·DELETE·ALL) 정책이 없다
select
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lounge_chat_requests' and policyname = 'g190_lcr_read')
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lounge_chat_requests'
                   and cmd = 'SELECT' and coalesce(qual, '') = 'true') as owner_read,
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lounge_chat_requests'
               and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')) as no_direct_write;
