// 172 — 견적을 받고 이틀째 못 고른 고객에게 «견적 N개 · 최저~최고 · 차이» 한 번(화면 요약은 lib/bidCompare.bidSummary 그대로)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("172 알림 — 견적 2개 이상 · 첫 견적 48시간 뒤 · 고르기 전 · 요청마다 한 번 · 시간 제한", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/172_bid_compare_nudge.sql", import.meta.url), "utf8");
  assert.match(sql, /having count\(\*\) >= 2/);
  assert.match(sql, /min\(b\.created_at\) < now\(\) - interval '48 hours'/);
  assert.match(sql, /q\.selected_bid_id is null/);
  assert.match(sql, /n\.type = 'BID_COMPARE_NUDGE' and n\.related_id::text = q\.id::text/);
  assert.match(sql, /v_hour < 9 or v_hour >= 20/);
  const dispatch = readFileSync(new URL("../../api/push/dispatch.js", import.meta.url), "utf8");
  assert.match(dispatch, /rpc\/bid_compare_nudge_due/);
  const main = readFileSync(new URL("../components/MainApp.jsx", import.meta.url), "utf8");
  assert.match(main, /t === "BID_COMPARE_NUDGE"/);
});
