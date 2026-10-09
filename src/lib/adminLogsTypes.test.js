import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../../supabase/migrations/", import.meta.url);
const sql205 = readFileSync(new URL("205_admin_logs_target_types.sql", dir), "utf8");

test("205 — 관리자 함수들이 admin_logs 에 남기는 종류를 모두 허용한다(공지 푸시 'push' 포함)", () => {
  const used = new Set();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".sql") || f >= "205") continue;
    const s = readFileSync(new URL(f, dir), "utf8");
    for (const m of s.matchAll(/insert into public\.admin_logs\s*\([^)]*\)\s*values\s*\(\s*[^,]+,\s*[^,]+,\s*'([a-z_]+)'/gi)) used.add(m[1]);
  }
  assert.ok(used.has("push"), "공지 푸시 기록을 못 찾음");
  for (const t of used) assert.ok(sql205.includes(`'${t}'`), `205 허용 목록에 없음: ${t}`);
  // 앱 코드(supabase.js)가 쓰는 종류도
  const app = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");
  for (const m of app.matchAll(/target_type:\s*"([a-z_]+)"/g)) assert.ok(sql205.includes(`'${m[1]}'`), `205 허용 목록에 없음(앱): ${m[1]}`);
});

test("마이 «알림함»은 알림 목록 화면으로(내 견적·시공 진행 아님)", () => {
  const src = readFileSync(new URL("../components/MainApp.jsx", import.meta.url), "utf8");
  assert.ok(src.includes('if (target === "notifications") { setScreen("notifications"); return; }'));
  assert.match(src, /screen==="notifications" && \([\s\S]{0,800}<NotificationInbox/);
});
