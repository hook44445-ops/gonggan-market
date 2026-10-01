// 199 — 라운지 신고자는 토큰으로 · 조회수는 한 사람 하루 한 번
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTokenRpc } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/199_report_actor_view_once.sql", import.meta.url), "utf8");

test("199 — 신고자 = auth.uid() (로그인 안 했으면 익명) · anon 신고는 그대로 된다", () => {
  assert.match(sql, /p_reporter_id := auth\.uid\(\);/);
  assert.match(sql, /grant execute on function public\.lounge_report_create\(uuid,text,text,text,text\) to anon, authenticated;/);
});

test("199 — 조회수 하루 한 번 · 사람 구분은 계정 → cf-connecting-ip → x-real-ip → xff · 모르면 예전처럼", () => {
  assert.match(sql, /if auth\.uid\(\) is not null then return 'u:'/);
  assert.match(sql, /'cf-connecting-ip'[\s\S]*'x-real-ip'[\s\S]*'x-forwarded-for'/);
  assert.match(sql, /if v_key is null then return true; end if;/);
  assert.match(sql, /_view_first_today\('lounge_post', p_post_id\)/);
  assert.match(sql, /_view_first_today\('company_page', p_company_id\)/);
  assert.match(sql, /alter table public\.view_marks enable row level security;/);
  for (const fn of ["lounge_report_create", "increment_lounge_view", "company_page_view"]) assert.ok(isTokenRpc(fn), fn);
  assert.match(sql, /as report_actor,/);
  assert.match(sql, /as view_once;/);
});
