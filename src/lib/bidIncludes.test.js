import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INCLUDE_ITEMS, normalizeIncludes, hasIncludes, includeState, asLabel, includesCell, askBeforeContract, includesLine,
} from "./bidIncludes.js";
import { compareBids } from "./bidTable.js";

test("저장 모양 — 모르는 칸·이상한 값은 버린다", () => {
  assert.deepEqual(normalizeIncludes({ vat: true, demolition: false, waste: "yes", hack: 1, as_months: 12 }),
    { vat: true, demolition: false, as_months: 12 });
  assert.deepEqual(normalizeIncludes('{"material":true,"as_months":7}'), { material: true });
  assert.deepEqual(normalizeIncludes(null), {});
  assert.deepEqual(normalizeIncludes([true]), {});
  assert.equal(hasIncludes({}), false);
  assert.equal(hasIncludes({ as_months: 0 }), true);
});

test("항목 상태 · AS", () => {
  assert.equal(includeState({ vat: true }, "vat"), "in");
  assert.equal(includeState({ vat: false }, "vat"), "out");
  assert.equal(includeState({}, "vat"), "none");
  assert.equal(asLabel({ as_months: 12 }), "AS 12개월");
  assert.equal(asLabel({ as_months: 0 }), "AS 없음");
  assert.equal(asLabel({}), null);
});

test("비교표 칸 — 포함 / 별도 / 안 적음 / AS", () => {
  const c = includesCell({ vat: true, material: true, demolition: false, as_months: 12 });
  assert.equal(c.text, "포함: 부가세·자재비 / 별도: 철거 / 안 적음: 폐기물 처리 / AS 12개월");
  assert.equal(c.warn, true);
  assert.deepEqual(includesCell(null), { text: "안 적음", missing: true, warn: false });
  const all = includesCell({ vat: true, demolition: true, waste: true, material: true });
  assert.equal(all.warn, false);
});

test("계약 전에 물어볼 것 · 카드 한 줄", () => {
  assert.deepEqual(askBeforeContract({ vat: true, demolition: false }), ["철거", "폐기물 처리", "자재비"]);
  assert.deepEqual(askBeforeContract(null), INCLUDE_ITEMS.map(i => i.label));
  assert.equal(includesLine({ vat: true, demolition: true, waste: true, material: true, as_months: 6 }), "부가세·철거·폐기물 처리·자재비 포함 · AS 6개월");
  assert.equal(includesLine(null), null);
});

test("없는 금액을 지어내지 않는다 — 문구에 숫자·원 없음(AS 개월만)", () => {
  const all = [includesCell({ vat: false, demolition: false }).text, includesLine({ waste: false })].join(" ");
  assert.doesNotMatch(all, /원|만원|%/);
});

test("비교표에 «포함 항목» 줄 · 별도·안 적음이면 안내", () => {
  const t = compareBids([
    { id: "a", price: 300, period: 5, includes: { vat: true, demolition: true, waste: true, material: true } },
    { id: "b", price: 250, period: 5, includes: { vat: false, material: true } },
  ]);
  const row = t.rows.find(r => r.key === "includes");
  assert.ok(row);
  assert.equal(row.cells[0].warn, false);
  assert.equal(row.cells[1].warn, true);
  assert.ok(t.notes.some(n => /계약 전에 꼭 물어보세요/.test(n)));
  const none = compareBids([{ id: "a", price: 1 }, { id: "b", price: 2 }]);
  assert.equal(none.rows.find(r => r.key === "includes").cells[0].missing, true);
});

test("앱 — 입찰 저장에 includes · 186 전이면 빼고 다시", () => {
  const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");
  assert.match(lib, /withoutIncludesRetry/);
  const sql = readFileSync(new URL("../../supabase/migrations/186_bid_includes.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists includes jsonb/);
  assert.match(sql, /as bid_includes_ok/);
});
