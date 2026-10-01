// 200 — 현장견적 · 견적서 · 계약 타임라인 · 관리자 화면: 토큰으로 읽고, 서버는 당사자만
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTokenRpc } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/200_site_visit_estimate_timeline_parties.sql", import.meta.url), "utf8");
const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");

test("앱 — 현장견적 · 견적서 · 고객 신고 · 관리자 기록을 토큰 없이 읽거나 쓰지 않는다", () => {
  assert.doesNotMatch(lib, /\bsupabase\s*\.from\("(site_visits|estimates|customer_reports|admin_logs)"\)/);
  assert.match(lib, /adminDb\(\)\.from\("admin_logs"\)\.insert\(log\)/);
  assert.match(lib, /let q = adminDb\(\)\.from\("customer_reports"\)/);
  assert.match(lib, /supabase\.rpc\("contract_timeline", \{ p_contract_id: contractId \}\)/);
  assert.ok(isTokenRpc("contract_timeline"));
});

test("200 — 두 표는 당사자 읽기 · 견적서 직접 쓰기 없음 · 타임라인 함수 · 메모 쓰기 당사자 · 신고 관리자 처리", () => {
  assert.match(sql, /create policy g200_sv_read on public\.site_visits for select\s+using \(public\._request_party_of\(request_id, company_id\)\)/);
  assert.match(sql, /create policy g200_est_read on public\.estimates for select\s+using \(public\._request_party_of\(request_id, company_id\)\)/);
  assert.match(sql, /t = 'estimates' and cmd in \('ALL', 'UPDATE', 'DELETE', 'INSERT'\)/);
  assert.match(sql, /and public\._escrow_id_party\(p_contract_id\)/);
  assert.match(sql, /with check \(auth\.uid\(\) = author_id and public\._escrow_id_party\(contract_id\)\)/);
  assert.match(sql, /g200_cr_admin_update on public\.customer_reports for update/);
  assert.match(sql, /as parties_read,/);
  assert.match(sql, /as no_direct_estimate_write,/);
  assert.match(sql, /as timeline_fn;/);
});
