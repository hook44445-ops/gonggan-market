const ACCOUNT_SID    = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN     = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SID     = process.env.TWILIO_VERIFY_SERVICE_SID;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const { phone } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: "phone is required" });

  if (!ACCOUNT_SID || !AUTH_TOKEN || !VERIFY_SID) {
    console.error("[send-otp] Missing Twilio env vars");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const url  = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`;
  const body = new URLSearchParams({ To: phone, Channel: "sms" });
  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");

  const twilioRes = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await twilioRes.json();
  if (!twilioRes.ok) {
    console.error("[send-otp] Twilio error:", json);
    return res.status(twilioRes.status).json({ error: json.message ?? "Twilio request failed" });
  }

  return res.status(200).json({ sent: true, status: json.status });
}
