-- ============================================================
--  Migration 185: 요청서 «현장 사진»을 찾을 수 있는 칸으로 (requests.photos)
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 앱 배포(사진 올리기·보이기 되는 버전) → 이 SQL. 지금 안 해도 앱은 그대로 돕니다.
--
--  왜(대표 2026-09-30)
--    「고객이 사진을 어떻게 올리냐, 초반에 뭘 고쳐야 한다고 말하냐에 따라 최종 견적이 달라진다」
--    그런데 요청서에 고객이 자기 집을 찍어 올리는 칸이 아예 없었다. 업체는 평수·예산·태그만
--    보고 숫자를 던졌고, 그래서 현장에 가면 달라질 수밖에 없었다.
--    앱은 먼저 «description 안에 [[photo]] 마커» 로 담게 해 뒀다(새 SQL 없이 돌아가게).
--    이 SQL 은 그 주소를 «찾을 수 있는 칸» 으로 옮긴다.
--
--  칸이 생기면 되는 것
--    · 사진이 있는 요청이 몇 건인지 셀 수 있다(관리자 숫자)
--    · 나중에 「말한 대로 지수」(입찰가 대비 최종 견적서 차이)를 잴 때
--      **사진이 있었던 건만** 세도록 조건을 걸 수 있다 — 안 그러면 요청서를 부실하게 쓴 탓이
--      성실한 업체 점수로 돌아간다(대표 지적).
--
--  안 바꾸는 것(중요)
--    · description 안 마커는 그대로 둔다. 요청 «고치기»는 RPC(request_update_by_owner)에
--      사진 칸이 없어서 앞으로도 마커로 저장된다. 트리거가 그걸 칸으로 옮겨 준다.
--    · 그래서 이 SQL 을 안 해도 앱은 지금처럼 돌고, 해도 화면은 달라지지 않는다.
--    · 사진 파일 자체는 기존 'chat-photos' 버킷에 그대로 둔다(088 정책 재사용 · 새 버킷 없음).
--
--  되돌리기(두 줄):
--    drop trigger if exists t_requests_sync_photos on public.requests;
--    drop function if exists public.requests_sync_photos(); alter table public.requests drop column if exists photos;
--
--  확인 칸 3개(맨 아래 select) — 셋 다 true 면 끝.
-- ============================================================

set search_path = public, extensions;

-- ① 칸 추가 (있으면 넘어간다)
alter table public.requests add column if not exists photos text[];

-- ② description 안 «[[photo]]주소» 줄을 뽑아 칸에 채우는 함수
--    · 최대 5장(앱 MAX_REQUEST_PHOTOS 와 같은 수)
--    · 마커가 하나도 없으면 칸을 건드리지 않는다 — 앞으로 칸에 직접 쓰는 길이 생겨도 덮어쓰지 않게
create or replace function public.requests_sync_photos()
returns trigger language plpgsql
set search_path = public, extensions as $$
declare v_urls text[];
begin
  select array_agg(url order by ord)
    into v_urls
    from (
      select trim(substring(line from 10)) as url, ord
        from unnest(string_to_array(coalesce(new.description, ''), E'\n')) with ordinality as t(line, ord)
       where trim(line) like '[[photo]]%'
         and length(trim(substring(line from 10))) > 0
       order by ord            -- limit 앞에 순서를 정해야 «앞 5장»이 된다(아무 5장이 아니라)
       limit 5
    ) s;
  if v_urls is not null then new.photos := v_urls; end if;
  return new;
end; $$;

drop trigger if exists t_requests_sync_photos on public.requests;
create trigger t_requests_sync_photos
  before insert or update of description on public.requests
  for each row execute function public.requests_sync_photos();

-- ③ 이미 올라온 요청 채우기(앱 배포 뒤 들어온 것들)
update public.requests
   set description = description
 where coalesce(description, '') like '%[[photo]]%'
   and (photos is null or array_length(photos, 1) is null);

-- ④ 「사진 있는 요청」을 빨리 세기 위한 부분 인덱스
create index if not exists idx_requests_has_photos
  on public.requests ((array_length(photos, 1)))
  where photos is not null;

notify pgrst, 'reload schema';

-- ── 확인 ──────────────────────────────────────────────────────
--  ① photos_col   : requests 에 photos 칸이 생겼다
--  ② sync_trigger : description 이 바뀌면 칸을 채우는 트리거가 있다
--  ③ backfill_ok  : 마커가 있는데 칸이 빈 요청이 하나도 남지 않았다
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'requests' and column_name = 'photos') as photos_col,
  exists (select 1 from pg_trigger where tgname = 't_requests_sync_photos' and not tgisinternal) as sync_trigger,
  not exists (select 1 from public.requests
               where coalesce(description, '') like '%[[photo]]%'
                 and (photos is null or array_length(photos, 1) is null)) as backfill_ok;
