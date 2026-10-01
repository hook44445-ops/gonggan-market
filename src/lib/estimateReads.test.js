// 197 — 최종 견적서 · 추가공사 목록: 당사자 · 관리자만(앱은 토큰으로 부른다)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTokenRpc } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/197_estimate_change_order_reads_parties.sql", import.meta.url), "utf8");

test("197 — 견적서는 요청 주인·견적 업체 주인·관리자 · 추가공사는 계약 당사자만", () => {
  assert.match(sql, /r\.id = e\.request_id and r\.user_id = auth\.uid\(\)/);
  assert.match(sql, /c\.id = e\.company_id or c\.owner_id = e\.company_id\) and c\.owner_id = auth\.uid\(\)/);
  assert.match(sql, /and public\._escrow_id_party\(p_contract_id\)/);
  for (const fn of ["estimate_get_for_request", "change_orders_for_contract"]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${fn}\\(uuid\\) from public, anon;`));
    assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${fn}\\(uuid\\) to anon`));
    assert.ok(isTokenRpc(fn), fn);
  }
  assert.match(sql, /as parties_only,/);
  assert.match(sql, /as no_anon;/);
});
