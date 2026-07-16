// Newsroom Router (Prubi + Quality + Adaptive Revision) 단위 테스트 (Phase 58)
//   실행: node --test src/lib/newsroomRouter.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectIntent, estimateDifficulty, prubiRoute, adaptiveRevisionPlan, revisionCostSaving,
  QUALITY_TIERS, QUALITY_ORDER,
} from "./newsroomRouter.js";

test("QUALITY_TIERS — 5단계, 상위일수록 검수·Fusion·품질 상향", () => {
  assert.equal(QUALITY_ORDER.length, 5);
  assert.ok(QUALITY_TIERS.ENTERPRISE.minScore > QUALITY_TIERS.BASIC.minScore);
  assert.ok(QUALITY_TIERS.EXPERT.reviews >= QUALITY_TIERS.STANDARD.reviews);
});

test("detectIntent / estimateDifficulty — 심층 분석은 고난도", () => {
  assert.equal(detectIntent("반도체 시장 심층 분석 리포트").intent, "analysis");
  const d = estimateDifficulty("반도체 시장 심층 분석 리포트와 향후 전망");
  assert.ok(d >= 4, `분석+전문+장문 → 고난도 (got ${d})`);
  assert.equal(detectIntent("속보 집중호우 통제").intent, "breaking");
});

test("prubiRoute — Topic→Intent→Difficulty→Budget→Quality→LLM 결정", () => {
  const simple = prubiRoute({ title: "오늘 날씨" });
  const deep = prubiRoute({ title: "반도체 산업 심층 분석 리포트와 향후 전망 총정리" });
  // 고난도가 더 높은 품질 티어.
  assert.ok(QUALITY_ORDER.indexOf(deep.qualityTier) >= QUALITY_ORDER.indexOf(simple.qualityTier));
  assert.ok(deep.plan.length >= 5);
  assert.ok(deep.model.length > 0);
});

test("prubiRoute — budget/targetQuality 보정", () => {
  const normal = prubiRoute({ title: "경제 금리 인상 분석" }, { budget: "normal" });
  const low = prubiRoute({ title: "경제 금리 인상 분석" }, { budget: "low" });
  const high = prubiRoute({ title: "경제 금리 인상 분석" }, { budget: "high" });
  assert.ok(QUALITY_ORDER.indexOf(low.qualityTier) <= QUALITY_ORDER.indexOf(normal.qualityTier));
  assert.ok(QUALITY_ORDER.indexOf(high.qualityTier) >= QUALITY_ORDER.indexOf(normal.qualityTier));
  // 관리자 목표 지정 우선.
  assert.equal(prubiRoute({ title: "간단 글" }, { targetQuality: "ENTERPRISE" }).qualityTier, "ENTERPRISE");
});

const boardWith = (decisions, { hardGatePassed = true } = {}) => ({
  hardGatePassed,
  reviewers: decisions.map((d, i) => ({ role: ["writer", "fact_checker", "seo", "chief_editor"][i], decision: d, hardFail: false })),
});

test("adaptiveRevisionPlan — 원인 담당만 부분 재실행(비용 최소화)", () => {
  const seoOnly = adaptiveRevisionPlan(boardWith(["PASS", "PASS", "REVISE", "PASS"]));
  assert.equal(seoOnly.strategy, "PARTIAL");
  assert.deepEqual(seoOnly.rerun, ["seo"]);
  assert.ok(revisionCostSaving(seoOnly) >= 70); // 1명만 재실행 → 큰 절감

  const factOnly = adaptiveRevisionPlan(boardWith(["PASS", "REVISE", "PASS", "PASS"]));
  assert.deepEqual(factOnly.rerun, ["fact_checker"]);

  const none = adaptiveRevisionPlan(boardWith(["PASS", "PASS", "PASS", "PASS"]));
  assert.equal(none.strategy, "NONE");

  const hard = adaptiveRevisionPlan(boardWith(["PASS", "PASS", "PASS", "PASS"], { hardGatePassed: false }));
  assert.equal(hard.strategy, "HARD_FAIL");

  const full = adaptiveRevisionPlan(boardWith(["REVISE", "REVISE", "REVISE", "PASS"]));
  assert.equal(full.strategy, "FULL_REWRITE");
  assert.equal(revisionCostSaving(full), 0);
});
