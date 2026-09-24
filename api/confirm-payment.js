import { contractGate, BIZ_REQUIRED_MESSAGE } from "../src/lib/contractGate.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { paymentKey, orderId, amount } = req.body ?? {};
  if (!paymentKey || !orderId || !amount) return res.status(400).json({ error: "Missing required fields" });

  // 아는 주문만 승인한다 — 공사 결제(gm_{요청ID}_…)와 공간토큰(token_…). 예전엔 다른 주문번호(order_…)로 오면
  // 아래 중복·사업자·금액 검사를 모두 건너뛸 수 있었다(총점검 09-24 6차).
  if (!/^(gm_|token_)/.test(String(orderId))) {
    return res.status(400).json({ error: "알 수 없는 주문이에요. 결제를 다시 시작해 주세요.", code: "UNKNOWN_ORDER" });
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: "Payment service not configured" });

  // 관리자 「신규 결제 중지」(ops_config, migration 108) — 켜져 있으면 승인하지 않는다(= 돈이 빠져나가지 않음).
  // 표를 못 읽으면(배포 전 등) 막지 않는다 — 스위치가 없던 때와 같은 동작.
  if (await paymentsPaused()) {
    return res.status(409).json({ error: "지금은 새 결제를 잠시 멈췄어요. 잠시 후 다시 시도해 주세요.", code: "PAYMENTS_PAUSED" });
  }

  // 같은 공사 두 번 결제 막기(C17) — 공사 결제 주문번호는 gm_{요청ID}_{시각}. 그 공사에 이미 PAID 결제가 있으면
  // 토스 승인(confirm)을 하지 않는다 → 두 번째 결제는 매입되지 않는다(돈이 빠져나가지 않음).
  // 공간토큰 등 다른 주문번호는 건드리지 않는다. 조회에 실패하면 막지 않는다(예전 동작).
  const reqMatch = /^gm_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/i.exec(String(orderId));
  if (reqMatch && await alreadyPaid(reqMatch[1])) {
    return res.status(409).json({
      error: "이미 결제된 공사예요. 같은 공사를 두 번 결제할 수 없어요 — 공사 화면에서 진행 상황을 확인해 주세요.",
      code: "ALREADY_PAID",
    });
  }

  // 계약은 사업자부터(A안) — 선택된 업체의 사업자등록이 관리자 확인 전이면 승인하지 않는다 → 매입 안 됨(돈이 안 나감).
  // 결제 화면도 막지만, 화면을 거치지 않은 요청까지 여기서 막는다. 업체를 «확인 못 했다»(조회 실패)면 예전처럼 막지 않는다 —
  // «확인 안 된 업체다»라고 읽혔을 때만 막는다(설정 문제로 모든 결제가 멈추지 않게).
  if (reqMatch) {
    const company = await selectedCompanyOf(reqMatch[1]);
    if (company && !contractGate(company).ok) {
      return res.status(409).json({ error: BIZ_REQUIRED_MESSAGE, code: "BIZ_REQUIRED" });
    }
  }

  // 금액 검사 — 결제 금액이 이 공사의 계약 금액(최종 견적서, 없으면 선택한 입찰가)보다 적으면 승인하지 않는다.
  // 결제 금액은 앱이 보내는 값이라, 앱을 조작하면 240만원 공사를 1,000원에 «결제 완료»로 만들 수 있었다(총점검 09-24 6차).
  // 이용료는 결제수단마다 달라 «이상»만 본다. 금액을 못 읽으면(조회 실패) 예전처럼 막지 않는다.
  if (reqMatch) {
    const base = await contractBaseWon(reqMatch[1]);
    if (base && Number(amount) < base) {
      return res.status(409).json({ error: "결제 금액이 계약 금액과 맞지 않아요. 결제를 다시 시작해 주세요.", code: "AMOUNT_MISMATCH" });
    }
  }

  const auth = Buffer.from(`${secretKey}:`).toString("base64");
  try {
    const r = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data.message ?? "Toss confirm failed", code: data.code });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function alreadyPaid(requestId) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const r = await fetch(
      `${url}/rest/v1/payment_orders?request_id=eq.${encodeURIComponent(requestId)}&status=eq.PAID&select=id&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
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

// 요청에 선택된 업체 행(verified 만). selected_company_id 는 업체 ID 일 수도, 주인 사용자 ID 일 수도 있다.
// 못 읽으면 null(= 모름). 업체 행이 없으면 null.
async function selectedCompanyOf(requestId) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const r = await fetch(`${url}/rest/v1/requests?id=eq.${encodeURIComponent(requestId)}&select=selected_company_id&limit=1`, { headers: h });
    if (!r.ok) return null;
    const ref = (await r.json())?.[0]?.selected_company_id;
    if (!ref || !/^[0-9a-f-]{36}$/i.test(String(ref))) return null;
    const c = await fetch(`${url}/rest/v1/companies?or=(id.eq.${ref},owner_id.eq.${ref})&select=id,verified&limit=1`, { headers: h });
    if (!c.ok) return null;
    return (await c.json())?.[0] ?? null;
  } catch {
    return null;
  }
}

// 이 공사의 계약 금액(원) — 서버 함수 contract_base_price(SQL 119: 최종 견적서 총액, 없으면 선택한 입찰가, 만원).
// 못 읽으면 null(= 모름 → 막지 않음).
async function contractBaseWon(requestId) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/contract_base_price`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_request_id: requestId }),
    });
    if (!r.ok) return null;
    const n = Number(await r.json());
    if (!Number.isFinite(n) || n <= 0) return null;
    return n >= 100000 ? n : n * 10000;
  } catch {
    return null;
  }
}
