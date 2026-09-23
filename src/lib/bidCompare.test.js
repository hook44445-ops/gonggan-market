import { test } from "node:test";
import assert from "node:assert/strict";
import { bidTags, sortBids, bidSummary } from "./bidCompare.js";

const B = [
  { id: "a", price: 1800, period: 20, company: { temp: 37.0 } },
  { id: "b", price: 1200, period: 30, company: { temp: 39.2 } },
  { id: "c", price: 1500, period: 14, company: { temp: 36.5 } },
];

test("한 곳뿐이면 비교 표를 달지 않는다", () => {
  assert.deepEqual(bidTags([B[0]], B[0]), []);
});

test("가장 싼 곳·빠른 곳·평판 좋은 곳에 표가 붙는다", () => {
  assert.deepEqual(bidTags(B, B[1]), ["💰 최저가", "⭐ 평판 최고"]);
  assert.deepEqual(bidTags(B, B[2]), ["⚡ 가장 빨라요"]);
  assert.deepEqual(bidTags(B, B[0]), []);
});

test("정렬 — 금액·기간·온도, 추천순은 받은 순서 그대로", () => {
  assert.deepEqual(sortBids(B, "price").map(b => b.id), ["b", "c", "a"]);
  assert.deepEqual(sortBids(B, "period").map(b => b.id), ["c", "a", "b"]);
  assert.deepEqual(sortBids(B, "temp").map(b => b.id), ["b", "a", "c"]);
  assert.deepEqual(sortBids(B, "recommended").map(b => b.id), ["a", "b", "c"]);
  assert.deepEqual(B.map(b => b.id), ["a", "b", "c"]); // 원본은 그대로
});

test("금액이 없는 입찰은 뒤로", () => {
  const withNull = [...B, { id: "d", price: 0, period: null, company: {} }];
  assert.equal(sortBids(withNull, "price").at(-1).id, "d");
  assert.equal(sortBids(withNull, "period").at(-1).id, "d");
  assert.equal(sortBids(withNull, "temp").at(-1).id, "d");
});

test("요약 — 몇 곳·최저·최고·차액", () => {
  const s = bidSummary(B);
  assert.equal(s.count, 3);
  assert.equal(s.min, 1200);
  assert.equal(s.max, 1800);
  assert.equal(s.gap, 600);
  assert.equal(s.minPeriod, 14);
  assert.deepEqual(bidSummary([]), { count: 0, min: null, max: null, gap: 0, minPeriod: null, maxPeriod: null });
});