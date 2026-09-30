import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { notifyRows } from "./notifyStats.js";
import { isGuardedRpc } from "./session.js";

test("읽음률 · 이름", () => {
  const rows = notifyRows([{ type: "BID_VIEWED", sent: 8, read: 6, users: 5 }, { type: "X_NEW", sent: 0, read: 0 }]);
  assert.equal(rows[0].label, "👀 고객이 견적 확인");
  assert.equal(rows[0].rate, 75);
  assert.equal(rows[1].label, "X_NEW");
  assert.equal(rows[1].rate, null);
  assert.deepEqual(notifyRows(null), []);
});

test("관리자만 · 토큰 연결 · 화면 연결", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/175_admin_notify_stats.sql", import.meta.url), "utf8");
  assert.match(sql, /u\.id = auth\.uid\(\) and u\.role = 'admin'/);
  assert.ok(isGuardedRpc("admin_notify_stats"));
  const adm = readFileSync(new URL("../screens/AdminScreen.jsx", import.meta.url), "utf8");
  assert.match(adm, /<AdminNotifyStatsPanel \/>/);
});
