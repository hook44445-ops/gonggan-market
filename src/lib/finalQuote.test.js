import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestTrades, applyTrade, restoreQuote, stepBlocker, quoteTotal, makeEmptyItem } from "./finalQuote.js";

test("요청서에서 고른 공사가 공정 칩 앞쪽에 온다", () => {
  const t = suggestTrades({ description: "필름, 욕실 위주로 부탁드려요" });
  assert.deepEqual(t.slice(0, 2), ["필름", "욕실"]);
  assert.ok(t.includes("철거") && t.length <= 12);
  assert.equal(new Set(t).size, t.length);
  const e = suggestTrades({ description: "조명·전기 교체" });
  assert.ok(e.includes("조명·전기") && !e.includes("전기"));
});

test("칩은 빈 줄을 먼저 채우고, 같은 공정은 두 번 안 넣는다", () => {
  let items = [makeEmptyItem(0), makeEmptyItem(1)];
  items = applyTrade(items, "철거");
  assert.equal(items[0].name, "철거");
  items = applyTrade(items, "철거");
  assert.equal(items.filter(i => i.name === "철거").length, 1);
  items = applyTrade(applyTrade(items, "도배"), "타일");
  assert.equal(items.length, 3);
  assert.equal(items[2].name, "타일");
});

test("임시저장한 견적을 다시 열면 공정·기간·메모가 돌아온다", () => {
  const r = restoreQuote({ items: [{ name: "철거", material: "", qty: 1, unit_price: 120 }], duration_days: 14, note: "메모", warranty_note: "1년" });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].unitPrice, "120");
  assert.equal(r.durationDays, "14");
  assert.equal(r.note, "메모");
  assert.equal(restoreQuote(null).items.length, 3);
});

test("다음 단계 막기 — 빈 줄은 무시, 반쯤 쓴 줄만 막는다", () => {
  const ok = [{ ...makeEmptyItem(0), name: "철거", qty: "1", unitPrice: "100" }, makeEmptyItem(1)];
  assert.equal(stepBlocker(1, { items: ok }), null);
  assert.match(stepBlocker(1, { items: [makeEmptyItem(0)] }), /한 줄/);
  assert.match(stepBlocker(1, { items: [{ ...makeEmptyItem(0), name: "철거", qty: "1" }] }), /1번째/);
  assert.match(stepBlocker(2, { durationDays: "" }), /기간/);
  assert.equal(stepBlocker(2, { durationDays: "7" }), null);
  assert.equal(quoteTotal(ok), 100);
});