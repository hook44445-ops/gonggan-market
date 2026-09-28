import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { companyImagePath, introProblem, profileReasonText, INTRO_MAX, PROFILE_IMAGE_PREFIX } from "./companyProfile.js";

test("사진 경로 — company/업체ID/cover|logo_시각.jpg", () => {
  assert.equal(companyImagePath("c1", "cover", 5), "company/c1/cover_5.jpg");
  assert.equal(companyImagePath("c1", "logo", 5), "company/c1/logo_5.jpg");
});

test("소개 300자", () => {
  assert.equal(introProblem("가".repeat(INTRO_MAX)), null);
  assert.match(introProblem("가".repeat(INTRO_MAX + 1)), /300/);
  assert.match(profileReasonText("BAD_IMAGE"), /사진/);
});

test("서버(154)와 규칙이 같다 — 사진 주소 앞부분 · 300자", () => {
  const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/154_company_profile.sql", import.meta.url)), "utf-8");
  assert.ok(sql.includes(`'${PROFILE_IMAGE_PREFIX}'`));
  assert.ok(sql.includes(`> ${INTRO_MAX}`));
  // 앱이 올리는 경로가 서버가 받는 앞부분과 맞는지
  assert.ok(`https://x.supabase.co/storage/v1/object/public/photos/${companyImagePath("c1", "cover", 1)}`.includes(PROFILE_IMAGE_PREFIX));
});
