// 191 — 공간토큰 적립·사용·잔액 · 약관 동의 기록: 로그인 토큰의 사용자만
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTokenRpc } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/191_token_consent_token_actor.sql", import.meta.url), "utf8");
const FNS = ["token_earn", "token_spend", "token_summary", "consent_record", "consent_types_for"];

test("191 — 다섯 함수 모두 auth.uid() 로만 · anon 권한 회수", () => {
  for (const fn of FNS) {
    const body = sql.slice(sql.indexOf(`create or replace function public.${fn}(`));
    assert.match(body.slice(0, 900), /auth\.uid\(\)/, fn);
    assert.match(sql, new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon;`), fn);
    assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to anon`), fn);
  }
  // 쓰기는 로그인 안 하면 42501
  assert.equal((sql.match(/raise exception 'LOGIN_REQUIRED' using errcode = '42501'/g) ?? []).length, 2);
  assert.match(sql, /as token_actor,/);
  assert.match(sql, /as no_anon;/);
});

test("191 — 후기 보상은 내가 쓴 후기 수까지만(설명만 바꿔 계속 받기 막기)", () => {
  assert.match(sql, />= \(select count\(\*\) from public\.reviews r where r\.user_id = p_user_id\)/);
});

test("앱 — 다섯 함수를 토큰 연결로 부른다", () => {
  for (const fn of FNS) assert.ok(isTokenRpc(fn), `${fn} 가 TOKEN_RPCS 에 없다`);
});
