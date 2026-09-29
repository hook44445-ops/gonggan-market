// 171 — 업체 주간 «지난주 우리 동네 새 요청» 알림: 월요일 9~20시 · 주 1회 · 110 과 같은 지역 판정 · 앱 연결
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/171_region_requests_weekly.sql", import.meta.url), "utf8");
const dispatch = readFileSync(new URL("../../api/push/dispatch.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../components/MainApp.jsx", import.meta.url), "utf8");

test("월요일 · 조용한 시간 · 주 1회", () => {
  assert.match(sql, /isodow from v_today\) <> 1/);
  assert.match(sql, /v_hour < 9 or v_hour >= 20/);
  assert.match(sql, /n\.type = 'REGION_REQUESTS_WEEKLY'\s+and \(n\.created_at at time zone 'Asia\/Seoul'\)::date >= v_mon/);
  assert.match(sql, /on conflict do nothing/);
});

test("110 과 같은 지역 판정 · 내 요청·정지 업체 제외", () => {
  assert.match(sql, /regexp_replace\(trim\(coalesce\(q\.area, ''\)\), '\^\.\*\\s', ''\)/);
  assert.match(sql, /w\.user_id is distinct from c\.owner_id/);
  assert.match(sql, /c\.company_status is null or c\.company_status = 'ACTIVE'/);
});

test("발송기가 부르고, 알림을 누르면 업체 홈 요청 목록으로", () => {
  assert.match(dispatch, /rpc\/company_region_weekly_due/);
  assert.match(main, /t === "REGION_REQUESTS_WEEKLY"\) \{ loadCompanyRequests\?\.\(\); go\("home"\)/);
});
