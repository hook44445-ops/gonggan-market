// 웹 방문자 → 앱 설치(대표 09-28 「1등 다운로드 앱」). 라운지 글이 검색으로 웹 방문자를 데려오는데,
// 설치로 이어지는 입구가 없었다.
//   · 아이폰 사파리: Apple 스마트 앱 배너(<meta name="apple-itunes-app">) — VITE_APP_STORE_ID 가 있을 때만.
//     앱 안(WKWebView)에서는 사파리가 아니라 저절로 안 보인다.
//   · 안드로이드 브라우저: 화면 위 얇은 띠 «앱으로 보기». 비공개 테스트 중엔 /download(참여 안내),
//     VITE_PLAY_PUBLIC=1 이면 Play 스토어로. 앱(TWA) 안에서는 보이지 않는다.
//   · 닫으면 14일 동안 다시 안 보인다.
import { PLAY_PACKAGE } from "./storeRating.js";

const IN_APP_KEY = "gonggan_in_app";
const DISMISS_KEY = "gonggan_install_banner_closed";
const QUIET_MS = 14 * 24 * 60 * 60 * 1000;

// 앱 안에서 열렸나 — TWA 는 첫 화면에만 referrer(android-app://)가 붙으니, 한 번 보이면 기기에 기억한다.
export function isInApp({ referrer = "", standalone = false, remembered = false } = {}) {
  return remembered || standalone || String(referrer).startsWith("android-app://");
}

export function androidInstallUrl(playPublic = false) {
  return playPublic ? `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}` : "/download";
}

// 띠를 보일까 — 안드로이드 브라우저 · 앱 밖 · 최근 14일 안에 닫지 않음 · /download 자체가 아님
export function shouldShowAndroidBanner({ ua = "", inApp = false, closedAt = 0, now = Date.now(), path = "/" }) {
  if (!/Android/i.test(ua) || inApp) return false;
  if (/^\/(download|testers)\b/.test(path)) return false;
  return !(now - Number(closedAt || 0) < QUIET_MS);
}

// 견적 요청 직후 «앱으로 알림 받기»(09-28) — 웹에서 요청한 사람은 견적 도착 알림이 필요한 순간이라 설치 전환이 가장 높다.
// 앱 안이면 null. 아이폰은 App Store 번호가 있을 때만, 안드로이드는 비공개 테스트 중엔 /download.
export function installOfferAfterRequest({ ua = "", inApp = false, appStoreId = "", playPublic = false } = {}) {
  if (inApp) return null;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const id = String(appStoreId ?? "").replace(/\D/g, "");
    return id ? { url: `https://apps.apple.com/app/id${id}`, store: "App Store" } : null;
  }
  if (/Android/i.test(ua)) return { url: androidInstallUrl(playPublic), store: playPublic ? "Google Play" : "테스트 앱" };
  return null;
}

// 아이폰 스마트 앱 배너 메타 내용 — 번호가 없으면 null
export function smartBannerContent(appStoreId, url = "") {
  const id = String(appStoreId ?? "").replace(/\D/g, "");
  if (!id) return null;
  return url ? `app-id=${id}, app-argument=${url}` : `app-id=${id}`;
}

// ── 브라우저에서만 쓰는 저장 ──
const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* noop */ } };

export function detectAndRememberInApp() {
  const remembered = safeGet(IN_APP_KEY) === "1";
  let standalone = false;
  try { standalone = window.matchMedia?.("(display-mode: standalone)")?.matches === true || window.navigator.standalone === true; } catch { /* noop */ }
  // iOS 쉘(Expo · react-native-webview)은 window.ReactNativeWebView 를 심는다 — 사파리가 아니라 앱 안
  let rnShell = false;
  try { rnShell = typeof window.ReactNativeWebView !== "undefined"; } catch { /* noop */ }
  const inApp = rnShell || isInApp({ referrer: document.referrer, standalone, remembered });
  if (inApp && !remembered) safeSet(IN_APP_KEY, "1");
  return inApp;
}
export const closedAt = () => Number(safeGet(DISMISS_KEY) || 0);
export const closeBanner = (now = Date.now()) => safeSet(DISMISS_KEY, String(now));
