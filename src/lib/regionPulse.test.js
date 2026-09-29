import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pulseView } from "./regionPulse.js";

test("동네 소식 — 요청이 없으면 카드 없음", () => {
  assert.equal(pulseView(null), null);
  assert.equal(pulseView({ ok: false }), null);
  assert.equal(pulseView({ ok: true, requests: 0, bids: 0, label: "강서구" }), null);
});

test("동네 소식 — 문구 · 업체/고객 버튼", () => {
  const v = pulseView({ ok: true, scope: "district", label: "강서구", requests: 5, bids: 12, top: ["욕실", "주방", null] });
  assert.equal(v.title, "📍 강서구 이번 주");
  assert.deepEqual(v.stats, ["새 견적 요청 5건", "들어온 견적 12건"]);
  assert.equal(v.topLine, "많이 찾은 공사 · 욕실 · 주방");
  assert.equal(v.cta, "나도 견적 받아 보기");
  assert.equal(pulseView({ ok: true, label: "서울", requests: 1, bids: 0 }, { isCompany: true }).cta, "새 요청 보러 가기");
});

test("서버(163) — 숫자만 · 7일 · 구 3건 미만이면 시", () => {
  const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/163_region_pulse.sql", import.meta.url)), "utf-8");
  assert.ok(sql.includes("interval '7 days'"));
  assert.ok(sql.includes("if v_req >= 3 then v_scope := 'district'"));
  assert.ok(!/user_id|phone|budget/.test(sql.split("returns jsonb")[1].split("jsonb_build_object('ok', true")[1] ?? ""), "개인 정보·금액을 돌려주지 않는다");
});
