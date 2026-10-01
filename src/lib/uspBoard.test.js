import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { USP_LIST, rate, uspRows, uspSummary, uspDedupKey, TRACKED_USPS, uspAction } from "./uspBoard.js";

test("USP 12 + 라운지 3 — 번호 1~15 · 고객 8 · 업체 4 · 라운지 3", () => {
  assert.deepEqual(USP_LIST.map((u) => u.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.equal(USP_LIST.filter((u) => u.who === "라운지").length, 3);
  assert.equal(USP_LIST.filter((u) => u.who === "고객").length, 8);
  assert.equal(USP_LIST.filter((u) => u.who === "업체").length, 4);
});

test("전환율 — 0 으로 나누지 않는다", () => {
  assert.equal(rate(3, 4), 75);
  assert.equal(rate(0, 0), null);
  assert.equal(rate(null, 5), null);
});

test("서버 줄 → 화면 12줄 · 없는 줄은 —(null) · 비교 차이(%p)", () => {
  const rows = uspRows([
    { usp: 2, used: 10, converted: 8, base_used: 10, base_converted: 3 },
    { usp: 6, used: 4, converted: 1 },
    { usp: 11 },
  ]);
  assert.equal(rows.length, 15);
  const r2 = rows.find((r) => r.id === 2);
  assert.equal(r2.rate, 80); assert.equal(r2.baseRate, 30); assert.equal(r2.lift, 50);
  assert.equal(r2.usedLabel, "사진 붙은 요청");
  const r6 = rows.find((r) => r.id === 6);
  assert.equal(r6.baseRate, null); assert.equal(r6.lift, null);
  const r11 = rows.find((r) => r.id === 11);
  assert.equal(r11.used, null); assert.equal(r11.rate, null);
  assert.equal(uspRows(null).every((r) => r.used === null), true);
});

test("요약 — 표본 5 이상만 · 지어낸 판단 없이 숫자로", () => {
  const rows = uspRows([{ usp: 2, used: 10, converted: 8 }, { usp: 3, used: 6, converted: 3 }, { usp: 4, used: 2, converted: 2 }]);
  assert.equal(uspSummary(rows), "가장 잘 넘어가는 것: 현장 사진 80% · 가장 약한 것: 견적 나란히 비교표 50%");
  assert.match(uspSummary(uspRows([])), /표본이 적어요/);
  // 라운지 줄은 강·약 비교에 넣지 않는다
  assert.doesNotMatch(uspSummary(uspRows([{ usp: 14, used: 50, converted: 50 }, { usp: 2, used: 10, converted: 8 }])), /사람이 쓴 글/);
});

test("하루 한 번 — 같은 USP·대상·한국 날짜", () => {
  const t = Date.parse("2026-10-01T16:00:00Z");   // 한국 10-02 01시
  assert.equal(uspDedupKey(3, "abc", t), "gonggan_usp:3:abc:2026-10-02");
  assert.equal(uspDedupKey(12, null, t), "gonggan_usp:12:-:2026-10-02");
  assert.deepEqual(TRACKED_USPS, [1, 3, 4, 12, 13, 15]);
  assert.equal(uspAction(3), "usp_3");
});

test("SQL 187 — 관리자만 · USP 하나씩 따로 계산(하나 실패해도 나머지) · 앱이 남기는 action 이름과 같다", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/187_admin_usp_board.sql", import.meta.url), "utf8");
  assert.match(sql, /not coalesce\(public\.is_admin\(\), false\)/);
  assert.match(sql, /revoke execute on function public\.admin_usp_board\(int\) from public, anon/);
  assert.ok((sql.match(/exception when others then v_rows := v_rows \|\| jsonb_build_object\('usp'/g) ?? []).length >= 11);
  for (const id of TRACKED_USPS.filter((n) => n <= 12)) assert.ok(sql.includes(id === 3 || id === 4 ? "'usp_' || i" : `'usp_${id}'`), `usp_${id}`);
  assert.match(sql, /as usp_board_ok;/);
});

test("SQL 188 — 라운지 3줄 · 관리자만 · 앱 기록 이름(usp_13 · usp_15)과 같다", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/188_admin_lounge_usp_rows.sql", import.meta.url), "utf8");
  assert.match(sql, /not coalesce\(public\.is_admin\(\), false\)/);
  assert.match(sql, /'usp_13'/);
  assert.match(sql, /'usp_15'/);
  assert.match(sql, /revoke execute on function public\.admin_lounge_usp_rows\(int\) from public, anon/);
  assert.match(sql, /as lounge_usp_ok;/);
});
