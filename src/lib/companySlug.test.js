import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { slugProblem, normalizeSlug, isUuid, RESERVED_SLUGS } from "./companySlug.js";

test("짧은 주소 규칙", () => {
  assert.equal(slugProblem("jiknyeong-repair"), null);
  assert.equal(slugProblem("강서집수리"), null);
  assert.equal(slugProblem("Gangseo Repair"), null);        // 대문자·띄어쓰기는 바꿔서 받는다
  assert.equal(normalizeSlug(" Gangseo Repair "), "gangseo-repair");
  assert.match(slugProblem("a"), /2자/);
  assert.match(slugProblem("a".repeat(21)), /20자/);
  assert.match(slugProblem("-abc"), /하이픈/);
  assert.match(slugProblem("abc_def"), /하이픈/);
  assert.match(slugProblem("admin"), /쓸 수 없는/);
  assert.match(slugProblem("공간마켓"), /쓸 수 없는/);
});

test("업체 ID(uuid)와 짧은 주소를 가른다", () => {
  assert.equal(isUuid("11111111-2222-3333-4444-555555555555"), true);
  assert.equal(isUuid("gangseo-repair"), false);
});

test("서버(149)와 예약어·글자 규칙이 같다", () => {
  const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/149_company_slug.sql", import.meta.url)), "utf-8");
  for (const w of RESERVED_SLUGS) assert.ok(sql.includes(`'${w}'`), `SQL 예약어에 없음: ${w}`);
  assert.ok(sql.includes("^[가-힣a-z0-9]([가-힣a-z0-9-]{0,18}[가-힣a-z0-9])?$"), "SQL 글자 규칙이 다르다");
});
