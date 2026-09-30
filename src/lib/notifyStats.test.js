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

import { pushReachLine } from "./notifyStats.js";
test("푸시 받는 사람 한 줄(178)", () => {
  assert.equal(pushReachLine(null), null);
  assert.equal(pushReachLine({ users: 200, reach: 50, android: 30, marketing: 12, new_7d: 9 }),
    "회원 200명 중 50명(25%)이 폰으로 받아요 · 안드로이드 30 · 광고 동의 12 · 최근 7일 새로 켠 사람 9");
  const sql = readFileSync(new URL("../../supabase/migrations/178_admin_push_reach.sql", import.meta.url), "utf8");
  assert.match(sql, /u\.id = auth\.uid\(\) and u\.role = 'admin'/);
});
