// ─────────────────────────────────────────────────────
// 공간마켓 웹 푸시(FCM) 클라이언트
//
// Firebase SDK 는 CDN 동적 import 로 로드한다(앱 번들 의존성 추가 없음).
// VITE_FIREBASE_* env 미설정 시 모든 함수가 graceful no-op → 앱 영향 없음.
// ─────────────────────────────────────────────────────

import { upsertFcmToken, deactivateFcmToken } from "./supabase";

const FB_VER = "10.12.2";

function getPushConfig() {
  const e = import.meta.env;
  const cfg = {
    apiKey:            e.VITE_FIREBASE_API_KEY,
    authDomain:        e.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         e.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             e.VITE_FIREBASE_APP_ID,
  };
  const vapidKey = e.VITE_FIREBASE_VAPID_KEY;
  const ok = !!(cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId && vapidKey);
  return { cfg, vapidKey, ok };
}

export function isPushSupported() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "Notification" in window
    && "PushManager" in window;
}

export function isPushConfigured() {
  return getPushConfig().ok;
}

let _messaging = null;

async function initMessaging() {
  if (_messaging) return _messaging;
  const { cfg, ok } = getPushConfig();
  if (!ok) return null;

  const appMod = await import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`);
  const msgMod = await import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-messaging.js`);
  const app = appMod.initializeApp(cfg);
  _messaging = msgMod.getMessaging(app);
  _messaging.__getToken = msgMod.getToken;
  _messaging.__onMessage = msgMod.onMessage;
  return _messaging;
}

async function registerSW() {
  const { cfg } = getPushConfig();
  // SW 가 자체 query string 으로 firebase config 를 읽도록 전달
  const params = new URLSearchParams({
    apiKey: cfg.apiKey ?? "",
    authDomain: cfg.authDomain ?? "",
    projectId: cfg.projectId ?? "",
    messagingSenderId: cfg.messagingSenderId ?? "",
    appId: cfg.appId ?? "",
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
}

// 사용자 동의 후 호출 — 권한 요청 + 토큰 발급 + DB 저장
export async function enablePush(userId) {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!isPushConfigured()) return { ok: false, reason: "not_configured" };
  if (!userId) return { ok: false, reason: "no_user" };

  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "permission_denied" };

    const messaging = await initMessaging();
    if (!messaging) return { ok: false, reason: "not_configured" };

    const reg = await registerSW();
    const { vapidKey } = getPushConfig();
    const token = await messaging.__getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, reason: "no_token" };

    await upsertFcmToken({
      userId,
      token,
      platform: "web",
      deviceInfo: { ua: navigator.userAgent?.slice(0, 200) ?? null },
    });
    try { sessionStorage.setItem("fcm_token", token); } catch {}
    return { ok: true, token };
  } catch (err) {
    return { ok: false, reason: "error", message: err?.message ?? String(err) };
  }
}

// 현재 기기 토큰 비활성화
export async function disablePush() {
  try {
    const token = sessionStorage.getItem("fcm_token");
    if (token) await deactivateFcmToken(token);
  } catch {}
  return { ok: true };
}

// 포그라운드 수신 콜백 등록(선택)
export async function onForegroundMessage(cb) {
  const messaging = await initMessaging();
  if (!messaging) return () => {};
  return messaging.__onMessage(messaging, cb);
}
