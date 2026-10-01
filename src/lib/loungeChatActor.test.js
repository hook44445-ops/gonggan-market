// 189 — 라운지 대화 신청·수락·거절·나가기: 로그인 토큰의 사용자만 · 고객–업체 대화는 서버에서도 막기
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/189_lounge_chat_token_actor.sql", import.meta.url), "utf8");
const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");
const session = readFileSync(new URL("./session.js", import.meta.url), "utf8");

test("189 — 네 함수 모두 auth.uid() · 로그인 안 하면 42501 · anon 권한 회수", () => {
  for (const fn of ["request_comment_chat", "accept_lounge_chat", "reject_lounge_chat", "leave_lounge_chat"]) {
    const body = sql.slice(sql.indexOf(`create or replace function public.${fn}(`));
    assert.match(body.slice(0, 1500), /v_uid\s+uuid := auth\.uid\(\)/, fn);
    assert.match(sql, new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon`), fn);
  }
  assert.ok((sql.match(/raise exception 'LOGIN_REQUIRED' using errcode = '42501'/g) ?? []).length >= 4);
  // 넘긴 ID 로 판단하지 않는다(신청자·수락자·나가는 사람)
  assert.doesNotMatch(sql, /target_id = p_acceptor_id|target_id = p_rejector_id|requester_id = p_user_id|values \(p_requester_id/);
});

test("189 — 고객 ↔ 업체 새 신청·수락은 COMPANY_CHAT_BLOCKED (업체끼리·고객끼리는 그대로)", () => {
  assert.match(sql, /_is_company_owner\(v_uid\) <> public\._is_company_owner\(p_target_id\)/);
  assert.match(sql, /_is_company_owner\(v_req\.requester_id\) <> public\._is_company_owner\(v_uid\)/);
  assert.match(sql, /as token_actor,/);
  assert.match(sql, /as no_anon;/);
});

test("앱 — 네 함수를 토큰으로 부르고, 토큰 없으면 다시 인증 · 막힘은 갈 길로 안내", () => {
  for (const fn of ["request_comment_chat", "accept_lounge_chat", "reject_lounge_chat", "leave_lounge_chat"]) assert.match(session, new RegExp(`"${fn}"`));
  assert.match(lib, /asLoginRequired\(await supabase\.rpc\("request_comment_chat"/);
  assert.match(lib, /asLoginRequired\(await supabase\.rpc\("accept_lounge_chat"/);
  const lounge = readFileSync(new URL("../constants/lounge.js", import.meta.url), "utf8");
  assert.match(lounge, /COMPANY_CHAT_BLOCKED_TEXT/);
});
