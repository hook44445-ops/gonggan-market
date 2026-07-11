// ════════════════════════════════════════════════════════════════════
// 공간라운지 Editorial Approval Policy — 발행 우선 승인 정책 (Phase 43)
//
//   초안 → 품질평가 → (점수밴드별) 제한 보정/재생성 → AI 조직 4인 검토(≤3라운드) →
//   Hard Gate → 최종 결정. 발행 우선: 품질이 조금 낮아도 Hard Fail 이 없으면 자동 승인한다.
//
//   무한 루프 방지 상한(⑦): 초안 1 · 자동보정 ≤2 · 전체재생성 ≤1 · 보드검토 ≤3라운드.
//   deps.refine/regenerate 는 선택(운영=LLM 주입, 서버/결정론=미주입 → 현재 본문 그대로 검토).
//   ⚠️ 순수 오케스트레이션 · 저장/DB 없음 · Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { evaluateQuality } from "./qualityEvaluator.js";
import { reviewByBoard } from "./aiEditorialBoard.js";

export const MAX_REVISIONS = 2;
export const MAX_REGENERATIONS = 1;
export const MAX_BOARD_ROUNDS = 3;

// 점수 밴드별 사전 보정 상한(④).
function preBoostCap(score) {
  if (score >= 85) return 0;
  if (score >= 80) return 1;
  if (score >= 70) return 2;
  return 1; // <70: 재생성 1회 후 보정 ≤1회
}

// 최종 결정 → 예약 가능 여부.
export function isApproved(finalDecision) {
  return finalDecision === "AUTO_APPROVED" || finalDecision === "AUTO_APPROVED_WITH_NOTES" || finalDecision === "CONDITIONAL_AUTO_APPROVED";
}

export async function runEditorialApproval(
  { draft, evaluate = (d) => evaluateQuality(d), refine = null, regenerate = null, existing = [] } = {},
  { maxRevisions = MAX_REVISIONS, maxRegenerations = MAX_REGENERATIONS, maxBoardRounds = MAX_BOARD_ROUNDS } = {}
) {
  const counts = { evaluationCount: 0, revisionCount: 0, regenerationCount: 0, boardReviewCount: 0 };
  let d = draft;
  let ev = evaluate(d); counts.evaluationCount += 1;

  // 1) <70 → 전체 재생성 1회(가능할 때) 후 재평가.
  if (ev.totalScore < 70 && regenerate && counts.regenerationCount < maxRegenerations) {
    try { const rg = await regenerate(d); if (rg) { d = typeof rg === "string" ? { ...d, content: rg } : rg; counts.regenerationCount += 1; ev = evaluate(d); counts.evaluationCount += 1; } } catch { /* keep */ }
  }
  // 2) 점수밴드별 사전 보정(약점만, 상한 내).
  const cap = preBoostCap(ev.totalScore);
  let boosts = 0;
  while (ev.totalScore < 85 && boosts < cap && refine && counts.revisionCount < maxRevisions) {
    let improved = null;
    try { improved = await refine(d, ev); } catch { improved = null; }
    if (!improved) break;
    const nd = typeof improved === "string" ? { ...d, content: improved } : improved;
    const ne = evaluate(nd); counts.evaluationCount += 1;
    if (ne.totalScore >= ev.totalScore) { d = nd; ev = ne; } // 퇴보 방지
    boosts += 1; counts.revisionCount += 1;
  }

  // 3) AI 조직 4인 검토 루프(≤3라운드) — REVISE/HARD_FAIL 이면 약점만 1회 보정 후 재검토.
  let board = reviewByBoard(d, { existing, evaluation: ev }); counts.boardReviewCount += 1;
  let round = 1;
  while (round < maxBoardRounds) {
    const bd = board.boardDecision;
    if (bd === "AUTO_APPROVED" || bd === "AUTO_APPROVED_WITH_NOTES" || bd === "SPLIT") break;
    // HARD_FAIL: 재생성(가능·상한) 우선, 아니면 보정. NEEDS_REVISION: 보정.
    let changed = false;
    if (bd === "HARD_FAIL" && regenerate && counts.regenerationCount < maxRegenerations) {
      try { const rg = await regenerate(d); if (rg) { d = typeof rg === "string" ? { ...d, content: rg } : rg; counts.regenerationCount += 1; changed = true; } } catch { /* keep */ }
    }
    if (!changed && refine && counts.revisionCount < maxRevisions) {
      try { const im = await refine(d, ev); if (im) { d = typeof im === "string" ? { ...d, content: im } : im; counts.revisionCount += 1; changed = true; } } catch { /* keep */ }
    }
    if (!changed) break; // 더 이상 개선 수단 없음 → 종료(상한 도달)
    ev = evaluate(d); counts.evaluationCount += 1;
    board = reviewByBoard(d, { existing, evaluation: ev }); counts.boardReviewCount += 1;
    round += 1;
  }

  // 4) 최종 결정(발행 우선).
  let finalDecision;
  if (board.split) finalDecision = "NEEDS_REVIEW";                      // 2:2 → 관리자
  else if (!board.hardGatePassed) finalDecision = "NEEDS_REVIEW";       // Hard Fail 잔존 → 관리자
  else if (board.boardDecision === "AUTO_APPROVED") finalDecision = "AUTO_APPROVED";
  else if (board.boardDecision === "AUTO_APPROVED_WITH_NOTES") finalDecision = "AUTO_APPROVED_WITH_NOTES";
  else finalDecision = ev.totalScore < 70 ? "CONDITIONAL_AUTO_APPROVED" : "AUTO_APPROVED_WITH_NOTES"; // Soft Fail만 → 발행

  return {
    finalDecision,
    approved: isApproved(finalDecision),
    grade: board.grade,
    qualityScore: ev.totalScore,
    approvalCount: board.approvalCount,
    totalReviewers: 4,
    hardGatePassed: board.hardGatePassed,
    hardGate: board.hardGate,
    ...counts,
    board,
    draft: d,
    // 요청 로그 필드(⑦).
    log: { ...counts, finalDecision, qualityScore: ev.totalScore, grade: board.grade, hardGatePassed: board.hardGatePassed },
  };
}
