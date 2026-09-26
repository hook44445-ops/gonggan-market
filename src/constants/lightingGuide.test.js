import { test } from "node:test";
import assert from "node:assert/strict";
import { splitLight, joinLight, requestHasLighting, LIGHT_CHECK } from "./lightingGuide.js";
import { suggestTrades } from "../lib/finalQuote.js";

test("조명 줄 — 넣고 다시 읽으면 같다(스위치·콘센트 포함)", () => {
  const note = joinLight(["매입등", "스위치·콘센트"], "거실만");
  assert.equal(note, "조명: 매입등, 스위치·콘센트\n거실만");
  assert.deepEqual(splitLight(note), { light: ["매입등", "스위치·콘센트"], rest: "거실만" });
  assert.deepEqual(splitLight("거실만"), { light: [], rest: "거실만" });
  assert.equal(joinLight([], " 거실만 "), "거실만");
});

test("요청에 조명이 있나", () => {
  assert.ok(requestHasLighting({ description: "도배, 조명·전기 — 조명: 간접조명" }));
  assert.ok(!requestHasLighting({ description: "도배, 바닥" }));
  assert.ok(!requestHasLighting(undefined));
});

test("단계별 확인 포인트 — 착공·중간·완료", () => {
  for (const k of [3, 4, 5]) assert.ok(LIGHT_CHECK[k].length >= 3);
});

test("업체 견적 칩 — 조명 기본 · 요청의 간접조명도", () => {
  assert.ok(suggestTrades({ description: "도배, 바닥" }).includes("조명"));
  const t = suggestTrades({ description: "도배, 조명·전기 — 조명: 간접조명, 매입등" });
  assert.ok(t.includes("간접조명") && t.includes("매입등") && t.includes("조명·전기"));
  assert.ok(!t.includes("전기") && !t.includes("조명"), "조명·전기가 있으면 기본 전기·조명 칩은 뺀다");
});
