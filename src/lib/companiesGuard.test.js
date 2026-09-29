// 보완 S3(167) — 업체가 앱 밖에서 직접 인증·점수·상태 칸을 못 바꾼다. 관리자 쓰기는 토큰 연결로.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/167_companies_protected_columns.sql", import.meta.url), "utf8");
const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");

test("고칠 때 지키는 칸 — 고객이 믿고 고르는 칸이 모두 들어 있다", () => {
  const upd = sql.slice(sql.indexOf("-- UPDATE:"));
  for (const col of ["owner_id", "verified", "license_verified", "has_insurance", "is_direct", "temp", "company_status",
    "guarantee_status", "guarantee_grade", "guarantee_amount", "fee_rate", "badge", "doc_status", "completed_jobs"]) {
    assert.match(upd, new RegExp(`new\\.${col} := old\\.${col};`), `${col} 를 지키지 않음`);
  }
  for (const col of ["name", "intro", "region", "service_regions", "online", "slug", "cover_url", "logo_url"]) {
    assert.doesNotMatch(upd, new RegExp(`new\\.${col} := old\\.`), `${col} 는 업체가 고칠 수 있어야 함`);
  }
});

test("서버 함수·관리자 토큰은 그대로 통과", () => {
  assert.match(sql, /if current_user not in \('anon', 'authenticated'\) then return new; end if;/);
  assert.match(sql, /if public\.is_admin\(\) then return new; end if;/);
});

test("앱의 관리자용 업체 칸 쓰기는 관리자 토큰 연결(adminDb)로", () => {
  for (const fn of ["updateCompanyTemp", "reviewCompany", "setCompanyStatus"]) {
    const i = lib.indexOf(`export const ${fn} =`);
    const body = lib.slice(i, lib.indexOf("export const", i + 10));
    assert.ok(body.includes("adminDb()"), `${fn} 가 adminDb 를 쓰지 않음`);
  }
});
