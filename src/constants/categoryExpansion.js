// ════════════════════════════════════════════════════════════════════
// 공간라운지 Category Expansion Preparation (Phase 8)
//
//   Space Coverage(Phase 6) 영역을 자연스럽게 확장할 후보를 정리한다. 새 카테고리는
//   "자동 생성하지 않고 추천만" 한다 — 관리자 승인 후에만 공식 카테고리로 전환한다.
//
//   포함(작업지시서): 인테리어/집꾸미기/시공후기/견적고민/연애/MBTI/자격증/종교/경제/
//     사회/주식/AI/여행/맛집/건강/창업/반려동물/인도점성술.
//   제외: 사주, 타로.  (인도점성술은 포함, 사주·타로는 확장 대상에서 뺀다.)
//
//   순수 데이터. categoryRecommender(Phase 2)와 함께 관리자 화면에서 "추천"으로만 노출.
// ════════════════════════════════════════════════════════════════════

// 확장 제외 — 정책상 새 카테고리 후보에서 뺀다.
export const EXPANSION_EXCLUDED = ["사주", "타로"];

// 확장 영역. kind: "existing"(대응 라운지 카테고리 있음) | "candidate"(개념 영역, 추천 대상).
export const EXPANSION_AREAS = [
  { id: "interior",  label: "인테리어",   kind: "existing",  category: "interior" },
  { id: "room_deco", label: "집꾸미기",   kind: "existing",  category: "room_deco" },
  { id: "review",    label: "시공후기",   kind: "existing",  category: "review" },
  { id: "quote",     label: "견적고민",   kind: "existing",  category: "quote_worry" },
  { id: "dating",    label: "연애",       kind: "existing",  category: "dating" },
  { id: "economy",   label: "경제",       kind: "existing",  category: "realestate" },
  { id: "stock",     label: "주식",       kind: "existing",  category: "stock" },
  { id: "travel",    label: "여행",       kind: "existing",  category: "travel" },
  { id: "food",      label: "맛집",       kind: "existing",  category: "restaurant" },
  { id: "health",    label: "건강",       kind: "existing",  category: "health" },
  { id: "startup",   label: "창업",       kind: "existing",  category: "startup" },
  { id: "pet",       label: "반려동물",   kind: "existing",  category: "pet" },
  // 개념 영역 — 대응 라운지 카테고리 없음 → "추천"만(관리자 승인 후 신설).
  { id: "mbti",      label: "MBTI",       kind: "candidate", category: null, voice: "insight_light" },
  { id: "cert",      label: "자격증",     kind: "candidate", category: null, voice: "informational" },
  { id: "religion",  label: "종교",       kind: "candidate", category: null, voice: "contemplative" },
  { id: "society",   label: "사회",       kind: "candidate", category: null, voice: "analytical" },
  { id: "ai",        label: "AI",         kind: "candidate", category: null, voice: "analytical" },
  { id: "astrology", label: "인도점성술", kind: "candidate", category: null, voice: "informational" },
];

// 추천(추천만) 대상 — 개념 영역 중 제외 목록에 없는 것들. 관리자 승인 전까지 정식 카테고리 아님.
export function expansionCandidates() {
  return EXPANSION_AREAS
    .filter((a) => a.kind === "candidate")
    .filter((a) => !EXPANSION_EXCLUDED.some((x) => a.label.includes(x)));
}
