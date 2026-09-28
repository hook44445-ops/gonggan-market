// 스토어 별점 요청 — 다운로드 순위에 가장 크게 작용하는 건 별점 수와 평점이다(대표 09-28 「1등 다운로드 앱」).
//   좋은 순간(고객이 후기에 별 4~5개를 준 직후)에만 한 번 묻는다. 불만인 사람에게는 묻지 않는다.
//   스토어 주소가 아직 없으면(심사 전 · 비공개 테스트) 아무것도 보이지 않는다 — 켜는 건 Vercel 환경변수:
//     VITE_APP_STORE_ID   = App Store 앱 번호(숫자, App Store Connect › 앱 정보 › Apple ID)
//     VITE_PLAY_PUBLIC    = "1"  (Play 정식 출시 뒤 — 비공개 테스트 중엔 별점을 남길 수 없다)
//   브라우저용 공개 값이라 VITE_ 로 둬도 된다(비밀 아님).

export const PLAY_PACKAGE = "com.gonggansai.gongganmarket";
const KEY = "gonggan_store_rating_asks";           // [시각, …]
const MIN_GAP_MS = 90 * 24 * 60 * 60 * 1000;       // 한 번 물으면 90일은 다시 묻지 않는다
const MAX_ASKS = 3;

// 어느 스토어 앱 안에서 열렸나 — iOS 쉘(Expo WebView)·아이폰 브라우저는 ios, 안드로이드는 android, 그 밖은 null
export function detectPlatform(ua = "", referrer = "") {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua) || String(referrer).startsWith("android-app://")) return "android";
  return null;
}

// 별점 남기는 곳 — 없으면 null(요청을 띄우지 않는다)
export function storeReviewUrl(platform, { appStoreId = "", playPublic = false } = {}) {
  if (platform === "ios") {
    const id = String(appStoreId ?? "").replace(/\D/g, "");
    return id ? `https://apps.apple.com/app/id${id}?action=write-review` : null;
  }
  if (platform === "android") {
    return playPublic ? `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&showAllReviews=true` : null;
  }
  return null;
}

// 지금 물어도 되나 — 별 4개 이상 · 주소 있음 · 90일 간격 · 평생 3번까지
export function shouldAskRating({ rating, url, asks = [], now = Date.now() }) {
  if (!url || !(Number(rating) >= 4)) return false;
  const list = (Array.isArray(asks) ? asks : []).map(Number).filter(Number.isFinite);
  if (list.length >= MAX_ASKS) return false;
  const last = list.length ? Math.max(...list) : 0;
  return now - last >= MIN_GAP_MS;
}

export function readAsks() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function recordAsk(now = Date.now()) {
  try { localStorage.setItem(KEY, JSON.stringify([...readAsks(), now].slice(-MAX_ASKS))); } catch { /* noop */ }
}

// 화면이 부르는 한 줄 — 이 기기·이 순간에 띄울 주소(없으면 null)
export function ratingUrlFor(rating, env = {}) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ref = typeof document !== "undefined" ? document.referrer : "";
  const url = storeReviewUrl(detectPlatform(ua, ref), env);
  return shouldAskRating({ rating, url, asks: readAsks() }) ? url : null;
}
