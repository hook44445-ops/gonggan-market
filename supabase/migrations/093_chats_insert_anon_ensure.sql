-- 093_chats_insert_anon_ensure.sql
-- 라운지/거래 채팅 메시지 INSERT 실패 복구(멱등). 081 이 운영 DB 에 적용되지 않았거나
-- 이후 재제한된 경우를 대비해, chats 의 anon 읽기/쓰기 + sender_type CHECK superset 을
-- 다시 보장한다.
--
-- [원인] 이 앱은 anon key + 전화번호 OTP 라 auth.uid() 가 항상 NULL 이다. 그런데
--   기존 chats RLS 가 (auth.uid() = sender_id) 이면 INSERT 가 막히고, sender_type
--   CHECK 가 ('consumer','company','system') 뿐이면 클라이언트 값('user' 등)이 위반된다.
--   (참여자 검증은 room_id=`${userId}_${companyId}` / lounge_{request_id} 기반 앱 로직이 담당.)
--
-- 새 컬럼/테이블 없음. chats 정책/제약만 정렬한다.

-- 1) 기존 chats 정책 제거(멱등) 후 anon 읽기/쓰기 재생성
do $$
declare r record;
begin
  for r in
    select polname from pg_policy where polrelid = 'public.chats'::regclass
  loop
    execute format('drop policy if exists %I on public.chats', r.polname);
  end loop;
end $$;

create policy "chats_anon_read"   on public.chats for select using (true);
create policy "chats_anon_insert" on public.chats for insert with check (true);

-- 2) sender_type CHECK superset — 기존 값 + 'user' 보존(클라이언트 전송값 호환)
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.chats'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%sender_type%'
  loop
    execute format('alter table public.chats drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.chats
  add constraint chats_sender_type_check
  check (sender_type in ('consumer','user','company','system'));
