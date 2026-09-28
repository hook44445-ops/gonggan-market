import { test } from "node:test";
import assert from "node:assert/strict";
import { SEASONAL_TOPICS, pickSeasonalTopic, koreanMonthOf } from "./loungeTopicPool.js";
import { tagsFromPost } from "../lib/loungeToRequest.js";

test("열두 달 모두 계절 주제가 있다", () => {
  for (let m = 1; m <= 12; m++) assert.ok(SEASONAL_TOPICS.some(t => t.months.includes(m)), `${m}월 주제 없음`);
});

test("한국 시간 달로 고른다 — 12월 1일 새벽(한국)은 겨울", () => {
  assert.equal(koreanMonthOf(new Date("2026-11-30T16:00:00Z")), 12);   // 한국 12/1 01:00
  const t = pickSeasonalTopic(new Date("2026-12-10T03:00:00Z"));
  assert.ok(SEASONAL_TOPICS.find(s => s.topic === t.topic).months.includes(12));
  assert.equal(t.seasonal, true);
  assert.equal(t.months, undefined);
});

test("같은 날은 같은 주제 · 이어진 나흘은 서로 다른 주제", () => {
  const d = (n) => new Date(Date.UTC(2027, 0, 10 + n, 3));
  assert.equal(pickSeasonalTopic(d(0)).topic, pickSeasonalTopic(d(0)).topic);
  const four = new Set([0, 1, 2, 3].map(n => pickSeasonalTopic(d(n)).topic));
  assert.equal(four.size, 4);
});

test("계절 주제 글은 모두 라운지 «이 글 같은 공사 견적» 링크(#815)가 뜬다", () => {
  for (const t of SEASONAL_TOPICS) {
    assert.ok(tagsFromPost({ title: t.topic, content: t.angle }).length > 0, `칩이 안 잡힘: ${t.topic}`);
  }
});
