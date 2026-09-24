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
  assert.deepEqual(unlockFor(450, {}).need, ["사업자등록증"]);
  assert.deepEqual(unlockFor(800, {}).need, ["사업자등록증", "시공보험 증권"]);
  assert.deepEqual(unlockFor(800, { biz: true }).need, ["시공보험 증권"]);
  assert.deepEqual(unlockFor(1200, { biz: true, insurance: true }).need, ["공간보증 프리미엄(200만원)"]);
  assert.deepEqual(unlockFor(3000, { biz: true, insurance: true, depositManwon: 100 }).need,
    ["공간보증 마스터(500만원)", "실내건축공사업 등록증"]);
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
  assert.deepEqual(unlockFor(800, { biz: true }).need, ["시공보험 증권"]);   // 2안(보증금 20%)은 안내하지 않는다
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

// 앱이 쓰는 정규화된 업체 값(MainApp normalizeCompany — hasInsurance)에서도 면허가 한도를 연다.
// normalizeCompany 가 license_verified 를 빠뜨리면 관리자가 면허를 승인해도 입찰 화면은 1,500만원 미만으로 막혔다.
test("limitStateOf — 정규화된 업체 값(hasInsurance)에서도 면허가 한도를 연다", () => {
  const normalized = { verified: true, hasInsurance: true, guarantee_status: "ACTIVE", guarantee_amount: 500, license_verified: true };
  assert.equal(bidLimit(limitStateOf(normalized)), 5000);
  assert.equal(bidLimit(limitStateOf({ ...normalized, license_verified: undefined })), LIMITS.UNLICENSED_CEILING);
});

// 계단 위치는 금액이 아니라 «낸 증빙»으로 — 보증금이 적은 면허 업체도 면허 칸에 있어야 한다.
test("ladderKeyOf — 낸 증빙으로 계단 위치를 정한다", async () => {
  const { ladderKeyOf } = await import("./partnerTier.js");
  assert.equal(ladderKeyOf({}), "none");
  assert.equal(ladderKeyOf({ insurance: true }), "none");                       // 사업자 없이는 500만원이어도 첫 칸
  assert.equal(ladderKeyOf({ biz: true }), "biz");
  assert.equal(ladderKeyOf({ biz: true, depositManwon: 200 }), "insurance");      // 보험 대신 보증금 20%(200만원부터 한도가 오른다)
  assert.equal(ladderKeyOf({ biz: true, insurance: true, depositManwon: 200 }), "premium");
  assert.equal(ladderKeyOf({ biz: true, insurance: true, depositManwon: 500, license: true }), "license");
});

// 더 낼 서류가 없다 ≠ 가장 큰 공사. 1억 미만이면 «보증금을 늘리면 커진다».
test("maxedText — 최고 한도가 아니면 보증금 안내", async () => {
  const { maxedText } = await import("./partnerTier.js");
  assert.match(maxedText({ biz: true, insurance: true, depositManwon: 500, license: true }), /보증금을 늘리면/);
  assert.equal(maxedText({ biz: true, insurance: true, depositManwon: 1000, license: true }), "가장 큰 공사까지 받을 수 있어요");
});

// 공간보증 베이직(50)·스탠다드(100)는 한도를 올리지 못한다 — 프리미엄 칸으로 올리지 않는다.
test("ladderKeyOf — 한도를 올리지 못하는 보증금은 프리미엄이 아니다", async () => {
  const { ladderKeyOf } = await import("./partnerTier.js");
  for (const dep of [50, 100]) {
    const s = { biz: true, insurance: true, depositManwon: dep };
    assert.equal(bidLimit(s), 1000);
    assert.equal(ladderKeyOf(s), "insurance");
    assert.equal(ladderKeyOf({ ...s, license: true }), "insurance");
  }
  assert.equal(ladderKeyOf({ biz: true, insurance: true, depositManwon: 200 }), "premium");
});

test("nextUnlock — 베이직·스탠다드를 건 업체에게는 프리미엄 등급(200만원)을 알려 준다", () => {
  const n = nextUnlock({ biz: true, insurance: true, depositManwon: 50 });
  assert.equal(n.key, "premium");
  assert.equal(n.to, LIMITS.UNLICENSED_CEILING);
  assert.match(n.ask, /200만원/);
});

test("ladderKeyOf — 보험 없이 건 보증금도 한도를 올릴 때만 한 칸 오른다", async () => {
  const { ladderKeyOf } = await import("./partnerTier.js");
  assert.equal(bidLimit({ biz: true, depositManwon: 50 }), 500);
  assert.equal(ladderKeyOf({ biz: true, depositManwon: 50 }), "biz");
  assert.equal(ladderKeyOf({ biz: true, depositManwon: 100 }), "biz");
  assert.equal(ladderKeyOf({ biz: true, depositManwon: 200 }), "insurance");
});
