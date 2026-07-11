// ════════════════════════════════════════════════════════════════════
// 공간라운지 Quality Refiner — 생성→평가→보완→재평가 루프 (Phase 42)
//
//   초안을 한 번 만들고 끝내지 않는다: 평가 후 85점 미만이면 "약점 항목만" 골라 보완하고
//   재평가한다. 최대 2회 보완 후에도 미달이면 관리자 검토대기로 넘긴다.
//   · 점수를 강제로 올리지 않는다 — 매 라운드 실제 evaluateQuality 로 재채점한다.
//   · generate/refine 는 주입(운영=callLLM, 테스트=mock). evaluate 기본=결정론적 휴리스틱.
//   · 품질점수 신뢰성: 평가는 생성과 분리된 "별도 평가 프롬프트 + JSON 출력"을 사용하도록
//     buildEvalPrompt 을 제공(운영에서 LLM 교차검증 시). 기본 파이프라인은 휴리스틱 평가로
//     자기채점 인플레이션을 원천 차단한다.
//   ⚠️ 순수 오케스트레이션 · 저장/DB/Cron 없음 · additive. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { evaluateQuality, QUALITY_PASS, RUBRIC_LABELS } from "./qualityEvaluator.js";

// 밴드 → 허용 보완 횟수(요청 스펙: 80~84=1회, 70~79=2회, 그 외 0 또는 재생성).
export function allowedBoosts(band) {
  return band === "보완1" ? 1 : band === "보완2" ? 2 : (band === "재생성" ? 2 : 0);
}

// 평가 전용 LLM 프롬프트(JSON 출력) — 생성과 분리된 교차평가용(운영 옵션).
export function buildEvalPrompt(draft = {}, type = null) {
  const items = Object.values(RUBRIC_LABELS).join(", ");
  return {
    system:
      "당신은 한국어 콘텐츠 품질 심사관입니다. 글을 과장 없이 냉정하게 평가합니다. " +
      "점수를 임의로 올리지 말고, 근거가 없으면 낮게 주세요. 반드시 JSON만 출력합니다.",
    user:
      `유형: ${type || "일반"}\n다음 글을 100점 기준으로 항목별(${items}) 평가하고, ` +
      `아래 JSON 스키마로만 답하세요.\n` +
      `{"totalScore":0,"passed":false,"weakPoints":[],"revisions":[]}\n\n` +
      `[제목]\n${draft.title ?? ""}\n\n[본문]\n${(draft.content ?? draft.body ?? "").slice(0, 4000)}`,
  };
}

// 보완 전용 LLM 프롬프트 — "약점 항목만" 선택적으로 고치도록 지시(분량 뻥튀기·반복·과장 금지).
export function buildBoostPrompt(draft = {}, ev = {}, type = null) {
  const weak = (ev.weakPoints || []).join(", ") || "전반적 완성도";
  const fixes = (ev.revisions || []).map((r, i) => `${i + 1}) ${r}`).join("\n") || "부족한 부분 보완";
  return {
    system:
      "당신은 한국어 콘텐츠 에디터입니다. 기존 글의 강점은 유지하고, 지정된 약점만 개선합니다. " +
      "규칙: 같은 문장 반복으로 분량만 늘리지 말 것, 출처 없는 수치·인용 생성 금지, " +
      "SEO 키워드 과다삽입 금지, 사실 확인 없이 부풀리기 금지. 개선된 전체 본문만 출력합니다.",
    user:
      `유형: ${type || "일반"}\n약점: ${weak}\n\n[개선 지침]\n${fixes}\n\n` +
      `[제목]\n${draft.title ?? ""}\n\n[본문]\n${draft.content ?? draft.body ?? ""}`,
  };
}

// 핵심 루프. deps:{ generate:()=>draft, refine:(draft,ev)=>draft|null, evaluate? }
//   opts:{ minScore, maxBoosts } — maxBoosts 미지정 시 첫 평가 밴드로 자동 결정.
export async function refineToQuality(
  { generate, refine, evaluate = (d) => evaluateQuality(d) } = {},
  { minScore = QUALITY_PASS, maxBoosts = null } = {}
) {
  if (typeof generate !== "function") throw new Error("generate 함수가 필요합니다");
  let draft = await generate();
  let ev = evaluate(draft);
  const cap = Number.isFinite(maxBoosts) ? maxBoosts : allowedBoosts(ev.band);
  const history = [{ round: 0, score: ev.totalScore, band: ev.band, weakPoints: ev.weakPoints }];
  let boosts = 0;

  while (ev.totalScore < minScore && boosts < cap && typeof refine === "function") {
    let improved = null;
    try { improved = await refine(draft, ev); } catch { improved = null; }
    if (!improved) break;
    const nextDraft = typeof improved === "string" ? { ...draft, content: improved } : improved;
    const nextEv = evaluate(nextDraft);
    boosts += 1;
    // 보완이 점수를 떨어뜨리면 이전 버전 유지(퇴보 방지).
    if (nextEv.totalScore >= ev.totalScore) { draft = nextDraft; ev = nextEv; }
    history.push({ round: boosts, score: nextEv.totalScore, band: nextEv.band, weakPoints: nextEv.weakPoints });
    if (ev.totalScore >= minScore) break;
  }

  const status = ev.totalScore >= minScore ? "approved_ready" : "needs_review";
  return {
    draft, eval: ev, score: ev.totalScore, boosts, history, status,
    // 요청 JSON 구조 요약.
    result: { totalScore: ev.totalScore, passed: status === "approved_ready", weakPoints: ev.weakPoints, revisions: ev.revisions },
  };
}
