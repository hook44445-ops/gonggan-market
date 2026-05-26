-- ============================================================
--  Migration 002: lounge_posts seed 게시글
--  Supabase SQL Editor에서 한 번만 실행하세요.
--  is_seed 컬럼 추가 + 초기 활성화용 게시글 25개 삽입.
-- ============================================================

-- 1. is_seed 컬럼 추가 (idempotent)
alter table public.lounge_posts
  add column if not exists is_seed boolean not null default false;

-- 2. 정렬 최적화 인덱스 (is_seed asc, created_at desc)
create index if not exists lounge_posts_seed_order_idx
  on public.lounge_posts (is_seed asc, created_at desc);

-- 3. Seed 게시글 삽입 (seed가 없을 때만 실행)
do $$
begin
  if (select count(*) from public.lounge_posts where is_seed = true) < 5 then

    insert into public.lounge_posts (
      user_id, anonymous_nickname, category, title, content,
      image_urls, gender, age_group, region,
      is_story, is_seed, view_count, like_count, comment_count,
      has_badge, is_deleted, is_hidden, created_at
    ) values

    -- ── 인테리어 ───────────────────────────────────────────
    (null, '공간러123', 'interior',
     '24평 도배 비용 보통 얼마 나올까요?',
     '32평 아파트 계약했는데 전 세입자가 도배를 엉망으로 해놔서 입주 전에 다 뜯고 새로 하려고요. 도배+장판 견적 받으려는데 감이 없어서요. 업체마다 차이가 크다고 하던데 대략 어느 정도 예상하면 될까요? 경험 있으신 분들 조언 부탁드려요.',
     ARRAY[]::text[], null, '30대', '마포구',
     false, true, 1420, 52, 18, false, false, false, now() - interval '8 days'),

    (null, '리모델링중', 'interior',
     '욕실 리모델링 전에 꼭 확인할 것들',
     '올해 욕실 두 곳 리모델링 했습니다. 1. 방수 공사를 업체가 직접 하는지 외주인지 꼭 물어보세요. 2. 환풍기 위치 미리 정하고 들어가야 해요. 3. 타일 패턴은 실물 샘플 보고 결정하세요, 사진과 실물 색 차이가 꽤 납니다. 나중에 알게 돼서 후회한 것들이에요.',
     ARRAY['https://picsum.photos/seed/lounge02/800/600'], 'female', '40대', '송파구',
     false, true, 2100, 78, 31, false, false, false, now() - interval '5 days'),

    (null, '마포거주민', 'interior',
     '주방 교체하고 제일 후회한 포인트',
     '작년에 싱크대+상판 교체 다 했는데 끝나고 가장 후회하는 건 상단 장 높이입니다. 키 165cm인데 위에 장이 너무 높아서 잘 못 써요. 업체에서 표준으로 해준다고 해서 그냥 맡겼더니 이렇게 됐어요. 키 작으신 분들은 설치 전에 꼭 높이 확인하세요.',
     ARRAY[]::text[], 'female', '30대', '마포구',
     false, true, 1680, 64, 25, false, false, false, now() - interval '12 days'),

    (null, '집꾸러미', 'interior',
     '셀프인테리어 vs 업체 시공 솔직 후기',
     '두 번 이사하면서 하나는 셀프, 하나는 업체 맡겼어요. 비용은 셀프가 절반 이하인데 마감 차이가 납니다. 특히 도배 이음새, 바닥 모서리 마감은 차이가 확연해요. 지금은 기초 공사는 업체, 소품과 소규모 꾸미기는 셀프로 나눠서 하는 중이에요.',
     ARRAY[]::text[], null, '30대', null,
     false, true, 980, 43, 19, false, false, false, now() - interval '15 days'),

    (null, '인테리어초보', 'interior',
     '견적 받을 때 꼭 물어봐야 하는 질문 5가지',
     '인테리어 처음이라 견적 받을 때 뭘 물어봐야 할지 몰라서 업체한테 끌려다녔어요. 이제는 꼭 이 5가지 물어봐요. 1. 자재 포함 여부, 2. 철거·폐기물 처리 비용, 3. 공사 기간, 4. AS 범위, 5. 잔금 지불 시점. 추가 비용으로 분쟁 나는 경우 대부분 이 부분 때문이에요.',
     ARRAY[]::text[], null, '20대', '강동구',
     false, true, 1850, 91, 34, false, false, false, now() - interval '3 days'),

    (null, '층소음고민', 'interior',
     '층간소음 줄이는 바닥재 실제 효과 있나요?',
     '아래층 민원이 있어서 기능성 바닥재로 교체를 고민 중이에요. 업체에서는 층간소음 저감 기능성 마루라고 하는데 실제로 효과가 있는지 궁금해요. 교체해보신 분들 실제 체감이 어떤지 알고 싶어요. 가격 차이가 많이 나서 신중하게 결정하고 싶어요.',
     ARRAY['https://picsum.photos/seed/lounge21/800/600'], null, '40대', '노원구',
     false, true, 1150, 54, 26, false, false, false, now() - interval '9 days'),

    (null, '부분교체중', 'interior',
     '싱크대 상판만 교체 가능한가요?',
     '싱크대 본체는 멀쩡한데 상판이 노후돼서 바꾸고 싶어요. 업체에서는 상판만은 안 한다는 곳도 있고, 된다는 곳도 있어서요. 가능하다면 비용은 어느 정도 나올지도 궁금합니다. 해보신 분 있으면 경험 공유 부탁드려요.',
     ARRAY[]::text[], null, '50대+', null,
     false, true, 520, 25, 13, false, false, false, now() - interval '14 days'),

    -- ── 집꾸미기 ───────────────────────────────────────────
    (null, '우리집꿈', 'room_deco',
     '작은 거실 넓어 보이게 하는 배치 방법',
     '22평에 살면서 거실이 답답해 보여서 이것저것 시도해봤어요. 제일 효과 있었던 건 TV장 없애고 벽걸이 TV로 바꾼 것. 바닥이 훤히 보이니까 확실히 넓어 보여요. 소파를 창문 쪽에서 조금 당겨서 뒤 공간 만드는 것도 도움됐어요.',
     ARRAY['https://picsum.photos/seed/lounge06/800/600'], 'female', '30대', '관악구',
     false, true, 740, 37, 14, false, false, false, now() - interval '9 days'),

    (null, '화이트홈', 'room_deco',
     '화이트톤 집 3년 살면서 알게 된 관리 팁',
     '화이트 도배에 화이트 바닥 조합으로 입주했는데 아이 키우면서 관리 포인트 생긴 게 있어요. 벽 아랫쪽은 반광 페인트가 낫고, 패브릭은 러그·커튼만 포인트 색 써도 충분해요. 화이트 패브릭 소파는 패브릭 전용 스프레이 세트 하나는 기본으로 갖추세요.',
     ARRAY[]::text[], 'female', '30대', '성동구',
     false, true, 560, 29, 11, false, false, false, now() - interval '18 days'),

    (null, '조명바꿈', 'room_deco',
     '조명 하나로 집 분위기 완전히 바뀐 후기',
     '주방 식탁 위 조명만 펜던트로 바꿨는데 사람들이 집 다 바꿨냐고 물어봐요. 비용 15만원짜리 조명인데요. 흰 형광등에서 노란 간접 조명으로 바꾸는 것만으로 분위기가 이렇게 달라지는지 몰랐어요. 침실도 스탠드 추가했더니 잠도 더 잘 자는 것 같아요.',
     ARRAY['https://picsum.photos/seed/lounge08/800/600'], 'female', '20대', '마포구',
     false, true, 1120, 58, 22, false, false, false, now() - interval '7 days'),

    (null, '원룸생활자', 'room_deco',
     '원룸 수납 아이디어 정리',
     '원룸 3년째 사는데 공간 활용 쪽으로는 나름 전문가가 됐어요. 침대 아래 수납박스가 제일 효율적이고, 벽면 선반은 꼭 앵커로 고정하세요. 현관에 키 큰 신발장 놓으면 공간 두 배로 씁니다. 책상 밑에 미니서랍 달기도 강추해요.',
     ARRAY[]::text[], null, '20대', '서대문구',
     false, true, 430, 22, 9, false, false, false, now() - interval '20 days'),

    (null, '이케아마니아', 'room_deco',
     'IKEA 제품으로 집 꾸민 조합 공유',
     '이케아 제품만으로 거실 꾸민 지 2년됐어요. 핵심은 큰 가구는 이케아, 소품은 국산·수입 섞기예요. KALLAX 선반 + 패브릭 박스 조합이 원가 대비 제일 만족스럽고, PAX 옷장은 옵션 조합에 따라 완성도가 크게 달라요. 아무거나 사면 후회하는 아이템도 공유할게요.',
     ARRAY['https://picsum.photos/seed/lounge22/800/600'], 'female', '30대', '용산구',
     false, true, 890, 47, 20, false, false, false, now() - interval '6 days'),

    -- ── 고민 ───────────────────────────────────────────────
    (null, '견적고민중', 'worry',
     '업체 견적이 너무 차이날 때 어떻게 비교하세요?',
     '같은 공사 내용으로 세 곳 견적 받았는데 170만원에서 420만원까지 차이가 나요. 이 차이가 자재 차이인지, 마진 차이인지 구분이 안 돼서요. 경험 있으신 분들은 어떻게 비교하셨어요? 항목별로 단가 따로 물어봐야 하나요?',
     ARRAY[]::text[], null, '30대', null,
     false, true, 890, 46, 28, false, false, false, now() - interval '6 days'),

    (null, '후기의심자', 'worry',
     '업체 후기 어디까지 믿으세요?',
     '요즘 플랫폼 후기들 보면 너무 좋은 것들만 있어서 의심가거든요. 저만 그런 건지... 실제로 업체 선택할 때 후기 외에 어떤 기준으로 거르세요? 포트폴리오 직접 물어보시나요? 현장 방문 요청도 해보셨어요?',
     ARRAY[]::text[], null, '40대', null,
     false, true, 720, 33, 24, false, false, false, now() - interval '11 days'),

    (null, '이사앞둔집', 'worry',
     '공사 일정 지연 경험 있으신가요?',
     '3주 공사 예정이었는데 현재 5주째입니다. 업체 말로는 자재 입고 지연이라는데 믿어야 할지 모르겠어요. 잔금도 일부 드린 상태고 이사 날짜도 잡혀 있어서 너무 불안해요. 이런 경우 어떻게 대처하셨는지, 계약서에 지연 조항 넣으셨는지 궁금해요.',
     ARRAY[]::text[], null, '30대', '강서구',
     false, true, 1030, 55, 37, false, false, false, now() - interval '4 days'),

    (null, '선택장애中', 'worry',
     '인테리어 업체 선정 기준, 어떻게 잡으세요?',
     '견적을 5군데 받았는데 어디를 선택해야 할지 더 모르겠어요. 가격이 제일 싼 곳은 왠지 불안하고, 제일 비싼 곳은 예산 초과라서요. 결국 신뢰가 기준인데 그걸 어떻게 보장받나요? 계약서에 꼭 들어가야 할 항목 아시는 분 계신가요?',
     ARRAY[]::text[], null, '30대', null,
     false, true, 760, 38, 27, false, false, false, now() - interval '5 days'),

    -- ── 부동산 ─────────────────────────────────────────────
    (null, '구축매입자', 'realestate',
     '구축 리모델링 하면 매매가 올라가나요?',
     '20년 된 아파트 매입해서 전체 리모델링 생각 중인데요. 비용 대비 실제로 시세가 올라가는지 궁금해요. 주변에서는 올라봤자 공사비도 못 건진다는 말도 있고, 신축급 되면 확실히 다르다는 말도 있어서요. 지역·규모에 따라 다른 건지, 경험담 주시면 감사해요.',
     ARRAY[]::text[], null, '40대', '노원구',
     false, true, 980, 41, 19, false, false, false, now() - interval '14 days'),

    (null, '전세거주자', 'realestate',
     '전세집에서 인테리어 어디까지 가능할까요?',
     '2년 계약 들어왔는데 도배랑 조명은 제 비용으로 하고 싶어요. 계약서에 원상복구 조항이 있는데 나갈 때 복구 안 해도 되는 범위가 어디까지인지 모르겠어요. 집주인 허락 받으면 바닥도 가능한가요? 경험 있으신 분들 조언 부탁드려요.',
     ARRAY[]::text[], 'female', '20대', '동작구',
     false, true, 640, 28, 16, false, false, false, now() - interval '16 days'),

    -- ── 창업 ───────────────────────────────────────────────
    (null, '카페창업준비', 'startup',
     '카페 인테리어 비용 경험 공유',
     '20평 카페 인테리어 비용 공유합니다. 시공 전 예산은 2500만원이었는데 최종 정산은 3100만원 나왔어요. 주방 덕트 공사가 예상보다 많이 나왔고, 간판·외부 공사를 따로 잡지 않아서 추가됐어요. 창업할 때 인테리어 예산은 처음 견적의 120~130%로 잡으세요.',
     ARRAY[]::text[], null, '30대', '성수동',
     false, true, 1340, 67, 29, true, false, false, now() - interval '10 days'),

    (null, '상가취득자', 'startup',
     '작은 상가 리모델링 예산 잡는 법',
     '12평짜리 상가를 샀는데 기존 업종이 달라서 내부를 다 뜯어야 해요. 처음 보는 비용 항목들이 너무 많아서 어디서부터 잡아야 할지 모르겠어요. 철거비, 기반 공사, 인테리어, 설비로 나눠서 각각 별도 견적 받는 게 좋다고 하던데 맞는 방법인지요?',
     ARRAY[]::text[], null, '40대', null,
     false, true, 780, 35, 20, false, false, false, now() - interval '13 days'),

    -- ── 생활 ───────────────────────────────────────────────
    (null, '먼지전쟁중', 'daily',
     '공사 기간 중 먼지 관리 팁 공유',
     '도배+장판 공사 일주일 하면서 먼지 진짜 장난 아니었어요. 미리 알았더라면 준비했을 것들 공유해요. 공사 전날 이불·옷 다 박스에 밀봉, 에어컨 필터 분리, 각 방 문 테이프로 막기. 끝나고 물걸레 두 번 이상 닦기. 공기청정기 있으면 풀가동 추천해요.',
     ARRAY[]::text[], null, '30대', null,
     false, true, 510, 24, 13, false, false, false, now() - interval '17 days'),

    (null, '계절고민', 'daily',
     '겨울 공사 vs 여름 공사, 어느 게 나을까요?',
     '이사 시기에 맞춰 공사 일정 잡으려는데 겨울이나 여름 중 어느 때가 더 나은지 궁금해요. 도배는 겨울이 안 좋다는 말을 들었는데 여름엔 습해서 그것도 문제라고 하더라고요. 4~5월이 제일 좋은 건지, 비수기 할인도 가능한지 궁금해요.',
     ARRAY[]::text[], null, null, null,
     false, true, 380, 17, 14, false, false, false, now() - interval '19 days'),

    (null, '홈오피스구축', 'daily',
     '거실 일부를 홈오피스로 분리하는 방법',
     '재택근무가 늘면서 거실 한쪽을 업무 공간으로 쓰고 싶은데 파티션이나 칸막이로 구분하는 방법을 찾고 있어요. 인테리어 전문 업체까지 부를 정도는 아닌 것 같고 DIY나 가구 배치로 해결할 수 있을지 의견 구해요.',
     ARRAY[]::text[], null, '30대', null,
     false, true, 440, 21, 11, false, false, false, now() - interval '16 days'),

    -- ── 대화해요 ────────────────────────────────────────────
    (null, '신혼집준비', 'chat',
     '인테리어 처음 맡겨봤을 때 제일 걱정됐던 것',
     '결혼하면서 처음으로 인테리어 업체 써봤어요. 솔직히 돈 내고 나서 연락 안 되면 어쩌지, 자재 바꿔치기 하면 어떻게 알지, 하는 걱정이 제일 컸어요. 결과적으로는 다행히 잘 됐는데, 처음에 업체 선택할 때 뭘 기준으로 고르셨어요?',
     ARRAY[]::text[], 'female', '20대', null,
     false, true, 670, 31, 22, false, false, false, now() - interval '7 days'),

    (null, '인테리어고민', 'chat',
     '여러분 집꾸미기 어떤 스타일 좋아하세요?',
     '저는 원래 북유럽 스타일 좋아했는데 실제로 살아보니 관리가 너무 힘들어서 요즘은 모던 미니멀로 방향 바꾸는 중이에요. 사진에서는 예쁜데 막상 살아보면 다른 스타일들이 있더라고요. 다들 어떤 스타일 선호하고 살아보니까 어떤지도 궁금해요.',
     ARRAY[]::text[], null, '30대', null,
     false, true, 490, 26, 18, false, false, false, now() - interval '11 days');

  end if;
end $$;

-- 완료 확인 쿼리
-- select id, anonymous_nickname, category, title, is_seed, created_at
-- from lounge_posts
-- where is_seed = true
-- order by created_at desc;
