// ─────────────────────────────────────────────────────
// 아이폰 앱(Expo) 푸시 다리 — 순수 ESM · 의존성 0 (PLAN-2026-09-30 4절)
//   웹(lib/push.js)과 발송기(api/push/dispatch.js) 양쪽에서 import.
//
//   앱 → 웹: window.GongganApp = { push: true, platform: "ios_expo", version: 1 } (페이지가 뜨기 전)
//   웹 → 앱: ReactNativeWebView.postMessage('{"type":"gonggan:push-ask"}') («알림 켜기» 누른 순간)
//   앱 → 웹: message 이벤트 · data = 문자열 JSON
//            { type: "gonggan:push-token", token: "ExponentPushToken[…]", platform: "ios_expo" }
//            { type: "gonggan:push-denied", reason, platform: "ios_expo" } — «켜졌어요» 금지
//   서버 → Expo: POST https://exp.host/--/api/v2/push/send { to, title, body, data: { url } }
// ─────────────────────────────────────────────────────

export const NATIVE_PUSH_PLATFORM = "ios_expo";
export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export const PUSH_ASK_MESSAGE = JSON.stringify({ type: "gonggan:push-ask" });

// ExponentPushToken[…] / ExpoPushToken[…] 만 받는다(아무 문자열이나 기기 토큰으로 저장하지 않게)
export function isExpoPushToken(token) {
  return typeof token === "string" && token.length <= 200 && /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

// 아이폰 앱 안인가 — 앱이 GongganApp 을 심었고 앱으로 말을 보낼 수 있을 때만
export function hasNativePushIn(w) {
  try {
    return !!w && w.GongganApp?.push === true && typeof w.ReactNativeWebView?.postMessage === "function";
  } catch { return false; }
}

// message 이벤트의 data(문자열 JSON) → { kind: "token", token } | { kind: "denied", reason } | null
//   다른 창의 message 와 섞이니 type 이 gonggan: 으로 시작하는 것만 본다.
export function parseNativePushMessage(data) {
  if (typeof data !== "string" || data.length > 2000) return null;
  let m;
  try { m = JSON.parse(data); } catch { return null; }
  if (!m || typeof m !== "object" || typeof m.type !== "string" || !m.type.startsWith("gonggan:")) return null;
  if (m.platform !== undefined && m.platform !== NATIVE_PUSH_PLATFORM) return null;
  if (m.type === "gonggan:push-token") return isExpoPushToken(m.token) ? { kind: "token", token: m.token } : null;
  if (m.type === "gonggan:push-denied") return { kind: "denied", reason: typeof m.reason === "string" ? m.reason.slice(0, 40) : "unknown" };
  return null;
}

// 앱이 알려 준 실패 이유 → 웹 공통 이유(lib/pushAsk pushFailText 와 같은 말)
export function nativeDeniedReason(reason) {
  return reason === "denied" || reason === "not_granted" ? "permission_denied" : `native_${reason || "unknown"}`;
}

// 알림을 눌렀을 때 앱이 열 주소 — «/»로 시작하는 경로 또는 gongganmarket.com 주소만(앱도 같은 규칙으로 한 번 더 본다)
export function safeAppUrl(target) {
  const s = typeof target === "string" ? target.trim() : "";
  if (s.startsWith("/") && !s.startsWith("//") && !s.includes("\\")) return s;
  try {
    const u = new URL(s);
    if (u.protocol === "https:" && (u.hostname === "gongganmarket.com" || u.hostname.endsWith(".gongganmarket.com"))) return u.toString();
  } catch { /* 주소 아님 */ }
  return "/";
}

// push_logs 한 줄 → Expo 메시지 한 통
export function expoPushMessage(token, log = {}) {
  return {
    to: token,
    title: log.title || "공간마켓",
    body: log.body || "",
    data: { url: safeAppUrl(log.target_url) },
    sound: "default",
  };
}

// Expo 응답 → { okCount, deadTokens(기기에서 앱이 지워진 토큰 — 끄기 대상), lastErr }
//   응답 data 는 보낸 메시지 순서와 같다.
export function readExpoTickets(tokens, json) {
  const tickets = Array.isArray(json?.data) ? json.data : [];
  let okCount = 0;
  const deadTokens = [];
  let lastErr = null;
  tokens.forEach((token, i) => {
    const t = tickets[i];
    if (t?.status === "ok") { okCount++; return; }
    if (t?.details?.error === "DeviceNotRegistered") deadTokens.push(token);
    lastErr = t ? String(t.details?.error || t.message || "expo_error").slice(0, 300) : (json?.errors ? JSON.stringify(json.errors).slice(0, 300) : "expo_no_ticket");
  });
  return { okCount, deadTokens, lastErr };
}
