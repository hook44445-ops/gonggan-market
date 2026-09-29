import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { kstDay, shouldCountView, statsLine } from "./pageViews.js";

test("한국 날짜 — 자정 경계", () => {
  assert.equal(kstDay(Date.parse("2026-09-29T23:59:00+09:00")), "2026-09-29");
  assert.equal(kstDay(Date.parse("2026-09-30T00:00:00+09:00")), "2026-09-30");
});

test("세기 — 하루 한 번 · 주인은 안 셈", () => {
  const now = Date.parse("2026-09-29T12:00:00+09:00");
  assert.equal(shouldCountView({ companyId: "c", lastDay: null, now }), true);
  assert.equal(shouldCountView({ companyId: "c", lastDay: "2026-09-29", now }), false);
  assert.equal(shouldCountView({ companyId: "c", lastDay: "2026-09-28", now }), true);
  assert.equal(shouldCountView({ companyId: "c", ownerId: "u", viewerId: "u", now }), false);
  assert.equal(shouldCountView({ companyId: null, now }), false);
});

test("마이페이지 문구", () => {
  assert.equal(statsLine(null), null);
  assert.equal(statsLine({ ok: false }), null);
  assert.match(statsLine({ ok: true, week: 0, total: 0 }), /아직 방문이 없어요/);
  assert.equal(statsLine({ ok: true, week: 5, total: 42 }), "이번 주 방문 5명 · 누적 42명");
});

test("서버(156) — 한국 날짜 · 7일 · 주인만", () => {
  const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/156_company_page_views.sql", import.meta.url)), "utf-8");
  assert.ok(sql.includes("(now() at time zone 'Asia/Seoul')::date"));
  assert.ok(sql.includes("day > v_day - 7"));
  assert.ok(sql.includes("'OWNER_ONLY'"));
});
