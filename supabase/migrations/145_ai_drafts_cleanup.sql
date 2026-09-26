-- ============================================================
--  Migration 145: 옛 AI 글 정리 (09-26 AI 글 작동 점검 결과)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠️ 영구 삭제 없음 — ③ 은 «삭제 표시(is_deleted)»라 되돌릴 수 있다(아래 되돌리기 참고).
--
--  ① 제목·본문의 「과(와)」 표시를 받침에 맞게(「폭우과(와)」 → 「폭우와」, 「부동산 대책과(와)」 → 「부동산 대책과」)
--     — 에디터 추천·인기 목록에 그대로 보이던 것. 발행된 글 포함.
--  ② 날짜가 이틀 넘게 지난 AI 예약 글(예: 9/13 「부동산 대책과 공간의 관계」) → 초안으로 되돌림(갑자기 발행되지 않게)
--  ③ 9월 전(7월)에 브라우저가 만든 AI 초안(중복·옛 틀 글, 23건 안팎) → 삭제 표시. 발행된 글·서버 초안은 건드리지 않는다.
--  확인 칸 3개(아래 select) — 셋 다 true 면 끝.
--
--  되돌리기(필요할 때만): update public.lounge_posts set is_deleted = false
--    where publish_status = 'draft' and ai_topic is not null and created_at < '2026-09-01' and is_deleted = true;
-- ============================================================

-- ① 조사
update public.lounge_posts
   set title = regexp_replace(title, '과\(와\)',
         case when (ascii(substring(title from '(.)과\(와\)')) - 44032) % 28 = 0 then '와' else '과' end, 'g'),
       content = case when content like '%과(와)%' then regexp_replace(content, '과\(와\)',
         case when (ascii(substring(title from '(.)과\(와\)')) - 44032) % 28 = 0 then '와' else '과' end, 'g') else content end,
       updated_at = now()
 where title like '%과(와)%'
   and ascii(substring(title from '(.)과\(와\)')) between 44032 and 55203;

-- ② 지난 예약 → 초안
update public.lounge_posts
   set publish_status = 'draft', scheduled_at = null, is_visible = false, updated_at = now()
 where publish_status = 'scheduled'
   and ai_topic is not null
   and scheduled_at < now() - interval '2 days';

-- ③ 7월 옛 AI 초안 → 삭제 표시
update public.lounge_posts
   set is_deleted = true, updated_at = now()
 where publish_status = 'draft'
   and ai_topic is not null
   and created_at < '2026-09-01'
   and coalesce(ai_source, '') not in ('server_template', 'server_llm', 'server_news')
   and coalesce(is_deleted, false) = false;

-- 확인: 셋 다 true 면 끝
select
  not exists (select 1 from public.lounge_posts where title like '%과(와)%' and coalesce(is_deleted, false) = false) as josa_ok,
  not exists (select 1 from public.lounge_posts where publish_status = 'scheduled' and ai_topic is not null and scheduled_at < now() - interval '2 days') as stale_schedule_ok,
  not exists (select 1 from public.lounge_posts where publish_status = 'draft' and ai_topic is not null and created_at < '2026-09-01'
              and coalesce(ai_source, '') not in ('server_template', 'server_llm', 'server_news') and coalesce(is_deleted, false) = false) as old_drafts_ok;
