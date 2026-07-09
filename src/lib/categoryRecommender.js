// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI 편집국 — 카테고리 추천 (Phase 2·AI Editor)
//
//   시대가 바뀌면 새 카테고리가 필요하다. 하지만 이 Phase 는 "자동 생성"하지 않는다 —
//   "추천"만 한다. AI 가 후보를 제안하고, 관리자가 승인해야 공식 카테고리가 된다
//   (라운지 구조가 무분별하게 늘어나는 것을 막으면서 Space is Everything 철학 아래 확장).
//
//   추천 규칙(스펙):
//     1) 새 카테고리는 무조건 "공간과 연결"되어야 한다(isSpaceConnected). 아니면 제외.
//     2) 아래 6개 조건 중 2개 이상 만족: 검색량 증가·트렌드 지속·콘텐츠 확장성·
//        공간 관련성·사용자 관심도·장기 가치.
//     3) 이미 존재하는 라운지 카테고리는 추천하지 않는다.
// ════════════════════════════════════════════════════════════════════

import { EMERGING_CATEGORIES, CATEGORY_SIGNAL_LABELS, isSpaceConnected } from "../constants/spacePhilosophy.js";
import { LOUNGE_CATEGORIES } from "../constants/lounge.js";

const MIN_SIGNALS = 2;
const existingIds = new Set(LOUNGE_CATEGORIES.map((c) => c.id));
// 라벨로도 이미 존재하는지 확인(예: 이름이 겹치는 경우).
const existingLabels = new Set(LOUNGE_CATEGORIES.map((c) => c.label));

function metSignals(candidate) {
  const s = candidate.signals ?? {};
  return Object.keys(CATEGORY_SIGNAL_LABELS).filter((k) => s[k] === true);
}

// 새 카테고리 후보 추천 목록. issues(오늘의 이슈)를 주면 관련도가 높은 후보를 위로 올린다(선택).
//   반환: [{ id, label, spaceLink, metSignals:[label...], signalCount, related }]
export function recommendCategories(issues = []) {
  const issueText = issues.map((i) => i.topic ?? "").join(" ").toLowerCase();

  return EMERGING_CATEGORIES
    .filter((c) => !existingIds.has(c.id) && !existingLabels.has(c.label)) // 규칙3: 기존 카테고리 제외
    .filter((c) => isSpaceConnected(c))                                    // 규칙1: 공간 연결 필수
    .map((c) => {
      const met = metSignals(c);
      const related = c.label && issueText.includes(c.label.toLowerCase());
      return {
        id: c.id,
        label: c.label,
        spaceLink: c.spaceLink,
        metSignals: met.map((k) => CATEGORY_SIGNAL_LABELS[k]),
        signalCount: met.length,
        related,
      };
    })
    .filter((c) => c.signalCount >= MIN_SIGNALS)                           // 규칙2: 2개 이상
    .sort((a, b) => (b.related - a.related) || (b.signalCount - a.signalCount));
}
