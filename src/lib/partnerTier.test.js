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

// ── 수주 한도 안전안 ──────────────────────────────────────────────
import { bidLimit, limitText, nextUnlock, unlockFor, LIMITS } from "./partnerTier.js";

test("사업자 없음 — 가입만 300, 보험이나 보증금이 있으면 500, 그 이상은 막힌다", () => {
  assert.equal(bidLimit({}), 300);
  assert.equal(bidLimit({ insurance: true }), 500);
  assert.equal(bidLimit({ depositManwon: 1000 }), 500);          // 보증금을 아무리 걸어도 사업자 없이는 500
  assert.equal(bidLimit({ insurance: true, depositManwon: 1000, license: true }), 500);
});

test("사업자 있음 — 500 → 보험 1,000 → 보증금 × 10(면허 없으면 1,500 미만)", () => {
  assert.equal(bidLimit({ biz: true }), 500);
  assert.equal(bidLimit({ biz: true, insurance: true }), 1000);
  assert.equal(bidLimit({ biz: true, insurance: true, depositManwon: 50 }), 1000);   // 500 < 1,000 이라 그대로
  assert.equal(bidLimit({ biz: true, insurance: true, depositManwon: 200 }), LIMITS.UNLICENSED_CEILING);
  assert.equal(bidLimit({ biz: true, insurance: true, depositManwon: 200, license: true }), 2000);
  assert.equal(bidLimit({ biz: true, insurance: true, depositManwon: 5000, license: true }), 10000); // 1억 상한
});

test("보증금은 보험 없이는 한도를 올리지 않는다", () => {
  assert.equal(bidLimit({ biz: true, depositManwon: 500 }), 500);
});

test("금액 글자 — 1,499 는 「1,500만원 미만」", () => {
  assert.equal(limitText(300), "300만원");
  assert.equal(limitText(1000), "1,000만원");
  assert.equal(limitText(1499), "1,500만원 미만");
  assert.equal(limitText(10000), "1억원");
});

test("다음 한 가지 — 하나만 더 내면 얼마가 되는지", () => {
  assert.deepEqual(nextUnlock({}), { key: "biz", ask: "사업자등록증", from: 300, to: 500 });
  assert.equal(nextUnlock({ biz: true }).key, "insurance");
  assert.equal(nextUnlock({ biz: true, insurance: true }).key, "deposit");
  assert.equal(nextUnlock({ biz: true, insurance: true, depositManwon: 200 }).key, "license");
});

test("입찰 금액이 넘을 때 — 무엇을 내면 되는지", () => {
  assert.equal(unlockFor(250, {}), null);                                   // 이미 가능
  assert.deepEqual(unlockFor(450, {}).need, ["시공보험 증권 또는 보증금"]);
  assert.deepEqual(unlockFor(800, {}).need, ["사업자등록증", "시공보험 증권"]);
  assert.deepEqual(unlockFor(800, { biz: true }).need, ["시공보험 증권"]);
  assert.deepEqual(unlockFor(1200, { biz: true, insurance: true }).need, ["보증금 120만원 이상"]);
  assert.deepEqual(unlockFor(3000, { biz: true, insurance: true, depositManwon: 100 }).need,
    ["보증금 300만원 이상", "실내건축공사업 등록증"]);
  assert.equal(unlockFor(20000, { biz: true, insurance: true, depositManwon: 5000, license: true }).over, true);
});
