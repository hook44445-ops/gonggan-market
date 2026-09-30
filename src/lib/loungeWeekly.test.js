// 174 — 월요일 «지난주 라운지 인기 글 3개»: 라운지를 쓰는 사람에게만 · 푸시는 라운지 알림 켠 사람만(139 기준)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/174_lounge_weekly_digest.sql", import.meta.url), "utf8");

test("월요일 · 주 1회 · 숨김·삭제 글 제외", () => {
  assert.match(sql, /isodow from v_today\) <> 1/);
  assert.match(sql, /n\.type = 'LOUNGE_WEEKLY'/);
  assert.match(sql, /coalesce\(p\.is_hidden, false\) = false/);
  assert.match(sql, /coalesce\(p\.is_deleted, false\) = false/);
});

test("받는 사람: 최근 60일 라운지 글·댓글 · 푸시는 lounge_hot + 라운지 알림 켠 사람", () => {
  assert.match(sql, /lounge_comments c where c\.created_at > now\(\) - interval '60 days'/);
  assert.match(sql, /push_lounge_activity'\)::boolean, false\)/);
  assert.match(sql, /'lounge_hot', v_title/);
});

test("발송기·알림 누르면 1등 글", () => {
  const d = readFileSync(new URL("../../api/push/dispatch.js", import.meta.url), "utf8");
  assert.match(d, /rpc\/lounge_weekly_digest_due/);
  const m = readFileSync(new URL("../components/MainApp.jsx", import.meta.url), "utf8");
  assert.match(m, /t === "LOUNGE_WEEKLY"\) \{ if \(rid\) \{ window\.location\.href = `\/lounge\/posts\/\$\{rid\}`/);
});
