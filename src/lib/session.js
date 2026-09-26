// 로그인 토큰(서버가 서명 — api/verify-otp · src/lib/sessionToken.server.js) 을 기기에 보관하고,
// «본인 확인이 필요한 호출»에만 붙인다(총점검 09-25 · E20 · 관리자 문).
//
//   · 기존 호출(anon 키)은 그대로 둔다 — 토큰을 모든 요청에 붙이면 anon 기준으로 짜인 정책이 달리 적용돼
//     여기저기 멈출 수 있다. 토큰은 authedDb(userId) 로 만든 연결에서만 쓴다.
//   · 기기 로그인(「다시 오셨네요」)도 이 토큰을 다시 쓴다(60일). 없거나 만료면 null — 인증번호로 다시 로그인.
import { createClient } from "@supabase/supabase-js";

const KEY = "gonggan_session_tokens";   // { [userId]: token }
const TICKET_KEY = "gonggan_signup_ticket";

const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") || {}; } catch { return {}; } };

function expOf(token) {
  try {
    const b = String(token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b)).exp ?? 0;
  } catch { return 0; }
}

export function saveSessionToken(userId, token) {
  if (!userId || !token) return;
  try { const all = readAll(); all[userId] = token; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* 저장 못 해도 진행 */ }
}

export function getSessionToken(userId) {
  if (!userId) return null;
  const t = readAll()[userId];
  if (!t) return null;
  if (expOf(t) * 1000 < Date.now() + 60 * 1000) return null;   // 만료(또는 1분 안에 만료)
  return t;
}

export function clearSessionTokens() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

// 새 사용자 — 인증번호 확인 때 받은 가입 표를 잠깐 들고 있다가, 가입 뒤 토큰으로 바꾼다.
export function holdSignupTicket(ticket) {
  try { if (ticket) sessionStorage.setItem(TICKET_KEY, ticket); } catch { /* noop */ }
}

export async function exchangeSignupTicket() {
  let ticket = null;
  try { ticket = sessionStorage.getItem(TICKET_KEY); } catch { /* noop */ }
  if (!ticket) return null;
  try {
    const res = await fetch("/api/verify-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupTicket: ticket }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.user?.id && data?.token) {
      saveSessionToken(data.user.id, data.token);
      try { sessionStorage.removeItem(TICKET_KEY); } catch { /* noop */ }
      return data.token;
    }
  } catch { /* 토큰 없이도 예전처럼 동작 */ }
  return null;
}

// 토큰을 붙인 DB 연결 — 토큰이 없으면 null(부르는 쪽이 «다시 로그인» 안내)
const clients = new Map();
export function authedDb(userId) {
  const token = getSessionToken(userId);
  if (!token) return null;
  if (!clients.has(token)) {
    clients.clear();   // 토큰이 바뀌면 옛 연결은 버린다
    clients.set(token, createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      accessToken: async () => token,
    }));
  }
  return clients.get(token);
}

// 관리자 API(/api/admin/*) 등 우리 서버 호출에 붙일 헤더
export function authHeader(userId) {
  const token = getSessionToken(userId);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 지금 로그인한 사용자 — App.handleLogin 이 알려 준다(새로고침 뒤엔 저장된 세션에서 읽는다).
let currentUserId = null;
export function setCurrentUserId(id) { currentUserId = id ?? null; }
export function getCurrentUserId() {
  if (currentUserId) return currentUserId;
  try { return JSON.parse(localStorage.getItem("gonggan_user") ?? "null")?.id ?? null; } catch { return null; }
}

// 관리자만 부르는 서버 함수 — 토큰 연결로 보낸다(서버 130 이 이 이름들에 관리자 토큰을 요구한다).
//   admin_verify_operator_pin 은 운영자 로그인 자체라 빼고, 업체 신청자가 부르는 partner_lead_* 는 넣지 않는다.
const GUARDED_EXACT = new Set([
  "list_test_accounts", "partner_leads_list", "partner_lead_set_status", "partner_lead_set_archive", "partner_lead_onboarding_set",
  "set_user_operator_by_phone", "set_user_test_account_by_phone", "unset_user_operator", "unset_user_test_account",
]);
// 당사자 확인이 필요한 서버 함수 — 토큰 연결로 보낸다(서버 136 이 auth.uid() 로 고객·업체를 판정).
// + 운영 스위치·라운지 운영자 함수(138 — 예전엔 앱이 보낸 사용자 ID 를 믿었다)
const TOKEN_RPCS = new Set(["escrow_action", "phase_photos_add", "ops_config_set", "op_set_post_hot", "op_set_post_hidden",
  "lounge_post_like", "soft_delete_lounge_post"]);
export function isTokenRpc(fn) { return TOKEN_RPCS.has(String(fn || "")); }

export function isGuardedRpc(fn) {
  const f = String(fn || "");
  if (f === "admin_verify_operator_pin") return false;
  return f.startsWith("admin_") || f.startsWith("settlement_admin_") || GUARDED_EXACT.has(f);
}
