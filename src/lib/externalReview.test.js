import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { externalReviewProblem, reviewReasonText, reviewRequestUrl, reviewRequestMessage, rememberPendingReview, takePendingReview } =
  await import("./externalReview.js");

beforeEach(() => store.clear());

test("입력 확인 — 별점·5~500자·공사 이름 40자", () => {
  assert.equal(externalReviewProblem({ rating: 5, content: "깔끔하게 해 주셨어요" }), null);
  assert.match(externalReviewProblem({ rating: 0, content: "좋아요좋아요" }), /별점/);
  assert.match(externalReviewProblem({ rating: 4, content: "좋아요" }), /5자/);
  assert.match(externalReviewProblem({ rating: 4, content: "가".repeat(501) }), /500/);
  assert.match(externalReviewProblem({ rating: 4, content: "좋아요좋아요", workTitle: "가".repeat(41) }), /40/);
});

test("후기 부탁 링크 — ?write=1 + 초대 코드", () => {
  assert.equal(reviewRequestUrl("gangseo-repair", "AB2CD3"), "https://gongganland.com/p/gangseo-repair?write=1&ref=AB2CD3");
  assert.equal(reviewRequestUrl("gangseo-repair", null), "https://gongganland.com/p/gangseo-repair?write=1");
  assert.ok(reviewRequestMessage("강서 집수리", "https://x").startsWith("강서 집수리입니다."));
  assert.equal(reviewReasonText("OWN_COMPANY"), "내 업체에는 후기를 남길 수 없어요");
});

test("로그인 전 기억 → 로그인 뒤 한 번만 되돌린다 · 7일 지나면 버림", () => {
  const t0 = Date.UTC(2026, 9, 1);
  rememberPendingReview("gangseo-repair", t0);
  assert.equal(takePendingReview(t0 + 1000), "/p/gangseo-repair?write=1");
  assert.equal(takePendingReview(t0 + 2000), null);
  rememberPendingReview("x", t0);
  assert.equal(takePendingReview(t0 + 8 * 86400000), null);
});

test("서버(151)와 한도가 같다 — 5~500자 · 40자 · 별 1~5", () => {
  const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/151_external_reviews.sql", import.meta.url)), "utf-8");
  assert.ok(sql.includes("char_length(content) between 5 and 500"));
  assert.ok(sql.includes("char_length(work_title) <= 40"));
  assert.ok(sql.includes("rating between 1 and 5"));
});
