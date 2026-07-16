// Unified Workflow Engine 단위 테스트 (Phase 57)
//   실행: node --test src/lib/workflowEngine.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WORKFLOW_STATES, WORKFLOW_ORDER, WORKFLOW_LABEL,
  routeCategory, CATEGORY_ROUTES,
  boardGate, nextOnDecision, DECISION,
  toWorkflowItem, buildWorkflowQueue,
  chiefSecretaryDecision, dueForPublish, runScheduler,
  workflowKpis, publishingView, workflowAnalytics,
} from "./workflowEngine.js";

const now = Date.parse("2026-07-12T05:00:00Z"); // KST 14:00
const past = "2026-07-12T04:00:00Z";
const future = "2026-07-13T05:00:00Z";

// ── 1) 상태머신 정의 ────────────────────────────────────────────────
test("WORKFLOW_STATES — 11개 정규 상태 + 순서/라벨 일치", () => {
  assert.equal(WORKFLOW_ORDER.length, 11);
  for (const s of WORKFLOW_ORDER) {
    assert.ok(WORKFLOW_STATES[s], `state ${s} 정의됨`);
    assert.ok(WORKFLOW_LABEL[s], `label ${s} 정의됨`);
  }
});

// ── 2) Category Router — 지시서 4개 예시 정확 매핑 ────────────────────
test("routeCategory — 신문사설/큐티/인도점성/공간매거진 파이프라인", () => {
  const news = routeCategory({ content_type: "morning_brief" });
  assert.equal(news.fusion, "News Fusion");
  assert.equal(news.writer, "News Writer");
  assert.equal(news.research, "News Fact");
  assert.equal(news.seo, "SEO");

  const qt = routeCategory({ content_type: "qt" });
  assert.equal(qt.fusion, "QT Fusion");
  assert.equal(qt.research, "Scripture");

  const vedic = routeCategory({ content_type: "astrology" });
  assert.equal(vedic.fusion, "Vedic Fusion");
  assert.equal(vedic.research, "Astrology Research");

  const mag = routeCategory({ content_type: "space_market" });
  assert.equal(mag.fusion, "Magazine Fusion");
  assert.equal(mag.writer, "Interior Writer");
  assert.equal(mag.image, "Image Engine");
  assert.ok(mag.steps.includes("Image Engine"));
});

test("routeCategory — 주제 문자열도 content_type으로 분류해 라우팅", () => {
  const r = routeCategory("오늘 큐티 말씀과 묵상");
  assert.equal(r.id, "qt");
  const news = routeCategory("주요신문 사설 헤드라인 매세지");
  assert.equal(news.id, "news");
});

// ── 3) Revision Loop — 리뷰어 결정 → 다음 행동 ───────────────────────
test("nextOnDecision — PASS/NOTE 다음 단계, REVISE 재융합, HARD_FAIL 종료+알림", () => {
  assert.equal(nextOnDecision(DECISION.PASS).advance, true);
  const note = nextOnDecision(DECISION.NOTE);
  assert.equal(note.advance, true);
  assert.equal(note.keepNote, true);
  const rev = nextOnDecision(DECISION.REVISE);
  assert.equal(rev.advance, false);
  assert.equal(rev.refusion, true);
  assert.equal(rev.sameReviewer, true);
  const hf = nextOnDecision(DECISION.PASS, { hardFail: true });
  assert.equal(hf.terminal, true);
  assert.equal(hf.alertAdmin, true);
});

// ── 4) BOARD_APPROVED 조건 ──────────────────────────────────────────
const boardOf = (decisions, { hardGatePassed = true } = {}) => ({
  hardGatePassed,
  approvalCount: decisions.filter((d) => d === "PASS" || d === "PASS_WITH_NOTE").length,
  reviewers: decisions.map((d, i) => ({ role: ["writer", "fact_checker", "seo", "chief_editor"][i], decision: d, hardFail: false })),
});

test("boardGate — 전원 PASS/NOTE + Hard Gate 통과 → 승인", () => {
  const g = boardGate(boardOf(["PASS", "PASS", "PASS_WITH_NOTE", "PASS"]));
  assert.equal(g.approved, true);
  assert.equal(g.reason, "APPROVED");
  assert.deepEqual(g.noteRoles, ["seo"]);
});

test("boardGate — REVISE가 하나라도 있으면 승인 금지", () => {
  const g = boardGate(boardOf(["PASS", "REVISE", "PASS", "PASS"]));
  assert.equal(g.approved, false);
  assert.equal(g.reason, "REVISE_PENDING");
  assert.deepEqual(g.reviseRoles, ["fact_checker"]);
});

test("boardGate — Hard Gate 실패 → HARD_FAIL", () => {
  const g = boardGate(boardOf(["PASS", "PASS", "PASS", "PASS"], { hardGatePassed: false }));
  assert.equal(g.approved, false);
  assert.equal(g.hardFail, true);
  assert.equal(g.reason, "HARD_FAIL");
});

// ── 상태 정규화 (DB status → 워크플로우 상태) ────────────────────────
test("toWorkflowItem — publish_status/scheduled_at → 정규 상태", () => {
  assert.equal(toWorkflowItem({ publish_status: "published" }, { now }).state, WORKFLOW_STATES.PUBLISHED);
  assert.equal(toWorkflowItem({ publish_status: "scheduled", scheduled_at: future }, { now }).state, WORKFLOW_STATES.SCHEDULED);
  assert.equal(toWorkflowItem({ publish_status: "scheduled", scheduled_at: past }, { now }).state, WORKFLOW_STATES.PUBLISHING);
  assert.equal(toWorkflowItem({ publish_status: "draft", content: "" }, { now }).state, WORKFLOW_STATES.DRAFT);
});

// ── 5) 총괄비서실장 — 재검토 없이 발행모드만 결정 ─────────────────────
test("chiefSecretaryDecision — 승인분만, 재검토 금지, 긴급→즉시", () => {
  const notApproved = chiefSecretaryDecision({ state: WORKFLOW_STATES.REVIEW });
  assert.equal(notApproved.eligible, false);

  const approved = chiefSecretaryDecision({
    state: WORKFLOW_STATES.APPROVED, title: "속보 집중호우 지하차도 통제",
    content: "집중호우로 지하차도가 전면 통제되었습니다. 시민 안전을 위해 우회로를 이용하시기 바랍니다. 현장 상황과 대응을 정리합니다.".repeat(2),
    contentType: "breaking", board: { hardGatePassed: true },
  }, { now });
  assert.equal(approved.eligible, true);
  assert.equal(approved.mode, "IMMEDIATE");
  assert.equal(approved.reReview, false);
});

// ── 6) Scheduler 통합 ───────────────────────────────────────────────
test("dueForPublish — scheduled & scheduled_at<=now 만", () => {
  const recs = [
    { id: "a", publish_status: "scheduled", scheduled_at: past },
    { id: "b", publish_status: "scheduled", scheduled_at: future },
    { id: "c", publish_status: "published", scheduled_at: past },
    { id: "d", publish_status: "draft" },
  ];
  const due = dueForPublish(recs, now);
  assert.deepEqual(due.map((r) => r.id), ["a"]);
});

test("runScheduler — 도래분 발행, executor 오류 집계, executor 없으면 blocked", async () => {
  const recs = [
    { id: "a", publish_status: "scheduled", scheduled_at: past },
    { id: "b", publish_status: "scheduled", scheduled_at: past },
  ];
  const calls = [];
  const ok = await runScheduler({ records: recs, now, executor: async (r) => { calls.push(r.id); return {}; } });
  assert.equal(ok.due, 2);
  assert.equal(ok.published, 2);
  assert.deepEqual(calls, ["a", "b"]);

  const fail = await runScheduler({ records: recs, now, executor: async () => ({ error: new Error("boom") }) });
  assert.equal(fail.failed, 2);

  const blocked = await runScheduler({ records: recs, now });
  assert.equal(blocked.blocked, true);
});

// ── 8·9) 탭 간 수치 일치 (Single Source of Truth) ────────────────────
test("workflowKpis ↔ publishingView — 같은 records → 같은 scheduled/published 수치", () => {
  const recs = [
    { id: "a", publish_status: "published", created_at: past, updated_at: past },
    { id: "b", publish_status: "scheduled", scheduled_at: future, created_at: past },
    { id: "c", publish_status: "scheduled", scheduled_at: past, created_at: past }, // due → PUBLISHING
    { id: "d", publish_status: "draft", content: "" , created_at: past },
  ];
  const kpi = workflowKpis(recs, { now });
  const pv = publishingView(recs, { now });
  // scheduled(예약) = SCHEDULED + PUBLISHING = b + c
  assert.equal(kpi.scheduled, pv.counts.scheduled + pv.counts.publishing);
  assert.equal(pv.counts.published, 1);
  assert.equal(pv.counts.scheduled, 1);
  assert.equal(pv.counts.publishing, 1);
});

test("workflowKpis — 빈 입력 안전 + aiCost 주입", () => {
  const k = workflowKpis([], { now, aiCostKRW: 1234 });
  assert.equal(k.todayCreated, 0);
  assert.equal(k.avgQuality, null);
  assert.equal(k.aiCostKRW, 1234);
});

// ── 10) AI 분석실 — 카테고리 성공률/비율 ─────────────────────────────
test("workflowAnalytics — 카테고리별 성공률 + 비율 계산", () => {
  const recs = [
    { id: "a", content_type: "qt", publish_status: "published", created_at: past, updated_at: past },
    { id: "b", content_type: "qt", publish_status: "scheduled", scheduled_at: future, created_at: past },
    { id: "c", content_type: "breaking", publish_status: "published", created_at: past, updated_at: past },
  ];
  const a = workflowAnalytics(recs, { now });
  assert.equal(a.total, 3);
  const qt = a.categorySuccess.find((r) => r.route === "qt");
  assert.equal(qt.total, 2);
  assert.equal(qt.published, 1);
  assert.equal(qt.successRate, 50);
});

test("buildWorkflowQueue — 상태별 카운트 합 = total", () => {
  const recs = [
    { id: "a", publish_status: "published", created_at: past },
    { id: "b", publish_status: "scheduled", scheduled_at: future, created_at: past },
    { id: "c", publish_status: "draft", content: "", created_at: past },
  ];
  const q = buildWorkflowQueue(recs, { now });
  const sum = Object.values(q.counts).reduce((n, v) => n + v, 0);
  assert.equal(sum, q.total);
  assert.equal(q.total, 3);
});
