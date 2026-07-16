// ════════════════════════════════════════════════════════════════════
// 공간라운지 Pipeline Gate — Prubi 배치·사전생성 게이트·BOARD_APPROVED v2·Adaptive 실행
//   (Phase 59 §1·§5·§6 + §2/§3/§4/§7 오케스트레이션)
//
//   미리보기 수준이던 Prubi Router / Adaptive Revision 을 실제 생성·검수·승인 게이트로 연결한다.
//     · staffPipeline: intent 별 OpenRouter 직원 파이프라인 배치(§1)
//     · preGenerationGate: 반복·엔티티집중·신선도·날짜를 생성 전에 검증(§2/§3/§4/§7)
//     · executeAdaptiveRevision: REVISE 원인 담당만 재작업 + 해당 서명 무효화(§5)
//     · boardApprovalV2: 4인 PASS/NOTE + REVISE 0 + 날짜/중복/유사도/신선도까지 만족해야 승인(§6)
//
//   ⚠️ 기존 Workflow Engine 상태정의·Scheduler·Executor·Approval 코어 무수정 · 신규 검증기.
// ════════════════════════════════════════════════════════════════════

import { prubiRoute, adaptiveRevisionPlan } from "./newsroomRouter.js";
import { boardGate, buildWorkflowQueue, WORKFLOW_STATES } from "./workflowEngine.js";
import { isRepeat, entityOverCap, entityConcentration, primaryEntity } from "./repetitionGuard.js";
import { freshnessVerdict, pickStructure, noveltyScore } from "./freshnessEngine.js";
import { checkDateConsistency } from "./editorialDateGuard.js";

// ── §1 Prubi 직원 배치 — intent 별 파이프라인 ────────────────────────────
const STAFF_PIPELINES = {
  breaking:   ["속보기자", "팩트체커", "편집장"],
  analysis:   ["리서처", "심층기자", "팩트체커", "SEO", "편집장"],
  data:       ["데이터분석가", "기자", "팩트체커", "편집장"],
  guide:      ["기자", "SEO", "편집장"],
  review:     ["기자", "팩트체커", "SEO", "편집장"],
  devotional: ["신앙콘텐츠담당", "문맥검토", "편집장"],
  news:       ["기자", "팩트체커", "SEO", "편집장"],
  space:      ["공간기자", "SEO", "이미지담당", "편집장"],
  general:    ["기자", "SEO", "편집장"],
};

export function staffPipeline(article = {}, opts = {}) {
  const prubi = prubiRoute(article, opts);
  // 공간매거진 카테고리는 전용 파이프라인.
  const key = prubi.category === "magazine" ? "space" : (STAFF_PIPELINES[prubi.intent] ? prubi.intent : "general");
  const roles = STAFF_PIPELINES[key];
  return {
    intent: prubi.intent,
    difficulty: prubi.difficulty,
    qualityTier: prubi.qualityTier,
    model: prubi.model,
    fusionCount: prubi.fusionCount,
    reviewRounds: prubi.reviewRounds,
    maxRevisions: prubi.maxRevisions,
    pipelineKey: key,
    pipeline: roles,
    prubi,
  };
}

// ── §2/§3/§4/§7 사전 생성 게이트 — 생성 전에 통과해야 저장/발행 가능 ──────
export function preGenerationGate(candidate = {}, existing = [], { override = {}, now = Date.now(), simThreshold = 0.5 } = {}) {
  const nv = freshnessVerdict(candidate, existing, { override, now });
  const hasNewSignal = nv.signalCount >= 2 && (nv.signals.newEvent || nv.signals.newOfficialData || nv.signals.newSource);
  const rep = isRepeat(candidate, existing, { now, simThreshold, hasNewSignal });
  const ent = entityOverCap(candidate, existing, { now });
  const date = checkDateConsistency(candidate, { now });
  const struct = pickStructure(candidate, existing);

  const reasons = [];
  let action = "GENERATE";
  // 1) 반복 차단(새 신호 없으면).
  if (rep.repeat) { action = "BLOCK"; reasons.push(`반복: ${rep.reason}(유사도 ${rep.similarity})`); }
  // 2) 신선도.
  else if (nv.verdict === "DISCARD") { action = "BLOCK"; reasons.push(nv.reason); }
  else if (nv.verdict === "PIVOT") { action = "PIVOT"; reasons.push("다른 각도로 전환"); }
  else if (nv.needsAugment) { action = "AUGMENT"; reasons.push("관점·자료 보강 후 재평가"); }
  // 3) 엔티티 집중(생성은 하되 지연 권고).
  if (ent.over) { if (action === "GENERATE") action = "DEFER"; reasons.push(`엔티티 집중: ${ent.entity} 오늘 ${Math.round(ent.projectedShare * 100)}%`); }
  // 4) 날짜(차단이 아니라 보정 대상).
  const dateRevise = date.verdict === "DATE_REVISE";
  if (dateRevise) reasons.push(date.reason);

  return {
    allow: action === "GENERATE" || action === "AUGMENT" || action === "DEFER",
    action,             // GENERATE | AUGMENT | PIVOT | DEFER | BLOCK
    reasons,
    novelty: { score: nv.score, verdict: nv.verdict, signalCount: nv.signalCount, signals: nv.signals },
    repeat: rep,
    entity: ent,
    date: { verdict: date.verdict, editorialDate: date.editorialDate, staleDates: date.staleDates, dateRevise },
    structure: struct,
  };
}

// ── §5 Adaptive Revision 실행 — 원인 담당만 재작업 + 서명 무효화 ──────────
//   signatures: { writer:bool, fact_checker:bool, seo:bool, chief_editor:bool } (서명 여부)
export function executeAdaptiveRevision(board = {}, signatures = {}, { targetInstructions = {} } = {}) {
  const plan = adaptiveRevisionPlan(board);
  if (plan.strategy === "HARD_FAIL") {
    return { plan, action: "HALT_TO_EXCEPTION", updatedSignatures: signatures, reReview: [], instructions: [] };
  }
  if (plan.strategy === "NONE") {
    return { plan, action: "ADVANCE", updatedSignatures: signatures, reReview: [], instructions: [] };
  }
  // 재작업 담당의 서명을 무효화하고 같은 담당이 재검토·재서명하도록 표시.
  const updated = { ...signatures };
  const reReview = [];
  const instructions = [];
  const EDIT = {
    seo: "제목·소제목·키워드만 보정",
    fact_checker: "사실 관련 문장과 출처만 재작성",
    writer: "도입·H2/H3·결론만 재구성",
    chief_editor: "편집 방향 보정",
  };
  for (const role of plan.rerun) {
    updated[role] = false;              // 기존 서명 무효화
    reReview.push(role);                // 같은 담당 재검토
    instructions.push({ role, edit: targetInstructions[role] || EDIT[role] || `${role} 부분 재작업` });
  }
  return {
    plan,
    action: plan.full ? "FULL_REWRITE" : "PARTIAL_REWORK",
    updatedSignatures: updated,
    reReview,
    instructions,
  };
}

// ── §9 운영센터 신선도/반복 지표 — DB records 에서 파생(관측) ──────────────
export function newsroomInsights(records = [], { now = Date.now() } = {}) {
  const { items } = buildWorkflowQueue(records, { now });
  const active = records.filter((r) => ["draft", "review", "approved", "scheduled", "publishing", "published"].includes(r.publish_status || "draft"));
  const drafts = active.filter((r) => (r.publish_status || "draft") === "draft");

  // noveltyScore 평균(초안 대상, 상호 비교).
  let nvSum = 0, nvN = 0, repeatN = 0, dateFixN = 0;
  for (const d of drafts) {
    const others = active.filter((x) => x.id !== d.id);
    const nv = noveltyScore(d, others, { now });
    nvSum += nv.score; nvN += 1;
    const rep = isRepeat(d, others, { now });
    if (rep.repeat) repeatN += 1;
    if (checkDateConsistency(d, { now }).verdict === "DATE_REVISE") dateFixN += 1;
  }

  const conc = entityConcentration(active, { now });
  const topEntity = conc.rows[0] || null;
  const entityRepeatRate = conc.total ? Math.round(((topEntity?.count || 0) / conc.total) * 100) : 0;

  // 최종 BOARD_APPROVED율(검토된 것 중 승인/이후 단계 비율).
  const reviewed = items.filter((it) => it.state !== WORKFLOW_STATES.DRAFT);
  const approvedLike = items.filter((it) => [WORKFLOW_STATES.APPROVED, WORKFLOW_STATES.CHIEF_SECRETARY, WORKFLOW_STATES.SCHEDULED, WORKFLOW_STATES.PUBLISHING, WORKFLOW_STATES.PUBLISHED].includes(it.state)).length;

  return {
    newTopicCandidates: drafts.length - repeatN,
    repeatBlocked: repeatN,
    noveltyAvg: nvN ? Math.round(nvSum / nvN) : null,
    dateFix: dateFixN,
    topicConcentration: topEntity ? { entity: topEntity.entity, share: entityRepeatRate } : null,
    entityRepeatRate,
    overCapEntities: conc.overCapEntities.map((e) => e.entity),
    boardApprovedRate: reviewed.length ? Math.round((approvedLike / reviewed.length) * 100) : null,
    reviewed: reviewed.length,
    note: "반복차단·DateFix·Adaptive 수치는 활성 DB 기준 파생(런타임 카운터 아님)",
  };
}

// primaryEntity 재노출(운영센터 편의).
export { primaryEntity };

// ── §6 BOARD_APPROVED v2 — 서명 개수 아닌 종합 조건 ──────────────────────
export function boardApprovalV2(draft = {}, { board, existing = [], now = Date.now(), override = {}, minNovelty = 40, simThreshold = 0.85 } = {}) {
  const gate = boardGate(board);                       // 4인 PASS/NOTE + Hard Gate + REVISE 0
  const date = checkDateConsistency(draft, { now });
  const rep = isRepeat(draft, existing, { now, simThreshold, hasNewSignal: true });
  const nv = freshnessVerdict(draft, existing, { override, now });

  const conditions = {
    boardAllPassOrNote: gate.approved,                 // 4인 PASS/PASS_WITH_NOTE
    noUnresolvedRevise: gate.reviseRoles.length === 0, // 미해결 REVISE 0
    noHardFail: !gate.hardFail,                        // HARD_FAIL 0
    dateConsistent: date.consistent,                   // 날짜 일치
    noTitleDuplicate: !(rep.repeat && (rep.reason === "SAME_NORMALIZED_TITLE")),
    bodySimilarityOk: !(rep.repeat && (rep.reason === "SAME_BODY_HASH" || rep.reason === "HIGH_SIMILARITY")),
    noveltyOk: nv.score >= minNovelty && nv.hasNewInfo,
  };
  const approved = Object.values(conditions).every(Boolean);
  const failed = Object.entries(conditions).filter(([, v]) => !v).map(([k]) => k);

  return {
    approved,
    conditions,
    failedConditions: failed,
    reason: approved ? "BOARD_APPROVED" : `미충족: ${failed.join(", ")}`,
    handoff: approved ? "CHIEF_SECRETARY" : (gate.hardFail ? "EXCEPTION" : "REVISION"),
    date, novelty: { score: nv.score, verdict: nv.verdict }, repeat: rep,
  };
}
