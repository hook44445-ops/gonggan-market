// 184 — 남은 열린 정책(결제 기록·시드 라운지 글·옛 표 2개) 닫기 · 본인 요청 마감·만료·숨기기는 서버 함수로
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/184_close_open_rest.sql", import.meta.url), "utf8");
const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");
const session = readFileSync(new URL("./session.js", import.meta.url), "utf8");

test("184 — 열린 정책은 조건으로 지우고 g184_ 로 다시", () => {
  assert.match(sql, /'payment_transactions', 'seed_lounge_posts', 'portfolio_projects', 'escrow_contracts'/);
  assert.match(sql, /coalesce\(qual, ''\) = 'true' or coalesce\(with_check, ''\) = 'true'/);
  for (const n of ["g184_pt_read", "g184_pt_insert", "g184_pt_admin", "g184_slp_read", "g184_slp_admin", "g184_pfp_admin", "g184_ec_admin", "g184_req_admin_update"]) {
    assert.match(sql, new RegExp(n));
  }
  assert.match(sql, /o\.user_id = auth\.uid\(\)/);
});

test("184 — request_owner_state: 토큰의 사용자 · 남의 요청 막기 · 관리자 판정이 비어도 막힘 · 로그인 안 함 불가", () => {
  assert.match(sql, /v_uid uuid := auth\.uid\(\)/);
  assert.match(sql, /not coalesce\(public\.is_admin\(\), false\)/);
  assert.match(sql, /'IN_CONTRACT'/);
  assert.match(sql, /revoke execute on function public\.request_owner_state\(uuid, text, text\) from public, anon/);
  assert.match(sql, /as owner_state_fn;/);
});

test("앱 — 요청 마감·만료·숨기기는 서버 함수(없으면 예전 방식) · 결제 기록은 토큰 연결", () => {
  assert.match(lib, /supabase\.rpc\("request_owner_state"/);
  for (const a of ['"close"', '"expire"', '"archive"']) assert.match(lib, new RegExp(`requestOwnerState\\(id, ${a}`));
  assert.match(session, /"request_owner_state"/);
  assert.doesNotMatch(lib, /supabase\.from\("payment_transactions"\)/);
  assert.match(lib, /userDb\(\)\.from\("payment_transactions"\)\.insert/);
});
