// 202 — 떨어진 업체에 결과 알림(본질 개선 · 업체 USP 10)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTIFY_LABELS } from "./notifyStats.js";

const sql = readFileSync(new URL("../../supabase/migrations/202_bid_result_notify.sql", import.meta.url), "utf8");
const main = readFileSync(new URL("../components/MainApp.jsx", import.meta.url), "utf8");

test("202 — 입금 뒤 «공사 중»이 되는 순간에만 · 입찰마다 한 번 · 고객·계약 업체 제외", () => {
  assert.match(sql, /after update of status on public\.requests/);
  assert.match(sql, /if new\.status is distinct from 'in_progress' or old\.status is not distinct from 'in_progress' then/);
  assert.match(sql, /where request_id = new\.id and id <> v_sel_bid and result_notified_at is null/);
  assert.match(sql, /v_owner = new\.user_id or v_owner = v_sel_owner then continue/);
});

test("202 — 경쟁 업체 금액·이름은 알리지 않는다 · 내 순위와 팁만", () => {
  const msgs = sql.slice(sql.indexOf("v_msg :="), sql.indexOf("insert into public.notifications"));
  assert.match(msgs, /곳 중 ' \|\| v_rank \|\| '번째로 낮았어요/);
  assert.match(msgs, /곳 중 가장 낮았어요/);
  assert.match(msgs, /곳 중 가장 높았어요/);
  assert.doesNotMatch(msgs, /x\.price \|\||v_sel_price|company_name|\.name/);
  assert.match(sql, /v_hour >= 9 and v_hour < 21/);
  assert.match(sql, /exception when others then\s+return new;/);
});

test("앱 — 알림 이름 · 누르면 업체 홈", () => {
  assert.ok(NOTIFY_LABELS.BID_NOT_SELECTED);
  assert.match(main, /if \(t === "BID_NOT_SELECTED"\) \{ loadCompanyRequests\?\.\(\); go\("home"\); return; \}/);
});
