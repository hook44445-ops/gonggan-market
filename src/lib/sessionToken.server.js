// 서버 전용(api/ 에서만 import) — 브라우저 코드에서 부르지 않는다(node:crypto).
//
// 로그인 토큰(JWT, HS256) — Supabase Legacy JWT Secret(SUPABASE_JWT_SECRET)으로 서명한다.
//   PostgREST 가 이 토큰을 «로그인한 사용자»로 받아 auth.uid() = sub 가 된다.
//   → 서버 함수·정책이 «앱이 보낸 사용자 ID» 대신 «토큰의 사용자»를 믿을 수 있다(총점검 09-25 E20 · 관리자 문).
// 가입 표(signup ticket) — 인증번호 확인 직후 아직 사용자 행이 없을 때 30분짜리 표를 주고,
//   가입(signup_user_by_phone) 뒤 그 표를 내면 토큰으로 바꿔 준다(인증번호는 1회용이라 다시 못 쓴다).
import crypto from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const fromB64url = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

export const SESSION_TTL_SEC = 60 * 24 * 3600;   // 60일 — 기기 로그인(「다시 오셨네요」)이 이 토큰을 다시 쓴다
export const TICKET_TTL_SEC = 30 * 60;

export function jwtSecret() {
  return process.env.SUPABASE_JWT_SECRET || "";
}

function sign(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

export function verify(token, secret) {
  try {
    const [h, b, s] = String(token || "").split(".");
    if (!h || !b || !s || !secret) return null;
    const expect = b64url(crypto.createHmac("sha256", secret).update(`${h}.${b}`).digest());
    const a = Buffer.from(s), e = Buffer.from(expect);
    if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null;
    const header = JSON.parse(fromB64url(h).toString("utf8"));
    if (header.alg !== "HS256") return null;
    const p = JSON.parse(fromB64url(b).toString("utf8"));
    if (!p.exp || p.exp * 1000 < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

// 사용자 토큰 — PostgREST 가 받는 모양(role · aud = authenticated, sub = users.id)
export function signSession(userId, secret = jwtSecret()) {
  if (!secret || !userId) return null;
  const now = Math.floor(Date.now() / 1000);
  return sign({ aud: "authenticated", role: "authenticated", sub: String(userId), iat: now, exp: now + SESSION_TTL_SEC, iss: "gongganmarket" }, secret);
}

export function verifySession(token, secret = jwtSecret()) {
  const p = verify(token, secret);
  return p && p.aud === "authenticated" && p.sub ? p : null;
}

// 가입 표 — PostgREST 가 받지 못하게 aud 를 다르게(«signup»), role 없음
export function signTicket(phone, secret = jwtSecret()) {
  if (!secret || !phone) return null;
  const now = Math.floor(Date.now() / 1000);
  return sign({ aud: "signup", phone: String(phone), iat: now, exp: now + TICKET_TTL_SEC, iss: "gongganmarket" }, secret);
}

export function verifyTicket(token, secret = jwtSecret()) {
  const p = verify(token, secret);
  return p && p.aud === "signup" && p.phone ? p : null;
}

// Authorization: Bearer <토큰> → 사용자 ID(검증 실패면 null)
export function sessionUserId(req, secret = jwtSecret()) {
  const h = String(req?.headers?.authorization ?? req?.headers?.Authorization ?? "");
  const m = /^Bearer\s+(.+)$/i.exec(h);
  const p = m ? verifySession(m[1], secret) : null;
  return p?.sub ?? null;
}
