-- ════════════════════════════════════════════════════════════════════
-- 024_lounge_seed_quality.sql
-- [라운지] 운영(seed) 글 퀄리티 2차 개선.
--   1) 제목 후킹 강화(SEO 키워드 유지 + 클릭 유도, 과장/공포마케팅 금지)
--   2) 카드 첫 문장(본문 도입) 후킹 강화 — 문제 제기 + 공감 + 읽을 이유
--   3) 시드 댓글을 사람냄새 나는 반응(공감/경험/질문/실수담/저장)으로 교체
--   · comment_count 동기화 트리거 + 조회수 RPC 재확인(멱등)
--
-- 선행: 019 → 020 → 021 → 022 → 023 실행 후 마지막에 실행.
--   (023 보강은 옛 제목 기준이라 023 이후에 본 마이그레이션의 제목 변경이 적용돼야 함)
-- 멱등: 제목/첫문장은 옛 값이 남아 있을 때만 변경, 댓글은 seed 댓글 전체 교체.
-- Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 0) 인프라 재확인(멱등) — 조회수 RPC + 댓글수 동기화 트리거
create or replace function public.increment_lounge_view(p_post_id uuid)
returns void language sql as $$
  update public.lounge_posts set view_count = coalesce(view_count,0)+1 where id = p_post_id;
$$;

create or replace function public.sync_lounge_comment_count()
returns trigger language plpgsql as $$
declare pid uuid;
begin
  pid := coalesce(new.post_id, old.post_id);
  update public.lounge_posts p set comment_count = (
    select count(*) from public.lounge_comments c
     where c.post_id = pid
       and coalesce(c.is_deleted,false)=false
       and coalesce(c.is_hidden,false)=false
  ) where p.id = pid;
  return null;
end; $$;
drop trigger if exists trg_sync_lounge_comment_count on public.lounge_comments;
create trigger trg_sync_lounge_comment_count
  after insert or update or delete on public.lounge_comments
  for each row execute function public.sync_lounge_comment_count();

-- 1) 제목 후킹 강화 (옛 제목 → 새 제목)
update public.lounge_posts set title = E'20평·30평 인테리어 비용, 왜 예상보다 많이 나올까' where title = E'평수별 인테리어 비용 가이드' and is_seed = true;
update public.lounge_posts set title = E'도배 전에 이것만은 확인하세요, 안 그러면 다시 합니다' where title = E'도배 전 꼭 확인할 것' and is_seed = true;
update public.lounge_posts set title = E'욕실 공사, 순서 틀리면 타일을 다시 뜯습니다' where title = E'욕실 리모델링 순서' and is_seed = true;
update public.lounge_posts set title = E'처음 인테리어 맡길 때, 돈 떼일 걱정 줄이는 법' where title = E'공간마켓 사용법 (의뢰인)' and is_seed = true;
update public.lounge_posts set title = E'견적은 많이 쓰는데 계약이 안 된다면' where title = E'공간마켓 사용법 (업체)' and is_seed = true;
update public.lounge_posts set title = E'공사비 먼저 주기 불안하다면 알아둘 것, 에스크로' where title = E'에스크로란 무엇인가요' and is_seed = true;
update public.lounge_posts set title = E'가장 싼 견적이 가장 비싸지는 이유' where title = E'견적 비교 잘하는 법' and is_seed = true;
update public.lounge_posts set title = E'후기 좋은 업체인데 왜 후회할까' where title = E'시공업체 고르는 기준' and is_seed = true;
update public.lounge_posts set title = E'인테리어 분쟁, 대부분 계약서에서 갈립니다' where title = E'계약서 꼭 확인할 항목' and is_seed = true;
update public.lounge_posts set title = E'인테리어 실패, 매번 비슷한 데서 터집니다' where title = E'인테리어 실패 사례 TOP5' and is_seed = true;
update public.lounge_posts set title = E'장마 시작되고 후회하기 전에 봐야 할 것' where title = E'여름 장마 전 필수 공사' and is_seed = true;
update public.lounge_posts set title = E'신축 입주, 순서 잘못 잡으면 가구를 다시 옮깁니다' where title = E'신축 입주 인테리어 순서' and is_seed = true;
update public.lounge_posts set title = E'강마루·강화마루·장판·타일, 우리 집엔 뭐가 맞을까' where title = E'바닥재 종류별 장단점' and is_seed = true;
update public.lounge_posts set title = E'벽지 vs 페인트, 싸다고 골랐다 후회하는 경우' where title = E'벽지 vs 페인트 비교' and is_seed = true;
update public.lounge_posts set title = E'주방 리모델링, 어디에 돈 써야 후회 없을까' where title = E'주방 리모델링 비용 가이드' and is_seed = true;
update public.lounge_posts set title = E'욕실 타일 셀프, 어디까지 직접 해도 될까' where title = E'욕실 타일 셀프 교체 가능?' and is_seed = true;
update public.lounge_posts set title = E'상가 인테리어, 디자인보다 먼저 확인할 것' where title = E'상가 인테리어 주의사항' and is_seed = true;
update public.lounge_posts set title = E'별점 말고 공간온도, 업체 신뢰는 이걸로 봅니다' where title = E'공간온도란 무엇인가요' and is_seed = true;
update public.lounge_posts set title = E'보증금, 수수료인 줄 알았는데 돌려받는 돈입니다' where title = E'보증금이 왜 필요한가요' and is_seed = true;
update public.lounge_posts set title = E'안전결제, 실제로 써보니 뭐가 달랐을까' where title = E'공간안전결제 이용 후기' and is_seed = true;

-- 2) 카드 첫 문장(본문 도입) 후킹 강화
update public.lounge_posts set content = replace(content, E'인테리어를 처음 알아볼 때 가장 막막한 건 "우리 집은 도대체 얼마가 드는 걸까"입니다.', E'같은 30평인데 견적이 2천만 원씩 차이 나는 데는 분명한 이유가 있습니다.') where title = E'20평·30평 인테리어 비용, 왜 예상보다 많이 나올까' and is_seed = true and content like '%' || E'인테리어를 처음 알아볼 때 가장 막막한 건 "우리 집은 도대체 얼마가 드는 걸까"입니다.' || '%';
update public.lounge_posts set content = replace(content, E'도배는 인테리어에서 가장 만족도가 큰 공사 중 하나입니다.', E'벽지만 잘 고르면 될 줄 알았는데, 정작 가장 후회하는 건 따로 있습니다.') where title = E'도배 전에 이것만은 확인하세요, 안 그러면 다시 합니다' and is_seed = true and content like '%' || E'도배는 인테리어에서 가장 만족도가 큰 공사 중 하나입니다.' || '%';
update public.lounge_posts set content = replace(content, E'욕실은 좁지만 방수·설비·타일·전기가 모두 얽힌, 집에서 가장 까다로운 공간입니다.', E'욕실은 예쁘게보다 순서가 먼저입니다. 한 번 꼬이면 멀쩡한 타일도 다시 뜯는 경우가 있습니다.') where title = E'욕실 공사, 순서 틀리면 타일을 다시 뜯습니다' and is_seed = true and content like '%' || E'욕실은 좁지만 방수·설비·타일·전기가 모두 얽힌, 집에서 가장 까다로운 공간입니다.' || '%';
update public.lounge_posts set content = replace(content, E'처음 인테리어를 맡기는 분들이 가장 불안해하는 건 "돈은 먼저 줬는데 공사가 제대로 될까"입니다.', E'공사비를 먼저 보내고 나서 마음 졸인 경험, 생각보다 많은 분들이 합니다.') where title = E'처음 인테리어 맡길 때, 돈 떼일 걱정 줄이는 법' and is_seed = true and content like '%' || E'처음 인테리어를 맡기는 분들이 가장 불안해하는 건 "돈은 먼저 줬는데 공사가 제대로 될까"입니다.' || '%';
update public.lounge_posts set content = replace(content, E'좋은 업체일수록 "견적은 많이 쓰는데 계약으로 이어지지 않는다"는 고민을 합니다.', E'가격을 더 낮춰도 계약이 안 된다면, 문제는 가격이 아닐 수 있습니다.') where title = E'견적은 많이 쓰는데 계약이 안 된다면' and is_seed = true and content like '%' || E'좋은 업체일수록 "견적은 많이 쓰는데 계약으로 이어지지 않는다"는 고민을 합니다.' || '%';
update public.lounge_posts set content = replace(content, E'인테리어 거래에서 가장 흔한 불안은 "선금을 줬는데 공사가 멈추면 어떡하지"입니다.', E'선금을 한 번에 보내고 나면 그때부터 마음이 편치 않습니다.') where title = E'공사비 먼저 주기 불안하다면 알아둘 것, 에스크로' and is_seed = true and content like '%' || E'인테리어 거래에서 가장 흔한 불안은 "선금을 줬는데 공사가 멈추면 어떡하지"입니다.' || '%';
update public.lounge_posts set content = replace(content, E'견적서를 여러 장 받아 들면 대부분 가장 먼저 "총액"을 봅니다.', E'견적서를 여러 장 받아도 총액만 보면 진짜 비교가 되지 않습니다.') where title = E'가장 싼 견적이 가장 비싸지는 이유' and is_seed = true and content like '%' || E'견적서를 여러 장 받아 들면 대부분 가장 먼저 "총액"을 봅니다.' || '%';
update public.lounge_posts set content = replace(content, E'인테리어의 성패는 대부분 "어떤 업체를 고르느냐"에서 결정됩니다.', E'완성 사진이 멋지다고 해서 좋은 업체인 것은 아닙니다.') where title = E'후기 좋은 업체인데 왜 후회할까' and is_seed = true and content like '%' || E'인테리어의 성패는 대부분 "어떤 업체를 고르느냐"에서 결정됩니다.' || '%';
update public.lounge_posts set content = replace(content, E'인테리어 분쟁의 상당수는 "계약서를 제대로 쓰지 않아서" 생깁니다.', E'‘그건 당연히 해주는 줄 알았다’가 분쟁의 가장 흔한 시작입니다.') where title = E'인테리어 분쟁, 대부분 계약서에서 갈립니다' and is_seed = true and content like '%' || E'인테리어 분쟁의 상당수는 "계약서를 제대로 쓰지 않아서" 생깁니다.' || '%';
update public.lounge_posts set content = replace(content, E'인테리어는 한 번에 큰돈이 들어가는 만큼, 실패하면 금전적으로도 심리적으로도 타격이 큽니다.', E'실패담은 다 달라 보여도 원인은 놀랄 만큼 비슷합니다.') where title = E'인테리어 실패, 매번 비슷한 데서 터집니다' and is_seed = true and content like '%' || E'인테리어는 한 번에 큰돈이 들어가는 만큼, 실패하면 금전적으로도 심리적으로도 타격이 큽니다.' || '%';
update public.lounge_posts set content = replace(content, E'장마는 집의 약한 곳을 가장 먼저 드러냅니다.', E'비가 길어지면 평소 멀쩡하던 집의 약한 곳이 한꺼번에 드러납니다.') where title = E'장마 시작되고 후회하기 전에 봐야 할 것' and is_seed = true and content like '%' || E'장마는 집의 약한 곳을 가장 먼저 드러냅니다.' || '%';
update public.lounge_posts set content = replace(content, E'새 아파트에 입주할 때 "어차피 새 집인데 뭘 더 하나" 싶지만, 입주 전에 해두면 좋은 작업들이 분명히 있습니다.', E'새 집이라 안심했다가 순서 때문에 해둔 작업을 다시 만지는 일이 생깁니다.') where title = E'신축 입주, 순서 잘못 잡으면 가구를 다시 옮깁니다' and is_seed = true and content like '%' || E'새 아파트에 입주할 때 "어차피 새 집인데 뭘 더 하나" 싶지만, 입주 전에 해두면 좋은 작업들이 분명히 있습니다.' || '%';
update public.lounge_posts set content = replace(content, E'바닥재는 한 번 깔면 오래 쓰고, 집 전체의 분위기와 발에 닿는 사용감을 좌우합니다.', E'바닥재는 한 번 깔면 오래 쓰는데, 이름이 비슷해 고르기가 의외로 어렵습니다.') where title = E'강마루·강화마루·장판·타일, 우리 집엔 뭐가 맞을까' and is_seed = true and content like '%' || E'바닥재는 한 번 깔면 오래 쓰고, 집 전체의 분위기와 발에 닿는 사용감을 좌우합니다.' || '%';
update public.lounge_posts set content = replace(content, E'벽을 새로 단장할 때 가장 먼저 부딪히는 선택이 "벽지냐 페인트냐"입니다.', E'‘페인트가 더 싸겠지’ 하고 골랐다가 오히려 비용이 더 나오기도 합니다.') where title = E'벽지 vs 페인트, 싸다고 골랐다 후회하는 경우' and is_seed = true and content like '%' || E'벽을 새로 단장할 때 가장 먼저 부딪히는 선택이 "벽지냐 페인트냐"입니다.' || '%';
update public.lounge_posts set content = replace(content, E'주방은 집에서 사용 빈도가 가장 높은 공간이라 리모델링 만족도가 큰 편입니다.', E'매일 쓰는 주방은 작은 결정 하나가 몇 년의 만족을 좌우합니다.') where title = E'주방 리모델링, 어디에 돈 써야 후회 없을까' and is_seed = true and content like '%' || E'주방은 집에서 사용 빈도가 가장 높은 공간이라 리모델링 만족도가 큰 편입니다.' || '%';
update public.lounge_posts set content = replace(content, E'요즘은 셀프 인테리어 정보가 많아, 욕실 타일도 직접 해볼까 고민하는 분이 많습니다.', E'줄눈 정도는 직접 해볼 만하지만, 욕심내면 아랫집 누수로 번질 수 있습니다.') where title = E'욕실 타일 셀프, 어디까지 직접 해도 될까' and is_seed = true and content like '%' || E'요즘은 셀프 인테리어 정보가 많아, 욕실 타일도 직접 해볼까 고민하는 분이 많습니다.' || '%';
update public.lounge_posts set content = replace(content, E'상가 인테리어는 집과 완전히 다릅니다.', E'상가는 멋보다 ‘문제 없이 열고 깔끔하게 나오는 것’이 더 중요합니다.') where title = E'상가 인테리어, 디자인보다 먼저 확인할 것' and is_seed = true and content like '%' || E'상가 인테리어는 집과 완전히 다릅니다.' || '%';
update public.lounge_posts set content = replace(content, E'공간마켓에서 업체를 보다 보면 "공간온도"라는 숫자가 눈에 띕니다.', E'후기 몇 개로 만들어진 별점만 믿기엔 불안할 때가 있습니다.') where title = E'별점 말고 공간온도, 업체 신뢰는 이걸로 봅니다' and is_seed = true and content like '%' || E'공간마켓에서 업체를 보다 보면 "공간온도"라는 숫자가 눈에 띕니다.' || '%';
update public.lounge_posts set content = replace(content, E'서비스를 이용하다 보면 "보증금"이라는 단어에 거부감을 느끼기 쉽습니다.', E'‘또 돈 떼는 건가’ 싶었던 보증금, 알고 보면 다른 이야기입니다.') where title = E'보증금, 수수료인 줄 알았는데 돌려받는 돈입니다' and is_seed = true and content like '%' || E'서비스를 이용하다 보면 "보증금"이라는 단어에 거부감을 느끼기 쉽습니다.' || '%';
update public.lounge_posts set content = replace(content, E'안전결제가 좋다는 말은 많이 들어도, 실제로 어떤 차이를 만드는지는 직접 써본 사례를 봐야 와닿습니다.', E'제도 설명만으론 잘 안 와닿던 안전결제, 직접 써본 분들의 이야기를 모았습니다.') where title = E'안전결제, 실제로 써보니 뭐가 달랐을까' and is_seed = true and content like '%' || E'안전결제가 좋다는 말은 많이 들어도, 실제로 어떤 차이를 만드는지는 직접 써본 사례를 봐야 와닿습니다.' || '%';

-- 3) 시드 댓글 사람냄새 교체 — seed 글의 시드 댓글(user_id IS NULL)만 교체(실사용자 댓글 보존)
delete from public.lounge_comments
 where user_id is null
   and post_id in (select id from public.lounge_posts where is_seed = true);

with seed_c(title, nick, content, hrs) as (
  select * from (values
    (E'20평·30평 인테리어 비용, 왜 예상보다 많이 나올까', E'30평주부', E'저도 30평인데 견적 받아보고 깜짝 놀랐어요. 항목별로 보니 그제야 이해가 가더라고요.', 9),
    (E'20평·30평 인테리어 비용, 왜 예상보다 많이 나올까', E'집수리고민', E'샷시 포함이냐 아니냐로 몇백이 왔다갔다 하던데 이게 진짜 크네요.', 16),
    (E'20평·30평 인테리어 비용, 왜 예상보다 많이 나올까', E'예비신혼', E'예비비 얘기 공감해요. 저흰 안 잡아놨다가 중간에 좀 고생했어요ㅠ', 23),
    (E'20평·30평 인테리어 비용, 왜 예상보다 많이 나올까', E'견적초보', E'견적 받을 때 항목별로 나눠달라고 꼭 말해야겠네요. 저장해둡니다.', 30),
    (E'20평·30평 인테리어 비용, 왜 예상보다 많이 나올까', E'부분시공중', E'부분만 해도 된다는 거 보고 마음이 좀 놓였어요. 전체는 부담됐거든요.', 37),
    (E'도배 전에 이것만은 확인하세요, 안 그러면 다시 합니다', E'벽지고민', E'곰팡이 있는 벽에 그냥 발랐다가 반년 만에 다시 올라왔어요. 원인부터 잡아야 하네요.', 44),
    (E'도배 전에 이것만은 확인하세요, 안 그러면 다시 합니다', E'리모델링중', E'기존 벽지 제거 여부 안 물어봤다가 추가금 나온 적 있어요ㅠ', 51),
    (E'도배 전에 이것만은 확인하세요, 안 그러면 다시 합니다', E'아이둘맘', E'친환경 등급 잘 몰랐는데 아이 있는 집은 챙겨야겠네요.', 58),
    (E'도배 전에 이것만은 확인하세요, 안 그러면 다시 합니다', E'셀프관심', E'샘플이랑 실제 색 다르다는 거 진짜 공감... 넓으면 더 진해 보이더라고요.', 65),
    (E'도배 전에 이것만은 확인하세요, 안 그러면 다시 합니다', E'입주준비', E'가구 들이기 전에 도배부터. 메모했습니다.', 72),
    (E'욕실 공사, 순서 틀리면 타일을 다시 뜯습니다', E'욕실재시공', E'방수 먼저 안 보고 했다가 결국 다시 했어요ㅠ 건조 시간 진짜 중요해요.', 79),
    (E'욕실 공사, 순서 틀리면 타일을 다시 뜯습니다', E'물고임', E'구배 잘못 잡으면 물 안 빠진다는 거 경험했네요. 바닥에 늘 물 고였어요.', 86),
    (E'욕실 공사, 순서 틀리면 타일을 다시 뜯습니다', E'처음공사', E'담수 테스트라는 게 있는지도 몰랐어요. 다음엔 꼭 요청해야지.', 15),
    (E'욕실 공사, 순서 틀리면 타일을 다시 뜯습니다', E'곰팡이지긋', E'환풍기 용량 작으면 습기 안 빠지는 거 맞아요. 곰팡이 계속 생기더라고요.', 22),
    (E'욕실 공사, 순서 틀리면 타일을 다시 뜯습니다', E'저장러', E'순서대로 정리돼 있어서 이해 잘 됐어요. 저장!', 29),
    (E'처음 인테리어 맡길 때, 돈 떼일 걱정 줄이는 법', E'처음이라', E'선금 한 번에 안 줘도 된다는 거 보고 좀 안심됐어요.', 36),
    (E'처음 인테리어 맡길 때, 돈 떼일 걱정 줄이는 법', E'신중파', E'단계별로 사진 확인하고 승인하는 구조 좋네요. 마음이 편해요.', 43),
    (E'처음 인테리어 맡길 때, 돈 떼일 걱정 줄이는 법', E'막막했음', E'처음이라 뭐부터 해야 하나 막막했는데 흐름 정리돼서 도움됐어요.', 50),
    (E'처음 인테리어 맡길 때, 돈 떼일 걱정 줄이는 법', E'의심많음', E'외부 계좌로 달라는 데도 있던데 거절해도 된다니 다행이네요.', 57),
    (E'처음 인테리어 맡길 때, 돈 떼일 걱정 줄이는 법', E'견적비교', E'견적 비교 무료라는 거 몰랐어요. 부담 없이 받아봐야겠어요.', 64),
    (E'견적은 많이 쓰는데 계약이 안 된다면', E'소형업체', E'견적은 많이 쓰는데 계약이 안 돼서 고민이었는데 도움 되네요.', 71),
    (E'견적은 많이 쓰는데 계약이 안 된다면', E'인테리어사장', E'단계 정산이라 대금 떼일 걱정 줄겠어요. 이게 제일 큽니다.', 78),
    (E'견적은 많이 쓰는데 계약이 안 된다면', E'시공중', E'과정 사진 꾸준히 올리라는 거 맞는 말이에요. 신뢰가 다르더라고요.', 85),
    (E'견적은 많이 쓰는데 계약이 안 된다면', E'신규파트너', E'응답 속도가 지표로 쌓인다니 신경 써야겠네요.', 14),
    (E'견적은 많이 쓰는데 계약이 안 된다면', E'공간마켓', E'결국 가격보다 신뢰입니다. 작은 공사부터 기록 쌓아가시면 매칭이 늘어요.', 21),
    (E'공사비 먼저 주기 불안하다면 알아둘 것, 에스크로', E'불안했음', E'선금 보내고 나면 그때부터 불안했는데 이런 구조면 낫겠네요.', 28),
    (E'공사비 먼저 주기 불안하다면 알아둘 것, 에스크로', E'처음리모델링', E'계좌이체랑 뭐가 다른지 이제 이해됐어요.', 35),
    (E'공사비 먼저 주기 불안하다면 알아둘 것, 에스크로', E'신중소비', E'문제 생기면 정산 보류 된다는 게 든든하네요.', 42),
    (E'공사비 먼저 주기 불안하다면 알아둘 것, 에스크로', E'직거래거절', E'수수료 아깝다고 직거래 권하던데 위험한 거였군요ㅠ', 49),
    (E'공사비 먼저 주기 불안하다면 알아둘 것, 에스크로', E'이해완료', E'돈을 대행사가 보관한다는 거 알고 나니 안심돼요.', 56),
    (E'가장 싼 견적이 가장 비싸지는 이유', E'견적세장', E'총액만 봤다가 빠진 항목 때문에 낭패 본 적 있어요.', 63),
    (E'가장 싼 견적이 가장 비싸지는 이유', E'비교중', E'같은 조건으로 맞춰서 비교해야 한다는 거 진짜 공감해요.', 70),
    (E'가장 싼 견적이 가장 비싸지는 이유', E'최저가함정', E'제일 싼 데가 알고 보니 철거가 빠져 있더라고요...', 77),
    (E'가장 싼 견적이 가장 비싸지는 이유', E'꼼꼼파', E'추가비용 조건 모호한 곳은 거르라는 말 새겨둡니다.', 84),
    (E'가장 싼 견적이 가장 비싸지는 이유', E'표정리', E'비교표로 적어보니 확실히 정리되네요. 해봐야겠어요.', 13),
    (E'후기 좋은 업체인데 왜 후회할까', E'후회경험', E'완성 사진만 보고 골랐다가 후회한 적 있어요. 과정 사진이 중요하네요.', 20),
    (E'후기 좋은 업체인데 왜 후회할까', E'후기정독', E'별점보다 후기 내용 읽으라는 말 백번 맞아요.', 27),
    (E'후기 좋은 업체인데 왜 후회할까', E'재계약중요', E'재계약 후기 있는 데가 확실히 다르더라고요.', 34),
    (E'후기 좋은 업체인데 왜 후회할까', E'상담중', E'상담할 때 한계까지 솔직히 말해주는 곳이 믿음 갔어요.', 41),
    (E'후기 좋은 업체인데 왜 후회할까', E'저장함', E'공간온도랑 완료 건수 같이 봐야겠네요. 저장합니다.', 48),
    (E'인테리어 분쟁, 대부분 계약서에서 갈립니다', E'분쟁날뻔', E'‘당연히 해주겠지’ 했다가 분쟁 날 뻔했어요. 적는 게 답이네요.', 55),
    (E'인테리어 분쟁, 대부분 계약서에서 갈립니다', E'계약앞둠', E'추가비용 조건 꼭 적어달라고 해야겠어요.', 62),
    (E'인테리어 분쟁, 대부분 계약서에서 갈립니다', E'기록파', E'구두로 한 약속도 메시지로 남기라는 거 공감해요.', 69),
    (E'인테리어 분쟁, 대부분 계약서에서 갈립니다', E'하자경험', E'보증 기간 안 챙겼다가 하자 났을 때 곤란했어요ㅠ', 76),
    (E'인테리어 분쟁, 대부분 계약서에서 갈립니다', E'신중계약', E'제외 항목까지 적는다는 발상 좋네요. 참고할게요.', 83),
    (E'인테리어 실패, 매번 비슷한 데서 터집니다', E'뼈아픔', E'선금 과다... 저도 겪어봐서 뼈아프게 공감해요.', 12),
    (E'인테리어 실패, 매번 비슷한 데서 터집니다', E'말싸움', E'계약서 없이 진행했다가 말싸움만 했어요. 기록이 답이네요.', 19),
    (E'인테리어 실패, 매번 비슷한 데서 터집니다', E'점검중요', E'완료 전에 하자 목록 정리하라는 거 좋은 팁이네요.', 26),
    (E'인테리어 실패, 매번 비슷한 데서 터집니다', E'지연경험', E'일정 자꾸 밀려서 속 터졌던 기억이... 완공일 명시 중요해요.', 33),
    (E'인테리어 실패, 매번 비슷한 데서 터집니다', E'공감', E'다 비슷한 데서 터진다는 말 진짜 공감합니다.', 40),
    (E'장마 시작되고 후회하기 전에 봐야 할 것', E'매년곰팡이', E'매년 장마 때 곰팡이 때문에 고생인데 원인부터 봐야겠네요.', 47),
    (E'장마 시작되고 후회하기 전에 봐야 할 것', E'물샜음', E'베란다 실리콘 갈라진 거 방치했다가 물 샜어요ㅠ', 54),
    (E'장마 시작되고 후회하기 전에 봐야 할 것', E'제습파', E'비 오는 날 환기보다 제습이라는 거 의외네요. 해봐야지.', 61),
    (E'장마 시작되고 후회하기 전에 봐야 할 것', E'북향살이', E'결로 심한 창 단열 필름 한번 알아봐야겠어요.', 68),
    (E'장마 시작되고 후회하기 전에 봐야 할 것', E'미리점검', E'장마 전에 미리 점검하는 게 이득이네요. 저장해둡니다.', 75),
    (E'신축 입주, 순서 잘못 잡으면 가구를 다시 옮깁니다', E'가구먼저후회', E'가구부터 들였다가 도배할 때 다 옮기느라 고생했어요ㅠ', 82),
    (E'신축 입주, 순서 잘못 잡으면 가구를 다시 옮깁니다', E'새집입주', E'하자 점검 기간 놓치면 안 된다는 거 진짜 중요해요.', 11),
    (E'신축 입주, 순서 잘못 잡으면 가구를 다시 옮깁니다', E'청소마지막', E'입주청소를 마지막에 하라는 게 핵심이네요. 몰랐어요.', 18),
    (E'신축 입주, 순서 잘못 잡으면 가구를 다시 옮깁니다', E'콘센트후회', E'콘센트 위치 미리 안 정해서 다시 작업한 적 있어요.', 25),
    (E'신축 입주, 순서 잘못 잡으면 가구를 다시 옮깁니다', E'곧입주', E'순서대로 메모했어요. 곧 입주라 도움 많이 됐어요.', 32),
    (E'강마루·강화마루·장판·타일, 우리 집엔 뭐가 맞을까', E'헷갈렸음', E'강마루랑 강화마루 차이 늘 헷갈렸는데 이제 알겠어요.', 39),
    (E'강마루·강화마루·장판·타일, 우리 집엔 뭐가 맞을까', E'강아지집사', E'강아지 키우는데 스크래치 때문에 강화마루 봐야겠네요.', 46),
    (E'강마루·강화마루·장판·타일, 우리 집엔 뭐가 맞을까', E'장판재발견', E'장판도 요즘 괜찮다던데 다시 보게 되네요.', 53),
    (E'강마루·강화마루·장판·타일, 우리 집엔 뭐가 맞을까', E'난방파', E'난방 자주 쓰면 강마루가 유리하군요. 참고할게요.', 60),
    (E'강마루·강화마루·장판·타일, 우리 집엔 뭐가 맞을까', E'소음경험', E'자재보다 시공이라는 말 공감해요. 평탄 작업 부실하면 소리나더라고요.', 67),
    (E'벽지 vs 페인트, 싸다고 골랐다 후회하는 경우', E'의외', E'페인트가 싸겠지 했는데 벽 상태 나쁘면 더 든다니 의외네요.', 74),
    (E'벽지 vs 페인트, 싸다고 골랐다 후회하는 경우', E'아이방', E'아이 방은 보수 쉬운 쪽이 낫겠어요. 낙서가 많아서ㅎ', 81),
    (E'벽지 vs 페인트, 싸다고 골랐다 후회하는 경우', E'혼합관심', E'포인트 벽만 페인트로 섞어도 된다는 거 좋네요.', 10),
    (E'벽지 vs 페인트, 싸다고 골랐다 후회하는 경우', E'입주급함', E'벽지가 시공 빠르다고 하니 입주 급한 저한텐 맞겠어요.', 17),
    (E'벽지 vs 페인트, 싸다고 골랐다 후회하는 경우', E'등급체크', E'둘 다 친환경 등급 본다는 거 메모했어요.', 24),
    (E'주방 리모델링, 어디에 돈 써야 후회 없을까', E'도어만교체', E'구조 그대로 두고 도어만 바꿔도 된다는 거 보고 마음 놓였어요.', 31),
    (E'주방 리모델링, 어디에 돈 써야 후회 없을까', E'콘센트부족', E'콘센트 항상 부족했는데 미리 정해야겠네요.', 38),
    (E'주방 리모델링, 어디에 돈 써야 후회 없을까', E'동선공감', E'동선부터 그려보라는 말 진짜 공감해요. 매일 쓰니까요.', 45),
    (E'주방 리모델링, 어디에 돈 써야 후회 없을까', E'상판후회', E'상판은 너무 아끼지 말라는 거 경험상 맞아요.', 52),
    (E'주방 리모델링, 어디에 돈 써야 후회 없을까', E'후드메모', E'후드 배기 경로 짧아야 냄새 잘 빠진다는 거 메모!', 59),
    (E'욕실 타일 셀프, 어디까지 직접 해도 될까', E'줄눈셀프', E'줄눈은 직접 해봤는데 할 만하더라고요.', 66),
    (E'욕실 타일 셀프, 어디까지 직접 해도 될까', E'방수무서움', E'전체는 방수 때문에 무서워서 못 하겠어요ㅠ', 73),
    (E'욕실 타일 셀프, 어디까지 직접 해도 될까', E'공구값', E'공구값 생각하면 부분만 셀프가 낫겠네요.', 80),
    (E'욕실 타일 셀프, 어디까지 직접 해도 될까', E'단종경험', E'단종 타일이라 같은 거 못 구한 적 있어요... 미리 확인하세요.', 9),
    (E'욕실 타일 셀프, 어디까지 직접 해도 될까', E'기준명확', E'보수는 셀프, 방수는 전문가. 기준 명확해서 좋네요.', 16),
    (E'상가 인테리어, 디자인보다 먼저 확인할 것', E'원상복구고생', E'원상복구 조건 모르고 철거했다가 나갈 때 고생했어요ㅠ', 23),
    (E'상가 인테리어, 디자인보다 먼저 확인할 것', E'오픈밀림', E'소방 기준 안 맞아서 오픈 밀린 적 있어요. 미리 확인하세요.', 30),
    (E'상가 인테리어, 디자인보다 먼저 확인할 것', E'자영업', E'임대료 나가니까 공기 단축이 곧 돈이라는 말 뼈저리게 공감해요.', 37),
    (E'상가 인테리어, 디자인보다 먼저 확인할 것', E'간판몰랐음', E'간판도 건물 기준 봐야 한다는 거 몰랐네요.', 44),
    (E'상가 인테리어, 디자인보다 먼저 확인할 것', E'창업준비', E'창업 준비 중인데 정리 잘 돼서 도움 많이 됐어요.', 51),
    (E'별점 말고 공간온도, 업체 신뢰는 이걸로 봅니다', E'별점불안', E'별점만 믿기 불안했는데 이런 지표가 있군요.', 58),
    (E'별점 말고 공간온도, 업체 신뢰는 이걸로 봅니다', E'완료건수', E'완료 건수랑 같이 보면 되겠네요.', 65),
    (E'별점 말고 공간온도, 업체 신뢰는 이걸로 봅니다', E'천천히', E'천천히 오른다는 게 오히려 믿음 가요.', 72),
    (E'별점 말고 공간온도, 업체 신뢰는 이걸로 봅니다', E'신생업체', E'신생 업체라고 무조건 거를 필요 없다는 말 공감해요.', 79),
    (E'별점 말고 공간온도, 업체 신뢰는 이걸로 봅니다', E'저장', E'광고보다 쌓인 데이터가 낫죠. 저장합니다.', 86),
    (E'보증금, 수수료인 줄 알았는데 돌려받는 돈입니다', E'거부감있었음', E'수수료인 줄 알고 거부감 있었는데 돌려받는 거였군요.', 15),
    (E'보증금, 수수료인 줄 알았는데 돌려받는 돈입니다', E'안심', E'법인계좌 분리 보관이라니 좀 안심되네요.', 22),
    (E'보증금, 수수료인 줄 알았는데 돌려받는 돈입니다', E'개인계좌주의', E'개인계좌로 달라면 거절해야겠어요. 몰랐네요.', 29),
    (E'보증금, 수수료인 줄 알았는데 돌려받는 돈입니다', E'부담덜', E'성실히 하면 100% 반환이라니 부담이 덜해요.', 36),
    (E'보증금, 수수료인 줄 알았는데 돌려받는 돈입니다', E'오해풀림', E'오해 풀려서 좋네요. 정리 감사합니다.', 43),
    (E'안전결제, 실제로 써보니 뭐가 달랐을까', E'마음놓임', E'단계마다 확인하니 마음 놓였다는 말 진짜 공감해요.', 50),
    (E'안전결제, 실제로 써보니 뭐가 달랐을까', E'든든', E'선금 한 번에 안 줘서 든든했어요.', 57),
    (E'안전결제, 실제로 써보니 뭐가 달랐을까', E'기록덕분', E'분쟁 났을 때 기록 있으니까 대화가 되더라고요.', 64),
    (E'안전결제, 실제로 써보니 뭐가 달랐을까', E'잘한선택', E'직거래 유도 거절한 게 결과적으로 잘한 거였어요.', 71),
    (E'안전결제, 실제로 써보니 뭐가 달랐을까', E'와닿음', E'제도 설명보다 실제 후기가 훨씬 와닿네요.', 78)
  ) as v(title, nick, content, hrs)
)
insert into public.lounge_comments (post_id, user_id, anonymous_nickname, content, is_expert_reply, created_at)
select p.id, null, sc.nick, sc.content, false, now() - (sc.hrs || ' hours')::interval
from seed_c sc
join public.lounge_posts p on p.title = sc.title and p.is_seed = true;

-- 4) comment_count 백필 (트리거가 처리하지만 안전하게 한 번 더)
update public.lounge_posts p
   set comment_count = (
     select count(*) from public.lounge_comments c
      where c.post_id = p.id
        and coalesce(c.is_deleted,false)=false
        and coalesce(c.is_hidden,false)=false
   )
 where p.is_seed = true;
