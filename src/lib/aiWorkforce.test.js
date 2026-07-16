// AI Workforce (OpenRouter 채용센터) 단위 테스트 (Phase 58-1)
//   실행: node --test src/lib/aiWorkforce.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_CATALOG, NEWSROOM_ROLES,
  workforceRoster, orgHierarchy, weeklyReview, promotionPlan,
  replacementRecommendations, workforceDashboard, searchModels, openRouterCandidates,
} from "./aiWorkforce.js";

test("MODEL_CATALOG — 지시서 직군(심층기자/편집국장/속보/리서치/번역/팩트/이미지/영상) 포함", () => {
  assert.equal(MODEL_CATALOG["anthropic/claude-3.5-sonnet"].role, "심층기자");
  assert.equal(MODEL_CATALOG["openai/gpt-4o"].role, "편집국장");
  assert.equal(MODEL_CATALOG["google/gemini-flash-1.5"].role, "속보기자");
  assert.equal(MODEL_CATALOG["deepseek/deepseek-chat"].role, "리서치");
  assert.equal(MODEL_CATALOG["qwen/qwen-2.5-72b-instruct"].role, "번역");
  assert.equal(MODEL_CATALOG["black-forest-labs/flux-1.1-pro"].kind, "image");
  assert.equal(MODEL_CATALOG["google/veo-2"].kind, "video");
  assert.ok(NEWSROOM_ROLES.editor_in_chief.rank > NEWSROOM_ROLES.reporter.rank);
});

test("workforceRoster — 직원 정보 필드 완비(입출력비용/속도/품질/PASS·Revision·실패율)", () => {
  const roster = workforceRoster();
  assert.ok(roster.length >= 6);
  for (const r of roster) {
    for (const k of ["model", "name", "role", "inputCostKRW", "outputCostKRW", "tier", "passRate", "revisionRate", "failRate", "recentWork", "active"]) {
      assert.ok(k in r, `필드 ${k} 존재`);
    }
  }
});

test("orgHierarchy — 사장→비서실장→편집국장 계층 + 전원 OpenRouter", () => {
  const org = orgHierarchy();
  assert.equal(org.president.title, "AI 사장");
  assert.equal(org.chief_secretary.title, "총괄비서실장");
  assert.ok(org.chain.includes("편집국장"));
  assert.ok(org.layers.length >= 3);
});

test("searchModels / openRouterCandidates — 검색·미보유 후보", () => {
  assert.ok(searchModels("gpt").every((m) => /gpt/i.test(`${m.model} ${m.label} ${m.role}`)));
  assert.ok(Array.isArray(openRouterCandidates()));
});

test("weeklyReview / promotionPlan / replacementRecommendations — 안전 실행", () => {
  const wr = weeklyReview();
  assert.ok(Array.isArray(wr));
  const pp = promotionPlan();
  assert.ok(Array.isArray(pp.promotions) && Array.isArray(pp.demotions));
  assert.ok(Array.isArray(replacementRecommendations()));
});

test("workforceDashboard — 총원/가동/휴면/오늘호출/평균 필드", () => {
  const d = workforceDashboard();
  for (const k of ["totalStaff", "activeStaff", "idleStaff", "todayCalls", "avgCostPerJobKRW", "costSaving"]) {
    assert.ok(k in d, `대시보드 ${k}`);
  }
  assert.equal(d.totalStaff, d.activeStaff + d.idleStaff);
});
