import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 노드에는 localStorage 가 없다 — 테스트용 간이 저장소
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { withRefCode, REFERRAL_REWARD, normalizeRefCode, refCodeFromSearch, inviteUrl, testerUrl, testerMessage, stashRefCode, pendingRefCode, clearRefCode, shouldClearAfterClaim } =
  await import("./referral.js");

beforeEach(() => store.clear());

test("코드 모양 — 6자리 · 대문자로 · 헷갈리는 글자는 거절", () => {
  assert.equal(normalizeRefCode(" ab2cd3 "), "AB2CD3");
  assert.equal(normalizeRefCode("AB2CD"), null);
  assert.equal(normalizeRefCode("AB0CD3"), null);   // 0
  assert.equal(normalizeRefCode("ABICD3"), null);   // I
  assert.equal(normalizeRefCode(null), null);
});

test("주소에서 코드 꺼내기와 초대 링크", () => {
  assert.equal(refCodeFromSearch("?ref=ab2cd3&x=1"), "AB2CD3");
  assert.equal(refCodeFromSearch("?x=1"), null);
  assert.equal(inviteUrl("AB2CD3"), "https://gongganmarket.com/?ref=AB2CD3");
  assert.equal(inviteUrl("bad"), "https://gongganmarket.com");
});

test("보관한 코드는 30일 뒤 사라진다 · 지우면 없다", () => {
  const t0 = Date.UTC(2026, 9, 1);
  stashRefCode("AB2CD3", t0);
  assert.equal(pendingRefCode(t0 + 29 * 86400000), "AB2CD3");
  assert.equal(pendingRefCode(t0 + 31 * 86400000), null);
  clearRefCode();
  assert.equal(pendingRefCode(t0), null);
  stashRefCode("nope", t0);
  assert.equal(pendingRefCode(t0), null);
});

test("서버에 못 보냈을 때(로그인 토큰 없음 · 146 전)만 코드를 남긴다", () => {
  assert.equal(shouldClearAfterClaim({ data: { ok: false, reason: "ALREADY" } }), true);
  assert.equal(shouldClearAfterClaim({ data: { ok: true } }), true);
  assert.equal(shouldClearAfterClaim({ error: { message: "LOGIN_REQUIRED" } }), false);
  assert.equal(shouldClearAfterClaim({ error: { message: "Could not find the function public.referral_claim" } }), false);
  assert.equal(shouldClearAfterClaim({ error: { message: "boom" } }), true);
});

test("테스터 모집 링크는 /download 로 · 초대 코드는 그대로", () => {
  assert.equal(testerUrl("AB2CD3"), "https://gongganmarket.com/download?ref=AB2CD3");
  assert.equal(testerUrl(null), "https://gongganmarket.com/download");
  assert.ok(testerMessage("AB2CD3").endsWith("https://gongganmarket.com/download?ref=AB2CD3"));
});

test("화면이 말하는 초대 보상이 서버(148)와 같다", () => {
  const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/148_referral_reward.sql", import.meta.url)), "utf-8");
  assert.match(sql, new RegExp(`v_invitee_amt int := ${REFERRAL_REWARD.invitee};`));
  assert.match(sql, new RegExp(`v_inviter_amt int := ${REFERRAL_REWARD.inviter};`));
  assert.match(sql, new RegExp(`v_monthly_cap int := ${REFERRAL_REWARD.monthlyCap};`));
});

test("공유 링크에 내 초대 코드 붙이기", () => {
  assert.equal(withRefCode("https://gongganmarket.com/lounge/posts/1/slug", "ab2cd3"), "https://gongganmarket.com/lounge/posts/1/slug?ref=AB2CD3");
  assert.equal(withRefCode("https://gongganmarket.com/x?a=1&ref=ZZZZZZ", "AB2CD3"), "https://gongganmarket.com/x?a=1&ref=AB2CD3");
  assert.equal(withRefCode("https://gongganmarket.com/x", null), "https://gongganmarket.com/x");
  assert.equal(withRefCode("", "AB2CD3"), "");
});
