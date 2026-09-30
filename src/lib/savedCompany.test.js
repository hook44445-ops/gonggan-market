// 찜(관심 업체) — 정책이 «토큰의 사용자 = customer_id» 라 토큰 연결로 · 179 찜한 업체 새 사례 알림
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("찜 읽기·저장·지우기는 토큰 연결(userDb)", () => {
  const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");
  assert.doesNotMatch(lib, /\bsupabase\s*\.from\("saved_companies"\)/);
  assert.equal((lib.match(/userDb\(\)\s*\.from\("saved_companies"\)/g) ?? []).length, 4);
});

test("179 — 7일에 한 번 · 사례 저장은 안 막음 · 누르면 업체 페이지", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/179_saved_company_new_showcase.sql", import.meta.url), "utf8");
  assert.match(sql, /n\.created_at > now\(\) - interval '7 days'/);
  assert.match(sql, /exception when others then null;   -- 사례 저장은 막지 않는다/);
  assert.match(sql, /after insert on public\.portfolios/);
  const main = readFileSync(new URL("../components/MainApp.jsx", import.meta.url), "utf8");
  assert.match(main, /t === "SAVED_COMPANY_NEW"\) \{ if \(rid\) window\.location\.href = `\/p\/\$\{rid\}`/);
});
