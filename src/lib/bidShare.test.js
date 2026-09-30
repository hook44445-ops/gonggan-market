import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bidShareRows, bidShareTitle, bidShareText, SHARE_MAX_ROWS } from "./bidShare.js";

test("싼 순 · 최대 5곳 · 가격 없는 입찰 빼기 · 가장 싼 곳 표시", () => {
  const bids = [
    { price: 1650, period: 7, company: { name: "홍익시공", temp: 41.2 } },
    { price: 1200, period: 10, company: { name: "공간설계소" } },
    { price: 0, company: { name: "가격없음" } },
    ...Array.from({ length: 5 }, (_, i) => ({ price: 2000 + i, company: { name: `업체${i}` } })),
  ];
  const rows = bidShareRows(bids);
  assert.equal(rows.length, SHARE_MAX_ROWS);
  assert.deepEqual(rows[0], { name: "공간설계소", price: "1,200만원", period: "10일", temp: "—", cheapest: true });
  assert.equal(rows[1].temp, "41.2°");
  assert.ok(!rows.some((r) => r.name === "가격없음"));
  assert.equal(bidShareRows([{ price: 100, company: { name: "A" } }])[0].cheapest, false);
});

test("제목·보낼 글 — 주소·예산 없음", () => {
  assert.equal(bidShareTitle("욕실"), "우리 집 욕실 견적 비교");
  assert.equal(bidShareTitle(""), "우리 집 견적 비교");
  assert.match(bidShareText("AB2CD3", "https://gongganmarket.com/?ref=AB2CD3"), /\?ref=AB2CD3/);
  assert.doesNotMatch(bidShareText(null, ""), /ref=/);
});

test("견적 비교 화면에 «가족에게 보내기»", () => {
  const scr = readFileSync(new URL("../screens/BidStatusScreen.jsx", import.meta.url), "utf8");
  assert.match(scr, /<BidShareCard /);
  const card = readFileSync(new URL("../components/BidShareCard.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(card, /area|budget|phone|address/);
});
