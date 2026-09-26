// 결제 승인 서버의 문(門) — 토스에 승인 요청을 보내기 전에 막아야 하는 것들 + 승인 뒤 서버 기록.
// 네트워크(fetch)는 가짜로 바꿔, 토스까지 갔는지(= 매입됐는지)와 DB 에 무엇을 썼는지를 센다.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler from "./confirm-payment.js";
import { signSession } from "../src/lib/sessionToken.server.js";

const REQ = "11111111-2222-4333-8444-555555555555";
const USER = "99999999-8888-4777-8666-555555555555";
let tossCalls, realFetch, base, writes, token;

function fakeRes() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
}
const call = async (body, { auth = true } = {}) => {
  const res = fakeRes();
  await handler({ method: "POST", body, headers: auth ? { authorization: `Bearer ${token}` } : {} }, res);
  return res;
};

beforeEach(() => {
  tossCalls = 0; base = 240; writes = [];
  process.env.TOSS_SECRET_KEY = "test_sk_x";
  process.env.SUPABASE_URL = "https://db.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  process.env.SUPABASE_JWT_SECRET = "jwt_test_secret";
  token = signSession(USER);
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const ok = (v) => ({ ok: true, json: async () => v, text: async () => JSON.stringify(v) });
    if (u.startsWith("https://api.tosspayments.com")) {
      tossCalls++;
      return ok({ status: "DONE", method: "카드", totalAmount: 2_490_000, approvedAt: "2026-09-26T00:00:00+09:00", secret: "s3cr3t" });
    }
    if (u.includes("/rpc/contract_base_price")) return ok(base);               // 만원
    if (init.method === "POST" || init.method === "PATCH") {
      writes.push({ u, body: JSON.parse(init.body ?? "null") });
      if (u.includes("/rpc/escrow_get_or_create")) return ok({ row: { id: "esc1" }, created: true });
      if (u.includes("/rpc/purchase_space_tokens")) return ok({ status: "credited", balance: 45 });
      if (u.endsWith("/payment_orders")) return ok([{ id: "po1", status: "PAID", contract_id: "esc1", payment_source: "original" }]);
      return ok(null);
    }
    if (u.includes("/ops_config")) return ok([{ pause_new_payments: false }]);
    if (u.includes("/payment_orders")) return ok([]);                        // 아직 결제 없음
    if (u.includes("/requests?")) return ok([{ selected_company_id: "c1", user_id: USER, selected_bid_id: "b1" }]);
    if (u.includes("/companies?")) return ok([{ id: "c1", verified: true }]);  // 사업자 확인 업체
    if (u.includes("/users?")) return ok([{ role: "customer" }]);
    return { ok: false, json: async () => ({}), text: async () => "{}" };
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

test("로그인 토큰이 없으면 토스에 보내지 않는다", async () => {
  const res = await call({ paymentKey: "pk", orderId: `gm_${REQ}_1`, amount: 2_490_000 }, { auth: false });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "LOGIN_REQUIRED");
  assert.equal(tossCalls, 0);
});

test("공사 결제 — 남의 요청이면 토스에 보내지 않는다", async () => {
  token = signSession("00000000-0000-4000-8000-000000000000");
  const res = await call({ paymentKey: "pk", orderId: `gm_${REQ}_1`, amount: 2_490_000 });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "NOT_OWNER");
  assert.equal(tossCalls, 0);
});

test("공사 결제 — 승인 뒤 서버가 계약·결제 기록을 만든다(만원 단위 · secret 은 앱에 안 보냄)", async () => {
  const res = await call({ paymentKey: "pk", orderId: `gm_${REQ}_1`, amount: 2_490_000 });
  assert.equal(res.statusCode, 200);
  const po = writes.find((x) => x.u.endsWith("/payment_orders"));
  assert.equal(po.body.status, "PAID");
  assert.equal(po.body.user_id, USER);
  assert.equal(po.body.contract_id, "esc1");
  assert.equal(po.body.bid_id, "b1");
  assert.equal(po.body.amount, 240);
  assert.equal(po.body.total_amount, 249);
  assert.equal(po.body.order_id, `gm_${REQ}_1`);
  assert.equal(res.body.record.contractId, "esc1");
  assert.ok(!("secret" in (res.body.data ?? {})));
});

test("공간토큰 — 상품표 가격이면 승인 · 적립 토큰 수는 서버가 상품표로 · 본인에게", async () => {
  const res = await call({ paymentKey: "pk", orderId: "token_1", amount: 8_900 });
  assert.equal(res.statusCode, 200);
  assert.equal(tossCalls, 1);
  const w = writes.find((x) => x.u.includes("/rpc/purchase_space_tokens"));
  assert.equal(w.body.p_user_id, USER);
  assert.equal(w.body.p_tokens, 25);
  assert.equal(res.body.record.credited, true);
});

test("공간토큰 — 상품표에 없는 금액은 토스에 보내지 않는다", async () => {
  const res = await call({ paymentKey: "pk", orderId: "token_1", amount: 5_000 });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "UNKNOWN_PACKAGE");
  assert.equal(tossCalls, 0);
});

test("결제 취소 — 관리자가 아니면 토스에 보내지 않는다", async () => {
  const res = await call({ action: "cancel", orderId: `gm_${REQ}_1`, reason: "테스트" });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "ADMIN_ONLY");
  assert.equal(tossCalls, 0);
});
