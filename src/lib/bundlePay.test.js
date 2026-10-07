// 공정 묶음 분할 결제 — 묶음 나누기(1천만 경계·차수) · 남은 금액 · 모든 묶음 완료 = 계약 확정.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUNDLE_LIMIT_WON, splitIntoBundles, quoteLines, bundleProgress, checkPartAmount, planSummary,
  contractReady, headline, fmtWon, partState, BUNDLE_METHODS,
} from "./bundlePay.js";

const M = 10_000; // 만원 → 원
const amounts = (bs) => bs.map((b) => b.amountWon);

test("2,500만 원 한 공정 → 900/900/700 (목공 1차·2차·3차)", () => {
  const bs = splitIntoBundles([{ name: "목공", won: 2500 * M }]);
  assert.deepEqual(amounts(bs), [900 * M, 900 * M, 700 * M]);
  assert.deepEqual(bs.map((b) => b.label), ["목공 1차", "목공 2차", "목공 3차"]);
  assert.equal(bs.reduce((s, b) => s + b.amountWon, 0), 2500 * M);
});

test("1천만 경계 — 묶음은 1천만 «미만». 딱 1천만인 공정은 차수로 나눈다", () => {
  assert.deepEqual(amounts(splitIntoBundles([{ name: "목공", won: 1000 * M }])), [900 * M, 100 * M]);
  assert.deepEqual(amounts(splitIntoBundles([{ name: "목공", won: 1000 * M - 1 }])), [1000 * M - 1]);
  // 더해서 딱 1천만이 되면 묶지 않는다
  assert.deepEqual(amounts(splitIntoBundles([{ name: "철거", won: 400 * M }, { name: "도배", won: 600 * M }])), [400 * M, 600 * M]);
  // 1원 모자라면 한 묶음
  assert.deepEqual(amounts(splitIntoBundles([{ name: "철거", won: 400 * M }, { name: "도배", won: 600 * M - 1 }])), [1000 * M - 1]);
});

test("여러 공정은 견적서 순서대로 1천만 미만이 되게 묶고, 큰 공정은 따로 차수", () => {
  const bs = splitIntoBundles([
    { name: "철거", won: 150 * M }, { name: "설비", won: 300 * M }, { name: "목공", won: 1800 * M },
    { name: "타일", won: 500 * M }, { name: "도배", won: 250 * M }, { name: "바닥", won: 400 * M },
  ]);
  assert.deepEqual(bs.map((b) => b.label), ["철거·설비", "목공 1차", "목공 2차", "타일·도배", "바닥"]);
  assert.deepEqual(amounts(bs), [450 * M, 900 * M, 900 * M, 750 * M, 400 * M]);
  assert.ok(bs.every((b) => b.amountWon > 0 && b.amountWon < BUNDLE_LIMIT_WON));
  assert.deepEqual(bs.map((b) => b.seq), [1, 2, 3, 4, 5]);
});

test("어떤 금액이든 묶음 합 = 견적 합, 묶음마다 1천만 미만", () => {
  for (const total of [1, 999_9999, 1000 * M, 1000 * M + 1, 4321 * M + 5000, 1 * 10_000 * M]) {
    const bs = splitIntoBundles([{ name: "공사 전체", won: total }, { name: "기타", won: 77 * M }]);
    assert.equal(bs.reduce((s, b) => s + b.amountWon, 0), total + 77 * M, String(total));
    assert.ok(bs.every((b) => b.amountWon < BUNDLE_LIMIT_WON), String(total));
  }
});

test("최종 견적서(만원) → 공정 줄(원). 같은 공정은 합치고, 합계 차이는 «기타», 할인이면 «공사 전체» 한 줄", () => {
  const est = { total_price: 1260, items: [
    { name: "목공", qty: 1, unit_price: 800 }, { name: "목공", qty: 2, unit_price: 100 }, { name: "도배", qty: 1, unit_price: 250 },
  ] };
  assert.deepEqual(quoteLines(est), [{ name: "목공", won: 1000 * M }, { name: "도배", won: 250 * M }, { name: "기타", won: 10 * M }]);
  assert.deepEqual(quoteLines({ ...est, total_price: 1100 }), [{ name: "공사 전체", won: 1100 * M }]);
  assert.deepEqual(quoteLines(null, 480), [{ name: "공사 전체", won: 480 * M }]);    // 견적서 없이 입찰가로 계약(119)
  assert.deepEqual(quoteLines({ total_price: 247.2, items: [{ name: "도배", qty: 1, unit_price: 247.2 }] }), [{ name: "도배", won: 2_472_000 }]);
});

const now = Date.parse("2026-10-07T12:00:00+09:00");
const later = (h) => new Date(now + h * 3600_000).toISOString();

test("남은 금액 = 묶음 금액 − 낸 금액 − 입금 기다리는 금액(기한 안). 기한 지난 계좌는 다시 열린다", () => {
  const b = { amountWon: 900 * M };
  const parts = [
    { status: "DONE", amount_won: 300 * M },                                  // 카드 1
    { status: "DONE", amount_won: 200 * M },                                  // 카드 2
    { status: "WAITING_FOR_DEPOSIT", amount_won: 250 * M, due_at: later(24) }, // 가상계좌 — 아직 기한 안
    { status: "WAITING_FOR_DEPOSIT", amount_won: 100 * M, due_at: later(-1) }, // 기한 지남 → 안 잡음
    { status: "CANCELED", amount_won: 900 * M },
  ];
  const p = bundleProgress(b, parts, now);
  assert.deepEqual(p, { amountWon: 900 * M, paidWon: 500 * M, pendingWon: 250 * M, remainingWon: 150 * M, status: "PENDING" });
  assert.equal(partState({ status: "REQUESTED", created_at: later(-0.1) }, now), "pending");   // 카드 결제창 진행 중(잠깐)
  assert.equal(partState({ status: "REQUESTED", created_at: later(-2) }, now), "expired");     // 창을 닫고 떠남
});

test("이번에 낼 금액 검사 — 남은 금액 이하, 최소 1만 원(마지막 자투리는 그 금액)", () => {
  const p = { remainingWon: 150 * M, pendingWon: 0 };
  assert.equal(checkPartAmount(p, 150 * M), null);
  assert.equal(checkPartAmount(p, 150 * M + 1), "OVER_REMAINING");
  assert.equal(checkPartAmount(p, 5000), "UNDER_MIN");
  assert.equal(checkPartAmount(p, 1.5), "BAD_AMOUNT");
  assert.equal(checkPartAmount({ remainingWon: 3000, pendingWon: 0 }, 3000), null);
  assert.equal(checkPartAmount({ remainingWon: 0, pendingWon: 100 }, 1), "WAITING_DEPOSIT");
  assert.equal(checkPartAmount({ remainingWon: 0, pendingWon: 0 }, 1), "BUNDLE_PAID");
});

test("모든 묶음이 다 채워져야 계약 확정 — 하나라도 남으면 «결제 진행 중»", () => {
  const bs = splitIntoBundles([{ name: "목공", won: 2500 * M }]).map((b, i) => ({ ...b, id: `b${i + 1}` }));
  const parts = {
    b1: [{ status: "DONE", amount_won: 900 * M }],
    b2: [{ status: "DONE", amount_won: 500 * M }, { status: "DONE", amount_won: 400 * M }],   // 카드 두 장
    b3: [{ status: "WAITING_FOR_DEPOSIT", amount_won: 700 * M, due_at: later(48) }],
  };
  const s = planSummary(bs, parts, now);
  assert.equal(s.contractReady, false);
  assert.equal(s.paidCount, 2);
  assert.equal(headline(s), "3개 중 2개 결제 완료 · 남은 금액 700만 원");
  // 입금이 들어오면 확정
  parts.b3[0].status = "DONE";
  assert.equal(contractReady(bs, parts, now), true);
  assert.match(headline(planSummary(bs, parts, now)), /모두 결제 완료/);
  // 묶음이 없으면 확정 아님
  assert.equal(contractReady([], {}, now), false);
});

test("금액 표기 · 수단 목록(가상계좌 먼저 · 요금 차이 표시 없음)", () => {
  assert.equal(fmtWon(7_000_000), "700만 원");
  assert.equal(fmtWon(7_345_000), "734만 5,000원");
  assert.equal(fmtWon(8000), "8,000원");
  assert.equal(BUNDLE_METHODS[0].id, "VIRTUAL_ACCOUNT");
  assert.ok(BUNDLE_METHODS.every((m) => !/%|수수료|추가 요금|\+/.test(`${m.label}${m.desc}`)));
});
