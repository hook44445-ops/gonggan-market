// 결제 승인 서버의 문(門) — 토스에 승인 요청을 보내기 전에 막아야 하는 것들.
// 네트워크(fetch)는 가짜로 바꿔, 토스까지 갔는지(= 매입됐는지)를 센다.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler from "./confirm-payment.js";

const REQ = "11111111-2222-4333-8444-555555555555";
let tossCalls, realFetch, base;

function fakeRes() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
}
const call = async (body) => { const res = fakeRes(); await handler({ method: "POST", body }, res); return res; };

beforeEach(() => {
  tossCalls = 0; base = 240;
  process.env.TOSS_SECRET_KEY = "test_sk_x";
  process.env.SUPABASE_URL = "https://db.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    const ok = (v) => ({ ok: true, json: async () => v });
    if (u.startsWith("https://api.tosspayments.com")) { tossCalls++; return ok({ status: "DONE" }); }
    if (u.includes("/ops_config")) return ok([{ pause_new_payments: false }]);
    if (u.includes("/payment_orders")) return ok([]);                        // 아직 결제 없음
    if (u.includes("/requests?")) return ok([{ selected_company_id: "c1" }]);
    if (u.includes("/companies?")) return ok([{ id: "c1", verified: true }]);  // 사업자 확인 업체
    if (u.includes("/rpc/contract_base_price")) return ok(base);               // 만원
    return { ok: false, json: async () => ({}) };
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

test("공사 결제 — 계약 금액 이상이면 토스 승인까지 간다", async () => {
  const res = await call({ paymentKey: "pk", orderId: `gm_${REQ}_1`, amount: 2_490_000 });
  assert.equal(res.statusCode, 200);
  assert.equal(tossCalls, 1);
});

test("공사 결제 — 계약 금액보다 적으면 토스에 보내지 않는다(AMOUNT_MISMATCH)", async () => {
  const res = await call({ paymentKey: "pk", orderId: `gm_${REQ}_1`, amount: 1_000 });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "AMOUNT_MISMATCH");
  assert.equal(tossCalls, 0);
});

test("모르는 주문번호(order_…)는 검사를 건너뛰지 못하고 거절된다", async () => {
  const res = await call({ paymentKey: "pk", orderId: "order_123", amount: 1_000 });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "UNKNOWN_ORDER");
  assert.equal(tossCalls, 0);
});

test("계약 금액을 못 읽으면(119 실행 전 등) 예전처럼 막지 않는다", async () => {
  base = null;
  const res = await call({ paymentKey: "pk", orderId: `gm_${REQ}_1`, amount: 2_490_000 });
  assert.equal(res.statusCode, 200);
  assert.equal(tossCalls, 1);
});

test("공간토큰 주문(token_…)은 공사 금액 검사 없이 지나간다", async () => {
  const res = await call({ paymentKey: "pk", orderId: "token_1", amount: 5_000 });
  assert.equal(res.statusCode, 200);
  assert.equal(tossCalls, 1);
});
