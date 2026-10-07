// ─────────────────────────────────────────────────────
// 공간랜드 웹 푸시(FCM) 클라이언트
//
// Firebase SDK 는 CDN 동적 import 로 로드한다(앱 번들 의존성 추가 없음).
// VITE_FIREBASE_* env 미설정 시 모든 함수가 graceful no-op → 앱 영향 없음.
// ─────────────────────────────────────────────────────

import { upsertFcmToken, deactivateFcmToken } from "./supabase";
import { getSessionToken } from "./session";
import {
  NATIVE_PUSH_PLATFORM, PUSH_ASK_MESSAGE, hasNativePushIn, parseNativePushMessage, nativeDeniedReason,
} from "./nativePush";

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
  if (hasNativePush()) return true;          // 아이폰 앱 안 — 웹 푸시 지원 여부와 따로(PLAN 4절)
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "Notification" in window
    && "PushManager" in window;
}

export function isPushConfigured() {
  return hasNativePush() || getPushConfig().ok;
}

// ── 아이폰 앱(Expo) 다리 ─────────────────────────────────────────────
//   앱이 window.GongganApp 을 심은 경우만. 토큰은 앱이 페이지가 뜰 때마다 조용히 한 번 보내 준다
//   → 로그인(토큰 연결)된 사람이면 저장. 사용자가 «끄기» 했으면 다시 켤 때까지 조용히 저장하지 않는다.
const NATIVE_OFF_KEY = "gonggan_native_push_off";
const NATIVE_WAIT_MS = 60000;               // 권한 창을 읽는 시간
const _native = { started: false, token: null, userId: null, savedKey: null, waiters: [] };

export function hasNativePush() {
  return typeof window !== "undefined" && hasNativePushIn(window);
}

// 이 기기에서 알림 권한 상태(묻기 카드용) — 앱 안은 토큰을 받았으면 허락된 것
export function pushPermission() {
  if (hasNativePush()) return _native.token ? "granted" : "default";
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

const nativeOff = () => { try { return localStorage.getItem(NATIVE_OFF_KEY) === "1"; } catch { return false; } };
const setNativeOff = (on) => { try { on ? localStorage.setItem(NATIVE_OFF_KEY, "1") : localStorage.removeItem(NATIVE_OFF_KEY); } catch { /* noop */ } };

async function saveNativeToken(userId, token) {
  const res = await upsertFcmToken({
    userId, token, platform: NATIVE_PUSH_PLATFORM,
    deviceInfo: { app: NATIVE_PUSH_PLATFORM, version: window.GongganApp?.version ?? null, ua: navigator.userAgent?.slice(0, 200) ?? null },
  });
  if (res?.error) return false;
  _native.savedKey = `${userId}:${token}`;
  try { sessionStorage.setItem("fcm_token", token); } catch { /* noop */ }
  return true;
}

function onNativeMessage(e) {
  if (e?.source && e.source !== window) return;       // 다른 창(iframe) 메시지는 안 받는다
  const msg = parseNativePushMessage(e?.data);
  if (!msg) return;
  const waiters = _native.waiters.splice(0);
  if (msg.kind === "token") {
    _native.token = msg.token;
    if (waiters.length) { waiters.forEach((w) => w({ ok: true, token: msg.token })); return; }
    // 조용한 한 번(이미 허락한 사람) — 로그인돼 있고 끄지 않았으면 저장
    const uid = _native.userId;
    if (uid && !nativeOff() && _native.savedKey !== `${uid}:${msg.token}`) saveNativeToken(uid, msg.token).catch(() => {});
    return;
  }
  waiters.forEach((w) => w({ ok: false, reason: nativeDeniedReason(msg.reason) }));
}

// 앱 시작 때 한 번 — 앱 안이 아니면 아무것도 안 한다
export function initNativePushBridge() {
  if (_native.started || !hasNativePush()) return;
  _native.started = true;
  window.addEventListener("message", onNativeMessage);
  try { document.addEventListener("message", onNativeMessage); } catch { /* noop */ }
}

// 로그인한 사람이 정해지면 — 이미 받은 토큰이 있으면 그 사람 것으로 저장(토큰 연결이 있을 때만)
export function syncNativePushToken(userId) {
  if (!hasNativePush()) return;
  initNativePushBridge();
  _native.userId = userId && getSessionToken(userId) ? userId : null;
  const { token } = _native;
  if (_native.userId && token && !nativeOff() && _native.savedKey !== `${userId}:${token}`) saveNativeToken(userId, token).catch(() => {});
}

// «알림 켜기» — 앱에 권한 창을 부탁하고 답(토큰/거절)을 기다린다. 저장까지 돼야 ok(거짓 성공 금지).
async function enableNativePush(userId) {
  initNativePushBridge();
  setNativeOff(false);
  let res;
  if (_native.token) res = { ok: true, token: _native.token };
  else {
    res = await new Promise((resolve) => {
      const done = (r) => { clearTimeout(timer); resolve(r); };
      const timer = setTimeout(() => {
        _native.waiters = _native.waiters.filter((w) => w !== done);
        resolve({ ok: false, reason: "no_token" });
      }, NATIVE_WAIT_MS);
      _native.waiters.push(done);
      try { window.ReactNativeWebView.postMessage(PUSH_ASK_MESSAGE); } catch { done({ ok: false, reason: "error" }); }
    });
  }
  if (!res.ok) return res;
  const saved = await saveNativeToken(userId, res.token).catch(() => false);
  return saved ? { ok: true, token: res.token } : { ok: false, reason: "save_failed" };
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
  if (hasNativePush()) return userId ? enableNativePush(userId) : { ok: false, reason: "no_user" };
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
  if (hasNativePush()) setNativeOff(true);    // 앱이 다음에 조용히 보내 줘도 다시 켜지 않게
  try {
    const token = sessionStorage.getItem("fcm_token") || _native.token;
    if (token) await deactivateFcmToken(token);
  } catch {}
  return { ok: true };
}

// 포그라운드 수신 콜백 등록(선택)
export async function onForegroundMessage(cb) {
  if (hasNativePush()) return () => {};
  const messaging = await initMessaging();
  if (!messaging) return () => {};
  return messaging.__onMessage(messaging, cb);
}
