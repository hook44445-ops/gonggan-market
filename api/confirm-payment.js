export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { paymentKey, orderId, amount } = req.body ?? {};
  if (!paymentKey || !orderId || !amount) return res.status(400).json({ error: "Missing required fields" });

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
