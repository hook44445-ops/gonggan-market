import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/206_brand_gongganland_in_functions.sql", import.meta.url), "utf8");

test("206 — 함수 글자만 공간랜드로 · 주소 예약어와 예금주는 건드리지 않는다", () => {
  assert.match(sql, /execute replace\(v_def, '공간마켓', '공간랜드'\)/);
  assert.match(sql, /if v_def ~ 'v_slug in\|deposit_owner' then continue;/);
  assert.match(sql, /n\.nspname = 'public'/);
  // 먼저 보기(읽기만)가 앞에 있다
  assert.ok(sql.indexOf("① 먼저 보기") < sql.indexOf("② 바꾸기"));
});
