// Editorial Bureaus (카테고리 편집국 + KPI + 주간성장) 단위 테스트 (Phase 58)
//   실행: node --test src/lib/editorialBureaus.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUREAUS, bureauOf, bureauKpis, GROWTH_SEQUENCE, evaluateGrowth,
  growthMetrics, runWeeklyGrowth,
} from "./editorialBureaus.js";

const now = Date.parse("2026-07-12T05:00:00Z");
const LONG = "이 글은 독자에게 실제 도움이 되는 정보를 충분한 분량으로 자세히 정리한 본문입니다. ".repeat(8);

test("bureauOf — 제목 키워드로 편집국 분류", () => {
  assert.equal(bureauOf({ title: "인테리어 시공 가이드" }), "space");
  assert.equal(bureauOf({ title: "금리 인상과 부동산 전망" }), "economy");
  assert.equal(bureauOf({ title: "챗GPT 활용법" }), "ai");
  assert.equal(bureauOf({ title: "오늘 큐티 말씀" }), "faith");
  assert.equal(bureauOf({ title: "속보 집중호우 통제" }), "news");
  assert.equal(bureauOf({ title: "그 밖의 잡담" }), "general");
});

test("bureauKpis — 편집국별 PASS율/Revision율/발행수/조회수", () => {
  const recs = [
    { id: "a", title: "인테리어 시공 완벽 가이드", content: LONG, publish_status: "published", created_at: now - 6e5, updated_at: now, view_count: 100, like_count: 10 },
    { id: "b", title: "금리 인상과 부동산 전망 분석", content: LONG, publish_status: "scheduled", scheduled_at: now + 8.64e7, created_at: now },
    { id: "c", title: "오늘 큐티 말씀 묵상", content: LONG, publish_status: "draft", created_at: now },
  ];
  const kpis = bureauKpis(recs, { now });
  const space = kpis.find((k) => k.id === "space");
  assert.ok(space);
  assert.equal(space.published, 1);
  assert.equal(space.views, 100);
  assert.ok(space.passRate >= 0 && space.passRate <= 100);
});

test("evaluateGrowth — 기준 충족 시 발행량 2배, 미달 시 유지", () => {
  assert.deepEqual(GROWTH_SEQUENCE.slice(0, 3), [20, 40, 80]);
  const good = evaluateGrowth({ passRate: 92, avgQuality: 90, failRate: 2, costPerJobKRW: 200 }, { now, state: { level: 0, weeklyTarget: 20 } });
  assert.equal(good.qualified, true);
  assert.equal(good.doubled, true);
  assert.equal(good.nextTarget, 40);

  const bad = evaluateGrowth({ passRate: 70, avgQuality: 80, failRate: 12, costPerJobKRW: 900 }, { now, state: { level: 2, weeklyTarget: 80 } });
  assert.equal(bad.qualified, false);
  assert.equal(bad.nextTarget, 80); // 유지
});

test("growthMetrics — 실측(WorkflowQueue) 파생 + 비용 주입", () => {
  const recs = [
    { id: "a", title: "인테리어 시공 가이드", content: LONG, publish_status: "published", created_at: now, updated_at: now },
    { id: "b", title: "경제 금리 분석", content: LONG, publish_status: "scheduled", scheduled_at: now + 8.64e7, created_at: now },
  ];
  const m = growthMetrics(recs, { aiCostPerJobKRW: 250, now });
  assert.equal(m.costPerJobKRW, 250);
  assert.equal(m.sampleSize, 2);
  assert.ok(m.passRate >= 0 && m.passRate <= 100);
});

test("runWeeklyGrowth — 표본 부족 시 성장 보류(상태 미변경)", () => {
  const recs = [{ id: "a", title: "글", content: LONG, publish_status: "published", created_at: now, updated_at: now }];
  const r = runWeeklyGrowth(recs, { aiCostPerJobKRW: 100, now, minSample: 5 });
  assert.equal(r.applied, false);
  assert.match(r.reason, /표본 부족/);
});

test("BUREAUS — 지시서 카테고리(공간/경제/AI/IT/생활/건강/신앙/뉴스) 포함", () => {
  const ids = BUREAUS.map((b) => b.id);
  for (const id of ["space", "economy", "ai", "it", "life", "health", "faith", "news"]) {
    assert.ok(ids.includes(id), `편집국 ${id}`);
  }
});
