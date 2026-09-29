import { test } from "node:test";
import assert from "node:assert/strict";
import { coverCrop, cardTitle, cardFooter, cardFileName } from "./beforeAfter.js";

test("가운데 잘라 꽉 채우기", () => {
  assert.deepEqual(coverCrop(4000, 3000, 1000, 500), { sx: 0, sy: 500, sw: 4000, sh: 2000 });
  assert.deepEqual(coverCrop(1000, 2000, 1000, 500), { sx: 0, sy: 750, sw: 1000, sh: 500 });
  const c = coverCrop(3000, 4000, 1080, 480);
  assert.ok(Math.abs(c.sw / c.sh - 1080 / 480) < 1e-9);
  assert.equal(coverCrop(0, 10, 10, 10), null);
});

test("제목 — 적은 것 → 공간 → 기본", () => {
  assert.equal(cardTitle("욕실 줄눈 새로", "욕실"), "욕실 줄눈 새로");
  assert.equal(cardTitle("", "욕실"), "우리 집 욕실 공사 전·후");
  assert.equal(cardTitle("", ""), "우리 집 공사 전·후");
  assert.equal(cardTitle("가".repeat(40)).length, 24);
});

test("아래 띠 — 고객은 초대 선물, 업체는 사례", () => {
  assert.match(cardFooter({}).sub, /공간토큰 20개/);
  assert.match(cardFooter({ isCompany: true, companyName: "홍익시공" }).head, /홍익시공 시공 사례/);
  assert.doesNotMatch(cardFooter({ isCompany: true }).sub, /토큰/);
  assert.equal(cardFileName("2026-09-29"), "공간마켓_전후_20260929.png");
});

import { readFileSync } from "node:fs";
test("입구 — 마이(고객·업체)와 전·후 사진 후기 뒤", () => {
  const my = readFileSync(new URL("../screens/v3/MyPageV3.jsx", import.meta.url), "utf8");
  assert.match(my, /<BeforeAfterCard userId=\{user\.id\}/);
  assert.equal((my.match(/label="전·후 사진 카드"/g) ?? []).length, 2);
  const rv = readFileSync(new URL("../screens/ReviewScreen.jsx", import.meta.url), "utf8");
  assert.match(rv, /data\.beforeImageUrls\?\.\[0\] && data\.afterImageUrls\?\.\[0\]/);
});
