import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerMoney, daysLeft } from "./partnerMoney.js";

test("C14: 계약 전 공사는 정산 예정·입금 예정에서 빠진다", () => {
  const r = partnerMoney({ activeJobs: [{ contracted: false, total: 240, paid: 0 }] });
  assert.equal(r.pending, 0);
  assert.equal(r.monthRevenue, 0);
});

test("C14: 실수령(수수료 4.4% 뺀 값)으로 센다", () => {
  const r = partnerMoney({ activeJobs: [{ contracted: true, total: 280, paid: 10 }] });
  assert.equal(r.monthRevenue, 27);   // 28만원 → 26.8 → 27
  assert.equal(r.pending, 241);       // 252만원 → 240.9 → 241
});

test("C14: 이번 달 정산 완료 공사도 이번 달 수익", () => {
  const now = new Date("2026-09-24T12:00:00+09:00");
  const r = partnerMoney({ completedJobs: [{ settled: true, total: 290, date: "2026-09-24T05:00:00Z" }], now });
  assert.equal(r.monthRevenue, 277);  // 290 × 0.956 = 277.2
});

test("C14: 공사 기간을 모르면 D-day 없음, 3일 공사는 D-3", () => {
  assert.equal(daysLeft("2026-09-24T00:00:00Z", null), null);
  assert.equal(daysLeft("2026-09-24T00:00:00Z", 3, new Date("2026-09-24T01:00:00Z").getTime()), 3);
});
