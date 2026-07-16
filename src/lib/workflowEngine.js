// ════════════════════════════════════════════════════════════════════
// 공간라운지 Unified Workflow Engine — 통합 워크플로우 (Phase 57)
//
//   운영센터·편성국·발행센터·무인운영·AI 분석실이 "각각 따로 계산"하던 문제를 없앤다.
//   모든 화면은 이 파일이 정의하는 하나의 WorkflowQueue(=DB lounge_posts 파생 상태머신)만
//   바라본다. 여기서 계산된 KPI/큐/상태를 그대로 소비하므로 탭 간 수치가 항상 일치한다.
//
//   상태머신(Single Source of Truth):
//     Draft → Fusion → Writing → Review → Revision → Approved → ChiefSecretary →
//     Scheduled → Publishing → Published / Failed
//
//   DB가 진실원(publish_status / scheduled_at). 초안의 검토·수정·승인 상태는
//   기존 결정론 4인 검토(reviewByBoard)로 파생한다 — 새 컬럼/Migration 없음.
//
//   ⚠️ Regression Zero: 순수 함수 · localStorage/DB 쓰기 없음(읽기 파생만).
//     기존 evaluateQuality / reviewByBoard / decidePublishMode / classifyContentType 재사용(무수정).
// ════════════════════════════════════════════════════════════════════

import { evaluateQuality } from "./qualityEvaluator.js";
import { reviewByBoard } from "./aiEditorialBoard.js";
import { decidePublishMode } from "./publishModeDecider.js";
import { classifyContentType } from "./contentTypes.js";
import { editorialDateKST } from "./editorialKey.js";
import { mapCategory } from "./categoryMapper.js";

// ── 1) Single Source of Truth — 정규 상태(11) ───────────────────────────
export const WORKFLOW_STATES = {
  DRAFT:           "DRAFT",
  FUSION:          "FUSION",
  WRITING:         "WRITING",
  REVIEW:          "REVIEW",
  REVISION:        "REVISION",
  APPROVED:        "APPROVED",          // = BOARD_APPROVED (4인 PASS/PASS_WITH_NOTE)
  CHIEF_SECRETARY: "CHIEF_SECRETARY",   // 총괄비서실장 결재 대기(품질 수정 금지)
  SCHEDULED:       "SCHEDULED",
  PUBLISHING:      "PUBLISHING",        // 예약시각 도래 — 발행 진행분
  PUBLISHED:       "PUBLISHED",
  FAILED:          "FAILED",
};

// 상태 순서(파이프라인 진행도) + 한글 라벨.
export const WORKFLOW_ORDER = [
  "DRAFT", "FUSION", "WRITING", "REVIEW", "REVISION",
  "APPROVED", "CHIEF_SECRETARY", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED",
];
export const WORKFLOW_LABEL = {
  DRAFT: "초안", FUSION: "융합", WRITING: "작성", REVIEW: "검토", REVISION: "수정",
  APPROVED: "이사회승인", CHIEF_SECRETARY: "총괄비서실장", SCHEDULED: "예약",
  PUBLISHING: "발행중", PUBLISHED: "발행완료", FAILED: "실패",
};

// 리뷰어 단계(Revision Loop 대상) — 순서 고정.
export const REVIEW_ROLES = ["writer", "fact_checker", "seo", "chief_editor"];
export const REVIEW_ROLE_LABEL = {
  writer: "작성 담당", fact_checker: "팩트체커", seo: "SEO 담당", chief_editor: "편집장",
};

// ── 2) Category Router — 주제→카테고리→(Fusion/Writer/Research/SEO/Image) 파이프라인 ──
//   지시서 예:
//     신문사설 → News Fusion → News Writer → News Fact → SEO
//     큐티     → QT Fusion  → QT Writer  → Scripture → SEO
//     인도점성 → Vedic Fusion → Vedic Writer → Astrology Research → SEO
//     공간매거진 → Magazine Fusion → Interior Writer → SEO → Image Engine
export const CATEGORY_ROUTES = {
  news: {
    id: "news", label: "신문사설·뉴스",
    fusion: "News Fusion", writer: "News Writer", research: "News Fact", seo: "SEO", image: null,
    contentTypes: ["morning_brief", "breaking"],
  },
  qt: {
    id: "qt", label: "큐티·묵상",
    fusion: "QT Fusion", writer: "QT Writer", research: "Scripture", seo: "SEO", image: null,
    contentTypes: ["qt"],
  },
  vedic: {
    id: "vedic", label: "인도점성·운세",
    fusion: "Vedic Fusion", writer: "Vedic Writer", research: "Astrology Research", seo: "SEO", image: null,
    contentTypes: ["astrology"],
  },
  magazine: {
    id: "magazine", label: "공간매거진",
    fusion: "Magazine Fusion", writer: "Interior Writer", research: null, seo: "SEO", image: "Image Engine",
    contentTypes: ["space_market"],
  },
  general: {
    id: "general", label: "일반·트렌드",
    fusion: "General Fusion", writer: "General Writer", research: "Trend Research", seo: "SEO", image: null,
    contentTypes: ["series", "trend_past", "trend_present", "trend_future"],
  },
};

// content_type → route id.
const TYPE_TO_ROUTE = Object.entries(CATEGORY_ROUTES).reduce((m, [rid, r]) => {
  for (const t of r.contentTypes) m[t] = rid;
  return m;
}, {});

// 주제(문자열) 또는 레코드({content_type,category,title,ai_topic})를 파이프라인으로 라우팅.
export function routeCategory(input) {
  let type = null, category = null, topic = "";
  if (input && typeof input === "object") {
    type = input.content_type || input.contentType || null;
    category = input.category || null;
    topic = input.title || input.ai_topic || input.topic || "";
  } else {
    topic = String(input ?? "");
  }
  if (!type) type = classifyContentType(topic);
  const routeId = TYPE_TO_ROUTE[type] || "general";
  const route = CATEGORY_ROUTES[routeId];
  // 카테고리 힌트(폭우→interior 등)는 참고 정보로만 첨부(파이프라인은 type 기준).
  const catHint = category ? { category } : (topic ? mapCategory(topic) : null);
  return {
    ...route,
    contentType: type,
    categoryHint: catHint?.category ?? category ?? null,
    steps: [route.fusion, route.writer, route.research, route.seo, route.image].filter(Boolean),
  };
}

// ── 3·4) Revision Loop + BOARD_APPROVED 조건 ────────────────────────────
//   리뷰어 결정: PASS / PASS_WITH_NOTE / REVISE (+ hardFail → HARD_FAIL)
//   규칙:
//     PASS       → 다음 단계
//     PASS_WITH_NOTE(NOTE) → 메모만 남기고 다음 단계
//     REVISE     → Fusion 재실행 → 같은 담당 재검토
//     HARD_FAIL  → 종료 → 관리자 알림
//   BOARD_APPROVED: 4인 전원 PASS 또는 PASS_WITH_NOTE + Hard Gate 통과.
//                   REVISE가 하나라도 있으면 승인 금지.
export const DECISION = {
  PASS: "PASS", NOTE: "PASS_WITH_NOTE", REVISE: "REVISE", HARD_FAIL: "HARD_FAIL",
};

// 리뷰어 1인 결정 → 다음 행동.
export function nextOnDecision(decision, { hardFail = false } = {}) {
  if (hardFail) return { action: "HARD_FAIL", advance: false, terminal: true, alertAdmin: true, note: "관리자 알림" };
  switch (decision) {
    case "PASS":            return { action: "PASS", advance: true, terminal: false };
    case "PASS_WITH_NOTE":  return { action: "NOTE", advance: true, terminal: false, keepNote: true };
    case "REVISE":          return { action: "REVISE", advance: false, terminal: false, refusion: true, sameReviewer: true };
    default:                return { action: "REVISE", advance: false, terminal: false, refusion: true, sameReviewer: true };
  }
}

// BOARD_APPROVED 게이트 — board(reviewByBoard 결과)만으로 승인 가능한지 판정.
export function boardGate(board) {
  if (!board || !Array.isArray(board.reviewers)) {
    return { approved: false, reason: "NO_BOARD", reviseRoles: [], noteRoles: [], hardFail: false };
  }
  const hardFail = !board.hardGatePassed || board.reviewers.some((r) => r.hardFail);
  const reviseRoles = board.reviewers.filter((r) => r.decision === "REVISE").map((r) => r.role);
  const noteRoles = board.reviewers.filter((r) => r.decision === "PASS_WITH_NOTE").map((r) => r.role);
  const allPassOrNote = board.reviewers.length === 4 &&
    board.reviewers.every((r) => r.decision === "PASS" || r.decision === "PASS_WITH_NOTE");
  const approved = allPassOrNote && !hardFail;
  const reason = hardFail ? "HARD_FAIL" : reviseRoles.length ? "REVISE_PENDING" : approved ? "APPROVED" : "INCOMPLETE";
  return { approved, reason, reviseRoles, noteRoles, hardFail, approvalCount: board.approvalCount ?? 0 };
}

// 초안 → 워크플로우 상태 파생(검토·수정·승인). Revision Loop의 현재 위치를 계산.
export function reviewState(draft, { existing = [], evaluation = null } = {}) {
  const ev = evaluation || evaluateQuality(draft);
  const board = reviewByBoard(draft, { existing, evaluation: ev });
  const gate = boardGate(board);
  let state;
  if (gate.hardFail) state = WORKFLOW_STATES.FAILED;            // HARD_FAIL → 종료
  else if (gate.reviseRoles.length) state = WORKFLOW_STATES.REVISION; // REVISE 잔존 → 수정 루프
  else if (gate.approved) state = WORKFLOW_STATES.APPROVED;     // 전원 PASS/NOTE → 이사회 승인
  else state = WORKFLOW_STATES.REVIEW;                          // 검토 중
  // 다음 수정 대상 리뷰어(같은 담당 재검토 대상) — REVIEW_ROLES 순서상 첫 REVISE.
  const nextReviseRole = REVIEW_ROLES.find((role) => gate.reviseRoles.includes(role)) || null;
  return { state, board, gate, evaluation: ev, nextReviseRole };
}

// ── 상태머신 정규화 — DB 레코드 하나 → WorkflowItem ─────────────────────
export function toWorkflowItem(record = {}, { now = Date.now(), existing = [], deriveReview = true } = {}) {
  const status = String(record.publish_status ?? record.publishStatus ?? "draft");
  const type = record.content_type || record.contentType || classifyContentType(record.title || record.ai_topic || "");
  const route = routeCategory({ ...record, content_type: type });
  const base = {
    id: record.id ?? null,
    title: record.title ?? "",
    content: String(record.content ?? record.body ?? ""),
    contentType: type,
    route: route.id,
    createdAt: record.created_at ?? null,
    updatedAt: record.updated_at ?? null,
    scheduledAt: record.scheduled_at ?? null,
    quality: null,
    board: null,
  };

  if (status === "published") {
    return { ...base, state: WORKFLOW_STATES.PUBLISHED };
  }
  if (status === "scheduled") {
    const due = record.scheduled_at != null && Date.parse(record.scheduled_at) <= now;
    return { ...base, state: due ? WORKFLOW_STATES.PUBLISHING : WORKFLOW_STATES.SCHEDULED, due };
  }
  // draft (또는 null) — 본문/검토로 초안 세부 상태 파생.
  const body = String(record.content ?? record.body ?? "");
  const hasBody = body.replace(/\s/g, "").length >= 80;
  if (!hasBody) return { ...base, state: WORKFLOW_STATES.DRAFT };
  if (!deriveReview) return { ...base, state: WORKFLOW_STATES.REVIEW };
  const rs = reviewState({ ...record, content_type: type }, { existing });
  return {
    ...base,
    state: rs.state,
    quality: rs.evaluation?.totalScore ?? null,
    board: rs.board,
    gate: rs.gate,
    nextReviseRole: rs.nextReviseRole,
  };
}

// records(lounge_posts) 전체 → WorkflowQueue(items + 상태별 카운트).
export function buildWorkflowQueue(records = [], { now = Date.now(), deriveReview = true } = {}) {
  const existing = records;
  const items = records.map((r) => toWorkflowItem(r, { now, existing, deriveReview }));
  const counts = Object.fromEntries(WORKFLOW_ORDER.map((s) => [s, 0]));
  for (const it of items) counts[it.state] = (counts[it.state] || 0) + 1;
  return { items, counts, total: items.length };
}

// ── 5) 총괄비서실장 — 재검토 없이 즉시/예약 발행만 결정 ──────────────────
//   BOARD_APPROVED → 즉시발행 또는 예약발행 → Executor → Published. 품질 수정 금지.
export function chiefSecretaryDecision(item, { now = Date.now() } = {}) {
  // 승인분만 결재 대상. (품질 재검토 하지 않음 — board 결과를 그대로 신뢰)
  if (!item || item.state !== WORKFLOW_STATES.APPROVED) {
    return { eligible: false, reason: "NOT_APPROVED" };
  }
  const mode = decidePublishMode(
    { title: item.title, content: item.content, content_type: item.contentType, scheduled_at: item.scheduledAt },
    { board: item.board, now }
  );
  return {
    eligible: mode.mode !== "HOLD",
    mode: mode.mode,           // IMMEDIATE | SCHEDULED | HOLD
    priority: mode.priority,
    reason: mode.reason,
    reReview: false,           // 총괄비서실장은 품질 재검토 금지
  };
}

// ── 6) Scheduler 통합 — 예약 도래분(scheduled_at<=now) 을 발행 대상으로 선별 ──
export function dueForPublish(records = [], now = Date.now()) {
  return records.filter((r) => {
    const status = String(r.publish_status ?? r.publishStatus ?? "");
    if (status !== "scheduled") return false;
    const at = r.scheduled_at ?? r.scheduledAt ?? null;
    return at != null && Date.parse(at) <= now;
  });
}

// 예약 도래분을 실제 발행. executor(record)=>({error}) 는 기존 발행 API 주입(무수정).
export async function runScheduler({ records = [], executor, now = Date.now() } = {}) {
  const due = dueForPublish(records, now);
  const result = { due: due.length, published: 0, failed: 0, errors: [] };
  if (typeof executor !== "function") return { ...result, blocked: true, reason: "NO_EXECUTOR" };
  for (const rec of due) {
    try {
      const { error } = (await executor(rec)) || {};
      if (error) { result.failed += 1; result.errors.push({ id: rec.id, message: error.message ?? String(error) }); }
      else result.published += 1;
    } catch (e) {
      result.failed += 1; result.errors.push({ id: rec.id, message: e?.message ?? String(e) });
    }
  }
  return result;
}

// ── 8) 운영센터 KPI — WorkflowQueue에서 직접 계산(모든 탭 공용) ───────────
const isTodayKST = (ts, today) => ts && editorialDateKST(ts) === today;

export function workflowKpis(records = [], { now = Date.now(), aiCostKRW = null } = {}) {
  const today = editorialDateKST(now);
  const { items } = buildWorkflowQueue(records, { now });

  const todayItems = items.filter((it) => isTodayKST(it.createdAt, today));
  const inState = (arr, ...states) => arr.filter((it) => states.includes(it.state));

  // 오늘 검토 = 오늘 생성분 중 초안 단계를 벗어나 검토가 이뤄진 것(REVIEW 이상).
  const reviewedToday = todayItems.filter((it) => it.state !== WORKFLOW_STATES.DRAFT);
  // 오늘 PASS = 오늘 생성분 중 REVISE 없이 승인/예약/발행에 도달.
  const passToday = inState(todayItems, WORKFLOW_STATES.APPROVED, WORKFLOW_STATES.CHIEF_SECRETARY,
    WORKFLOW_STATES.SCHEDULED, WORKFLOW_STATES.PUBLISHING, WORKFLOW_STATES.PUBLISHED);

  const publishedToday = items.filter((it) =>
    it.state === WORKFLOW_STATES.PUBLISHED && isTodayKST(it.updatedAt || it.createdAt, today));

  // 평균 품질(파생된 초안 quality).
  const scored = items.filter((it) => typeof it.quality === "number");
  const avgQuality = scored.length ? Math.round(scored.reduce((n, it) => n + it.quality, 0) / scored.length) : null;

  // 평균 처리시간(생성→발행, 오늘 발행분, 분).
  let elapsedSum = 0, elapsedN = 0;
  for (const it of publishedToday) {
    const c = Date.parse(it.createdAt || 0), p = Date.parse(it.updatedAt || it.createdAt || now);
    if (c && p >= c) { elapsedSum += (p - c) / 60000; elapsedN += 1; }
  }

  return {
    date: today,
    todayCreated: todayItems.length,
    todayReviewed: reviewedToday.length,
    todayPass: passToday.length,
    revision: inState(items, WORKFLOW_STATES.REVISION).length,
    scheduled: inState(items, WORKFLOW_STATES.SCHEDULED, WORKFLOW_STATES.PUBLISHING).length,
    published: publishedToday.length,
    failed: inState(items, WORKFLOW_STATES.FAILED).length,
    avgQuality,
    avgProcessMin: elapsedN ? Math.round(elapsedSum / elapsedN) : null,
    aiCostKRW: aiCostKRW != null ? aiCostKRW : null,
  };
}

// ── 9) 발행센터 뷰 — Scheduled/Publishing/Published/Failed 만 ────────────
export function publishingView(records = [], { now = Date.now() } = {}) {
  const { items } = buildWorkflowQueue(records, { now, deriveReview: false });
  const pick = (...states) => items.filter((it) => states.includes(it.state));
  return {
    scheduled: pick(WORKFLOW_STATES.SCHEDULED),
    publishing: pick(WORKFLOW_STATES.PUBLISHING),
    published: pick(WORKFLOW_STATES.PUBLISHED),
    failed: pick(WORKFLOW_STATES.FAILED),
    counts: {
      scheduled: pick(WORKFLOW_STATES.SCHEDULED).length,
      publishing: pick(WORKFLOW_STATES.PUBLISHING).length,
      published: pick(WORKFLOW_STATES.PUBLISHED).length,
      failed: pick(WORKFLOW_STATES.FAILED).length,
    },
  };
}

// ── 10) AI 분석실 — WorkflowQueue 분석(품질/실패율/Revision율/PASS율/카테고리 성공률) ──
export function workflowAnalytics(records = [], { now = Date.now(), aiCostKRW = null } = {}) {
  const { items, counts, total } = buildWorkflowQueue(records, { now });
  const reviewed = items.filter((it) => it.state !== WORKFLOW_STATES.DRAFT &&
    it.state !== WORKFLOW_STATES.FUSION && it.state !== WORKFLOW_STATES.WRITING);
  const revision = counts[WORKFLOW_STATES.REVISION] || 0;
  const failed = counts[WORKFLOW_STATES.FAILED] || 0;
  const passLike = (counts[WORKFLOW_STATES.APPROVED] || 0) + (counts[WORKFLOW_STATES.CHIEF_SECRETARY] || 0) +
    (counts[WORKFLOW_STATES.SCHEDULED] || 0) + (counts[WORKFLOW_STATES.PUBLISHING] || 0) +
    (counts[WORKFLOW_STATES.PUBLISHED] || 0);
  const denom = reviewed.length || 1;
  const scored = items.filter((it) => typeof it.quality === "number");
  const avgQuality = scored.length ? Math.round(scored.reduce((n, it) => n + it.quality, 0) / scored.length) : null;

  // 카테고리(route)별 성공률 = 발행완료 / (해당 route 전체).
  const byRoute = {};
  for (const it of items) {
    const r = (byRoute[it.route] ||= { route: it.route, label: CATEGORY_ROUTES[it.route]?.label || it.route, total: 0, published: 0, revision: 0, failed: 0 });
    r.total += 1;
    if (it.state === WORKFLOW_STATES.PUBLISHED) r.published += 1;
    if (it.state === WORKFLOW_STATES.REVISION) r.revision += 1;
    if (it.state === WORKFLOW_STATES.FAILED) r.failed += 1;
  }
  const categorySuccess = Object.values(byRoute).map((r) => ({
    ...r, successRate: r.total ? Math.round((r.published / r.total) * 100) : 0,
  })).sort((a, b) => b.total - a.total);

  return {
    total,
    avgQuality,
    failRate: Math.round((failed / denom) * 100),
    revisionRate: Math.round((revision / denom) * 100),
    passRate: Math.round((passLike / denom) * 100),
    counts,
    categorySuccess,
    aiCostKRW: aiCostKRW != null ? aiCostKRW : null,
  };
}
