-- ============================================================
--  Migration 144: 라운지 댓글 숨김 — «토큰의 사용자»로만 판단 (138 에서 빠진 것)
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--  ⚠ 순서: 같은 PR 앱 배포(이 함수를 로그인 토큰으로 부르는 버전) «뒤»에. 배포 전 앱은 토큰 없이 불러 막힌다.
--
--  문제(09-26)
--    op_set_comment_hidden(025·028)이 앱이 보낸 p_actor_id 를 믿었다 — 관리자·운영자 id 를 알면
--    누구나 남의 댓글을 숨길 수 있었다. 138 은 글 추천·숨김·긴급 스위치만 고쳤다.
--  고침
--    행위자 = auth.uid()(로그인 토큰). 관리자 또는 운영자(is_operator)만. p_actor_id 는 이름만 남긴다(앱 호환).
--    기록(operator_action_logs)도 토큰의 사용자로.
--  확인 칸 1개(아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.op_set_comment_hidden(p_comment_id uuid, p_hidden boolean, p_actor_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_role text; v_op boolean;
begin
  select role, is_operator into v_role, v_op from public.users where id = v_uid;
  if v_role is null or (v_role <> 'admin' and coalesce(v_op, false) = false) then raise exception 'MODERATOR_ONLY'; end if;
  update public.lounge_comments
     set is_hidden = p_hidden,
         hidden_by = case when p_hidden then v_uid else null end,
         hidden_at = case when p_hidden then now() else null end
   where id = p_comment_id;
  insert into public.operator_action_logs(actor_id, actor_role, action, target_type, target_id, detail)
  values (v_uid, v_role, case when p_hidden then 'HIDE_COMMENT' else 'UNHIDE_COMMENT' end, 'lounge_comment', p_comment_id, null);
end; $$;
grant execute on function public.op_set_comment_hidden(uuid, boolean, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select position('auth.uid()' in pg_get_functiondef('public.op_set_comment_hidden(uuid,boolean,uuid)'::regprocedure)) > 0 as comment_hidden_token_ok;
