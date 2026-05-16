// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
//
// 라운지는 단순 커뮤니티 게시판이 아닙니다.
// 사람이 머무는 공간 안에서 신뢰가 생기고,
// 그 신뢰가 거래로 이어지는 구조입니다.
//
// 흐름:
// 라운지 → 신뢰 형성 → 대화 연결 → 견적 상담 → 거래 → 후기 → 재계약
//
// 익명 = 자유로운 소통의 보호막
// 토큰 = 진짜 관심과 가벼운 접근을 구분하는 장치
// 공간온도 = 쌓인 신뢰의 증명
// ─────────────────────────────────────────────────────

export const LOUNGE_CATEGORIES = [
  { id: 'all',      label: '전체',           group: null },
  { id: 'popular',  label: '🔥 인기',        group: null },

  { id: 'free',              label: '자유',           group: '지역/일상' },
  { id: 'neighborhood',      label: '동네',           group: '지역/일상' },
  { id: 'restaurant',        label: '맛집',           group: '지역/일상' },
  { id: 'daily',             label: '일상',           group: '지역/일상' },
  { id: 'worry',             label: '고민',           group: '지역/일상' },

  { id: 'interior_review',   label: '인테리어 후기',  group: '인테리어/공간' },
  { id: 'before_after',      label: '시공 전/후',     group: '인테리어/공간' },
  { id: 'company_recommend', label: '업체 추천',      group: '인테리어/공간' },
  { id: 'quote_question',    label: '견적 질문',      group: '인테리어/공간' },
  { id: 'room_deco',         label: '자취/집꾸미기',  group: '인테리어/공간' },

  { id: 'domestic_stock',    label: '국내주식',       group: '경제/정보' },
  { id: 'overseas_stock',    label: '해외주식',       group: '경제/정보' },
  { id: 'economy',           label: '경제',           group: '경제/정보' },
  { id: 'realestate',        label: '부동산',         group: '경제/정보' },
  { id: 'startup',           label: '창업',           group: '경제/정보' },

  { id: 'exercise',          label: '운동',           group: '취미/라이프' },
  { id: 'car',               label: '차/오토바이',    group: '취미/라이프' },
  { id: 'game',              label: '게임',           group: '취미/라이프' },
  { id: 'travel',            label: '여행',           group: '취미/라이프' },
  { id: 'pet',               label: '반려동물',       group: '취미/라이프' },
];

export const TOKEN_PACKAGES = [
  { tokens: 25,   bonus: 0, price: 8900,   badge: null },
  { tokens: 45,   bonus: 0, price: 13900,  badge: null },
  { tokens: 100,  bonus: 0, price: 25900,  badge: null },
  { tokens: 200,  bonus: 0, price: 45900,  badge: '인기' },
  { tokens: 600,  bonus: 0, price: 128900, badge: null },
  { tokens: 1100, bonus: 0, price: 228900, badge: '실속' },
];

export const TOKEN_COSTS = {
  CHAT_REQUEST:          20,
  INTEREST_MIN:          1,
  INTEREST_MAX:          2,
  POST_BOOST_MIN:        15,
  POST_BOOST_MAX:        30,
  EXPERT_HIGHLIGHT_MIN:  30,
  EXPERT_HIGHLIGHT_MAX:  50,
};

export const TOKEN_EARN = {
  SIGNUP:               20,
  PROFILE_COMPLETE:     20,
  FIRST_POST:           10,
  FIRST_COMMENT:        5,
  WEEKLY_ACTIVITY:      30,
  CONSTRUCTION_REVIEW:  30,
  QUOTE_REVIEW:         50,
};

export const SPACE_TEMPERATURE_BASE = 36.5;

export const CATEGORY_LABEL = LOUNGE_CATEGORIES.reduce((acc, c) => {
  acc[c.id] = c.label;
  return acc;
}, {});

export const MOCK_LOUNGE_POSTS = [
  {
    id: 'mock-1',
    anonymous_nickname: '날쌘다람쥐',
    category: 'interior_review',
    title: '셀프도배하다 벽지 망했다…',
    content: '혼자 해보려고 유튜브 보면서 도전했는데 이음새가 너무 벌어져버렸어요. 결국 업체 불러야 할 것 같아서 여기 물어봅니다. 이런 경우 비용이 얼마나 나올까요?',
    view_count: 1240,
    like_count: 47,
    comment_count: 23,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    is_story: false,
    region: '마포구',
    gender: null,
    age_group: '30대',
  },
  {
    id: 'mock-2',
    anonymous_nickname: '파파스머프',
    category: 'domestic_stock',
    title: '테슬라 오늘 왜 오르냐',
    content: '뉴스 찾아봐도 딱히 호재가 없는데 3% 올랐네요. 혹시 아시는 분?',
    view_count: 830,
    like_count: 38,
    comment_count: 15,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    is_story: false,
    region: null,
    gender: 'male',
    age_group: null,
  },
  {
    id: 'mock-3',
    anonymous_nickname: '민트고양이',
    category: 'room_deco',
    title: '이 조명 어디 제품인지 아시는분?',
    content: '카페에서 봤는데 너무 예뻐서 사진 찍어왔어요. 비슷한 제품 알고 계신 분 있으신가요?',
    view_count: 560,
    like_count: 29,
    comment_count: 12,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    is_story: false,
    region: '강남구',
    gender: 'female',
    age_group: '20대',
  },
  {
    id: 'mock-4',
    anonymous_nickname: '새벽올빼미',
    category: 'worry',
    title: '이사 가야 하는데 인테리어 할까요 말까요',
    content: '전세 계약이 2개월 남았는데 이사 예정이에요. 지금 집 도배장판이 너무 낡아서 업체에 맡기려고 하는데, 나가는 집에 하는 게 맞나요?',
    view_count: 320,
    like_count: 18,
    comment_count: 8,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    is_story: false,
    region: '용산구',
    gender: null,
    age_group: '40대',
  },
];

export const MOCK_STORIES = [
  { id: 's1', anonymous_nickname: '졸린판다',    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
  { id: 's2', anonymous_nickname: '빠른치타',    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: 's3', anonymous_nickname: '조용한부엉이', created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  { id: 's4', anonymous_nickname: '달리는말',    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() },
  { id: 's5', anonymous_nickname: '행복한코끼리', created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() },
];
