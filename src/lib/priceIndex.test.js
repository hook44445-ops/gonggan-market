import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { priceIndexSummary, priceDataCards, MIN_SAMPLES } from "./priceIndex.js";

test("표본 5건 미만이면 숨김 · 등급별 가중 평균 → 평당", () => {
  assert.equal(priceIndexSummary([{ price_per_m2: 30, sample_count: 4 }]), null);
  const s = priceIndexSummary([{ price_per_m2: 30, sample_count: 3 }, { price_per_m2: 50, sample_count: 2 }, { price_per_m2: 0, sample_count: 9 }]);
  assert.equal(s.samples, 5);
  assert.equal(s.perPyeong, Math.round(38 * 3.3058));   // (30×3 + 50×2)/5 = 38 만원/m²
  assert.match(s.line, /완공 5건 기준/);
  assert.equal(MIN_SAMPLES, 5);
});

test("관리자 칸", () => {
  const c = priceDataCards({ requests_total: 40, requests_with_fields: 30, estimates_total: 10, estimates_graded: 4, index_rows: 2, index_samples: 7 });
  assert.equal(c[0].sub, "전체 40건 중 75%");
  assert.equal(c[2].value, 2);
});

test("176 관리자만 · 견적 비교 화면에 시세 줄", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/176_admin_price_data_stats.sql", import.meta.url), "utf8");
  assert.match(sql, /u\.id = auth\.uid\(\) and u\.role = 'admin'/);
  const scr = readFileSync(new URL("../screens/BidStatusScreen.jsx", import.meta.url), "utf8");
  assert.match(scr, /<PriceIndexLine /);
});
