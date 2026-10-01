// 195 — 업체 신청서 이어받기: 로그인한 본인 번호로만
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTokenRpc } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/195_partner_lead_claim_token.sql", import.meta.url), "utf8");

test("195 — 찾기는 본인 번호(관리자만 넘긴 번호) · 토큰 없으면 null", () => {
  const claim = sql.slice(sql.indexOf("function public.partner_lead_claim_for_company("), sql.indexOf("function public.partner_lead_mark_claimed("));
  assert.match(claim, /if v_uid is null then return null; end if;/);
  assert.match(claim, /from public\.users u where u\.id = v_uid/);
  assert.match(claim, /if coalesce\(public\.is_admin\(\), false\) then\s+v_phone := nullif\(regexp_replace\(coalesce\(p_phone/);
});

test("195 — 확정은 내 업체 + 내 번호 신청서만 · anon 회수", () => {
  assert.match(sql, /raise exception 'LOGIN_REQUIRED' using errcode = '42501'/);
  assert.match(sql, /c\.id = p_company_id and c\.owner_id = v_uid/);
  assert.match(sql, /'error', 'NOT_OWNER'/);
  for (const fn of ["partner_lead_claim_for_company", "partner_lead_mark_claimed"]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon;`));
    assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to anon`));
    assert.ok(isTokenRpc(fn), fn);
  }
  assert.match(sql, /as own_phone_only,/);
  assert.match(sql, /as no_anon;/);
});
