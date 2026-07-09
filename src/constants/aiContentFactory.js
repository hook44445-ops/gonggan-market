// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI 콘텐츠 자동화 공장 — Phase 1 (Draft 생성 파이프라인)
//   "Space is Everything" — 공간은 상위개념, 모든 카테고리는 공간 안의 이야기다.
//   이 파일은 2단계(주제 기획)·3단계(제목/구성)·4단계(본문)를 템플릿 기반으로 구현한다.
//   Template 기반 + AI 기반을 모두 지원하는 구조 — generateDraft() 의 반환 형태만
//   유지하면, 추후 이 함수를 Claude/OpenAI API 호출로 그대로 교체할 수 있다.
// ════════════════════════════════════════════════════════════════════

// 공간 최상위 6개 도메인(철학 이미지 반영) — 카테고리는 이 중 하나에 속하는
// "공간 안의 이야기"로 취급한다. UI 그룹핑/문서화 참고용(표시 전용).
export const SPACE_DOMAINS = [
  { id: "residential", label: "주거공간", categories: ["interior", "room_deco", "move_in"] },
  { id: "workspace",   label: "업무공간", categories: ["startup", "staff-talk"] },
  { id: "people",      label: "사람",     categories: ["marriage", "dating", "pet"] },
  { id: "society",     label: "사회",     categories: ["realestate", "stock", "jobs"] },
  { id: "life",        label: "라이프",   categories: ["health", "exercise", "travel", "restaurant", "daily", "local"] },
  { id: "culture",     label: "문화",     categories: ["humor", "free", "review", "quote_worry"] },
];

// 1단계(이슈 수집)를 대체하는 Phase 1 프리셋 — 외부 트렌드 API 연동(Phase 2) 전까지
// 관리자가 이슈를 직접 고르거나 입력해 파이프라인을 시작한다. "이슈 → 공간 관점 재해석" 예시.
export const ISSUE_PRESETS = [
  { id: "heatwave",   issue: "폭염",         spaceAngle: "우리 집을 시원하게 만드는 공간 관리법", category: "interior" },
  { id: "rate_cut",   issue: "금리 인하",     spaceAngle: "지금 리모델링을 고민해야 하는 이유",     category: "quote_worry" },
  { id: "pet_growth", issue: "반려동물 증가", spaceAngle: "반려동물과 함께 사는 집 구조 만들기",   category: "pet" },
  { id: "startup",    issue: "창업 증가",     spaceAngle: "카페·상가 인테리어 준비 체크리스트",     category: "startup" },
  { id: "solo",       issue: "1인 가구 증가", spaceAngle: "작은 공간을 효율적으로 쓰는 법",         category: "room_deco" },
  { id: "aging",      issue: "고령화 사회",   spaceAngle: "시니어를 위한 안전한 공간 디자인",       category: "health" },
  { id: "season",     issue: "환절기",       spaceAngle: "환절기 실내 공기와 결로 관리법",         category: "daily" },
  { id: "moveinseason", issue: "이사철",     spaceAngle: "이사 전 체크리스트와 입주 준비",         category: "move_in" },
];

// 3단계(카테고리 자동 분류) — 이슈/제목 텍스트를 기존 라운지 카테고리로 매핑.
// 실제 AI 분류(Phase 2/3) 전까지 키워드 스코어링으로 대체(투명하고 예측 가능).
const CATEGORY_KEYWORDS = {
  interior:    ["인테리어", "리모델링", "시공", "자재", "도배", "장판", "타일"],
  review:      ["후기", "비포애프터", "시공사례", "완성"],
  quote_worry: ["견적", "비용", "가격", "예산", "금리"],
  "staff-talk": ["사장님", "업체", "운영", "창업사례"],
  room_deco:   ["꾸미기", "가구", "배치", "홈스타일링", "1인", "원룸", "작은 공간"],
  move_in:     ["이사", "입주", "체크리스트", "이사철"],
  realestate:  ["부동산", "아파트", "매매", "전세", "집값"],
  marriage:    ["결혼", "신혼", "혼수"],
  dating:      ["연애", "데이트"],
  health:      ["건강", "수면", "공기", "환기", "시니어", "고령", "안전"],
  stock:       ["주식", "투자", "재테크"],
  jobs:        ["취업", "이직", "직장"],
  pet:         ["반려동물", "강아지", "고양이", "펫"],
  exercise:    ["운동", "홈트"],
  startup:     ["창업", "카페", "상가", "매장"],
  travel:      ["여행", "숙소", "펜션"],
  restaurant:  ["맛집", "카페", "식당"],
  daily:       ["생활", "환절기", "결로", "청소", "정리", "날씨", "폭염", "장마", "한파"],
  local:       ["동네", "지역"],
  humor:       ["유머", "재미"],
  free:        ["자유", "일상"],
};

export function classifyCategory(text, fallback = "daily") {
  const t = String(text ?? "").toLowerCase();
  if (!t) return fallback;
  let best = fallback;
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((n, kw) => n + (t.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

// 4단계(본문 생성) — LOUNGE_SEO_POLICY.md 구조(도입→소제목→체크리스트→공간마켓 연결→CTA)를
// 따르는 템플릿. 이슈를 "공간 관점"으로 재해석해 정보성 콘텐츠 뼈대를 만든다.
// ⚠️ 표시 전용 초안이다 — 관리자가 검수/수정 후 발행하는 것을 전제로 한다(베타 원칙).
//    Phase 2/3 에서 이 함수 시그니처(입력/출력)를 유지한 채 내부만 실제 AI 호출로 교체하면 된다.
export function generateDraft({ issue, spaceAngle, category, region } = {}) {
  const topic = String(issue ?? "").trim();
  const angle = String(spaceAngle ?? "").trim() || `${topic}과(와) 공간의 관계`;
  const cat = category || classifyCategory(`${topic} ${angle}`);
  const regionPrefix = region ? `${region} ` : "";

  const title = `${regionPrefix}${angle}`.trim();

  const content = [
    `요즘 "${topic}" 이야기가 많습니다. 그런데 이건 남의 이야기가 아니라, 사실 우리가 매일 지내는 공간과 맞닿아 있는 이야기입니다.`,
    "",
    `## 왜 지금 "${topic}"이 공간과 연결될까`,
    `${topic}은 생활 방식과 공간을 쓰는 방식을 함께 바꿉니다. ${angle}을(를) 고민하는 사람이 늘어나는 이유이기도 합니다.`,
    "",
    "## 공간에서 확인해볼 것",
    "- 지금 공간에서 가장 불편한 지점은 어디인가",
    "- 예산 안에서 우선순위를 어디에 둘 것인가",
    "- 혼자 해결할 부분과 전문가 도움이 필요한 부분 구분하기",
    "",
    "## 체크리스트",
    "- [ ] 현재 공간 상태 사진으로 기록해두기",
    "- [ ] 우선순위 3가지 정하기",
    "- [ ] 비슷한 사례·견적 미리 비교해보기",
    "",
    "## 정리",
    `"${topic}"은 지나가는 이슈가 아니라 공간을 다시 보게 하는 계기입니다. 작은 변화부터 시작해도 충분합니다.`,
    "",
    "궁금한 점이 있다면 공간마켓 라운지에서 비슷한 고민을 하는 사람들과 이야기를 나눠보세요. 필요하다면 검증된 업체의 무료 비교견적도 받아볼 수 있습니다.",
  ].join("\n");

  const tags = [topic, cat].filter(Boolean);

  return { title, content, category: cat, tags };
}
