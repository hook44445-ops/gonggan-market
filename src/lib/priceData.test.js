import { test } from "node:test";
import assert from "node:assert/strict";
import { sizeToM2, buildingTypeOf, regionCodeOf, requestPriceFields, isMissingColumnError } from "./priceData.js";

test("평수 → m²", () => {
  assert.equal(sizeToM2("24평"), 79.3);
  assert.equal(sizeToM2("33평형"), 109.1);
  assert.equal(sizeToM2("84㎡"), 84);
  assert.equal(sizeToM2("20~30평"), 82.6);
  assert.equal(sizeToM2("10평대"), 49.6);
  assert.equal(sizeToM2("40평 이상"), 148.8);
  assert.equal(sizeToM2("평수 무관(작은 수리)"), null);
  assert.equal(sizeToM2(""), null);
  assert.equal(sizeToM2("잘 몰라요"), null);
  assert.equal(sizeToM2("3300평"), null);
});

test("공간 유형 → 건물 유형(모르면 null)", () => {
  assert.equal(buildingTypeOf("아파트 전체"), "apartment");
  assert.equal(buildingTypeOf("원룸/오피스텔"), "officetel");
  assert.equal(buildingTypeOf("카페/식당"), "commercial");
  assert.equal(buildingTypeOf("오피스"), "office");
  assert.equal(buildingTypeOf("빌라 욕실"), "villa");
  assert.equal(buildingTypeOf("기타"), null);
});

test("지역 → 시·도 코드", () => {
  assert.equal(regionCodeOf("서울 강서구"), "11");
  assert.equal(regionCodeOf("경기 성남시 분당구"), "41");
  assert.equal(regionCodeOf("인천 연수구"), "28");
  assert.equal(regionCodeOf("충청남도 천안시"), "44");
  assert.equal(regionCodeOf(""), null);
});

test("요청 표준 칸 한 번에", () => {
  assert.deepEqual(requestPriceFields({ spaceType: "아파트 전체", size: "30평대", area: "서울 마포구" }),
    { space_size_m2: 115.7, building_type: "apartment", region_code: "11" });
});

test("칸 없음 오류 판별", () => {
  assert.ok(isMissingColumnError({ code: "PGRST204", message: "Could not find the 'space_size_m2' column" }));
  assert.ok(!isMissingColumnError({ code: "23505", message: "duplicate key" }));
});

import { readFileSync } from "node:fs";
test("요청 저장은 가격 칸이 없는 DB 에서도 예전처럼(칸 없음이면 다시 저장)", () => {
  const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");
  const i = lib.indexOf("export const createRequest = async");
  const body = lib.slice(i, lib.indexOf("};", i));
  assert.match(body, /isMissingColumnError\(res\.error\)\) return supabase\.from\("requests"\)\.insert\(data\)/);
  const sql = readFileSync(new URL("../../supabase/migrations/170_price_data_fields.sql", import.meta.url), "utf8");
  for (const c of ["space_size_m2", "building_type", "region_code"]) assert.match(sql, new RegExp(`add column if not exists ${c}`));
  assert.match(sql, /c\.owner_id = auth\.uid\(\)/);
});
