-- ============================================================
--  Migration 177: 홈 «📸 우리 동네 최근 완공» — 우리 구(적으면 시) 최근 30일 좋은 후기의 완공 사진
--  Supabase SQL Editor 에서 한 번만 실행하세요. 여러 번 실행해도 안전합니다.
--
--  · 이미 공개된 것만: 업체 페이지·후기 목록에 보이는 공간마켓 후기(숨김·삭제 제외 · 고객 → 업체 후기)의 «공사 후» 사진
--  · 별 4개 이상 · 최근 30일 · 최대 6장 · 고객 이름·연락처·정확한 주소는 돌려주지 않는다(동네 이름·공간·업체 이름만)
--  · 로그인 없이도 부를 수 있다(홈은 둘러보기 손님에게도 보인다)
--  되돌리기: drop function if exists public.region_done_photos(text);
--  확인 칸 1개(맨 아래 select) — true 면 끝.
-- ============================================================

set search_path = public, extensions;

create or replace function public.region_done_photos(p_region text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  v_region text := trim(coalesce(p_region, ''));
  v_city text := nullif(split_part(v_region, ' ', 1), '');
  v_dist text := nullif(case when position(' ' in v_region) > 0 then regexp_replace(v_region, '^.*\s', '') end, '');
  v_pat text; v_label text; v_n int; v_items jsonb;
begin
  if v_city is null or char_length(v_region) > 40 then return jsonb_build_object('ok', false); end if;

  -- 구 먼저, 2장 안 되면 시
  foreach v_pat in array array_remove(array[v_dist, v_city], null) loop
    select count(*) into v_n from public.reviews r
     where r.created_at > now() - interval '30 days'
       and coalesce(r.region, '') ilike '%' || v_pat || '%'
       and coalesce(r.is_hidden, false) = false and coalesce(r.is_deleted, false) = false
       and coalesce(r.status, 'published') not in ('REJECTED', 'HIDDEN', 'hidden', 'rejected')
       and coalesce(r.reviewer_role, 'customer') = 'customer'
       and coalesce(r.rating, 0) >= 4
       and coalesce(array_length(r.after_image_urls, 1), 0) > 0;
    if v_n >= 2 then v_label := v_pat; exit; end if;
  end loop;
  if v_label is null then return jsonb_build_object('ok', true, 'label', coalesce(v_dist, v_city), 'items', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'photo', t.photo, 'space', t.space_type, 'rating', t.rating,
           'company_id', t.company_id, 'company', t.company, 'slug', t.slug) order by t.created_at desc), '[]'::jsonb)
    into v_items
    from (
      select r.id, r.after_image_urls[1] as photo, r.space_type, r.rating, r.created_at,
             r.company_id, c.name as company, to_jsonb(c) ->> 'slug' as slug
        from public.reviews r
        left join public.companies c on c.id = r.company_id
       where r.created_at > now() - interval '30 days'
         and coalesce(r.region, '') ilike '%' || v_label || '%'
         and coalesce(r.is_hidden, false) = false and coalesce(r.is_deleted, false) = false
         and coalesce(r.status, 'published') not in ('REJECTED', 'HIDDEN', 'hidden', 'rejected')
         and coalesce(r.reviewer_role, 'customer') = 'customer'
         and coalesce(r.rating, 0) >= 4
         and coalesce(array_length(r.after_image_urls, 1), 0) > 0
       order by r.created_at desc
       limit 6
    ) t;
  return jsonb_build_object('ok', true, 'label', v_label, 'items', v_items);
end; $$;
grant execute on function public.region_done_photos(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: true 면 끝
select exists (select 1 from pg_proc where proname = 'region_done_photos') as region_photos_ok;
