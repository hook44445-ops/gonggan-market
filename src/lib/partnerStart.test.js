import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerStartState, PARTNER_STEPS } from "./partnerStart.js";

test("새 업체 — 0/7, 다음은 사업자등록", () => {
  const s = partnerStartState({});
  assert.equal(s.total, PARTNER_STEPS.length);
  assert.equal(s.count, 0);
  assert.equal(s.next.key, "biz");
  assert.equal(s.complete, false);
});

test("밖 공사 후기도 «첫 후기»로 친다 · 순서대로 다음 칸", () => {
  const s = partnerStartState({ company: { verified: true, has_insurance: true, slug: "gangseo" }, growth: { showcases: 0, reviews: 0 }, extReviews: 1 });
  assert.equal(s.count, 4);
  assert.equal(s.next.key, "profile");
  assert.equal(s.items.find(i => i.key === "review").done, true);
});

test("다 하면 complete", () => {
  const s = partnerStartState({ company: { verified: true, hasInsurance: true, slug: "a", cover_url: "https://x/c.jpg", intro: "욕실 수리" }, growth: { showcases: 2, reviews: 1 }, shared: true });
  assert.equal(s.complete, true);
  assert.equal(s.next, null);
});

test("커버만 있고 소개가 없으면 «페이지 꾸미기»는 아직", () => {
  const s = partnerStartState({ company: { verified: true, has_insurance: true, slug: "a", cover_url: "https://x/c.jpg", intro: " " } });
  assert.equal(s.items.find(i => i.key === "profile").done, false);
  assert.equal(s.total, 7);
});
