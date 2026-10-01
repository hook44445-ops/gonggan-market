// 193 — 업체 선택(현장견적 요청) request_site_visit: 요청 주인만 · 그 입찰의 업체로만
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTokenRpc } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/193_request_site_visit_owner_only.sql", import.meta.url), "utf8");
const screen = readFileSync(new URL("../screens/BidStatusScreen.jsx", import.meta.url), "utf8");

test("193 — 토큰 필요 · 요청 주인(관리자)만 · 입찰 업체만 · anon 회수", () => {
  assert.match(sql, /raise exception 'LOGIN_REQUIRED' using errcode = '42501'/);
  assert.match(sql, /v_request\.user_id is distinct from v_uid and not coalesce\(public\.is_admin\(\), false\)/);
  assert.match(sql, /v_bid\.company_id in \(c\.id, c\.owner_id\)/);
  assert.match(sql, /revoke execute on function public\.request_site_visit\(uuid, uuid, uuid\) from public, anon;/);
  assert.doesNotMatch(sql, /grant execute on function public\.request_site_visit\([^)]*\) to anon/);
  assert.match(sql, /as owner_only,/);
  assert.match(sql, /as no_anon;/);
});

test("앱 — 토큰으로 부르고, 토큰이 없으면 다시 인증 안내", () => {
  assert.ok(isTokenRpc("request_site_visit"));
  assert.match(screen, /asLoginRequired\(await supabase\.rpc\('request_site_visit'/);
});
