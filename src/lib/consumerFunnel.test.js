import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarizeConsumerFunnel, consumerFunnelByDay, kstDay, CONSUMER_FUNNEL_ACTIONS } from "./consumerFunnelStats.js";

const L = (action, created_at = "2026-10-09T03:00:00Z") => ({ action, created_at });

test("여섯 단계 · 앞 단계 대비 % · 마지막은 실제 요청 수", () => {
  const logs = [
    ...Array(10).fill(0).map(() => L("consumer_landing_view")),
    ...Array(5).fill(0).map(() => L("consumer_quote_cta")),
    ...Array(4).fill(0).map(() => L("consumer_draft_start")),
    ...Array(2).fill(0).map(() => L("consumer_auth_start")),
    L("consumer_auth_done"), L("partner_join_click"),
  ];
  const rows = summarizeConsumerFunnel({ logs, requests: [{ created_at: "2026-10-09T04:00:00Z" }] });
  assert.deepEqual(rows.map((r) => r.count), [10, 5, 4, 2, 1, 1]);
  assert.deepEqual(rows.map((r) => r.rate), [null, 50, 80, 50, 50, 100]);
  assert.equal(rows.at(-1).source, "db");
});

test("모르면 — 로 둔다(0 으로 속이지 않는다)", () => {
  const rows = summarizeConsumerFunnel({ logs: null, requests: null });
  assert.ok(rows.every((r) => r.count === null && r.rate === null));
});

test("날짜별은 한국 날짜로 묶고 최근이 위", () => {
  const now = Date.parse("2026-10-09T12:00:00+09:00");
  const rows = consumerFunnelByDay({
    logs: [L("consumer_landing_view", "2026-10-08T16:00:00Z"), L("consumer_landing_view", "2026-10-08T14:00:00Z")],
    requests: [{ created_at: "2026-10-09T01:00:00Z" }],
  }, 3, now);
  assert.deepEqual(rows.map((r) => r.day), ["2026-10-09", "2026-10-08", "2026-10-07"]);
  assert.equal(rows[0].counts.consumer_landing_view, 1);   // 16시 UTC = 10-09 01시 KST
  assert.equal(rows[1].counts.consumer_landing_view, 1);
  assert.equal(rows[0].counts.request_sent, 1);
  assert.equal(kstDay("엉터리"), null);
});

test("기록은 개인정보 없이 — user_id 를 비운다", () => {
  const src = readFileSync(new URL("./consumerFunnel.js", import.meta.url), "utf8");
  assert.match(src, /userId: null/);
  assert.doesNotMatch(src, /phone|getCurrentUserId/);
});

test("다섯 기록 단계가 화면에 걸려 있다", () => {
  const land = readFileSync(new URL("../screens/LandingScreen.jsx", import.meta.url), "utf8");
  const login = readFileSync(new URL("../screens/LoginScreen.jsx", import.meta.url), "utf8");
  for (const a of CONSUMER_FUNNEL_ACTIONS) assert.ok(land.includes(`"${a}"`) || login.includes(`"${a}"`), `안 걸림: ${a}`);
  const admin = readFileSync(new URL("../screens/AdminScreen.jsx", import.meta.url), "utf8");
  assert.ok(admin.includes("<ConsumerFunnelPanel />"));
});
