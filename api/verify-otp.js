import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { signSession, signTicket, verifyTicket } from "../src/lib/sessionToken.server.js";

// 번호 확인 — 두 갈래.
//
// ① 문자 인증(OTP) — Solapi 전환에 따라 코드 검증을 서버에서 직접 수행(구 Twilio Verify 대체).
//    otp_codes 에 저장된 해시와 비교(만료/시도제한 포함) 후, 성공 시 기존 users 조회.
//    입력 { phone(E.164), code } → 출력 { verified: true, user: <users row | null> }.
//
// ② 휴대폰 본인인증(포트원 · PASS/통신사 실명 확인) — 번호 소유 + 실명을 한 번에 확인한다.
//    업체 가입·로그인은 문자 대신 이 길을 탄다(대표: 「업체는 본인인증이 빠르게」).
//    입력 { identityVerificationId, userId? } → 출력 { verified: true, via: "identity",
//                                                       user: <row | null>, phone, name }
//    · 앱이 보낸 값은 믿지 않는다 — 포트원 API 로 결과를 «다시 조회»해 VERIFIED 인지 본다.
//    · 1회용: identity_verification_log(마이그레이션 102)에 이미 있는 건이면 거절한다.
//    · 30분이 지난 인증은 받지 않는다(가로챈 건 재사용 방지).
//    · userId 가 오면(마이페이지 인증) 그 사용자의 번호와 인증된 번호가 같아야 한다.
//    · 인증 완료 표시는 서버(서비스 롤)만 한다. 새 사용자는 가입 서버 함수가 방금 인증한
//      번호를 보고 표시한다(102). 포트원 비밀키는 환경변수 PORTONE_API_SECRET 로만 읽는다.
//    · 서버리스 함수가 12개 한도라 새 파일 대신 여기에 얹었다.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_ATTEMPTS = 5;
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
const IDENTITY_MAX_AGE_MS = 30 * 60 * 1000;

// 010-1234-5678 / 01012345678 / +821012345678 → +821012345678
function toE164KR(p) {
  const d = String(p ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("82")) return "+" + d;
  if (d.startsWith("0"))  return "+82" + d.slice(1);
  return "+82" + d;
}

async function verifyIdentity(db, req, res) {
  const { identityVerificationId, userId } = req.body ?? {};
  const id = String(identityVerificationId ?? "").trim();
  if (!id || id.length > 200) return res.status(400).json({ error: "본인인증 정보가 없습니다" });
  if (!PORTONE_API_SECRET) {
    console.error("[verify-otp/identity] PORTONE_API_SECRET 없음");
    return res.status(503).json({ error: "본인인증이 아직 준비되지 않았습니다" });
  }

  // 1회용 — 이미 쓴 인증 건이면 거절(102 미적용이면 조회가 실패하므로 시간창만으로 막는다)
  const { data: used, error: usedErr } = await db
    .from("identity_verification_log").select("id").eq("id", id).maybeSingle();
  if (!usedErr && used) return res.status(409).json({ error: "이미 사용한 본인인증입니다. 다시 인증해 주세요" });

  // 포트원에 결과를 다시 묻는다 — 앱이 보낸 값은 믿지 않는다
  let iv = null;
  try {
    const r = await fetch(`https://api.portone.io/identity-verifications/${encodeURIComponent(id)}`, {
      headers: { Authorization: `PortOne ${PORTONE_API_SECRET}` },
    });
    if (r.ok) iv = await r.json();
    else console.error("[verify-otp/identity] portone", r.status);
  } catch (e) {
    console.error("[verify-otp/identity] portone fetch", e?.message);
  }
  if (!iv || iv.status !== "VERIFIED") {
    return res.status(400).json({ error: "본인인증이 완료되지 않았습니다" });
  }
  const verifiedAt = Date.parse(iv.verifiedAt ?? iv.statusChangedAt ?? iv.updatedAt ?? "") || Date.now();
  if (Date.now() - verifiedAt > IDENTITY_MAX_AGE_MS) {
    return res.status(400).json({ error: "본인인증 시간이 지났습니다. 다시 인증해 주세요" });
  }
  const vc = iv.verifiedCustomer ?? {};
  const phone = toE164KR(vc.phoneNumber);
  const name = String(vc.name ?? "").trim();
  if (!phone) return res.status(400).json({ error: "인증된 휴대폰 번호를 받지 못했습니다" });

  // 기록(1회용 표시) — 102 미적용이면 실패해도 진행
  const { error: logErr } = await db.from("identity_verification_log").insert({
    id, phone, verified_at: new Date(verifiedAt).toISOString(), provider: "portone",
  });
  if (logErr && /duplicate|unique/i.test(logErr.message ?? "")) {
    return res.status(409).json({ error: "이미 사용한 본인인증입니다. 다시 인증해 주세요" });
  }

  // 사용자 찾기 — 마이페이지 인증(userId)이면 그 사용자, 아니면 번호로
  let user = null;
  if (userId) {
    const { data } = await db.from("users").select("*").eq("id", userId).maybeSingle();
    if (!data) return res.status(404).json({ error: "사용자를 찾지 못했습니다" });
    if (toE164KR(data.phone) !== phone) {
      return res.status(403).json({ error: "가입한 번호와 본인인증한 번호가 다릅니다" });
    }
    user = data;
  } else {
    const { data } = await db.from("users").select("*").eq("phone", phone).maybeSingle();
    user = data ?? null;
  }

  // 이미 있는 사용자면 서버가 인증 완료로 표시한다(새 사용자는 가입 서버 함수가 표시 — 102)
  if (user?.id) {
    const { data: updated } = await db.from("users").update({
      is_identity_verified: true,
      identity_verified_at: new Date(verifiedAt).toISOString(),
      identity_provider: "portone",
      identity_verification_status: "verified",
    }).eq("id", user.id).select("*").maybeSingle();
    if (updated) user = updated;
    await db.from("identity_verification_log").update({ user_id: user.id }).eq("id", id);
  }

  return res.status(200).json({ verified: true, via: "identity", user, phone, name,
    token: user?.id ? signSession(user.id) : null, signupTicket: user?.id ? null : signTicket(phone) });
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

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[verify-otp] Missing Supabase env vars");
    return res.status(500).json({ error: "Server misconfiguration" });
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ② 휴대폰 본인인증 갈래
  if (req.body?.identityVerificationId) return verifyIdentity(db, req, res);

  // ③ 가입 표 → 로그인 토큰(인증번호 확인 뒤 가입한 새 사용자). 인증번호는 1회용이라 가입 뒤엔 이 표로 토큰을 받는다.
  if (req.body?.signupTicket) {
    const t = verifyTicket(req.body.signupTicket);
    if (!t) return res.status(401).json({ error: "가입 확인이 만료됐어요. 다시 인증해 주세요" });
    const { data: u } = await db.from("users").select("*").eq("phone", t.phone).maybeSingle();
    if (!u?.id) return res.status(404).json({ error: "가입한 사용자를 찾지 못했어요" });
    return res.status(200).json({ verified: true, user: u, token: signSession(u.id) });
  }

  // ① 문자 인증 갈래
  const { phone, code } = req.body ?? {};
  if (!phone || !code) return res.status(400).json({ error: "phone and code are required" });

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
    return res.status(200).json({ verified: true, user: null, signupTicket: signTicket(phone) });
  }

  // 로그인 토큰(SUPABASE_JWT_SECRET 이 없으면 null — 예전과 같은 동작). 새 사용자면 가입 표.
  return res.status(200).json({
    verified: true, user: user ?? null,
    token: user?.id ? signSession(user.id) : null,
    signupTicket: user?.id ? null : signTicket(phone),
  });
}
