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
  { id: 'all',        label: '전체',    group: null },
  { id: 'popular',    label: '🔥 인기', group: null },
  { id: 'interior',   label: '인테리어', group: '공간' },
  { id: 'room_deco',  label: '집꾸미기', group: '공간' },
  { id: 'worry',      label: '고민',    group: '일상' },
  { id: 'daily',      label: '생활',    group: '일상' },
  { id: 'chat',       label: '대화해요', group: '일상' },
  { id: 'realestate', label: '부동산',   group: '경제' },
  { id: 'stock',      label: '주식',    group: '경제' },
  { id: 'humor',      label: '유머',    group: '일상' },
  { id: 'pet',        label: '반려동물', group: '취미' },
  { id: 'exercise',   label: '운동',    group: '취미' },
  { id: 'startup',    label: '창업',    group: '경제' },
  { id: 'travel',     label: '여행',    group: '취미' },
  { id: 'game',       label: '게임',    group: '취미' },
  { id: 'local',      label: '동네',    group: '일상' },
  { id: 'food',       label: '맛집',    group: '일상' },
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
  CHAT_REQUEST:         20,
  POST_BOOST_MIN:       15,
  POST_BOOST_MAX:       30,
  EXPERT_HIGHLIGHT_MIN: 30,
  EXPERT_HIGHLIGHT_MAX: 50,
};

export const TOKEN_EARN = {
  SIGNUP:                20,
  PROFILE_COMPLETE:      15,
  FIRST_POST:            10,
  FIRST_COMMENT:          5,
  FIRST_STORY:            5,
  LIKES_RECEIVED_20:      5,
  COMMENTS_WRITTEN_10:    5,
  POSTS_WRITTEN_3:        5,
  CONSTRUCTION_REVIEW:   15,
  FIRST_QUOTE_REQUEST:   10,
};

export const SPACE_TEMPERATURE_BASE = 36.5;

export const CATEGORY_LABEL = LOUNGE_CATEGORIES.reduce((acc, c) => {
  acc[c.id] = c.label;
  return acc;
}, {});
