import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

// OTP 검증 — Solapi 전환에 따라 코드 검증을 서버에서 직접 수행(구 Twilio Verify 대체).
// otp_codes 에 저장된 해시와 비교(만료/시도제한 포함) 후, 성공 시 기존 users 조회
// 로직을 그대로 유지한다. 클라이언트 계약은 기존과 동일:
//   입력 { phone(E.164), code } → 출력 { verified: true, user: <users row | null> }.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_ATTEMPTS = 5;

function hashCode(phone, code) {
  return crypto.createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const { phone, code } = req.body ?? {};
  if (!phone || !code) return res.status(400).json({ error: "phone and code are required" });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[verify-otp] Missing Supabase env vars");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1. 저장된 OTP 조회
  const { data: row, error: selErr } = await db
    .from("otp_codes")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (selErr) {
    console.error("[verify-otp] otp lookup error:", selErr.message);
    return res.status(500).json({ error: "인증에 실패했습니다" });
  }
  if (!row) {
    return res.status(400).json({ error: "인증번호를 다시 요청해주세요" });
  }

  // 만료 확인
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.from("otp_codes").delete().eq("phone", phone);
    return res.status(400).json({ error: "인증번호가 만료되었습니다. 다시 요청해주세요" });
  }
  // 시도 횟수 제한
  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
    await db.from("otp_codes").delete().eq("phone", phone);
    return res.status(429).json({ error: "시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요" });
  }
  // 코드 일치 확인
  if (hashCode(phone, String(code)) !== row.code_hash) {
    await db.from("otp_codes").update({ attempts: (row.attempts ?? 0) + 1 }).eq("phone", phone);
    return res.status(400).json({ error: "인증번호가 올바르지 않습니다" });
  }

  // 검증 성공 — 코드 소비(1회용)
  await db.from("otp_codes").delete().eq("phone", phone);

  // 2. 기존 users 조회 로직 유지(응답 계약 동일)
  const { data: user, error } = await db
    .from("users")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error("[verify-otp] Supabase lookup error:", error.message);
    // 조회 실패해도 인증 자체는 성공 — 프론트가 신규 가입 흐름으로 진행
    return res.status(200).json({ verified: true, user: null });
  }

  return res.status(200).json({ verified: true, user: user ?? null });
}
