// 182 — 요청·입찰·라운지 글·댓글·좋아요의 «누구나 쓰기» 닫기 · 앱은 먼저 로그인 토큰으로 쓴다
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/182_close_open_inserts.sql", import.meta.url), "utf8");
const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");

test("182 — true 쓰기 정책을 조건으로 지우고 본인만 쓰기 5개", () => {
  assert.match(sql, /cmd in \('INSERT','ALL'\)/);
  assert.match(sql, /coalesce\(with_check, ''\) = 'true'/);
  for (const n of ["g182_req_insert", "g182_bids_insert", "g182_lp_insert", "g182_lc_insert", "g182_lpl_insert"]) assert.match(sql, new RegExp(n));
  assert.match(sql, /c\.owner_id = auth\.uid\(\)/);
  assert.match(sql, /as owner_only_ok;/);
});

test("앱 — 요청·입찰·라운지 쓰기는 토큰 연결로(익명 연결 쓰기 없음)", () => {
  assert.doesNotMatch(lib, /supabase\.from\("requests"\)\.(insert|update)/);
  assert.doesNotMatch(lib, /supabase\.from\("bids"\)\.(insert|update)\(data\)/);
  assert.doesNotMatch(lib, /supabase\.from\("lounge_posts"\)\.insert/);
  assert.match(lib, /asLoginRequired\(await userDb\(\)\.from\("bids"\)\.insert/);
  assert.match(lib, /asLoginRequired\(await userDb\(\)\.from\("lounge_comments"\)\.insert/);
});
