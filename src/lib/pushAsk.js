// 견적 요청 직후 «🔔 견적이 오면 폰으로 알려 드릴까요?» — 재방문 알림은 푸시를 켠 사람에게만 폰으로 간다.
//   물어볼 때: 이 기기가 푸시를 받을 수 있고(웹 푸시 · 안드로이드 앱 · 아이폰은 앱이 GongganApp 을 심은 빌드만 — lib/push hasNativePush) · 아직 묻지 않았고(permission=default)
//   · 최근 14일 안에 이 화면에서 물은 적이 없을 때. 거절(denied)이면 브라우저가 다시 못 묻는다 — 안 보인다.
const KEY = "gonggan_push_ask_at";
const DAY = 86400000;

export function shouldAskPush({ supported, configured, permission, iosShell = false, lastAskedAt = 0, now = Date.now() } = {}) {
  if (!supported || !configured || iosShell) return false;
  if (permission !== "default") return false;
  return !(Number(lastAskedAt) > 0 && now - Number(lastAskedAt) < 14 * DAY);
}

export const lastPushAsk = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
export const markPushAsk = (now = Date.now()) => { try { localStorage.setItem(KEY, String(now)); } catch { /* noop */ } };

// 켜면 같이 켜는 것 — 내 요청·대화·계약 소식(광고 아님). 광고(push_marketing)는 따로 동의(157).
export const PUSH_ON_PREFS = { push_enabled: true, push_estimate_news: true, push_chat: true, push_escrow: true };

export function pushFailText(reason) {
  if (reason === "permission_denied") return "알림이 막혀 있어요 · 폰 설정 › 알림에서 공간마켓(또는 브라우저)을 켜 주세요";
  return "지금은 켤 수 없어요 · 마이 › 푸시 알림에서 다시 켤 수 있어요";
}
