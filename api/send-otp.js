import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { SolapiMessageService } from "solapi";

// OTP 발송 — Solapi SMS 사용(구 Twilio Verify 대체).
// Solapi 는 SMS 발송만 제공하므로 코드 생성·저장(만료/시도제한)·검증을 서버가
// 직접 수행한다. 본 핸들러는 6자리 코드를 생성→otp_codes 에 해시 저장→Solapi 로
// 발송한다. 클라이언트 계약은 기존과 동일: 입력 { phone(E.164) } → 출력 { sent: true }.

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOLAPI_KEY    = process.env.SOLAPI_API_KEY;
const SOLAPI_SECRET = process.env.SOLAPI_API_SECRET;
const SOLAPI_SENDER = process.env.SOLAPI_SENDER;

const OTP_TTL_SEC = 180; // 3분

// E.164(+82...) → 국내 형식(0...). Solapi 는 국내 번호 형식을 사용한다.
function toKoreanLocal(phone) {
  const p = String(phone).trim();
  if (p.startsWith("+82")) return "0" + p.slice(3).replace(/[^0-9]/g, "");
  return p.replace(/[^0-9]/g, "");
}
function hashCode(phone, code) {
  return crypto.createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const { phone } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: "phone is required" });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[send-otp] Missing Supabase env vars");
    return res.status(500).json({ error: "Server misconfiguration" });
  }
  if (!SOLAPI_KEY || !SOLAPI_SECRET || !SOLAPI_SENDER) {
    console.error("[send-otp] Missing Solapi env vars");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  // 6자리 인증번호 생성(000000~999999, 앞자리 0 보존)
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 전화번호당 1개의 활성 코드 — 재전송 시 갱신(upsert)
  const { error: upsertErr } = await db
    .from("otp_codes")
    .upsert(
      {
        phone,
        code_hash:  hashCode(phone, code),
        expires_at: new Date(Date.now() + OTP_TTL_SEC * 1000).toISOString(),
        attempts:   0,
        created_at: new Date().toISOString(),
      },
      { onConflict: "phone" }
    );

  if (upsertErr) {
    console.error("[send-otp] otp store error:", upsertErr.message);
    return res.status(500).json({ error: "인증번호 발송에 실패했습니다" });
  }

  // Solapi 로 SMS 발송(국내 번호 형식으로 변환)
  try {
    const messageService = new SolapiMessageService(SOLAPI_KEY, SOLAPI_SECRET);
    await messageService.send({
      to:   toKoreanLocal(phone),
      from: SOLAPI_SENDER,
      text: `[공간마켓] 인증번호 ${code}를 입력해주세요.`,
    });
  } catch (err) {
    console.error("[send-otp] Solapi send error:", err?.message || err);
    return res.status(502).json({ error: "인증번호 발송에 실패했습니다" });
  }

  return res.status(200).json({ sent: true });
}
