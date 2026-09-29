// 보완 S2(169) — 업체 서류는 주인·관리자만, 심사 결과는 관리자만. 앱은 토큰 연결로 읽고 쓴다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/169_company_documents_owner_only.sql", import.meta.url), "utf8");
const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");

test("정책 3개 모두 주인·관리자 판정, 누구나 정책 없음", () => {
  const body = sql.replace(/^--.*$/gm, "");
  assert.equal((body.match(/create policy company_documents_owner_\w+/g) ?? []).length, 3);
  assert.doesNotMatch(body, /using \(true\)|with check \(true\)/);
});

test("업체가 직접 쓸 때 심사 칸은 못 바꾼다(초안·제출만)", () => {
  assert.match(sql, /new\.review_status not in \('draft', 'submitted'\)/);
  assert.match(sql, /new\.reviewed_by := old\.reviewed_by/);
  assert.match(sql, /if public\.is_admin\(\) then return new; end if;/);
});

test("앱의 서류 표 접근은 토큰 연결", () => {
  assert.doesNotMatch(lib, /\bsupabase\s*\.from\("company_documents"\)/);
});
