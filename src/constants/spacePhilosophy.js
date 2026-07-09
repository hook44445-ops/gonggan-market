// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI 편집국 — "Space is Everything" 철학 엔진 (Phase 2·AI Editor)
//
//   공간은 최상위 카테고리다. 모든 사람·이야기·산업·사회현상·문화·경제·관계·삶은
//   공간 안에서 일어난다. 따라서 AI 는 뉴스를 복사하지 않고, 검색량만 보고 쓰지 않는다 —
//   항상 "공간이라는 관점"으로 세상을 재해석한다.
//
//   예) 폭염 → 공간 관리 → 생활 / 금리 → 주거공간 → 부동산 / 창업 → 상업공간 → 창업 /
//       AI → 미래 공간 → 스마트홈 / 주식 → 공간산업 → 경제 / 반려동물 → 함께 사는 공간 → 반려동물
//
//   이 파일은 "구조/규칙"이다(결정론적, 외부 API 없음). Phase 3 에서 LLM 이 붙으면
//   reinterpretThroughSpace() 내부만 실제 프롬프트 호출로 교체하면 되고, 반환 형태는 유지한다.
// ════════════════════════════════════════════════════════════════════

// 재해석 렌즈 — 이슈 키워드를 "공간 관점(spaceKeyword)"으로 끌어올린 뒤 기존 라운지
// 카테고리로 착지시킨다. 위에서부터 첫 매칭을 사용한다(구체적인 규칙이 위, 일반 규칙이 아래).
export const SPACE_LENS = [
  { id: "weather",  match: ["폭염", "한파", "장마", "폭우", "미세먼지", "황사", "날씨", "계절", "환절기", "결로", "난방", "냉방"],
    spaceKeyword: "공간 관리",       category: "daily",
    angle: (t) => `${t}에 대응하는 우리 공간 관리법` },
  { id: "housing",  match: ["금리", "대출", "집값", "부동산", "전세", "월세", "청약", "분양", "재건축", "규제"],
    spaceKeyword: "주거공간",         category: "realestate",
    angle: (t) => `${t} 시대에 주거공간을 다시 보는 법` },
  { id: "biz",      match: ["창업", "상가", "카페", "매장", "자영업", "프랜차이즈", "공실", "임대료"],
    spaceKeyword: "상업공간",         category: "startup",
    angle: (t) => `${t} 흐름 속 상업공간 준비 체크리스트` },
  { id: "future",   match: ["ai", "인공지능", "로봇", "스마트홈", "자동화", "iot", "메타버스"],
    spaceKeyword: "미래 공간",         category: "free",
    angle: (t) => `${t}이(가) 바꾸는 미래의 공간` },
  { id: "industry", match: ["주식", "증시", "코스피", "코스닥", "투자", "반도체", "경기", "경제성장", "환율"],
    spaceKeyword: "공간산업",         category: "stock",
    angle: (t) => `${t}으로 읽는 공간산업의 방향` },
  { id: "pet",      match: ["반려동물", "강아지", "고양이", "펫"],
    spaceKeyword: "함께 사는 공간",    category: "pet",
    angle: (t) => `${t}과(와) 함께 사는 집 구조 만들기` },
  { id: "solo",     match: ["1인가구", "1인 가구", "자취", "혼자", "원룸"],
    spaceKeyword: "작은 공간",         category: "room_deco",
    angle: (t) => `${t} 시대, 작은 공간을 효율적으로 쓰는 법` },
  { id: "senior",   match: ["고령", "시니어", "노후", "실버"],
    spaceKeyword: "안전한 공간",       category: "health",
    angle: (t) => `${t}를 위한 안전한 공간 디자인` },
  { id: "movein",   match: ["이사", "입주", "전입"],
    spaceKeyword: "새로운 공간",       category: "move_in",
    angle: (t) => `${t} 전에 확인하는 새 공간 체크리스트` },
  { id: "travel",   match: ["여행", "숙소", "호텔", "펜션", "캠핑"],
    spaceKeyword: "머무는 공간",       category: "travel",
    angle: (t) => `${t}에서 만나는 머무는 공간 이야기` },
  { id: "family",   match: ["결혼", "신혼", "혼수", "출산", "육아"],
    spaceKeyword: "함께하는 공간",     category: "marriage",
    angle: (t) => `${t}과(와) 함께 준비하는 공간` },
];

// 기본 렌즈 — 매칭되는 규칙이 없을 때(모든 이슈는 결국 공간과 연결된다는 철학의 안전망).
const DEFAULT_LENS = {
  id: "life",
  spaceKeyword: "삶의 공간",
  category: "daily",
  angle: (t) => `${t}을(를) 우리 공간의 관점에서 다시 보기`,
};

// 이슈 텍스트 → 공간 관점 재해석. 반환: { topic, spaceKeyword, spaceAngle, category, lensId, chain }
//   chain 은 "이슈 → 공간 관점 → 착지 카테고리" 3단계로, 편집회의/UI 에서 사고 과정을 그대로 보여준다.
export function reinterpretThroughSpace(topic) {
  const t = String(topic ?? "").trim();
  const lower = t.toLowerCase();
  const lens = SPACE_LENS.find((l) => l.match.some((m) => lower.includes(m.toLowerCase()))) ?? DEFAULT_LENS;
  return {
    topic: t,
    spaceKeyword: lens.spaceKeyword,
    spaceAngle:   lens.angle(t),
    category:     lens.category,
    lensId:       lens.id,
    chain:        [t || "이슈", lens.spaceKeyword, lens.category],
  };
}

// ── 시대 확장: "새 카테고리 후보" 풀 ─────────────────────────────────
// 원칙: 새 카테고리는 무조건 공간과 연결되어야 한다(spaceLink 필수). 공간과 연결되지 않으면
//   후보에서 제외한다. 이 Phase 는 "자동 생성"이 아니라 "추천"만 한다 — 관리자가 승인해야
//   공식 카테고리가 된다(categoryRecommender.js 가 이 풀을 사용).
//
// signals: 아래 6개 조건 중 2개 이상 만족해야 추천 대상(스펙 규칙).
//   searchGrowth(검색량 증가) · trendDurability(트렌드 지속) · contentScalability(콘텐츠 확장성) ·
//   spaceRelevance(공간 관련성) · userInterest(사용자 관심도) · longTermValue(장기 가치)
export const EMERGING_CATEGORIES = [
  { id: "smarthome", label: "스마트홈", spaceLink: "집이라는 공간이 기술로 진화하는 영역",
    signals: { searchGrowth: true, trendDurability: true, contentScalability: true, spaceRelevance: true, userInterest: true, longTermValue: true } },
  { id: "esg",       label: "친환경·ESG", spaceLink: "지속가능한 공간과 에너지 소비 방식",
    signals: { searchGrowth: true, trendDurability: true, contentScalability: true, spaceRelevance: true, userInterest: false, longTermValue: true } },
  { id: "local",     label: "로컬·동네", spaceLink: "우리가 사는 동네라는 생활공간",
    signals: { searchGrowth: false, trendDurability: true, contentScalability: true, spaceRelevance: true, userInterest: true, longTermValue: true } },
  { id: "parenting", label: "육아", spaceLink: "아이와 함께 크는 집이라는 공간",
    signals: { searchGrowth: true, trendDurability: true, contentScalability: true, spaceRelevance: true, userInterest: true, longTermValue: true } },
  { id: "camping",   label: "캠핑", spaceLink: "집 밖에서 만드는 임시 생활공간",
    signals: { searchGrowth: true, trendDurability: false, contentScalability: true, spaceRelevance: true, userInterest: true, longTermValue: false } },
  { id: "aging",     label: "고령화·시니어", spaceLink: "나이 들어도 안전한 공간",
    signals: { searchGrowth: true, trendDurability: true, contentScalability: true, spaceRelevance: true, userInterest: false, longTermValue: true } },
  { id: "sharedoffice", label: "공유오피스", spaceLink: "함께 일하는 업무공간",
    signals: { searchGrowth: false, trendDurability: true, contentScalability: true, spaceRelevance: true, userInterest: false, longTermValue: true } },
  { id: "sharedkitchen", label: "공유주방", spaceLink: "함께 쓰는 조리·상업공간",
    signals: { searchGrowth: false, trendDurability: false, contentScalability: true, spaceRelevance: true, userInterest: false, longTermValue: true } },
  { id: "metaverse", label: "메타버스", spaceLink: "디지털 위에 지어지는 가상의 공간",
    signals: { searchGrowth: false, trendDurability: false, contentScalability: false, spaceRelevance: true, userInterest: false, longTermValue: false } },
];

// 새 카테고리 생성 조건: 공간과 연결(spaceLink) + signals 중 2개 이상 만족.
export const CATEGORY_SIGNAL_LABELS = {
  searchGrowth:       "검색량 증가",
  trendDurability:    "트렌드 지속",
  contentScalability: "콘텐츠 확장성",
  spaceRelevance:     "공간 관련성",
  userInterest:       "사용자 관심도",
  longTermValue:      "장기 가치",
};

// 공간과 연결되어 있는가 — 연결되지 않으면 카테고리로 만들지 않는다(철학 규칙).
export function isSpaceConnected(candidate) {
  return Boolean(candidate?.spaceLink && String(candidate.spaceLink).trim().length > 0);
}
