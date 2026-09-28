import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CURRENT_EVENT, eventStatus, daysLeft, prizeFor, eventLine } from "./referralEvent.js";

const at = (iso) => Date.parse(iso);

test("한국 시간 경계 — 9/30 23:59 전 · 10/1 00:00 시작 · 11/1 00:00 마감", () => {
  assert.equal(eventStatus(CURRENT_EVENT, at("2026-09-30T23:59:00+09:00")), "upcoming");
  assert.equal(eventStatus(CURRENT_EVENT, at("2026-10-01T00:00:00+09:00")), "live");
  assert.equal(eventStatus(CURRENT_EVENT, at("2026-10-31T23:59:59+09:00")), "live");
  assert.equal(eventStatus(CURRENT_EVENT, at("2026-11-01T00:00:00+09:00")), "ended");
});

test("D-n — 10/1 은 D-30, 10/31 은 오늘 마감", () => {
  assert.equal(daysLeft(CURRENT_EVENT, at("2026-10-01T09:00:00+09:00")), 30);
  assert.equal(daysLeft(CURRENT_EVENT, at("2026-10-31T20:00:00+09:00")), 0);
  assert.match(eventLine(CURRENT_EVENT, at("2026-10-31T20:00:00+09:00")), /^오늘 마감/);
  assert.equal(daysLeft(CURRENT_EVENT, at("2026-09-28T12:00:00+09:00")), null);
});

test("상품 — 1~3등 300/200/100, 4등부터 0", () => {
  assert.deepEqual([1, 2, 3, 4].map(r => prizeFor(r)), [300, 200, 100, 0]);
  assert.equal(eventLine(CURRENT_EVENT, at("2026-09-28T12:00:00+09:00")), "10월 1일 시작 · 1등 300 · 2등 200 · 3등 100 토큰");
});

test("서버(155)와 기간·상품이 같다", () => {
  const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/155_referral_event.sql", import.meta.url)), "utf-8");
  assert.ok(sql.includes("'2026-10', '10월 초대왕', '2026-10-01 00:00:00+09', '2026-11-01 00:00:00+09', array[300, 200, 100]"));
});
