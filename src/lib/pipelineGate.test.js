// Pipeline Gate 단위 테스트 — Prubi 배치·사전게이트·Adaptive·BOARD_APPROVED v2 (Phase 59)
//   §11 필수 사례 10건 커버.
import { test } from "node:test";
import assert from "node:assert/strict";
import { staffPipeline, preGenerationGate, executeAdaptiveRevision, boardApprovalV2 } from "./pipelineGate.js";
import { chiefSecretaryDecision, WORKFLOW_STATES } from "./workflowEngine.js";

const now = Date.parse("2026-07-16T02:00:00Z");
const nvidiaBody = "엔비디아가 이번 분기 실적을 발표했다. AI 반도체 수요가 강하게 이어지며 데이터센터 매출이 크게 늘었다. 반도체 랠리가 지속될지 관심이 모인다. ".repeat(4);
const RICH = "정부가 오늘 공식 발표했다. 통계청 자료에 따르면 지표가 올랐다. 출처를 함께 정리한다. 왜 중요한가? 체크리스트로 정리하고 공간과 연결한다. ".repeat(3);

// §1 Prubi 배치.
test("§1 staffPipeline — intent별 직원 배치(속보/심층/공간매거진)", () => {
  const breaking = staffPipeline({ title: "속보 집중호우 통제" });
  assert.equal(breaking.intent, "breaking");
  assert.ok(breaking.pipeline.includes("속보기자") && breaking.pipeline.includes("편집장"));

  const deep = staffPipeline({ title: "반도체 산업 심층 분석 리포트와 전망" });
  assert.ok(deep.pipeline.includes("팩트체커"));

  const space = staffPipeline({ title: "인테리어 시공 공간 매거진", content_type: "space_market" });
  assert.ok(space.pipeline.includes("이미지담당"));
});

// §11-1,3 반복 차단.
test("case1/3 — 유사 기존 주제(새 신호 없음) → BLOCK", () => {
  const existing = [{ id: 1, title: "엔비디아 실적과 AI 반도체 랠리", content: nvidiaBody, publish_status: "published", created_at: "2026-07-15" }];
  const g = preGenerationGate({ title: "엔비디아 실적으로 본 반도체 전망", content: nvidiaBody + "전망 정리" }, existing, { now });
  assert.equal(g.action, "BLOCK");
});

// §11-2 새 공식 발표 → 생성 허용.
test("case2 — 엔비디아 신규 공식 발표(새 신호) → 생성 허용", () => {
  const existing = [{ id: 1, title: "엔비디아 실적과 AI 반도체 랠리", content: nvidiaBody, publish_status: "published", created_at: "2026-07-15" }];
  const cand = { title: "엔비디아 신규 GPU 공식 발표", content: "엔비디아가 오늘 신규 GPU 를 공식 발표했다. 통계청 자료와 새 사양이 처음 공개됐다. 출처를 정리한다. " + nvidiaBody };
  const g = preGenerationGate(cand, existing, { now, override: { newEvent: true, newOfficialData: true, newSource: true } });
  assert.notEqual(g.action, "BLOCK");
});

// §11-4 날짜 보정.
test("case4 — 2023년 샘플 날짜 → date DATE_REVISE 플래그", () => {
  const g = preGenerationGate({ title: "브리핑", content: RICH + " 2023년 5월 10일 기준 자료입니다." }, [], { now, override: { newEvent: true, newOfficialData: true } });
  assert.equal(g.date.dateRevise, true);
});

// §11-5 팩트 REVISE → 관련만 재작업 + 서명 무효화.
const boardWith = (decisions, { hardGatePassed = true } = {}) => ({
  hardGatePassed,
  reviewers: decisions.map((d, i) => ({ role: ["writer", "fact_checker", "seo", "chief_editor"][i], decision: d, hardFail: false })),
});

test("case5 — 팩트체커 REVISE → fact_checker만 재작업·서명 무효화", () => {
  const sig = { writer: true, fact_checker: true, seo: true, chief_editor: true };
  const r = executeAdaptiveRevision(boardWith(["PASS", "REVISE", "PASS", "PASS"]), sig);
  assert.equal(r.action, "PARTIAL_REWORK");
  assert.deepEqual(r.reReview, ["fact_checker"]);
  assert.equal(r.updatedSignatures.fact_checker, false);
  assert.equal(r.updatedSignatures.writer, true);
});

// §11-6 SEO REVISE → SEO만.
test("case6 — SEO REVISE → seo만 재작업", () => {
  const r = executeAdaptiveRevision(boardWith(["PASS", "PASS", "REVISE", "PASS"]), { writer: true, fact_checker: true, seo: true, chief_editor: true });
  assert.deepEqual(r.reReview, ["seo"]);
  assert.equal(r.updatedSignatures.seo, false);
});

// §11-7 REVISE 잔존 → BOARD_APPROVED 금지.
test("case7 — REVISE 잔존 → boardApprovalV2 승인 금지", () => {
  const draft = { title: "엔비디아 신규 발표", content: RICH };
  const v = boardApprovalV2(draft, { board: boardWith(["PASS", "REVISE", "PASS", "PASS"]), existing: [], now, override: { newEvent: true, newOfficialData: true } });
  assert.equal(v.approved, false);
  assert.ok(v.failedConditions.includes("noUnresolvedRevise"));
});

// §11-8 4인 PASS/NOTE + 조건 만족 → 총괄비서실장 인수.
test("case8 — 4인 PASS/NOTE + 날짜/중복/신선도 통과 → CHIEF_SECRETARY 인수", () => {
  const draft = { title: "속보 정부 신규 공식 발표 요약", content: RICH };
  const v = boardApprovalV2(draft, { board: boardWith(["PASS", "PASS_WITH_NOTE", "PASS", "PASS"]), existing: [], now, override: { newEvent: true, newOfficialData: true, newSource: true } });
  assert.equal(v.approved, true);
  assert.equal(v.handoff, "CHIEF_SECRETARY");
});

// §11-9,10 즉시/예약 발행 결정(총괄비서실장, 재검토 금지).
test("case9/10 — 즉시 콘텐츠는 IMMEDIATE, 일반은 SCHEDULED (재검토 없음)", () => {
  const immediate = chiefSecretaryDecision({ state: WORKFLOW_STATES.APPROVED, title: "속보 집중호우 지하차도 통제", content: RICH, contentType: "breaking", board: { hardGatePassed: true } }, { now });
  assert.equal(immediate.mode, "IMMEDIATE");
  assert.equal(immediate.reReview, false);

  const scheduled = chiefSecretaryDecision({ state: WORKFLOW_STATES.APPROVED, title: "오늘 큐티 말씀 묵상", content: RICH, contentType: "qt", board: { hardGatePassed: true } }, { now });
  assert.equal(scheduled.mode, "SCHEDULED");
});
