import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nextDue, careStatus, careLine, sortCare, buildCareRow, HOME_CARE_PRESETS } from "./homeCare.js";

test("다음 시기 — 월 단위 · 달 끝 맞춤", () => {
  assert.equal(nextDue("2025-03-15", 24), "2027-03-15");
  assert.equal(nextDue("2026-01-31", 1), "2026-02-28");
  assert.equal(nextDue("2026-11-10", 3), "2027-02-10");
  assert.equal(nextDue("bad", 3), null);
});

test("상태 · 문구", () => {
  const t = "2026-10-01";
  assert.equal(careStatus({ done_on: "2024-09-01", cycle_months: 24 }, t).state, "due");
  const soon = careStatus({ done_on: "2025-11-01", cycle_months: 12 }, t);
  assert.equal(soon.state, "soon"); assert.equal(careLine(soon), "약 1개월 뒤");
  assert.equal(careLine(careStatus({ done_on: "2025-10-20", cycle_months: 12 }, t)), "19일 뒤 살펴볼 시기");
  assert.equal(careLine(careStatus({ done_on: "2026-09-01", cycle_months: 24 }, t)), "약 1년 11개월 뒤");
  assert.equal(careLine(careStatus({ done_on: "2024-01-01", cycle_months: 12 }, t)), "살펴볼 시기가 됐어요");
});

test("정렬 — 시기 됨 → 곧 → 나머지", () => {
  const items = [
    { id: "ok", done_on: "2026-09-01", cycle_months: 24 },
    { id: "due", done_on: "2024-01-01", cycle_months: 12 },
    { id: "soon", done_on: "2025-11-01", cycle_months: 12 },
  ];
  assert.deepEqual(sortCare(items, "2026-10-01").map((i) => i.id), ["due", "soon", "ok"]);
});

test("폼 검사 · 기본 항목", () => {
  assert.match(buildCareRow({}).error, /무엇을/);
  assert.match(buildCareRow({ label: "a", cycle_months: 0, done_on: "2026-01-01" }).error, /주기/);
  assert.match(buildCareRow({ label: "a", cycle_months: 12 }).error, /날짜/);
  assert.deepEqual(buildCareRow({ label: " 욕실 실리콘 ", cycle_months: "24", done_on: "2026-01-01", kind: "bath_silicone" }).row,
    { kind: "bath_silicone", label: "욕실 실리콘", cycle_months: 24, done_on: "2026-01-01", memo: null });
  for (const p of HOME_CARE_PRESETS) assert.ok(p.label.length <= 30 && p.cycle >= 1 && p.cycle <= 240);
});

test("서버(165) — 본인 것만 · 30일에 한 번 · 9~20시", () => {
  const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/165_home_care.sql", import.meta.url)), "utf-8");
  assert.ok(sql.includes("for all using (user_id = auth.uid()) with check (user_id = auth.uid())"));
  assert.ok(sql.includes("n.created_at > now() - interval '30 days'"));
  assert.ok(sql.includes("v_hour < 9 or v_hour >= 20"));
  assert.ok(sql.includes("cycle_months between 1 and 240") && sql.includes("char_length(label) between 1 and 30"));
});

test("후기에서 수첩 항목 고르기 — 최대 3개 · 없으면 빈 배열", async () => {
  const { suggestCarePresets } = await import("./homeCare.js");
  assert.deepEqual(suggestCarePresets("욕실 타일 줄눈 새로 하고 실리콘도 다시 쐈어요").map((p) => p.kind), ["bath_silicone", "grout"]);
  assert.deepEqual(suggestCarePresets("거실 도배랑 장판 교체").map((p) => p.kind), ["wallpaper", "floor"]);
  assert.deepEqual(suggestCarePresets("친절하셨어요"), []);
  assert.equal(suggestCarePresets("욕실 줄눈 창틀 보일러 에어컨").length, 3);
});
