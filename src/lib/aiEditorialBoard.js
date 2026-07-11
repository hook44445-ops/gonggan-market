// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI Editorial Board — AI 조직 4인 승인 (Phase 43)
//
//   하나의 콘텐츠를 4개 AI 역할이 각자 관점으로 검토한다.
//     1) 작성 담당  2) 팩트체커  3) SEO 담당  4) 편집장
//   각 역할은 { role, decision, score, hardFail, issues[], revisionRequests[] } 를 반환하고,
//   보드는 이를 집계해 { boardDecision, approvalCount, ... , hardGatePassed } 를 만든다.
//
//   ⚠️ 발행 우선 원칙: 품질점수는 발행을 막는 절대 기준이 아니라 보정 강도·등급 참고용.
//     Hard Fail(허위·위험 단정·금칙어·심각중복·본문 공백·PII·유형 심각위반)만 발행을 차단한다.
//   ⚠️ Regression Zero: 기존 evaluateQuality / evaluateGate / detectPII 재사용(무수정).
//     결정론적 순수 함수 · 저장/DB/LLM 없음.
// ════════════════════════════════════════════════════════════════════

import { evaluateQuality, RUBRIC_LABELS } from "./qualityEvaluator.js";
import { evaluateGate, checkBannedWords } from "./autoPublishGate.js";
import { detectPII } from "../utils/loungeSeo.js";

// 위험한 의료·법률·금융 단정 + 명백 허위 신호(Hard Fail 후보).
const DANGER_CLAIMS = [
  /반드시\s*(낫|치료|완치|효과)/, /100\s*%\s*(수익|승소|합격|완치|보장)/,
  /무조건\s*(오른|수익|승소|합격|낫)/, /확정\s*수익/, /절대\s*안전한\s*투자/,
  /원금\s*보장/, /즉시\s*완치/,
];
const MALICIOUS = /(<script|javascript:|onerror\s*=|onclick\s*=|data:text\/html|bit\.ly\/|tinyurl\.com\/)/i;
const NEWS_NUM = /\d+(\.\d+)?\s*(%|퍼센트|억|만원|원|명|건|배)/;
const SOURCE_CUE = /(출처|근거|자료|보도|발표|기준|참고|according)/;

const B = (body) => String(body ?? "");
const full = (d) => `${d.title ?? ""}\n${B(d.content ?? d.body)}`;
// 만점 대비 정규화(0~100).
const pctOf = (breakdown, keys) => {
  const s = keys.reduce((a, k) => a + (breakdown[k]?.score ?? 0), 0);
  const m = keys.reduce((a, k) => a + (breakdown[k]?.max ?? 0), 0);
  return m ? Math.round((s / m) * 100) : 0;
};
// 점수 → decision(발행 우선: 웬만하면 PASS/NOTE, 심각할 때만 REVISE).
const decideBy = (score, hardFail) => hardFail ? "REVISE" : score >= 80 ? "PASS" : score >= 62 ? "PASS_WITH_NOTE" : "REVISE";

// 1) 작성 담당 — 주제충실도·본문구성·문장·최소길이·반복·마무리.
export function reviewWriter(draft, ev) {
  const body = B(draft.content ?? draft.body);
  const score = pctOf(ev.breakdown, ["contentDepth", "structure", "toneNatural", "dedupe", "ctaClosing"]);
  const emptyBody = body.replace(/\s/g, "").length < 80; // 본문 사실상 공백 → Hard Fail(near-empty만)
  const issues = [], rev = [];
  if (ev.breakdown.structure.score < ev.breakdown.structure.max * 0.6) { issues.push("본문 구성/가독성 약함"); rev.push("도입·소제목(H2/H3)·결론으로 구조 정리"); }
  if (ev.breakdown.dedupe.score < ev.breakdown.dedupe.max * 0.7) { issues.push("반복 문장"); rev.push("반복 문장 제거"); }
  if (ev.breakdown.ctaClosing.score < ev.breakdown.ctaClosing.max * 0.6) rev.push("마무리 요약 보강");
  if (emptyBody) issues.push("본문이 사실상 비어 있음");
  return { role: "writer", decision: decideBy(score, emptyBody), score, hardFail: emptyBody, issues, revisionRequests: rev };
}

// 2) 팩트체커 — 허위·출처없는 수치·시점오류·사실/의견·위험 단정.
export function reviewFactChecker(draft, ev) {
  const f = full(draft);
  const danger = DANGER_CLAIMS.some((re) => re.test(f));
  const banned = checkBannedWords(f);
  const newsish = ev.typeGroup === "news";
  const fabNumber = newsish && NEWS_NUM.test(f) && !SOURCE_CUE.test(f); // 뉴스에 출처없는 구체 수치
  const hardFail = danger || banned.length > 0;
  // 점수: 사실성 항목(15) → 100 환산 + 위험 감점.
  let score = Math.round((ev.factuality / 15) * 100);
  if (fabNumber) score = Math.max(0, score - 20);
  if (danger) score = Math.min(score, 30);
  const issues = [], rev = [];
  if (danger) { issues.push("위험한 의료·법률·금융 단정"); rev.push("단정 표현 제거 또는 '참고' 고지 추가"); }
  if (banned.length) issues.push(`금칙어(${banned.join(", ")})`);
  if (fabNumber) { issues.push("출처 없는 구체 수치"); rev.push("수치에 출처 표기 또는 제거"); }
  if (newsish && !/\d{4}[.\-년]|\d{1,2}월|\d{1,2}일|오늘|어제/.test(f)) rev.push("뉴스 날짜·시점 명시");
  return { role: "fact_checker", decision: decideBy(score, hardFail), score, hardFail, issues, revisionRequests: rev };
}

// 3) SEO 담당 — 검색의도·제목·키워드 자연스러움·중복.
export function reviewSeo(draft, ev, { existing = [] } = {}) {
  const score = pctOf(ev.breakdown, ["searchIntent", "titleQuality", "seoNatural"]);
  // 심각 중복 = 최근 코퍼스에 동일 제목 존재.
  const title = String(draft.title ?? "").trim();
  const dupHard = !!title && existing.some((e) => String(e.title ?? "").trim() === title && (e.id == null || e.id !== draft.id));
  const issues = [], rev = [];
  if (ev.breakdown.seoNatural.score < ev.breakdown.seoNatural.max * 0.6) rev.push("핵심키워드·연관어를 제목·소제목·본문에 자연스럽게 반영");
  if (ev.breakdown.titleQuality.score < ev.breakdown.titleQuality.max * 0.7) rev.push("구체적 대상·숫자로 제목 명료화");
  if (dupHard) issues.push("의미 없는 중복·복제 글");
  return { role: "seo", decision: decideBy(score, dupHard), score, hardFail: dupHard, issues, revisionRequests: rev };
}

// 4) 편집장 — 전체 품질·문체·읽을 가치·과도한 홍보·최종 발행 가능.
export function reviewChiefEditor(draft, ev) {
  const score = ev.totalScore;
  const promo = /(최저가|무조건 싸|강력 추천|지금 바로 신청|1위 업체)/.test(full(draft));
  const issues = [], rev = [];
  if (promo) { issues.push("과도한 홍보"); rev.push("홍보성 문구 완화"); }
  if (ev.weakPoints.length) rev.push(...ev.revisions.slice(0, 2));
  // 편집장은 품질 저하만으로 Hard Fail 하지 않는다(발행 우선). 홍보는 note 수준.
  const decision = score >= 85 ? "PASS" : score >= 70 ? "PASS_WITH_NOTE" : "REVISE";
  return { role: "chief_editor", decision, score, hardFail: false, issues, revisionRequests: [...new Set(rev)] };
}

// 필수 안전 게이트(Hard Gate) — 점수와 무관하게 반드시 통과해야 함.
export function hardSafetyGate(draft, { existing = [] } = {}) {
  const f = full(draft);
  const banned = checkBannedWords(f);
  const pii = detectPII(f);
  const malicious = MALICIOUS.test(f);
  const danger = DANGER_CLAIMS.some((re) => re.test(f));
  const bodyLen = B(draft.content ?? draft.body).replace(/\s/g, "").length;
  const emptyBody = bodyLen < 80;
  // 기존 Safety Gate 재사용(품질/SEO/Review 는 발행 우선이라 비활성, 금칙어·중복·길이만 하드).
  const gate = evaluateGate(
    { title: draft.title, content: draft.content ?? draft.body, category: draft.category, ai_topic: draft.ai_topic },
    { existing, stage: "approved", cfg: { minQuality: 0, minConfidence: 0, seoCheck: false, reviewRequired: false, minBodyLength: 150, minHeadings: 0, dupHours: 48 } }
  );
  const checks = {
    noBanned: banned.length === 0,
    noPII: !pii,
    noMalicious: !malicious,
    noDangerClaim: !danger,
    notDuplicate: gate.checks.duplicate.ok,
    minBody: !emptyBody && gate.checks.aiCheck.ok,
  };
  const passed = Object.values(checks).every(Boolean);
  const reasons = [];
  if (!checks.noBanned) reasons.push(`금칙어(${banned.join(", ")})`);
  if (!checks.noPII) reasons.push("개인정보 노출");
  if (!checks.noMalicious) reasons.push("악성 코드/비정상 링크");
  if (!checks.noDangerClaim) reasons.push("위험한 의료·법률·금융 단정");
  if (!checks.notDuplicate) reasons.push("심각한 중복");
  if (!checks.minBody) reasons.push("본문 길이 부족/공백");
  return { passed, checks, reasons };
}

// 등급(발행 우선 — 점수는 등급 참고용).
export function gradeOf(score) {
  return score >= 90 ? "EXCELLENT" : score >= 85 ? "GOOD" : score >= 80 ? "STANDARD" : score >= 70 ? "BASIC" : "CONDITIONAL";
}

// 보드 1회 검토 — 4인 결과 + Hard Gate 집계.
export function reviewByBoard(draft, { existing = [], evaluation = null } = {}) {
  const ev = evaluation || evaluateQuality(draft);
  const reviewers = [
    reviewWriter(draft, ev),
    reviewFactChecker(draft, ev),
    reviewSeo(draft, ev, { existing }),
    reviewChiefEditor(draft, ev),
  ];
  const hard = hardSafetyGate(draft, { existing });
  const hardFailReviewer = reviewers.some((r) => r.hardFail);
  const hardGatePassed = hard.passed && !hardFailReviewer;
  const approvalCount = reviewers.filter((r) => r.decision === "PASS" || r.decision === "PASS_WITH_NOTE").length;
  const reviseCount = reviewers.filter((r) => r.decision === "REVISE").length;
  const notes = reviewers.some((r) => r.decision === "PASS_WITH_NOTE" || r.revisionRequests.length);
  const split = approvalCount === 2 && reviseCount === 2;

  // 단일 라운드 판정(루프 제어는 정책에서).
  let boardDecision;
  if (!hardGatePassed) boardDecision = "HARD_FAIL";
  else if (split) boardDecision = "SPLIT";
  else if (reviseCount === 0) boardDecision = notes ? "AUTO_APPROVED_WITH_NOTES" : "AUTO_APPROVED";
  else boardDecision = "NEEDS_REVISION";

  // 모든 리뷰어의 보정 요청 취합(약점만 보정용).
  const revisionRequests = [...new Set(reviewers.flatMap((r) => r.revisionRequests))];

  return {
    boardDecision,
    approvalCount,
    totalReviewers: 4,
    // ⑧ 정직한 상태 구분: 이 보드는 규칙 기반(휴리스틱) 사전검사이며 실제 LLM 검수가 아니다.
    reviewMode: "heuristic",
    heuristicStatus: hardGatePassed ? "HEURISTIC_PASS" : "HEURISTIC_FAIL",
    aiReviewStatus: "AI_REVIEW_PENDING",
    qualityScore: ev.totalScore,
    grade: gradeOf(ev.totalScore),
    hardGatePassed,
    hardGate: hard,
    split,
    reviewers,
    revisionRequests,
    weakPoints: ev.weakPoints,
    labels: RUBRIC_LABELS,
  };
}
