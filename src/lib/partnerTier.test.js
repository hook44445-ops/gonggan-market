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

test("보험 없이 보증금은 20% 로 계산된다(1,000 상한)", () => {
  assert.equal(bidLimit({ biz: true, depositManwon: 500 }), 1000);   // 보험 없이 20%: 500×5=2,500 → 1,000 상한
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
  assert.equal(nextUnlock({ biz: true, insurance: true }).key, "premium");
  assert.equal(nextUnlock({ biz: true, insurance: true, depositManwon: 200 }).key, "license");
});

test("입찰 금액이 넘을 때 — 무엇을 내면 되는지", () => {
  assert.equal(unlockFor(250, {}), null);                                   // 이미 가능
  assert.deepEqual(unlockFor(450, {}).need, ["사업자등록증 · 시공보험 · 보증금 중 하나"]);
  assert.deepEqual(unlockFor(800, {}).need, ["사업자등록증", "시공보험 증권 또는 보증금 160만원 이상"]);
  assert.deepEqual(unlockFor(800, { biz: true }).need, ["시공보험 증권 또는 보증금 160만원 이상"]);
  assert.deepEqual(unlockFor(1200, { biz: true, insurance: true }).need, ["보증금 120만원 이상"]);
  assert.deepEqual(unlockFor(3000, { biz: true, insurance: true, depositManwon: 100 }).need,
    ["보증금 300만원 이상", "실내건축공사업 등록증"]);
  assert.equal(unlockFor(20000, { biz: true, insurance: true, depositManwon: 5000, license: true }).over, true);
});

import { limitStateOf } from "./partnerTier.js";

test("업체 정보 → 한도 입력: 관리자 확인값만 본다", () => {
  // 결제 없이 적히던 badge 는 보지 않는다
  assert.deepEqual(limitStateOf({ badge: "signature" }), { biz: false, insurance: false, depositManwon: 0, license: false });
  // 공간보증은 ACTIVE 일 때만, 금액이 없으면 등급 금액
  assert.equal(limitStateOf({ guarantee_status: "PENDING_DEPOSIT", guarantee_grade: "MASTER" }).depositManwon, 0);
  assert.equal(limitStateOf({ guarantee_status: "ACTIVE", guarantee_grade: "MASTER" }).depositManwon, 500);
  assert.equal(limitStateOf({ guarantee_status: "ACTIVE", guarantee_amount: 300, guarantee_grade: "MASTER" }).depositManwon, 300);
  // hasInsurance(화면 이름)·has_insurance(DB 이름) 둘 다 받는다
  assert.equal(limitStateOf({ hasInsurance: true }).insurance, true);
  assert.equal(limitStateOf({ has_insurance: true }).insurance, true);
  // 끝까지: 사업자+보험+마스터+면허 → 5,000만원
  assert.equal(bidLimit(limitStateOf({ verified: true, has_insurance: true, guarantee_status: "ACTIVE", guarantee_grade: "MASTER", license_verified: true })), 5000);
});

import { unlockMessage, LADDER } from "./partnerTier.js";

test("보험 없으면 보증금 20% — 1,000만원까지만", () => {
  assert.equal(bidLimit({ biz: true, depositManwon: 100 }), 500);    // 100 × 5 = 500
  assert.equal(bidLimit({ biz: true, depositManwon: 160 }), 800);    // 160 × 5
  assert.equal(bidLimit({ biz: true, depositManwon: 200 }), 1000);   // 200 × 5
  assert.equal(bidLimit({ biz: true, depositManwon: 1000 }), 1000);  // 보험 없는 길은 1,000 에서 멈춘다
  assert.equal(unlockFor(800, { biz: true, depositManwon: 1000 }), null);
  assert.deepEqual(unlockFor(800, { biz: true }).need, ["시공보험 증권 또는 보증금 160만원 이상"]);
  assert.deepEqual(unlockFor(1200, { biz: true, depositManwon: 1000 }).need, ["시공보험 증권"]);
  assert.equal(nextUnlock({ biz: true, depositManwon: 100 }).key, "insurance");
});

test("보증금 10% — 1,200만원 공사엔 보증금 120만원", () => {
  assert.equal(bidLimit({ biz: true, insurance: true, depositManwon: 120 }), 1200);
  assert.equal(bidLimit({ biz: true, insurance: true, depositManwon: 119 }), 1190);
});

test("한 문장 — 받침에 맞춘 조사", () => {
  assert.equal(unlockMessage(null), null);
  assert.equal(unlockMessage({ need: ["시공보험 증권"], over: false }), "이 공사는 시공보험 증권을 내면 입찰할 수 있어요");
  assert.equal(unlockMessage({ need: ["시공보험 증권 또는 보증금 160만원 이상"], over: false }),
    "이 공사는 시공보험 증권 또는 보증금 160만원 이상을 내면 입찰할 수 있어요");
  assert.equal(unlockMessage({ need: ["사업자등록증 · 시공보험 · 보증금 중 하나"], over: false }),
    "이 공사는 사업자등록증 · 시공보험 · 보증금 중 하나를 내면 입찰할 수 있어요");
  assert.match(unlockMessage({ need: [], over: true }), /1억원까지/);
});

test("계단 — 300 · 500 · 1,000 · 1,500 미만 · 1억", () => {
  assert.deepEqual(LADDER.map(r => r.limit), [300, 500, 1000, 1499, 10000]);
  assert.deepEqual(LADDER.map(r => r.key), ["none", "biz", "insurance", "premium", "license"]);
});
