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
