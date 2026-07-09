// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI 편집국 — 편집회의 오케스트레이션 (Phase 2·AI Editor)
//
//   글을 생성하기 "전에" 편집회의를 연다:
//     오늘 이슈 → 가치 평가 → 공간 관련성 평가 → 카테고리 결정 → (생성)
//
//   목표는 콘텐츠의 "양"이 아니라 "경쟁력"이다. 각 이슈를 공간 관점으로 재해석하고,
//   "이 글은 공간라운지에서만 볼 수 있는가?" 게이트를 통과하는 것만 오늘 만들 콘텐츠로 뽑는다.
//
//   결정론적(외부 API 없음). Phase 3 에서 LLM 이 붙으면 각 평가 함수 내부만 교체한다.
// ════════════════════════════════════════════════════════════════════

import { reinterpretThroughSpace } from "../constants/spacePhilosophy.js";
import { generateDraft, classifyCategory } from "../constants/aiContentFactory.js";
import { scoreTopic } from "./topicScore.js";
import { scoreContent, isLoungeUnique, REWRITE_THRESHOLD } from "./contentScore.js";

// 가치 평가 — 이 이슈로 글을 만들 "가치"가 있는가(0~100). 재해석된 "공간 앵글"까지 함께
//   평가한다 — 철학상 모든 이슈는 공간 관점으로 재해석되므로, 날것의 키워드가 아니라
//   재해석 결과의 관련도를 본다(시의성/관련도 기반, topicScore 재사용).
function evaluateValue(topic, region, reinterpretation) {
  const framed = `${topic} ${reinterpretation.spaceAngle}`;
  const s = scoreTopic({ topic: framed, region, collectedAt: null });
  return Math.round(s.total * 0.6 + s.interiorRelevance * 0.4);
}

// 공간 관련성 평가 — 구체 렌즈로 재해석되면 높게, 일반(default) 렌즈면 중간(보류 유도).
function evaluateSpaceRelevance(reinterpretation) {
  return reinterpretation.lensId === "life" ? 55 : 85;
}

// 이슈 1건에 대한 편집회의 결과(생성 전).
//   { topic, spaceKeyword, spaceAngle, category, chain, valueScore, spaceScore, verdict }
export function reviewIssue(topic, { region = null } = {}) {
  const reinterpretation = reinterpretThroughSpace(topic);
  const valueScore = evaluateValue(topic, region, reinterpretation);
  const spaceScore = evaluateSpaceRelevance(reinterpretation);
  const decidedCategory = reinterpretation.category || classifyCategory(topic);
  // 가치·공간 관련성 모두 기준선을 넘어야 "제작(make)". 하나라도 낮으면 보류(hold).
  const verdict = valueScore >= 60 && spaceScore >= 60 ? "make" : "hold";
  return {
    topic,
    spaceKeyword: reinterpretation.spaceKeyword,
    spaceAngle:   reinterpretation.spaceAngle,
    category:     decidedCategory,
    chain:        reinterpretation.chain,
    valueScore,
    spaceScore,
    verdict,
  };
}

// 편집회의 — 오늘의 이슈 목록 전체를 심의해 우선순위대로 정렬한 편성표를 만든다.
//   issues: [{ topic, region? }] 또는 [{ topic }]  (dailyIssues.generateDailyIssues() 결과 호환)
export function runEditorialMeeting(issues = []) {
  return issues
    .map((it) => reviewIssue(it.topic, { region: it.region ?? null }))
    .sort((a, b) => (b.valueScore + b.spaceScore) - (a.valueScore + a.spaceScore));
}

// 오늘 만들 콘텐츠 자동 선정 — 편성표에서 "make" 판정만, 상위 N개.
export function selectTodaysContent(meeting = [], n = 20) {
  return meeting.filter((m) => m.verdict === "make").slice(0, n);
}

// 생성 → 자기평가 → (미달 시) 재작성. 결정론적 엔진에서 "재작성"은 대체 공간 앵글로
//   변주를 만들어 가장 높은 점수의 초안을 고르는 것으로 구현한다(Phase 3: LLM 재작성으로 교체).
//   반환: { draft, score, attempts, passed }  — draft 는 generateDraft() 와 동일한 형태.
export function generateReviewedDraft({ issue, spaceAngle, category, region = null } = {}, { maxAttempts = 3 } = {}) {
  const angles = [
    spaceAngle,
    `${issue}, 우리 공간부터 점검하기`,
    `${issue} 시대의 공간 활용 노하우`,
  ].filter(Boolean);

  let best = null;
  let attempts = 0;
  for (let i = 0; i < Math.min(maxAttempts, angles.length); i++) {
    attempts += 1;
    const draft = generateDraft({ issue, spaceAngle: angles[i], category, region });
    const score = scoreContent(draft);
    if (!best || score.total > best.score.total) best = { draft, score };
    if (score.total >= REWRITE_THRESHOLD && isLoungeUnique(score)) break; // 통과하면 즉시 채택.
  }

  return {
    draft:    best.draft,
    score:    best.score,
    attempts,
    passed:   best.score.total >= REWRITE_THRESHOLD && isLoungeUnique(best.score),
  };
}
