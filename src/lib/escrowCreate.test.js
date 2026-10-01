// 192 — 계약(에스크로) 만들기: 요청 주인 · 입찰(선택) 업체 · 서버 키만
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTokenRpc } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/192_escrow_create_parties_only.sql", import.meta.url), "utf8");
const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");

test("192 — 서버 키는 그대로 · 그 밖엔 토큰 + 당사자만 · anon 회수", () => {
  assert.match(sql, /= 'service_role'/);
  assert.match(sql, /raise exception 'LOGIN_REQUIRED' using errcode = '42501'/);
  assert.match(sql, /v_uid = v_req\.user_id/);
  assert.match(sql, /coalesce\(public\.is_admin\(\), false\)/);
  assert.match(sql, /b\.request_id = p_request_id and b\.company_id in \(c\.id, c\.owner_id\)/);
  assert.match(sql, /return jsonb_build_object\('error', 'NOT_PARTY'\)/);
  assert.match(sql, /revoke execute on function public\.escrow_get_or_create\(uuid, uuid, integer\) from public, anon;/);
  assert.doesNotMatch(sql, /grant execute on function public\.escrow_get_or_create\([^)]*\) to anon/);
  assert.match(sql, /as parties_only,/);
  assert.match(sql, /as no_anon;/);
});

test("앱 — 토큰으로 부르고, 당사자가 아니면 폴백(직접 넣기)도 하지 않는다", () => {
  assert.ok(isTokenRpc("escrow_get_or_create"));
  assert.match(lib, /if \(!rpc\.error && rpc\.data\?\.error\) return \{ data: null, created: false/);
});
