import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { donePhotosView } from "./regionPhotos.js";

test("2장 미만이면 안 보임 · 링크는 업체 페이지", () => {
  assert.equal(donePhotosView({ ok: true, label: "강서구", items: [{ id: 1, photo: "https://x/a.jpg" }] }), null);
  assert.equal(donePhotosView({ ok: false }), null);
  const v = donePhotosView({ ok: true, label: "강서구", items: [
    { id: 1, photo: "https://x/a.jpg", space: "욕실", company: "홍익시공", slug: "hongik" },
    { id: 2, photo: "https://x/b.jpg", company_id: "c-2" },
    { id: 3, photo: "javascript:alert(1)" }] });
  assert.equal(v.title, "📸 강서구 최근 완공");
  assert.equal(v.items.length, 2);
  assert.equal(v.items[0].href, "/p/hongik");
  assert.equal(v.items[1].href, "/p/c-2");
  assert.equal(v.items[0].caption, "욕실 · 홍익시공");
});

test("177 — 공개 후기만 · 고객 이름·연락처 안 돌려줌 · 홈 고객 화면에 연결", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/177_region_done_photos.sql", import.meta.url), "utf8");
  assert.match(sql, /coalesce\(r\.is_hidden, false\) = false and coalesce\(r\.is_deleted, false\) = false/);
  assert.match(sql, /coalesce\(r\.rating, 0\) >= 4/);
  const body = sql.slice(sql.indexOf("jsonb_build_object(\n           'id'"));
  assert.doesNotMatch(body.slice(0, body.indexOf("from (")), /user_name|phone|user_id/);
  const home = readFileSync(new URL("../screens/v3/HomeV3.jsx", import.meta.url), "utf8");
  assert.match(home, /!isCompany && <RegionDonePhotos region=\{user\?\.region\} \/>/);
});
