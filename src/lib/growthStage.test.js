import { test } from "node:test";
import assert from "node:assert/strict";
import { GROWTH_STAGES, stageFor, nextStage, projectsToNextLevel, nextLevelHint, xpSources } from "./growthStage.js";

test("레벨 10개가 다섯 단계로 묶인다", () => {
  assert.equal(GROWTH_STAGES.length, 5);
  assert.equal(stageFor(1).id, "seed");
  assert.equal(stageFor(2).id, "seed");
  assert.equal(stageFor(3).id, "root");
  assert.equal(stageFor(6).id, "stem");
  assert.equal(stageFor(10).id, "forest");
  const covered = GROWTH_STAGES.flatMap(s => [s.levels[0], s.levels[1]]);
  assert.deepEqual(covered, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("범위 밖 값도 안전하게 받는다", () => {
  assert.equal(stageFor(0).id, "seed");
  assert.equal(stageFor(99).id, "forest");
  assert.equal(stageFor(undefined).id, "seed");
});

test("다음 단계 — 마지막은 없음", () => {
  assert.equal(nextStage(1).id, "root");
  assert.equal(nextStage(8).id, "forest");
  assert.equal(nextStage(10), null);
});

test("남은 XP를 «완료 몇 건»으로 — 280XP가 한 건", () => {
  assert.equal(projectsToNextLevel(0), 0);
  assert.equal(projectsToNextLevel(10), 1);
  assert.equal(projectsToNextLevel(280), 1);
  assert.equal(projectsToNextLevel(281), 2);
  assert.equal(projectsToNextLevel(900), 4);
});

test("안내 한 줄 — 최고 레벨이면 그 말만", () => {
  assert.equal(nextLevelHint({ isMax: true }), "최고 레벨입니다");
  assert.match(nextLevelHint({ xpToNext: 560 }), /공사 2건/);
});

test("XP 항목은 상수에서 뽑는다(화면에 숫자를 손으로 적지 않는다)", () => {
  const s = xpSources();
  assert.ok(s.length >= 5);
  assert.ok(s.every(x => Number.isFinite(x.xp) && x.xp > 0));
  assert.equal(s.find(x => x.label === "고객 후기").xp, 30);
});