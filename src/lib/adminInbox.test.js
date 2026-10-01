// 관리자 «오늘 할 일» · «신고» 탭(10-01)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { todayRows, sortTodayRows, mergeReports } from "./adminInbox.js";

test("오늘 할 일 — 서버 숫자를 쓰고, 모르면 null(«열기 ›») · 신고 = 라운지 + 고객", () => {
  const rows = todayRows({ disputes: 1, lounge_reports: 2, customer_reports: 3, direct_deal: 0, payouts_approved: 4, payouts_held: 1, partner_leads: null }, { docQueue: 5, pendingCompanies: 0 });
  const by = Object.fromEntries(rows.map(([l, n, t]) => [l, [n, t]]));
  assert.deepEqual(by["신고"], [5, "reports"]);
  assert.deepEqual(by["지급 대기"], [5, "settlements"]);
  assert.equal(by["파트너 상담"][0], null);
  assert.equal(todayRows(null).find(([l]) => l === "분쟁")[1], null);
});

test("처리할 것이 있는 줄이 위 · 모름은 가운데 · 0 은 아래", () => {
  const order = sortTodayRows([["a", 0], ["b", null], ["c", 3], ["d", 7], ["e", null]]).map(([l]) => l);
  assert.deepEqual(order, ["d", "c", "b", "e", "a"]);
});

test("신고 합치기 — 출처 표시 · 대기 먼저 · 최신 순", () => {
  const m = mergeReports(
    [{ id: 1, target_type: "post", reason: "광고", status: "resolved", created_at: "2026-10-01T01:00:00Z" },
     { id: 2, target_type: "comment", reason: "욕설", status: "pending", created_at: "2026-09-30T01:00:00Z", reporter_name: "김" }],
    [{ id: 3, report_type: "반복취소", status: "PENDING", reporter_id: "x", created_at: "2026-10-01T02:00:00Z" }],
  );
  assert.deepEqual(m.map((x) => [x.source, x.id, x.open]), [["customer", 3, true], ["lounge", 2, true], ["lounge", 1, false]]);
  assert.match(m[0].sourceLabel, /고객 신고/);
  assert.equal(m[1].title, "댓글 신고 · 욕설");
});

test("관리자 화면 — «신고» 탭이 직거래 의심이 아니라 라운지·고객 신고를 읽는다", () => {
  const adm = readFileSync(new URL("../screens/AdminScreen.jsx", import.meta.url), "utf8");
  const block = adm.slice(adm.indexOf('if (mainTab === "reports") {'), adm.indexOf('if (mainTab === "reviews") {'));
  assert.match(block, /getLoungeReports/);
  assert.match(block, /getCustomerReports\(\)/);
  assert.doesNotMatch(block, /getDirectDealReports/);
  assert.match(adm, /sortTodayRows\(todayRows\(todayCounts/);
  const sql = readFileSync(new URL("../../supabase/migrations/201_admin_today_counts.sql", import.meta.url), "utf8");
  assert.match(sql, /raise exception 'ADMIN_ONLY' using errcode = '42501'/);
  assert.match(sql, /revoke execute on function public\.admin_today_counts\(\) from public, anon;/);
});
