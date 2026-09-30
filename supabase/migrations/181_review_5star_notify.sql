-- ============================================================
--  Migration 181: 별 5개 후기 → 업체 주인에게 «⭐ 후기 카드로 만들기» 알림(한 번)
--  Supabase SQL Editor 에서 실행하세요. 여러 번 실행해도 안전합니다.
--
--  · 고객이 쓴 별 5개 후기만(업체가 고객에게 쓴 평가는 빼고) · 숨김 후기는 빼고
--  · 같은 업체는 하루(한국 날짜)에 한 번까지 — 후기가 여러 개 와도 알림은 하나
--  · 알림함은 언제나, 푸시는 한국 9~21시 + 푸시 켬인 사람만(광고 아님 — 내 업체 소식)
--  · 후기 저장을 절대 막지 않는다(알림이 실패해도 넘어감)
--  되돌리기: drop trigger if exists trg_review_5star_notify on public.reviews;
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public._review_5star_notify()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_owner uuid; v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_pref jsonb; v_title text := '⭐ 별 5개 후기를 받았어요'; v_msg text; v_j jsonb := to_jsonb(new);
begin
  begin
    if coalesce(new.rating, 0) <> 5 or new.company_id is null then return new; end if;
    if coalesce(v_j ->> 'reviewer_role', 'customer') = 'company' then return new; end if;
    if coalesce((v_j ->> 'is_hidden')::boolean, false) or coalesce((v_j ->> 'is_deleted')::boolean, false) then return new; end if;
    select owner_id into v_owner from public.companies where id = new.company_id;
    if v_owner is null then return new; end if;
    if exists (select 1 from public.notifications n
                where n.user_id = v_owner and n.type = 'REVIEW_5STAR'
                  and (n.created_at at time zone 'Asia/Seoul')::date = v_today) then
      return new;
    end if;
    v_msg := '«' || left(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'), 24)
             || case when length(coalesce(new.content, '')) > 24 then '…' else '' end
             || '» — 후기 카드로 만들어 손님께 보여 주세요';
    insert into public.notifications (user_id, type, title, message, related_id, related_type, priority)
    values (v_owner, 'REVIEW_5STAR', v_title, v_msg, new.company_id, 'company', 'NORMAL');
    if v_hour >= 9 and v_hour < 21 then
      select to_jsonb(p) into v_pref from public.push_preferences p where p.user_id = v_owner;
      if coalesce((v_pref ->> 'push_enabled')::boolean, false) then
        insert into public.push_logs (user_id, type, title, body, target_url, related_id, status)
        values (v_owner, 'REVIEW_5STAR', v_title, v_msg, '/?open=review-card', new.id::text || ':5star', 'queued')
        on conflict do nothing;
      end if;
    end if;
  exception when others then null;   -- 후기 저장은 막지 않는다
  end;
  return new;
end; $$;

drop trigger if exists trg_review_5star_notify on public.reviews;
create trigger trg_review_5star_notify
  after insert on public.reviews
  for each row execute function public._review_5star_notify();

-- 확인: true 면 끝
select exists (select 1 from pg_trigger where tgname = 'trg_review_5star_notify' and not tgisinternal) as review_5star_ok;
