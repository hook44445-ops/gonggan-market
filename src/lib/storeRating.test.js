import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlatform, storeReviewUrl, shouldAskRating } from "./storeRating.js";

test("어느 스토어 앱인지 — 아이폰·안드로이드·그 밖", () => {
  assert.equal(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
  assert.equal(detectPlatform("Mozilla/5.0 (Linux; Android 14; SM-S918N)"), "android");
  assert.equal(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)", "android-app://com.gonggansai.gongganmarket/"), "android");
  assert.equal(detectPlatform("Mozilla/5.0 (Windows NT 10.0)"), null);
});

test("스토어 주소가 없으면(심사 전 · 비공개 테스트) 묻지 않는다", () => {
  assert.equal(storeReviewUrl("ios", { appStoreId: "" }), null);
  assert.equal(storeReviewUrl("ios", { appStoreId: "6739012345" }), "https://apps.apple.com/app/id6739012345?action=write-review");
  assert.equal(storeReviewUrl("android", { playPublic: false }), null);
  assert.match(storeReviewUrl("android", { playPublic: true }), /details\?id=com\.gonggansai\.gongganmarket/);
  assert.equal(storeReviewUrl(null, { appStoreId: "1", playPublic: true }), null);
});

test("별 4개 이상 · 90일 간격 · 평생 3번까지", () => {
  const url = "https://apps.apple.com/app/id1?action=write-review";
  const now = Date.UTC(2027, 0, 1);
  const day = 86400000;
  assert.equal(shouldAskRating({ rating: 5, url, asks: [], now }), true);
  assert.equal(shouldAskRating({ rating: 3, url, asks: [], now }), false);
  assert.equal(shouldAskRating({ rating: 5, url: null, asks: [], now }), false);
  assert.equal(shouldAskRating({ rating: 4, url, asks: [now - 30 * day], now }), false);
  assert.equal(shouldAskRating({ rating: 4, url, asks: [now - 91 * day], now }), true);
  assert.equal(shouldAskRating({ rating: 5, url, asks: [1, 2, 3], now }), false);
});
