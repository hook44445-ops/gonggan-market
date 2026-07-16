// ════════════════════════════════════════════════════════════════════
// 공간라운지 Newsroom Router — Prubi Router + Quality Router + Adaptive Revision
//   (Phase 58 §2·§3·§4)
//
//   기사마다 Topic → Intent → Difficulty → Budget → Expected Quality → LLM 선택 순으로
//   결정한다(Prubi 구조). 단순 기사와 고품질 기사를 같은 모델로 만들지 않는다.
//   품질 목표(BASIC~ENTERPRISE)에 따라 모델·Fusion 개수·검수 횟수·Revision 상한을 자동 결정.
//   REVISION 은 원인을 분석해 해당 담당만 재실행(비용 최소화).
//
//   ⚠️ 기존 Workflow Engine / Approval / Scheduler 무수정 · Additive. 순수 함수 · DB/LLM 없음.
//     실제 모델 호출은 기존 llmProviders/llmClient 구조 그대로(이 모듈은 "결정"만 한다).
// ════════════════════════════════════════════════════════════════════

import { classifyContentType } from "./contentTypes.js";
import { routeCategory } from "./workflowEngine.js";

// ── Quality Router — 품질 목표 티어 ─────────────────────────────────────
//   티어별: 사용 모델 급, Fusion 개수, 검수 횟수, Revision 상한.
export const QUALITY_TIERS = {
  BASIC:      { id: "BASIC",      label: "기본",     minScore: 62, model: "fast",     fusion: 1, reviews: 1, maxRevisions: 0 },
  STANDARD:   { id: "STANDARD",   label: "표준",     minScore: 75, model: "balanced", fusion: 1, reviews: 2, maxRevisions: 1 },
  PREMIUM:    { id: "PREMIUM",    label: "프리미엄", minScore: 85, model: "strong",   fusion: 2, reviews: 3, maxRevisions: 2 },
  EXPERT:     { id: "EXPERT",     label: "전문가",   minScore: 90, model: "top",      fusion: 3, reviews: 4, maxRevisions: 2 },
  ENTERPRISE: { id: "ENTERPRISE", label: "엔터프라이즈", minScore: 94, model: "top",  fusion: 3, reviews: 4, maxRevisions: 3 },
};
export const QUALITY_ORDER = ["BASIC", "STANDARD", "PREMIUM", "EXPERT", "ENTERPRISE"];

// 모델 급 → 대표 OpenRouter 슬러그(기존 구조로 호출됨). 급만 정하고 실제 라우팅은 기존 provider가 처리.
export const MODEL_TIER_SLUG = {
  fast:     "google/gemini-flash-1.5",
  balanced: "openai/gpt-4o-mini",
  strong:   "anthropic/claude-3.5-sonnet",
  top:      "anthropic/claude-3.5-sonnet",
};

// ── Intent 판별 — 기사 목적 ─────────────────────────────────────────────
const INTENT_RULES = [
  { intent: "breaking",  re: /속보|긴급|재난|사고|침수|태풍|지진|화재|통제/, difficulty: 2 },
  { intent: "analysis",  re: /분석|전망|심층|리포트|해설|why|왜|구조|이유/, difficulty: 5 },
  { intent: "guide",     re: /방법|가이드|하는\s*법|정리|체크리스트|팁|how/, difficulty: 3 },
  { intent: "review",    re: /후기|리뷰|비교|추천|평가|best|순위/, difficulty: 3 },
  { intent: "devotional",re: /큐티|묵상|말씀|기도|신앙|운세|점성/, difficulty: 2 },
  { intent: "news",      re: /뉴스|사설|헤드라인|브리핑|발표|정책/, difficulty: 3 },
];
export function detectIntent(topic = "") {
  const t = String(topic);
  for (const r of INTENT_RULES) if (r.re.test(t)) return { intent: r.intent, baseDifficulty: r.difficulty };
  return { intent: "general", baseDifficulty: 3 };
}

// ── Difficulty(1~5) — Intent + 주제 복잡도(길이/전문어) ─────────────────
export function estimateDifficulty(topic = "", intent = null) {
  const it = intent || detectIntent(topic).intent;
  const base = detectIntent(topic).baseDifficulty;
  let d = base;
  const t = String(topic);
  if (/경제|금리|투자|주식|법률|의료|과학|ai|인공지능|반도체|정책/i.test(t)) d += 1; // 전문 영역
  if (t.length >= 22) d += 1; // 복합 주제
  void it;
  return Math.max(1, Math.min(5, d));
}

// ── Prubi Router — Topic→Intent→Difficulty→Budget→Expected Quality→LLM ──
//   budget: 'low'|'normal'|'high'(관리자 정책) — 낮으면 티어 하향, 높으면 상향.
export function prubiRoute(article = {}, { budget = "normal", targetQuality = null } = {}) {
  const topic = String(article.title ?? article.ai_topic ?? article.topic ?? "");
  const type = article.content_type || classifyContentType(topic);
  const { intent } = detectIntent(topic);
  const difficulty = estimateDifficulty(topic, intent);

  // Difficulty → 기본 품질 티어.
  let tierIdx = difficulty <= 1 ? 0 : difficulty === 2 ? 1 : difficulty === 3 ? 2 : difficulty === 4 ? 3 : 4;
  // Budget 보정.
  if (budget === "low") tierIdx = Math.max(0, tierIdx - 1);
  if (budget === "high") tierIdx = Math.min(QUALITY_ORDER.length - 1, tierIdx + 1);
  // 관리자 지정 목표 품질 우선.
  if (targetQuality && QUALITY_TIERS[targetQuality]) tierIdx = QUALITY_ORDER.indexOf(targetQuality);

  const tierId = QUALITY_ORDER[tierIdx];
  const tier = QUALITY_TIERS[tierId];
  const route = routeCategory({ ...article, content_type: type });
  const modelSlug = MODEL_TIER_SLUG[tier.model];

  return {
    topic, intent, difficulty,
    budget,
    expectedQuality: tier.minScore,
    qualityTier: tierId,
    tierLabel: tier.label,
    model: modelSlug,
    modelClass: tier.model,
    fusionCount: tier.fusion,
    reviewRounds: tier.reviews,
    maxRevisions: tier.maxRevisions,
    category: route.id,
    categoryLabel: route.label,
    pipeline: route.steps,
    plan: [
      `Topic: ${topic.slice(0, 40)}`,
      `Intent: ${intent}`,
      `Difficulty: ${difficulty}/5`,
      `Budget: ${budget}`,
      `Expected Quality: ${tier.minScore}+ (${tier.label})`,
      `LLM: ${modelSlug} × Fusion ${tier.fusion}`,
      `검수 ${tier.reviews}회 · Revision ≤${tier.maxRevisions}`,
    ],
  };
}

// ── Adaptive Revision — REVISION 원인 분석 → 해당 담당만 재실행 ──────────
//   board(reviewByBoard 결과)의 리뷰어별 REVISE 를 원인으로 매핑한다.
//     seo → SEO만 재실행 · fact_checker → 팩트체커만 · writer → Writer 재작성 · chief_editor → 편집장 보정
const ROLE_ACTION = {
  writer:       { cause: "structure", rerun: "writer",       label: "구조/본문 → Writer 재작성" },
  fact_checker: { cause: "fact",      rerun: "fact_checker", label: "팩트 문제 → 팩트체커만 재실행" },
  seo:          { cause: "seo",       rerun: "seo",          label: "SEO 문제 → SEO만 재실행" },
  chief_editor: { cause: "editorial", rerun: "chief_editor", label: "편집 문제 → 편집장 보정" },
};

export function adaptiveRevisionPlan(board = {}) {
  const reviewers = Array.isArray(board.reviewers) ? board.reviewers : [];
  const reviseRoles = reviewers.filter((r) => r.decision === "REVISE").map((r) => r.role);
  const hardFail = board.hardGatePassed === false || reviewers.some((r) => r.hardFail);

  if (hardFail) {
    return { strategy: "HARD_FAIL", rerun: [], full: false, reason: "안전 게이트 실패 → 종료·관리자 알림", steps: [] };
  }
  if (reviseRoles.length === 0) {
    return { strategy: "NONE", rerun: [], full: false, reason: "REVISE 없음 → 재실행 불필요", steps: [] };
  }
  // 원인별 부분 재실행(전체 재작성 회피 → 비용 최소화).
  const steps = reviseRoles.map((role) => ROLE_ACTION[role] || { cause: "other", rerun: role, label: `${role} 재실행` });
  // writer 재작성이 포함되면 하류(SEO/팩트)는 재작성 후 자동 재검토 대상.
  const full = reviseRoles.includes("writer") && reviseRoles.length >= 3;
  return {
    strategy: full ? "FULL_REWRITE" : "PARTIAL",
    rerun: [...new Set(steps.map((s) => s.rerun))],
    causes: [...new Set(steps.map((s) => s.cause))],
    full,
    reason: full ? "다수 항목 REVISE → 전체 재작성" : "원인 담당만 부분 재실행(비용 최소화)",
    steps,
  };
}

// 부분 재실행 비용 절감 추정(전체 재작성 대비). rerun 담당 수 / 전체 4.
export function revisionCostSaving(plan) {
  if (!plan || plan.strategy === "NONE" || plan.strategy === "HARD_FAIL") return 0;
  if (plan.full) return 0;
  const reran = plan.rerun.length;
  return Math.round((1 - reran / 4) * 100); // 예: 1명만 재실행 → 75% 절감
}
