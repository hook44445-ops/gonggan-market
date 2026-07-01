-- 088_storage_chat_photos_policy.sql
-- 채팅 사진 업로드 실패 수정:
--   "new row violates row-level security policy" (storage.objects INSERT 차단).
--
-- 이 앱은 anon key + 전화번호 OTP 로그인이라 supabase.auth 세션이 없어 auth.uid()
-- 가 NULL 이다. 따라서 auth.uid() 기반 storage 정책은 업로드를 막는다. 기존 이미지
-- 버킷(lounge-images 등)과 동일하게, chat-photos 버킷을 대상으로 anon/authenticated
-- 의 업로드·조회를 버킷 범위로 허용한다(참여자 검증은 앱/클라이언트 로직이 담당).
--
-- 새 컬럼/테이블 없음. storage.objects 의 chat-photos 스코프 정책만 추가한다.

-- 버킷 보장(공개 읽기). 이미 있으면 public=true 로 정렬.
insert into storage.buckets (id, name, public)
values ('chat-photos', 'chat-photos', true)
on conflict (id) do update set public = true;

-- 업로드(INSERT) — chat-photos 버킷 한정
drop policy if exists "chat_photos_insert" on storage.objects;
create policy "chat_photos_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'chat-photos');

-- 조회(SELECT) — chat-photos 버킷 한정
drop policy if exists "chat_photos_select" on storage.objects;
create policy "chat_photos_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'chat-photos');
