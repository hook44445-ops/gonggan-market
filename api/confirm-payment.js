import { contractGate, BIZ_REQUIRED_MESSAGE } from "../src/lib/contractGate.js";
import { verifySession } from "../src/lib/sessionToken.server.js";
import { TOKEN_PACKAGES } from "../src/constants/lounge.js";

// ─────────────────────────────────────────────────────
// 결제 승인 · 기록 · 취소(환불) — 토스페이먼츠(09-26 «결제 열기 준비»)
//   POST { paymentKey, orderId, amount }            → 승인 + 서버가 기록(공사: 결제 기록 · 토큰: 적립)
//   POST { action: "cancel", orderId, reason }      → 관리자만 · 토스 취소(환불) + 기록
//   예전엔 승인만 서버가 하고 «결제 기록·토큰 적립»은 앱이 했다 —
//     · 승인 뒤 앱이 닫히면 돈은 빠졌는데 기록이 없고,
//     · 토큰 적립 함수(purchase_space_tokens)는 누구나 불러 공짜 토큰을 만들 수 있었다(SQL 143 으로 닫음),
//     · 적립 토큰 수·금액도 앱이 보낸 값이었다.
//   이제 로그인 토큰의 본인만 결제를 승인받고, 기록·적립은 서버가 한다(같은 주문번호는 한 번만).
// ─────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: "Payment service not configured" });
  const uid = sessionUserId(req);

  if (req.body?.action === "cancel") return cancelPayment(req, res, { secretKey, uid });

  const { paymentKey, orderId, amount } = req.body ?? {};
  if (!paymentKey || !orderId || !amount) return res.status(400).json({ error: "Missing required fields" });

  // 아는 주문만 승인한다 — 공사 결제(gm_{요청ID}_…)와 공간토큰(token_…). 예전엔 다른 주문번호(order_…)로 오면
  // 아래 중복·사업자·금액 검사를 모두 건너뛸 수 있었다(총점검 09-24 6차).
  if (!/^(gm_|token_)/.test(String(orderId))) {
    return res.status(400).json({ error: "알 수 없는 주문이에요. 결제를 다시 시작해 주세요.", code: "UNKNOWN_ORDER" });
  }

  // 로그인한 본인만 — 승인 «전에» 본다(여기서 막히면 토스가 매입하지 않는다 = 돈이 안 나감).
  if (!uid) return res.status(401).json({ error: "로그인이 풀렸어요. 다시 로그인한 뒤 결제해 주세요.", code: "LOGIN_REQUIRED" });

  // 공간토큰 — 금액이 상품표에 있는 가격이어야 한다(적립 토큰 수는 서버가 상품표로 정한다).
  const isToken = String(orderId).startsWith("token_");
  const pkg = isToken ? TOKEN_PACKAGES.find((p) => p.price === Number(amount)) : null;
  if (isToken && !pkg) return res.status(400).json({ error: "상품 금액이 맞지 않아요. 다시 시도해 주세요.", code: "UNKNOWN_PACKAGE" });

  // 관리자 「신규 결제 중지」(ops_config, migration 108) — 켜져 있으면 승인하지 않는다(= 돈이 빠져나가지 않음).
  // 표를 못 읽으면(배포 전 등) 막지 않는다 — 스위치가 없던 때와 같은 동작.
  if (await paymentsPaused()) {
    return res.status(409).json({ error: "지금은 새 결제를 잠시 멈췄어요. 잠시 후 다시 시도해 주세요.", code: "PAYMENTS_PAUSED" });
  }

  // 같은 공사 두 번 결제 막기(C17) — 공사 결제 주문번호는 gm_{요청ID}_{시각}. 그 공사에 이미 PAID 결제가 있으면
  // 토스 승인(confirm)을 하지 않는다 → 두 번째 결제는 매입되지 않는다(돈이 빠져나가지 않음).
  // 같은 주문번호를 다시 보낸 것(복귀 화면 새로고침)은 «이미 기록됨»으로 돌려준다.
  const reqMatch = /^gm_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/i.exec(String(orderId));
  const recorded = await orderByOrderId(orderId);
  if (recorded) return res.status(200).json({ success: true, already: true, record: recordView(recorded) });
  if (reqMatch && await alreadyPaid(reqMatch[1])) {
    return res.status(409).json({
      error: "이미 결제된 공사예요. 같은 공사를 두 번 결제할 수 없어요 — 공사 화면에서 진행 상황을 확인해 주세요.",
      code: "ALREADY_PAID",
    });
  }

  let request = null;
  if (reqMatch) {
    request = await requestRow(reqMatch[1]);
    // 남의 공사를 결제하지 않는다 — 요청을 읽었는데 주인이 다르면 막는다(못 읽으면 예전처럼 통과).
    if (request?.user_id && request.user_id !== uid) {
      return res.status(403).json({ error: "내 요청의 공사만 결제할 수 있어요.", code: "NOT_OWNER" });
    }
    // 계약은 사업자부터(A안) — 선택된 업체의 사업자등록이 관리자 확인 전이면 승인하지 않는다 → 매입 안 됨(돈이 안 나감).
    // 업체를 «확인 못 했다»(조회 실패)면 예전처럼 막지 않는다 — «확인 안 된 업체다»라고 읽혔을 때만 막는다.
    const company = await selectedCompanyOf(reqMatch[1], request);
    if (company && !contractGate(company).ok) {
      return res.status(409).json({ error: BIZ_REQUIRED_MESSAGE, code: "BIZ_REQUIRED" });
    }
  }

  // 금액 검사 — 결제 금액이 이 공사의 계약 금액(최종 견적서, 없으면 선택한 입찰가)보다 적으면 승인하지 않는다.
  // 이용료는 결제수단마다 달라 «이상»만 본다. 금액을 못 읽으면(조회 실패) 예전처럼 막지 않는다.
  let base = null;
  if (reqMatch) {
    base = await contractBaseWon(reqMatch[1]);
    if (base && Number(amount) < base) {
      return res.status(409).json({ error: "결제 금액이 계약 금액과 맞지 않아요. 결제를 다시 시작해 주세요.", code: "AMOUNT_MISMATCH" });
    }
  }

  const auth = Buffer.from(`${secretKey}:`).toString("base64");
  let data;
  try {
    const r = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    data = await r.json();
    if (!r.ok) {
      // 이미 승인된 결제(복귀 화면 두 번 처리 등) — 토스에서 결제를 다시 읽어 기록을 이어 간다.
      if (data?.code === "ALREADY_PROCESSED_PAYMENT") {
        const g = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, { headers: { Authorization: `Basic ${auth}` } });
        if (!g.ok) return res.status(400).json({ error: data.message ?? "Toss confirm failed", code: data.code });
        data = await g.json();
        if (data?.orderId !== orderId) return res.status(400).json({ error: "주문 정보가 맞지 않아요.", code: "ORDER_MISMATCH" });
      } else {
        return res.status(400).json({ error: data.message ?? "Toss confirm failed", code: data.code });
      }
    }
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }

  // 기록 — 실패해도 승인은 이미 됐다(돈은 빠졌다). 앱에 «기록 실패 + 주문번호»를 알려 고객센터가 찾을 수 있게.
  let record = null;
  try {
    record = isToken
      ? await recordTokenPurchase({ uid, pkg, orderId, paymentKey, toss: data })
      : await recordConstructionPayment({ uid, request, requestId: reqMatch?.[1] ?? null, baseWon: base, orderId, paymentKey, toss: data });
  } catch (e) {
    record = { error: e?.message ?? "record_failed" };
  }
  return res.status(200).json({ success: true, data: publicToss(data), record });
}

// ── 로그인 토큰 ────────────────────────────────────────────────────
function sessionUserId(req) {
  const h = req.headers?.authorization ?? req.headers?.Authorization ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(String(h));
  if (!m) return null;
  return verifySession(m[1])?.sub ?? null;
}

// 앱에 돌려줄 토스 결과(비밀값 secret 은 빼고)
function publicToss(d) {
  if (!d) return null;
  const { secret, ...rest } = d; // eslint-disable-line no-unused-vars
  return rest;
}

// ── DB(서버 키) ────────────────────────────────────────────────────
function sbEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, h: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } } : null;
}
async function sbGet(path) {
  const e = sbEnv(); if (!e) return null;
  try { const r = await fetch(`${e.url}/rest/v1/${path}`, { headers: e.h }); return r.ok ? await r.json() : null; } catch { return null; }
}
async function sbWrite(method, path, body, prefer = "return=representation") {
  const e = sbEnv(); if (!e) return { error: "missing_env" };
  try {
    const r = await fetch(`${e.url}/rest/v1/${path}`, { method, headers: { ...e.h, Prefer: prefer }, body: JSON.stringify(body) });
    const text = typeof r.text === "function" ? await r.text() : JSON.stringify(await r.json?.() ?? null);
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* */ }
    return r.ok ? { data: json } : { error: json?.message ?? text ?? `http_${r.status}`, code: json?.code };
  } catch (err) {
    return { error: err?.message ?? "fetch_failed" };
  }
}

async function orderByOrderId(orderId) {
  const rows = await sbGet(`payment_orders?order_id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
const recordView = (o) => ({ id: o.id, status: o.status, contractId: o.contract_id ?? null, source: o.payment_source ?? null });

// 공간토큰 — 상품표의 토큰 수로 적립(purchase_space_tokens 는 SQL 143 뒤 서버만 부를 수 있다)
async function recordTokenPurchase({ uid, pkg, orderId, paymentKey, toss }) {
  if (toss?.status !== "DONE") return { status: toss?.status ?? "UNKNOWN", credited: false };
  const r = await sbWrite("POST", "rpc/purchase_space_tokens", {
    p_user_id: uid, p_tokens: pkg.tokens, p_price: pkg.price, p_order_id: orderId,
    p_payment_key: paymentKey, p_method: toss.method ?? "CARD", p_description: `공간토큰 ${pkg.tokens}개 구매`,
  });
  if (r.error || r.data?.error) return { error: r.error ?? r.data.error };
  return { credited: r.data?.status === "credited" || r.data?.status === "already_processed", tokens: pkg.tokens, balance: r.data?.balance ?? null };
}

// 공사 결제 — 결제 기록(payment_orders · payment_transactions) + 계약(에스크로) 확보.
//   금액 단위는 예전 앱 기록과 같게 «만원»(관리자 결제관리가 만원으로 보여 준다). 토스 원 단위 금액은 raw_response 에.
//   가상계좌(입금 대기)는 READY 로만 기록하고 계약을 만들지 않는다 — 돈이 들어온 뒤(입금 통보) 진행.
async function recordConstructionPayment({ uid, request, requestId, baseWon, orderId, paymentKey, toss }) {
  const done = toss?.status === "DONE";
  const totalWon = Number(toss?.totalAmount ?? 0);
  const man = (won) => Math.round((Number(won) / 10000) * 10) / 10;
  const baseMan = baseWon ? man(baseWon) : null;
  const totalMan = man(totalWon);

  let contractId = null;
  if (done && requestId) {
    const esc = await sbWrite("POST", "rpc/escrow_get_or_create", {
      p_request_id: requestId, p_company_id: request?.selected_company_id ?? null, p_total_amount: Math.round(baseMan ?? totalMan),
    });
    contractId = esc.data?.row?.id ?? null;
  }

  const row = {
    user_id: uid, request_id: requestId, bid_id: request?.selected_bid_id ?? null, contract_id: contractId,
    amount: baseMan ?? totalMan, customer_fee: baseMan != null ? Math.max(0, Math.round((totalMan - baseMan) * 10) / 10) : 0, vat: 0,
    total_amount: totalMan, payment_method: toss?.method ?? null,
    status: done ? "PAID" : "READY", provider: "TOSS", payment_source: "original",
    order_id: orderId, payment_key: paymentKey, paid_at: done ? (toss?.approvedAt ?? new Date().toISOString()) : null,
    raw_response: {
      status: toss?.status, method: toss?.method, totalAmountWon: totalWon, approvedAt: toss?.approvedAt ?? null,
      virtualAccount: toss?.virtualAccount ?? null, secret: toss?.secret ?? null, // secret — 입금 통보(웹훅) 확인용, 앱에 내보내지 않음
    },
  };
  let ins = await sbWrite("POST", "payment_orders", row);
  // SQL 143(금액 칸 소수 허용) 전이면 정수로 한 번 더
  if (ins.error && /integer/i.test(String(ins.error))) {
    ins = await sbWrite("POST", "payment_orders", { ...row, amount: Math.round(row.amount), customer_fee: Math.round(row.customer_fee), total_amount: Math.round(row.total_amount) });
  }
  // 같은 주문번호가 동시에 들어와 이미 기록됐으면(SQL 143 의 유일 색인) 그 기록을 쓴다
  if (ins.error) {
    const again = await orderByOrderId(orderId);
    if (again) return recordView(again);
    return { error: ins.error, contractId };
  }
  const order = Array.isArray(ins.data) ? ins.data[0] : ins.data;
  await sbWrite("POST", "payment_transactions", {
    payment_order_id: order?.id, pg_provider: "toss", pg_payment_key: paymentKey, provider: "TOSS",
    payment_method: toss?.method ?? null, method: toss?.method ?? null, amount: row.total_amount,
    status: toss?.status ?? "DONE", approved_at: row.paid_at, raw_response: { orderId, totalAmountWon: totalWon },
  }, "return=minimal");
  return { ...recordView(order), virtualAccount: done ? null : (toss?.virtualAccount ?? null) };
}

// ── 결제 취소(환불) — 관리자만 ─────────────────────────────────────
//   토스 취소 API 로 실제 환불 → 결제 기록 CANCELLED · 계약(에스크로) CANCELLED · 관리자 로그.
//   막는 경우: 이미 업체에 지급된 단계가 있음(부분 환불은 아직 — 토스 관리자 화면에서) ·
//             토큰 구매인데 남은 토큰이 산 만큼 없음.
async function cancelPayment(req, res, { secretKey, uid }) {
  const { orderId, reason } = req.body ?? {};
  if (!uid) return res.status(401).json({ error: "관리자 로그인이 필요해요.", code: "LOGIN_REQUIRED" });
  const me = await sbGet(`users?id=eq.${encodeURIComponent(uid)}&select=role&limit=1`);
  if (me?.[0]?.role !== "admin") return res.status(403).json({ error: "관리자만 결제를 취소할 수 있어요.", code: "ADMIN_ONLY" });
  if (!orderId || !String(reason ?? "").trim()) return res.status(400).json({ error: "주문번호와 취소 사유가 필요해요.", code: "MISSING_FIELDS" });

  const order = await orderByOrderId(orderId);
  if (!order) return res.status(404).json({ error: "결제 기록을 찾지 못했어요.", code: "NOT_FOUND" });
  if (!order.payment_key) return res.status(409).json({ error: "토스 결제번호가 없는 기록이에요 — 토스 관리자 화면에서 확인해 주세요.", code: "NO_PAYMENT_KEY" });
  if (order.status !== "PAID" && order.status !== "READY") return res.status(409).json({ error: `이미 «${order.status}» 상태예요.`, code: "NOT_CANCELLABLE" });

  if (order.contract_id) {
    const paid = await sbGet(`escrow_payouts?contract_id=eq.${order.contract_id}&status=in.(PAID,COMPLETED,TRANSFERRED)&select=id&limit=1`);
    if (Array.isArray(paid) && paid.length) {
      return res.status(409).json({ error: "이미 업체에 지급된 단계가 있어 전액 취소할 수 없어요. 부분 환불은 토스 관리자 화면에서 해 주세요.", code: "PAYOUT_DONE" });
    }
  }
  let tokenUndo = null;
  if (order.payment_source === "token") {
    const tokens = Number(order.raw_response?.tokens ?? 0);
    const bal = await sbGet(`space_tokens?user_id=eq.${order.user_id}&select=balance&limit=1`);
    const balance = Number(bal?.[0]?.balance ?? 0);
    if (!tokens || balance < tokens) {
      return res.status(409).json({ error: `산 토큰 ${tokens}개 중 일부를 이미 썼어요(남은 ${balance}개). 전액 취소할 수 없어요.`, code: "TOKENS_SPENT" });
    }
    tokenUndo = { tokens, balance };
  }

  const auth = Buffer.from(`${secretKey}:`).toString("base64");
  let data;
  try {
    const r = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", "Idempotency-Key": `cancel_${order.order_id}` },
      body: JSON.stringify({ cancelReason: String(reason).slice(0, 200) }),
    });
    data = await r.json();
    if (!r.ok && data?.code !== "ALREADY_CANCELED_PAYMENT") {
      return res.status(400).json({ error: data?.message ?? "토스 취소에 실패했어요.", code: data?.code ?? "TOSS_CANCEL_FAILED" });
    }
  } catch {
    return res.status(500).json({ error: "토스 연결에 실패했어요. 잠시 후 다시 시도해 주세요." });
  }

  const nowIso = new Date().toISOString();
  await sbWrite("PATCH", `payment_orders?id=eq.${order.id}`, {
    status: "CANCELLED", raw_response: { ...(order.raw_response ?? {}), cancel: { at: nowIso, reason, by: uid, tossStatus: data?.status ?? null } },
  }, "return=minimal");
  if (order.contract_id) {
    await sbWrite("PATCH", `escrow_payments?id=eq.${order.contract_id}`, { transaction_status: "CANCELLED", updated_at: nowIso }, "return=minimal");
  }
  if (tokenUndo) {
    await sbWrite("PATCH", `space_tokens?user_id=eq.${order.user_id}`, { balance: tokenUndo.balance - tokenUndo.tokens }, "return=minimal");
    await sbWrite("POST", "space_token_logs", { user_id: order.user_id, amount: -tokenUndo.tokens, type: "spend", description: "토큰 구매 취소(환불)" }, "return=minimal");
  }
  await sbWrite("POST", "admin_logs", {
    admin_id: uid, action: "PAYMENT_CANCEL", target_type: "payment_order", target_id: order.id,
    after_val: { orderId: order.order_id, tossStatus: data?.status ?? null, tokens: tokenUndo?.tokens ?? null }, reason,
  }, "return=minimal");
  return res.status(200).json({ success: true, status: "CANCELLED", tossStatus: data?.status ?? null });
}

// ── 승인 전 검사들(예전 그대로) ─────────────────────────────────────
async function alreadyPaid(requestId) {
  const rows = await sbGet(`payment_orders?request_id=eq.${encodeURIComponent(requestId)}&status=eq.PAID&select=id&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}

async function paymentsPaused() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const r = await fetch(`${url}/rest/v1/ops_config?id=eq.1&select=pause_new_payments`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return !!rows?.[0]?.pause_new_payments;
  } catch {
    return false;
  }
}

async function requestRow(requestId) {
  const rows = await sbGet(`requests?id=eq.${encodeURIComponent(requestId)}&select=user_id,selected_company_id,selected_bid_id&limit=1`);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

// 요청에 선택된 업체 행(verified 만). selected_company_id 는 업체 ID 일 수도, 주인 사용자 ID 일 수도 있다.
// 못 읽으면 null(= 모름). 업체 행이 없으면 null.
async function selectedCompanyOf(requestId, request = null) {
  const ref = (request ?? await requestRow(requestId))?.selected_company_id;
  if (!ref || !/^[0-9a-f-]{36}$/i.test(String(ref))) return null;
  const rows = await sbGet(`companies?or=(id.eq.${ref},owner_id.eq.${ref})&select=id,verified&limit=1`);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

// 이 공사의 계약 금액(원) — 서버 함수 contract_base_price(SQL 119: 최종 견적서 총액, 없으면 선택한 입찰가, 만원).
// 못 읽으면 null(= 모름 → 막지 않음).
async function contractBaseWon(requestId) {
  const e = sbEnv(); if (!e) return null;
  try {
    const r = await fetch(`${e.url}/rest/v1/rpc/contract_base_price`, {
      method: "POST", headers: e.h, body: JSON.stringify({ p_request_id: requestId }),
    });
    if (!r.ok) return null;
    const n = Number(await r.json());
    if (!Number.isFinite(n) || n <= 0) return null;
    return n >= 100000 ? n : n * 10000;
  } catch {
    return null;
  }
}
