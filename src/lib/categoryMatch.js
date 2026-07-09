// ════════════════════════════════════════════════════════════════════
// 공간라운지 Category Match (Phase 19) — 제목/본문/태그 ↔ 카테고리 일치도 강화
//
//   Editorial Engine 이 정한 카테고리가 실제 제목/본문/태그와 맞는지 검증한다.
//   본문에서 다시 분류한 결과와 다르면 감점하고, "가장 가까운 상위 카테고리"를 제안한다
//   (불확실할 때 '자유'로 도피하지 않는다). 순수 함수.
// ════════════════════════════════════════════════════════════════════

import { classifyEditorialCategory } from "../constants/editorialPrompt.js";

// 제목 + 본문 앞부분(대표성) + 태그로 카테고리를 재도출.
export function categoryMatchScore(draft = {}) {
  const title = String(draft.title ?? "");
  const body = String(draft.body ?? "");
  const tags = (Array.isArray(draft.tags) ? draft.tags : []).join(" ");
  const assigned = String(draft.category ?? "").trim();

  const fromTitle = classifyEditorialCategory(title);
  const fromBody = classifyEditorialCategory(`${title} ${body.slice(0, 600)} ${tags}`);

  // 세 신호(assigned/title/body)가 얼마나 모이는가.
  const votes = [assigned, fromTitle, fromBody].filter(Boolean);
  const agree = votes.filter((v) => v === assigned).length;

  let score;
  let mismatch = false;
  let suggested = assigned;
  if (assigned && assigned === fromBody && assigned === fromTitle) {
    score = 96;                               // 완전 일치
  } else if (assigned && (assigned === fromBody || assigned === fromTitle)) {
    score = 80;                               // 부분 일치
  } else {
    score = 55; mismatch = true; suggested = fromBody; // 불일치 → 본문 기준 제안
  }

  return { score, assigned, fromTitle, fromBody, suggested, mismatch, agree };
}
