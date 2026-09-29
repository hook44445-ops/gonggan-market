-- ============================================================
--  Migration 168: 대화 — 그 방의 고객·업체(와 관리자)만 읽고 쓴다 (보완 S1)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(대화를 로그인 토큰으로 읽고·쓰고·실시간 구독하는 버전) → 대표 재로그인 → 이 SQL.
--
--  바꾸는 것
--    · chats 읽기·쓰기 정책: 누구나 → 방의 당사자·관리자만(로그인 토큰의 사용자 기준).
--      방 ID 규칙은 그대로: `${고객ID}_${업체ID}`(업체ID 는 companies.id 또는 옛 방의 업체 주인 ID), `lounge_${라운지 대화 요청 ID}`.
--    · 쓰기: 보낸 사람은 비우거나(시스템 기록) 본인만.
--    · 읽음 처리(chat_mark_room_read · 066): 읽는 사람 = 토큰의 사용자, 당사자만.
--    · 실시간(postgres_changes)은 이 정책을 그대로 따른다 — 앱은 토큰 연결로 구독한다.
--    · 대화 사진 보관함(chat-photos · 088): 목록 보기·올리기를 누구나 → 그 방의 당사자·관리자만(보완 S5).
--      사진 경로 첫 칸이 방 ID(uploadChatPhoto). 사진 주소로 보는 것은 그대로(주소는 당사자 대화에만 있다).
--  되돌리기(예전 정책 — 093 과 같음):
--    drop policy if exists chats_party_read on public.chats; drop policy if exists chats_party_insert on public.chats;
--    create policy "chats_anon_read" on public.chats for select using (true);
--    create policy "chats_anon_insert" on public.chats for insert with check (true);
--    (사진 보관함) 088 의 두 create policy 문을 다시 실행.
--  확인 칸 4개(맨 아래 select) — 넷 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.chat_room_party(p_room_id text, p_uid uuid)
returns boolean language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_a uuid; v_b uuid; v_lounge uuid;
begin
  if p_uid is null or coalesce(p_room_id, '') = '' then return false; end if;
  if exists (select 1 from public.users u where u.id = p_uid and u.role = 'admin') then return true; end if;

  if p_room_id like 'lounge\_%' then
    begin v_lounge := substr(p_room_id, 8)::uuid; exception when others then return false; end;
    return exists (select 1 from public.lounge_chat_requests q
                    where q.id = v_lounge and p_uid in (q.requester_id, q.target_id));
  end if;

  begin
    v_a := split_part(p_room_id, '_', 1)::uuid;
    v_b := split_part(p_room_id, '_', 2)::uuid;
  exception when others then return false;
  end;
  if split_part(p_room_id, '_', 3) <> '' then return false; end if;

  return p_uid in (v_a, v_b)
      or exists (select 1 from public.companies c where c.owner_id = p_uid and c.id in (v_a, v_b));
end; $$;
grant execute on function public.chat_room_party(text, uuid) to anon, authenticated;

do $$
declare r record;
begin
  for r in select polname from pg_policy where polrelid = 'public.chats'::regclass loop
    execute format('drop policy if exists %I on public.chats', r.polname);
  end loop;
end $$;

alter table public.chats enable row level security;
create policy chats_party_read on public.chats for select
  using (public.chat_room_party(room_id, auth.uid()));
create policy chats_party_insert on public.chats for insert
  with check (public.chat_room_party(room_id, auth.uid()) and (sender_id is null or sender_id = auth.uid()));

create or replace function public.chat_mark_room_read(
  p_room_id   text,
  p_reader_id uuid
) returns integer
language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_count integer := 0;
begin
  p_reader_id := auth.uid();   -- 168: 읽는 사람은 로그인 토큰의 사용자(앱이 보낸 값은 쓰지 않는다)
  if coalesce(trim(p_room_id), '') = '' or p_reader_id is null then
    return 0;
  end if;
  if not public.chat_room_party(p_room_id, p_reader_id) then return 0; end if;

  update public.chats
     set read_at = now()
   where room_id = p_room_id
     and read_at is null
     and sender_id is distinct from p_reader_id;

  get diagnostics v_count = row_count;
  return v_count;
end; $fn$;

grant execute on function public.chat_mark_room_read(text, uuid) to anon, authenticated;

-- 대화 사진 보관함 — 목록·올리기는 방의 당사자·관리자만
drop policy if exists "chat_photos_insert" on storage.objects;
create policy "chat_photos_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'chat-photos' and public.chat_room_party(split_part(name, '/', 1), auth.uid()));
drop policy if exists "chat_photos_select" on storage.objects;
create policy "chat_photos_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'chat-photos' and public.chat_room_party(split_part(name, '/', 1), auth.uid()));

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① party_only: chats 정책이 당사자 정책 2개뿐이다(누구나 읽기·쓰기 정책 없음)
--  ② rls_on: chats 행 보안이 켜져 있다
--  ③ read_token: 읽음 처리가 토큰의 사용자로 판단한다
--  ④ photos_party: 대화 사진 보관함 목록·올리기가 당사자 판정을 쓴다
select
  (select count(*) from pg_policy where polrelid = 'public.chats'::regclass) = 2
    and not exists (select 1 from pg_policy where polrelid = 'public.chats'::regclass
                     and pg_get_expr(polqual, polrelid) = 'true') as party_only,
  (select relrowsecurity from pg_class where oid = 'public.chats'::regclass) as rls_on,
  exists (select 1 from pg_proc where proname = 'chat_mark_room_read' and prosrc like '%168: 읽는 사람%') as read_token,
  (select count(*) from pg_policy where polrelid = 'storage.objects'::regclass
     and polname in ('chat_photos_insert', 'chat_photos_select')
     and coalesce(pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)) like '%chat_room_party%') = 2 as photos_party;
