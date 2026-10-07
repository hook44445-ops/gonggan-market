import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLedgerRow, summarizeByMonth, overMinorLimit, profitOf, MINOR_WORK_LIMIT_WON, sourceLabel } from "./jobLedger.js";

test("폼 값 → 저장할 행: 쉼표·원 글자를 걷어 내고 시간은 0.5 단위", () => {
  const { row, error } = buildLedgerRow({
    title: "  욕실 수전 교체 ", work_date: "2026-12-10", source: "acquaintance",
    hours: "2.3", material_cost: "45,000원", revenue: "150,000", memo: "",
  });
  assert.equal(error, undefined);
  assert.deepEqual(row, {
    work_date: "2026-12-10", title: "욕실 수전 교체", source: "acquaintance",
    hours: 2.5, material_cost: 45000, revenue: 150000, memo: null,
  });
});

test("빈 이름·날짜 없음은 막는다 · 모르는 출처는 공간랜드", () => {
  assert.match(buildLedgerRow({ title: " ", work_date: "2026-12-10" }).error, /이름/);
  assert.match(buildLedgerRow({ title: "필름", work_date: "" }).error, /날짜/);
  assert.equal(buildLedgerRow({ title: "필름", work_date: "2026-12-10", source: "zzz" }).row.source, "gonggan");
  assert.equal(sourceLabel("acquaintance"), "지인");
});

test("월별 합계 — 최근 달이 먼저, 시간당 순이익은 시간을 적은 건만", () => {
  const months = summarizeByMonth([
    { work_date: "2026-12-01", revenue: 200000, material_cost: 50000, hours: 3 },
    { work_date: "2026-12-15", revenue: 100000, material_cost: 20000, hours: 0 },
    { work_date: "2027-01-05", revenue: 300000, material_cost: 100000, hours: 4 },
  ]);
  assert.deepEqual(months.map(m => m.month), ["2027-01", "2026-12"]);
  const dec = months[1];
  assert.equal(dec.count, 2);
  assert.equal(dec.revenue, 300000);
  assert.equal(dec.material, 70000);
  assert.equal(dec.profit, 230000);
  assert.equal(dec.profitPerHour, 50000);   // (200,000-50,000)/3 — 시간 없는 건은 빼고
  assert.equal(months[0].profitPerHour, 50000);
});

test("시간을 하나도 안 적은 달은 시간당 순이익이 없다", () => {
  const [m] = summarizeByMonth([{ work_date: "2026-12-01", revenue: 1000, material_cost: 0, hours: 0 }]);
  assert.equal(m.profitPerHour, null);
});

test("1,500만원 상한 알림과 순이익", () => {
  assert.equal(MINOR_WORK_LIMIT_WON, 15000000);
  assert.equal(overMinorLimit({ revenue: 14999999 }), false);
  assert.equal(overMinorLimit({ revenue: 15000000 }), true);
  assert.equal(profitOf({ revenue: 100, material_cost: 130 }), -30);
});
