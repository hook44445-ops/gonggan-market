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

  // 국내 휴대폰 번호만 — 해외 문자는 요금이 크고 이 서비스는 국내 번호로만 가입한다.
  if (!/^\+8210\d{7,8}$/.test(String(phone))) return res.status(400).json({ error: "휴대폰 번호(010)를 확인해 주세요" });

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 발송 제한(대표 09-25 「인증번호 여러 번 계속 받으면 돈 나가」 · SQL 132) — 번호당 60초 1번 · 24시간 5번,
  // 접속 주소당 1시간 10번. 기록 표를 못 읽으면(132 실행 전) 예전처럼 막지 않는다.
  const ip = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  const since = (ms) => new Date(Date.now() - ms).toISOString();
  const countSince = async (col, val, ms) => {
    const { count, error } = await db.from("otp_send_log").select("id", { count: "exact", head: true }).eq(col, val).gte("sent_at", since(ms));
    return error ? null : (count ?? 0);
  };
  const lastMin = await countSince("phone", phone, 60 * 1000);
  if (lastMin != null && lastMin >= 1) return res.status(429).json({ error: "인증번호를 방금 보냈어요. 1분 뒤에 다시 요청해 주세요" });
  const lastDay = await countSince("phone", phone, 24 * 3600 * 1000);
  if (lastDay != null && lastDay >= 5) return res.status(429).json({ error: "오늘 인증번호를 너무 많이 요청했어요. 내일 다시 시도하거나 고객센터(070-7954-2740)로 연락해 주세요" });
  const ipHour = await countSince("ip", ip, 3600 * 1000);
  if (ipHour != null && ipHour >= 10) return res.status(429).json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요" });

  // 6자리 인증번호 생성(000000~999999, 앞자리 0 보존)
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");

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

  // 발송 기록(제한 계산용) — 실패해도 발송은 이미 끝났다
  try {
    await db.from("otp_send_log").insert({ ip, phone });
    if (Math.random() < 0.05) await db.rpc("otp_send_log_prune");
  } catch { /* noop */ }

  return res.status(200).json({ sent: true });
}
