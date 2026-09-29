import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuote, formatWon, quoteFileName, QUOTE_MAX_ITEMS } from "./quoteSheet.js";

test("견적 — 항목 합계 · 빈 줄은 무시 · 금액 글자 정리", () => {
  const { quote } = buildQuote({ title: "욕실 실리콘 교체", customer: "김○○", items: [
    { name: "실리콘 재시공", amount: "120,000" }, { name: "", amount: "" }, { name: "줄눈 보수", amount: "80000원" } ] });
  assert.equal(quote.total, 200000);
  assert.equal(quote.items.length, 2);
  assert.equal(quote.vatLine, "부가세 포함");
  assert.equal(formatWon(quote.total), "200,000원");
});

test("견적 — 안 되는 경우는 한국어로", () => {
  assert.match(buildQuote({ items: [{ name: "a", amount: 1 }] }).error, /공사 이름/);
  assert.match(buildQuote({ title: "t", items: [] }).error, /항목을 하나 이상/);
  assert.match(buildQuote({ title: "t", items: [{ name: "", amount: "5000" }] }).error, /이름이 없는 항목/);
  assert.match(buildQuote({ title: "t", items: [{ name: "a", amount: "" }] }).error, /금액을/);
  const many = Array.from({ length: QUOTE_MAX_ITEMS + 1 }, (_, i) => ({ name: `항목${i}`, amount: 1000 }));
  assert.match(buildQuote({ title: "t", items: many }).error, /까지예요/);
  assert.equal(buildQuote({ title: "t", vat: "separate", items: [{ name: "a", amount: 1 }] }).quote.vatLine, "부가세 별도");
});

test("파일 이름 — 못 쓰는 글자 빼기", () => {
  assert.equal(quoteFileName("욕실/주방: 수리?", "2026-10-02"), "견적서-욕실주방 수리-2026-10-02.png");
  assert.equal(quoteFileName("", "2026-10-02"), "견적서-견적-2026-10-02.png");
});
