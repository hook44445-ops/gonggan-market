// 공정 묶음 분할 결제(gb_ 주문 · SQL 205) — 토스 승인 «전에» 막아야 하는 것들 + 승인·입금 통보 뒤 서버 반영.
// 네트워크(fetch)는 가짜로 바꿔, 토스까지 갔는지(= 매입됐는지)와 서버 함수에 무엇을 보냈는지를 센다.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler from "./confirm-payment.js";
import { signSession } from "../src/lib/sessionToken.server.js";

const USER = "99999999-8888-4777-8666-555555555555";
const OTHER = "aaaaaaaa-8888-4777-8666-555555555555";
const ORDER = "gb_0123456789abcdef0123456789abcdef_abc123def456";
let tossCalls, tossReads, realFetch, rpcs, part, settleResult, secretOk, token, tossPayment;

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
  tossCalls = 0; tossReads = 0; rpcs = []; secretOk = true;
  part = { status: "ok", user_id: USER, request_id: "r1", amount_won: 3_000_000, method: "CARD" };
  settleResult = { status: "ok", part_status: "DONE", bundle_seq: 1, paid_count: 1, count: 3, left_won: 16_000_000, contract_ready: false, escrow_id: null };
  tossPayment = { orderId: ORDER, status: "DONE", method: "카드", totalAmount: 3_000_000, approvedAt: "2026-10-07T12:00:00+09:00", secret: "s3cr3t" };
  process.env.TOSS_SECRET_KEY = "test_sk_x";
  process.env.SUPABASE_URL = "https://db.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  process.env.SUPABASE_JWT_SECRET = "jwt_test_secret";
  token = signSession(USER);
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const ok = (v) => ({ ok: true, json: async () => v, text: async () => JSON.stringify(v) });
    if (u.startsWith("https://api.tosspayments.com/v1/payments/orders/")) { tossReads++; return ok(tossPayment); }
    if (u.startsWith("https://api.tosspayments.com")) { tossCalls++; return ok(tossPayment); }
    if (u.includes("/rpc/")) {
      const fn = u.split("/rpc/")[1];
      rpcs.push({ fn, body: JSON.parse(init.body ?? "null") });
      if (fn === "bundle_part_for_confirm") return part ? ok(part) : { ok: false, json: async () => ({}) };
      if (fn === "bundle_part_settle") return ok(settleResult);
      if (fn === "bundle_part_secret_ok") return ok(secretOk);
      return ok(null);
    }
    if (u.includes("/ops_config")) return ok([{ pause_new_payments: false }]);
    return { ok: false, json: async () => ({}), text: async () => "{}" };
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

test("묶음 결제 — 결제 건 금액과 같으면 토스 승인 → 서버 함수가 반영", async () => {
  const res = await call({ paymentKey: "pk", orderId: ORDER, amount: 3_000_000 });
  assert.equal(res.statusCode, 200);
  assert.equal(tossCalls, 1);
  const settle = rpcs.find((r) => r.fn === "bundle_part_settle");
  assert.equal(settle.body.p_order_id, ORDER);
  assert.equal(settle.body.p_toss.totalAmount, 3_000_000);
  assert.equal(res.body.record.partStatus, "DONE");
  assert.equal(res.body.record.leftWon, 16_000_000);
  assert.equal(res.body.data.secret, undefined);                 // secret 은 앱에 안 보낸다
});

test("묶음 결제 — 금액이 결제 건과 다르면(앱 조작) 토스에 보내지 않는다", async () => {
  for (const amount of [2_999_999, 3_000_001, 9_000_000]) {
    const res = await call({ paymentKey: "pk", orderId: ORDER, amount });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, "AMOUNT_MISMATCH");
  }
  assert.equal(tossCalls, 0);
});

test("묶음 결제 — 남의 요청 · 로그인 없음 · 닫힌 결제 건은 토스에 보내지 않는다", async () => {
  part = { ...part, user_id: OTHER };
  assert.equal((await call({ paymentKey: "pk", orderId: ORDER, amount: 3_000_000 })).body.code, "NOT_OWNER");
  assert.equal((await call({ paymentKey: "pk", orderId: ORDER, amount: 3_000_000 }, { auth: false })).statusCode, 401);
  part = { error: "OVER_REMAINING" };
  const r = await call({ paymentKey: "pk", orderId: ORDER, amount: 3_000_000 });
  assert.equal(r.statusCode, 409);
  assert.equal(r.body.code, "OVER_REMAINING");
  assert.equal(tossCalls, 0);
});

test("묶음 표를 못 읽으면(205 실행 전) 막는다 — 새 결제라 «모르면 통과»가 없다", async () => {
  part = null;
  const res = await call({ paymentKey: "pk", orderId: ORDER, amount: 3_000_000 });
  assert.equal(res.statusCode, 503);
  assert.equal(tossCalls, 0);
});

test("가상계좌 — 발급되면 계좌·기한을 돌려주고 secret 은 서버 함수에만", async () => {
  tossPayment = { ...tossPayment, method: "가상계좌", status: "WAITING_FOR_DEPOSIT",
    virtualAccount: { bankCode: "88", accountNumber: "X1234", customerName: "고객", dueDate: "2026-10-14T23:59:59+09:00" } };
  settleResult = { status: "ok", part_status: "WAITING_FOR_DEPOSIT", due_at: "2026-10-14T14:59:59Z" };
  const res = await call({ paymentKey: "pk", orderId: ORDER, amount: 3_000_000 });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.record.virtualAccount.accountNumber, "X1234");
  assert.equal(rpcs.find((r) => r.fn === "bundle_part_settle").body.p_toss.secret, "s3cr3t");
  assert.equal(res.body.data.secret, undefined);
});

test("한 번에 결제(gm_)는 1천만 원 이상이면 토스에 보내지 않는다(OVER_SINGLE_LIMIT)", async () => {
  const REQ = "11111111-2222-4333-8444-555555555555";
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const ok = (v) => ({ ok: true, json: async () => v, text: async () => JSON.stringify(v) });
    if (u.includes("/rpc/contract_base_price")) return ok(1200);                                   // 1,200만 원
    if (u.includes("/requests?")) return ok([{ selected_company_id: "c1", user_id: USER, selected_bid_id: "b1" }]);
    if (u.includes("/companies?")) return ok([{ id: "c1", verified: true }]);
    if (u.includes("/payment_orders")) return ok([]);
    return prev(url, init);
  };
  const res = await call({ paymentKey: "pk", orderId: `gm_${REQ}_1`, amount: 12_000_000 });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "OVER_SINGLE_LIMIT");
  assert.equal(tossCalls, 0);
});

test("입금 통보(웹훅) — secret 이 맞으면 토스에서 다시 읽어 반영, 틀리면 무시", async () => {
  const hook = { eventType: "DEPOSIT_CALLBACK", createdAt: "2026-10-08T10:00:00", data: { orderId: ORDER, secret: "s3cr3t", status: "DONE" } };
  let res = await call(hook, { auth: false });
  assert.equal(res.statusCode, 200);
  assert.equal(tossReads, 1);
  assert.ok(rpcs.some((r) => r.fn === "bundle_part_settle" && r.body.p_toss.status === "DONE"));
  // 예전 형식 · secret 틀림 → 반영 안 함
  rpcs = []; secretOk = false;
  res = await call({ orderId: ORDER, secret: "nope", status: "DONE" }, { auth: false });
  assert.equal(res.body.code, "SECRET_MISMATCH");
  assert.ok(!rpcs.some((r) => r.fn === "bundle_part_settle"));
  // 묶음이 아닌 주문(gm_)은 받지 않는다
  res = await call({ orderId: "gm_x_1", secret: "s", status: "DONE" }, { auth: false });
  assert.equal(res.body.ignored, true);
});

test("관리자 환불(취소) — 분할 결제 건(gb_)이면 묶음 진행에서도 뺀다(bundle_part_refunded)", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const ok = (v) => ({ ok: true, json: async () => v, text: async () => JSON.stringify(v) });
    if (u.includes("/users?")) return ok([{ role: "admin" }]);
    if (u.includes("/payment_orders?order_id=eq.")) return ok([{ id: "po9", order_id: ORDER, payment_key: "pk9", status: "PAID", payment_source: "bundle", contract_id: null }]);
    if (u.startsWith("https://api.tosspayments.com") && u.endsWith("/cancel")) return ok({ status: "CANCELED" });
    if (init.method === "PATCH" || (init.method === "POST" && !u.includes("/rpc/"))) return ok(null);
    return prev(url, init);
  };
  const res = await call({ action: "cancel", orderId: ORDER, reason: "고객 환불 요청" });
  assert.equal(res.statusCode, 200);
  assert.ok(rpcs.some((r) => r.fn === "bundle_part_refunded" && r.body.p_order_id === ORDER));
});
