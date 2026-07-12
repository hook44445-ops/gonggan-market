// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI Editorial Board — 실제 LLM 4인 검토 (Phase 49)
//
//   기존 reviewByBoard(휴리스틱, reviewMode:"heuristic", aiReviewStatus:"AI_REVIEW_PENDING")를
//   무수정으로 두고, 그 위에 "실제 LLM 검수"를 얹는다. Hard Safety Gate·품질점수·등급은
//   기존 휴리스틱을 그대로 신뢰(안전장치 보존)하고, 4인의 편집 판정(PASS/NOTE/REVISE/HARD_FAIL)만
//   실제 LLM 으로 교체한다. LLM 미설정/실패/파싱실패 시 기존 휴리스틱 보드로 자동 폴백.
//
//   반환 형태는 reviewByBoard 와 100% 동일(+reviewMode:"llm") → buildDossier(record,{board})에
//   그대로 넣으면 4인 서명·BOARD_APPROVED·총괄비서실장·타임라인이 실제 검수 기준으로 재계산된다.
// ════════════════════════════════════════════════════════════════════

import { callLLM, isLLMConfigured } from "./llmClient.js";
import { parseLLMJson } from "./llmContentGenerator.js";
import { reviewByBoard, gradeOf } from "./aiEditorialBoard.js";
import { buildDossier } from "./approvalDossier.js";

const ROLES = ["writer", "fact_checker", "seo", "chief_editor"];
const ROLE_KO = { writer: "작성 담당", fact_checker: "팩트체커", seo: "SEO 담당", chief_editor: "편집장" };
const DECISIONS = ["PASS", "PASS_WITH_NOTE", "REVISE", "HARD_FAIL"];

function boardSystemPrompt() {
  return [
    "당신은 온라인 매거진 '공간라운지' 편집국의 4인 심사위원입니다. 각자 독립적으로 원고를 검수합니다.",
    "· 작성 담당(writer): 구성·전개·완성도·사람다운 문체(AI 티) 검수",
    "· 팩트체커(fact_checker): 사실·과장·단정·근거 검수(틀린 단정은 REVISE)",
    "· SEO 담당(seo): 제목·검색성·태그·요약 적합성 검수",
    "· 편집장(chief_editor): 브랜드 톤·발행 가치·독자 여운 종합 검수",
    "각 위원은 decision ∈ {PASS, PASS_WITH_NOTE, REVISE, HARD_FAIL}, score(0~100), issues[], revisionRequests[], opinion(한 줄)을 낸다.",
    "HARD_FAIL 은 안전/표절/심각한 허위 등 발행 불가일 때만. 애매하면 REVISE.",
    "반드시 아래 JSON '하나의 객체'로만 응답. 코드펜스·설명 금지.",
  ].join("\n");
}
function boardUserPrompt(draft) {
  const body = String(draft.content ?? draft.body ?? "").slice(0, 4000);
  return [
    `제목: ${draft.title ?? ""}`,
    `카테고리: ${draft.category ?? draft.content_type ?? ""}`,
    `본문:\n${body}`,
    "",
    "출력(JSON only):",
    '{ "reviewers": [',
    '  { "role":"writer", "decision":"PASS|PASS_WITH_NOTE|REVISE|HARD_FAIL", "score":0, "issues":[], "revisionRequests":[], "opinion":"" },',
    '  { "role":"fact_checker", ... }, { "role":"seo", ... }, { "role":"chief_editor", ... }',
    "] }",
  ].join("\n");
}

function normalizeReviewer(raw, role) {
  const decision = DECISIONS.includes(raw?.decision) ? raw.decision : "PASS";
  const score = Number.isFinite(Number(raw?.score)) ? Math.max(0, Math.min(100, Math.round(Number(raw.score)))) : 70;
  const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 6) : []);
  return {
    role, name: ROLE_KO[role], decision, score,
    hardFail: decision === "HARD_FAIL",
    issues: arr(raw?.issues), revisionRequests: arr(raw?.revisionRequests),
    opinion: String(raw?.opinion ?? "").trim().slice(0, 200),
  };
}

// 실제 LLM 4인 검토 — 실패 시 기존 휴리스틱 보드로 폴백(동일 형태).
export async function reviewByBoardLLM(draft, { existing = [], signal = null, temperature = 0.4, maxTokens = 1200 } = {}) {
  const base = reviewByBoard(draft, { existing });   // 안전장치(hardGate)·품질·등급은 휴리스틱 신뢰
  if (!isLLMConfigured()) return base;

  try {
    const { text } = await callLLM({ system: boardSystemPrompt(), user: boardUserPrompt(draft), temperature, maxTokens, signal });
    const parsed = parseLLMJson(text);
    const list = Array.isArray(parsed?.reviewers) ? parsed.reviewers : null;
    if (!list || list.length < 4) return base;

    const reviewers = ROLES.map((role) => normalizeReviewer(list.find((r) => r?.role === role) || {}, role));
    const hardFailReviewer = reviewers.some((r) => r.hardFail);
    const hardGatePassed = base.hardGate.passed && !hardFailReviewer;  // Hard Gate 는 휴리스틱 유지
    const approvalCount = reviewers.filter((r) => r.decision === "PASS" || r.decision === "PASS_WITH_NOTE").length;
    const reviseCount = reviewers.filter((r) => r.decision === "REVISE").length;
    const notes = reviewers.some((r) => r.decision === "PASS_WITH_NOTE" || r.revisionRequests.length);
    const split = approvalCount === 2 && reviseCount === 2;

    let boardDecision;
    if (!hardGatePassed) boardDecision = "HARD_FAIL";
    else if (split) boardDecision = "SPLIT";
    else if (reviseCount === 0) boardDecision = notes ? "AUTO_APPROVED_WITH_NOTES" : "AUTO_APPROVED";
    else boardDecision = "NEEDS_REVISION";

    return {
      ...base,
      reviewMode: "llm",
      aiReviewStatus: "AI_REVIEWED",
      reviewers,
      boardDecision,
      approvalCount,
      reviseCount,
      split,
      hardGatePassed,
      revisionRequests: [...new Set(reviewers.flatMap((r) => r.revisionRequests))],
    };
  } catch {
    return base;   // LLM 실패 → 휴리스틱 폴백(운영 중단 없음)
  }
}

// 실제 LLM 검수 기반 품의서 — buildDossier 의 board 파라미터에 LLM 보드를 넣어 재계산.
export async function buildDossierLLM(record = {}, { existing = [], budget = null, now = Date.now(), signal = null } = {}) {
  const board = await reviewByBoardLLM(record, { existing, signal });
  return { ...buildDossier(record, { board, now, budget }), reviewMode: board.reviewMode };
}

export { gradeOf };
