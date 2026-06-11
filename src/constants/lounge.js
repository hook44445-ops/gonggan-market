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

// 카테고리 최종 정리 (2026.06)
//  · 추가: 시공후기/견적고민/업체추천/이사입주
//  · 비활성(is_active=false): 게임/반려동물/여행/대화해요 — 게시글은 is_visible=false 로 숨김(soft)
//  · PREVIEW_COUNT(7)까지 노출, 그 이후(이사입주~)는 "더보기"로 접힘
export const LOUNGE_CATEGORIES = [
  { id: 'all',         label: '전체',        group: null },
  { id: 'popular',     label: '🔥 인기',     group: null },
  { id: 'interior',    label: '인테리어',     group: '공간' },
  { id: 'review',      label: '📸 시공후기',  group: '공간' },
  { id: 'quote_worry', label: '💬 견적고민',  group: '공간' },
  { id: 'recommend',   label: '🛡️ 업체추천', group: '공간' },
  { id: 'room_deco',   label: '집꾸미기',     group: '공간' },
  { id: 'move_in',     label: '🏠 이사입주',  group: '공간' },
  { id: 'realestate',  label: '부동산',       group: '경제' },
  { id: 'startup',     label: '창업',        group: '경제' },
  { id: 'local',       label: '동네',        group: '일상' },
  { id: 'daily',       label: '생활',        group: '일상' },
  { id: 'stock',       label: '주식',        group: '경제' },
  { id: 'exercise',    label: '운동',        group: '취미' },
  { id: 'humor',       label: '유머',        group: '일상' },
  { id: 'free',        label: '자유',        group: '일상' },
];

// "더보기" 접힘 기준 — 집꾸미기(index 6)까지 노출, 이사입주부터 접힘
export const LOUNGE_PREVIEW_COUNT = 7;

// 비활성 카테고리 id — 게시글 노출 제외(soft, is_visible=false). 복구 시 이 목록에서 제거.
// 삭제 대상은 명시된 4개만: 게임/반려동물/여행/대화해요.
export const LOUNGE_INACTIVE_CATEGORIES = ['game', 'pet', 'travel', 'chat'];

// perk: 25토큰(체험용) 대비 추가 수량 강조 문구 — UI 표시용. 가격/토큰 수량 정책 불변.
export const TOKEN_PACKAGES = [
  { tokens: 25,   bonus: 0, price: 8900,   badge: null,   perk: '체험용' },
  { tokens: 45,   bonus: 0, price: 13900,  badge: null,   perk: '🎁 20토큰 추가' },
  { tokens: 100,  bonus: 0, price: 25900,  badge: null,   perk: '🎁 75토큰 추가' },
  { tokens: 200,  bonus: 0, price: 45900,  badge: '인기', perk: '🔥 175토큰 추가' },
  { tokens: 600,  bonus: 0, price: 128900, badge: null,   perk: '🔥 575토큰 추가' },
  { tokens: 1100, bonus: 0, price: 228900, badge: '실속', perk: '👑 1075토큰 추가' },
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
