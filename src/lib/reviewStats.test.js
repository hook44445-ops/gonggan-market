import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewStatsByCompany, withReviewStats } from "./reviewStats.js";

test("D16: 업체별 평균·개수를 센다", () => {
  const s = reviewStatsByCompany([
    { company_id: "a", rating: 5 },
    { company_id: "a", rating: 4 },
    { company_id: "b", rating: 5 },
  ]);
  assert.deepEqual(s, { a: { rating: 4.5, reviews: 2 }, b: { rating: 5, reviews: 1 } });
});

test("D16: 1~5 밖·빈 값은 세지 않는다", () => {
  const s = reviewStatsByCompany([
    { company_id: "a", rating: 0 },
    { company_id: "a", rating: null },
    { company_id: "a", rating: 6 },
    { company_id: null, rating: 5 },
    { company_id: "a", rating: "3" },
  ]);
  assert.deepEqual(s, { a: { rating: 3, reviews: 1 } });
});

test("D16: 후기 없는 업체는 0/0 — 옛 row.rating 을 믿지 않는다", () => {
  const list = withReviewStats([{ id: "a", rating: 4.9 }, { id: "b" }], { b: { rating: 5, reviews: 2 } });
  assert.deepEqual(list, [{ id: "a", rating: 0, reviews: 0 }, { id: "b", rating: 5, reviews: 2 }]);
});
