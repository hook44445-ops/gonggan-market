// ════════════════════════════════════════════════════════════════════
// Category Mapping (Phase 2) — 트렌드 이슈를 기존 라운지 카테고리로 자동 추천.
//   예) 폭우 → 집수리(interior) · 폭염 → 생활(daily) · 부동산 대책 → 부동산(realestate)
//   기존 Phase 1 classifyCategory()(src/constants/aiContentFactory.js, 무수정)를
//   기본 폴백으로 재사용하고, 트렌드 이슈에 특화된 힌트만 이 파일에 추가한다.
// ════════════════════════════════════════════════════════════════════

import { classifyCategory } from "../constants/aiContentFactory.js";

// 트렌드 이슈 → 카테고리 우선 매핑(스펙 예시 반영). 여기 없으면 classifyCategory() 폴백.
const TREND_CATEGORY_HINTS = {
  interior:    ["폭우", "누수", "침수", "집수리", "방수", "결로"],
  daily:       ["폭염", "한파", "미세먼지", "장마", "환절기"],
  realestate:  ["부동산 대책", "전세사기", "집값", "대출 규제", "청약"],
};

export function mapCategory(topic) {
  const t = String(topic ?? "");
  for (const [cat, hints] of Object.entries(TREND_CATEGORY_HINTS)) {
    if (hints.some((h) => t.includes(h))) {
      return { category: cat, confidence: "high", source: "trend_hint" };
    }
  }
  return { category: classifyCategory(t), confidence: "low", source: "keyword_fallback" };
}
