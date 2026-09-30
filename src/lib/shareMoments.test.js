// 공유 순간 늘리기 — 견적 3개 배너(한 번) · 181 별 5개 후기 알림
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { showMoment } from "./bidShare.js";

const mem = (init = {}) => ({ m: { ...init }, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = v; } });

test("견적 3개부터 · 그 요청에서 보내기 전까지만 크게", () => {
  assert.equal(showMoment(2, "r1", mem()), false);
  assert.equal(showMoment(3, "r1", mem()), true);
  assert.equal(showMoment(5, "r1", mem({ gg_bidshare_sent_r1: "1" })), false);
  assert.equal(showMoment(5, "r2", mem({ gg_bidshare_sent_r1: "1" })), true);
  assert.equal(showMoment(3, null, mem()), false);
});

const sql = readFileSync(new URL("../../supabase/migrations/181_review_5star_notify.sql", import.meta.url), "utf8");

test("181 — 고객이 쓴 별 5개만 · 하루 한 번 · 푸시는 9~21시 · 저장은 안 막음", () => {
  assert.match(sql, /coalesce\(new\.rating, 0\) <> 5/);
  assert.match(sql, /reviewer_role', 'customer'\) = 'company' then return new/);
  assert.match(sql, /n\.type = 'REVIEW_5STAR'\s+and \(n\.created_at at time zone 'Asia\/Seoul'\)::date = v_today/);
  assert.match(sql, /v_hour >= 9 and v_hour < 21/);
  assert.match(sql, /'\/\?open=review-card'/);
  assert.match(sql, /exception when others then null/);
  assert.match(sql, /as review_5star_ok;/);
});

import { proInviteMessage } from "./referral.js";

test("아는 사장님 초대 — 파트너 소개로 · 보상 약속 없음", () => {
  const m = proInviteMessage("ABCDEF");
  assert.match(m, /\/partner\?ref=ABCDEF$/);
  assert.doesNotMatch(m, /토큰|원|보상/);
  assert.match(proInviteMessage(null), /\/partner$/);
});
