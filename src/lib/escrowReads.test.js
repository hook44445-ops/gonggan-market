// 196 — 계약 · 지급 단계 · 단계 사진: 당사자 · 관리자만 읽기(앱은 토큰으로 읽는다)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/196_escrow_reads_parties_only.sql", import.meta.url), "utf8");
const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../components/MainApp.jsx", import.meta.url), "utf8");
const act = readFileSync(new URL("./spaceActivity.js", import.meta.url), "utf8");

test("196 — 누구나 읽기 정책을 조건으로 지우고 당사자 정책 3개", () => {
  assert.match(sql, /cmd in \('SELECT', 'ALL'\) and coalesce\(qual, ''\) = 'true'/);
  for (const p of ["g196_escrow_read", "g196_payout_read", "g196_phase_read"]) assert.match(sql, new RegExp(`create policy ${p} on public\\.`));
  assert.match(sql, /c\.id = p_company_id or c\.owner_id = p_company_id\) and c\.owner_id = auth\.uid\(\)/);
  assert.match(sql, /r\.id = p_request_id and r\.user_id = auth\.uid\(\)/);
  assert.match(sql, /coalesce\(public\.is_admin\(\), false\)/);
  assert.match(sql, /grant execute on function public\.company_done_projects\(uuid\) to anon, authenticated;/);
  assert.match(sql, /as no_public_read,/);
  assert.match(sql, /as party_read,/);
  assert.match(sql, /as done_count_fn;/);
});

test("앱 — 세 표는 토큰 연결(userDb)로만 읽는다 · 공개 숫자는 서버 함수(없으면 예전 방식)", () => {
  for (const src of [lib, main]) assert.doesNotMatch(src, /\bsupabase\s*\.from\(["'](escrow_payments|escrow_payouts|phase_photos)["']\)/);
  assert.match(act, /supabase\.rpc\("company_done_projects", \{ p_company_id: companyId \}\)/);
  // 공개 화면에서 표를 직접 읽는 곳은 «함수가 없을 때» 예전 방식 한 곳뿐
  assert.equal((act.match(/from\("escrow_payments"\)/g) ?? []).length, 2);
});
