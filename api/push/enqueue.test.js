// 공간마켓 알림 → FCM 큐 연결(Phase 1) 단위 테스트
// 실행: node --test api/push/enqueue.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { decidePushGate, buildTargetUrl, TYPE_TO_PREF_COLUMN } from "./enqueue.js";

// ── push_preferences 게이트 ────────────────────────────────────────────────

test("decidePushGate: 수신설정 row 없음 → push_disabled (내부 알림은 별도 저장됨)", () => {
  assert.deepEqual(decidePushGate(null, "CONTRACT_CREATED"), { allow: false, reason: "push_disabled" });
});

test("decidePushGate: 전체 푸시 OFF → push_disabled", () => {
  const pref = { push_enabled: false, push_escrow: true };
  assert.deepEqual(decidePushGate(pref, "CONTRACT_CREATED"), { allow: false, reason: "push_disabled" });
});

test("decidePushGate: 전체 ON, 카테고리(escrow) OFF → category_disabled", () => {
  const pref = { push_enabled: true, push_escrow: false };
  assert.deepEqual(decidePushGate(pref, "CONTRACT_CREATED"), { allow: false, reason: "category_disabled" });
});

test("decidePushGate: 전체 ON, 카테고리 ON → allow", () => {
  const pref = { push_enabled: true, push_escrow: true };
  assert.deepEqual(decidePushGate(pref, "CONTRACT_CREATED"), { allow: true });
});

test("decidePushGate: 매핑 없는 type은 push_enabled 만으로 allow", () => {
  const pref = { push_enabled: true };
  assert.deepEqual(decidePushGate(pref, "UNKNOWN_TYPE"), { allow: true });
});

// ── target_url ──────────────────────────────────────────────────────────────

test("buildTargetUrl: contract/escrow → /contracts/:id", () => {
  assert.equal(buildTargetUrl("contract", "c1"), "/contracts/c1");
  assert.equal(buildTargetUrl("escrow", "e1"), "/contracts/e1");
});

test("buildTargetUrl: lounge_post → /lounge/posts/:id", () => {
  assert.equal(buildTargetUrl("lounge_post", "p1"), "/lounge/posts/p1");
});

test("buildTargetUrl: request/bid → /requests/:id", () => {
  assert.equal(buildTargetUrl("request", "r1"), "/requests/r1");
  assert.equal(buildTargetUrl("bid", "b1"), "/requests/b1");
});

test("buildTargetUrl: relatedId 없음 또는 매핑 없는 타입 → /", () => {
  assert.equal(buildTargetUrl("contract", null), "/");
  assert.equal(buildTargetUrl("company", "x1"), "/");
});

// ── 연결 대상 이벤트 → push_preferences 컬럼 매핑 ──────────────────────────

test("TYPE_TO_PREF_COLUMN: Phase 1 연결 대상 이벤트가 모두 매핑됨", () => {
  const connected = [
    "BID_RECEIVED", "COMPANY_SELECTED", "CONTRACT_CREATED", "ESCROW_PAID_30",
    "CONSTRUCTION_STARTED", "ESCROW_MID_CHECK", "CONSTRUCTION_DONE", "SETTLEMENT_DONE",
    "REVIEW_REQUEST", "DISPUTE_FILED", "DIRECT_DEAL_DETECTED", "ESTIMATE_DUE_SOON",
    "CONTRACT_FOLLOWUP", "COMPANY_APPROVED", "COMPANY_REJECTED", "DOCUMENT_REVIEW",
    "CHANGE_ORDER_REQUEST", "SITE_VISIT_REQUESTED", "ADMIN_ACTION",
  ];
  for (const type of connected) {
    assert.ok(TYPE_TO_PREF_COLUMN[type], `${type} 에 대한 push_preferences 컬럼 매핑이 있어야 함`);
  }
});

// ── 엔드포인트 ──────────────────────────────────────────────────────────────

function mockRes() {
  return {
    statusCode: null,
    body: null,
    setHeader() {},
    end(body) { this.body = body; },
  };
}

test("handler: SUPABASE 자격증명 없으면 graceful no-op (no_db_credentials)", async () => {
  const req = { method: "POST", body: JSON.stringify({ userId: "u1", type: "CONTRACT_CREATED" }) };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: false, reason: "no_db_credentials" });
});

test("handler: userId/type 누락 → missing_params", async () => {
  const req = { method: "POST", body: JSON.stringify({ userId: "u1" }) };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: false, reason: "missing_params" });
});

test("handler: GET 요청은 405", async () => {
  const req = { method: "GET" };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});
