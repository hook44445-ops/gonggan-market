import { createClient } from "@supabase/supabase-js";

const ACCOUNT_SID    = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN     = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SID     = process.env.TWILIO_VERIFY_SERVICE_SID;
const SUPABASE_URL   = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const { phone, code } = req.body ?? {};
  if (!phone || !code) return res.status(400).json({ error: "phone and code are required" });

  if (!ACCOUNT_SID || !AUTH_TOKEN || !VERIFY_SID) {
    console.error("[verify-otp] Missing Twilio env vars");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  // 1. Verify the code with Twilio
  const url  = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`;
  const body = new URLSearchParams({ To: phone, Code: code });
  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");

  const twilioRes = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await twilioRes.json();

  if (!twilioRes.ok || json.status !== "approved") {
    console.error("[verify-otp] Twilio verification failed:", json);
    return res.status(400).json({ error: "인증번호가 올바르지 않습니다", twilioStatus: json.status });
  }

  // 2. Look up existing profile in users table
  if (!SUPABASE_URL || !SERVICE_KEY) {
    // No Supabase admin configured — just return verified: true so frontend can proceed
    return res.status(200).json({ verified: true, user: null });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error("[verify-otp] Supabase lookup error:", error.message);
    // Still return verified so frontend can proceed to profile creation
    return res.status(200).json({ verified: true, user: null });
  }

  return res.status(200).json({ verified: true, user: user ?? null });
}
