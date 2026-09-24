// 파트너 카드 등급 — 낸 만큼 카드가 좋아지는 규칙이 흔들리지 않게.
import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerTier, coverOf, compareStats, TIERS, PROOFS } from "./partnerTier.js";

test("아무것도 안 내면 기본, 빠진 것 셋", () => {
  const t = partnerTier({});
  assert.equal(t.key, "basic");
  assert.equal(t.count, 0);
  assert.deepEqual(t.missing.map(m => m.key), ["biz", "insurance", "deposit"]);
});

test("하나라도 내면 확인된 업체", () => {
  assert.equal(partnerTier({ biz: true }).key, "verified");
  assert.equal(partnerTier({ insurance: true, deposit: true }).key, "verified");
});

test("셋 다 내야 프리미엄 — 둘로는 안 된다", () => {
  assert.equal(partnerTier({ biz: true, insurance: true }).key, "verified");
  const p = partnerTier({ biz: true, insurance: true, deposit: true });
  assert.equal(p.key, "premium");
  assert.equal(p.missing.length, 0);
  assert.equal(p.label, TIERS.premium.label);
});

test("등급 순위는 기본 < 확인 < 프리미엄", () => {
  assert.ok(TIERS.basic.rank < TIERS.verified.rank && TIERS.verified.rank < TIERS.premium.rank);
  assert.equal(PROOFS.length, 3);
});

test("대표 사진 — 여러 모양에서 찾고, 없으면 null", () => {
  assert.equal(coverOf({ cover: "/a.webp" }), "/a.webp");
  assert.equal(coverOf({ portfolio: [{ afterPhotos: ["/b.webp"] }] }), "/b.webp");
  assert.equal(coverOf({ portfolio: [{}, { image_url: "/c.webp" }] }), "/c.webp");
  assert.equal(coverOf({ portfolio: [] }), null);
  assert.equal(coverOf({}), null);
});

test("비교 줄 — 모든 카드가 같은 순서, 없는 값은 —", () => {
  const s = compareStats({ completedJobs: 58, rating: 4.83, avgResponseHours: 0.5, disputeRate: 0 });
  assert.deepEqual(s.map(x => x.key), ["done", "rating", "response", "dispute"]);
  assert.equal(s[1].value, "4.8");
  assert.equal(s[2].value, "30분");
  const empty = compareStats({});
  assert.equal(empty[1].value, "—");
  assert.equal(empty[2].value, "—");
});
