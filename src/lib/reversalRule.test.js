import { test } from "node:test";
import assert from "node:assert/strict";
import { reversalEffect, MAX_BIDS_PER_REQUEST } from "./reversalRule.js";

const now = new Date("2026-09-25T12:00:00Z").getTime();
const h = (n) => new Date(now - n * 36e5).toISOString();

test("번복 온도 — 업체가 들인 수고만큼(시장논리)", () => {
  assert.equal(reversalEffect({ selected: false }).delta, 0);
  assert.equal(reversalEffect({ selected: true, status: "site_visiting", selectedAt: h(5), now }).delta, -0.5);
  assert.equal(reversalEffect({ selected: true, status: "final_quote_submitted", selectedAt: h(5), now }).delta, -1.0);
  assert.equal(reversalEffect({ selected: true, status: "site_visiting", selectedAt: h(80), now }).delta, 0);   // 업체가 멈춤
  assert.equal(reversalEffect({ selected: true, status: "final_quote_submitted", selectedAt: h(80), now }).delta, -1.0); // 견적은 받았다
  assert.equal(reversalEffect({ paid: true }).canCancel, false);
  assert.equal(MAX_BIDS_PER_REQUEST, 5);
});
