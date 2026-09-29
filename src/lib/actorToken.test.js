// 보완 S4(166) — 서버가 «토큰의 사용자»로 판단하는 함수는 앱도 반드시 토큰 연결로 불러야 한다.
// 하나라도 빠지면 그 기능은 SQL 실행 뒤 LOGIN_REQUIRED 로 멈춘다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { S4_TOKEN_RPCS, isTokenRpc, needsSessionToken } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/166_actor_from_token_all.sql", import.meta.url), "utf8");
const defined = [...sql.matchAll(/create or replace function public\.(\w+)\s*\(/g)].map((m) => m[1]);

test("166 이 고친 함수는 모두 토큰 연결로 부른다", () => {
  assert.equal(defined.length, 29);
  for (const fn of defined) assert.ok(isTokenRpc(fn), `${fn} 가 TOKEN_RPCS 에 없다`);
  assert.deepEqual([...new Set(defined)].sort(), [...S4_TOKEN_RPCS].sort());
});

test("166 의 함수는 모두 앱이 보낸 p_actor_id 대신 auth.uid() 를 쓴다", () => {
  const blocks = sql.split(/(?=create or replace function public\.)/).slice(1);
  for (const b of blocks) {
    const name = b.match(/function public\.(\w+)/)[1];
    const body = b.slice(b.indexOf("$$") + 2);
    if (/language\s+sql/i.test(b)) assert.ok(!/p_actor_id/.test(body.split("$$")[0]), `${name}: sql 몸통에 p_actor_id`);
    else assert.match(body, /^\s*(#variable_conflict[^\n]*\n)?[\s\S]*?\bbegin\s*\n\s*p_actor_id := auth\.uid\(\);/i, `${name}: 맨 앞에서 바꾸지 않음`);
  }
});

test("앱이 이 함수들을 부르는 곳이 모두 목록 안에 있다(오타·새 함수 확인)", () => {
  const src = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");
  const called = new Set([...src.matchAll(/rpc\(\s*"(\w+)"\s*,\s*\{[^}]*p_actor_id/g)].map((m) => m[1]));
  for (const fn of called) assert.ok(isTokenRpc(fn), `${fn}: p_actor_id 를 보내는데 토큰 연결이 아님`);
});

test("토큰 없는 로그인만 «한 번 더 인증» 안내", () => {
  assert.equal(needsSessionToken(null, false), false);
  assert.equal(needsSessionToken({ id: "g", isGuest: true }, false), false);
  assert.equal(needsSessionToken({ id: "u", phone: "010", role: "consumer" }, true), false);
  assert.equal(needsSessionToken({ id: "u", phone: "010", role: "consumer" }, false), true);
  assert.equal(needsSessionToken({ id: "c", role: "company" }, false), true);
});
