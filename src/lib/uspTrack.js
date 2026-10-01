// USP «사용» 남기기 — 화면에서만 일어나는 것(비교표·시세를 봄 · 공유)만. activity_logs 는 원래 누구나 쓰기(180).
//   같은 USP·대상·날짜는 한 번만 · 실패해도 화면은 그대로(기록 보조).
import { logActivity } from "./supabase";
import { getCurrentUserId } from "./session";
import { uspDedupKey, uspAction, TRACKED_USPS } from "./uspBoard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function trackUsp(uspId, { targetId = null, targetType = null, role = null, meta = {} } = {}) {
  try {
    if (!TRACKED_USPS.includes(Number(uspId))) return;
    const tid = targetId && UUID.test(String(targetId)) ? String(targetId) : null;
    const key = uspDedupKey(uspId, tid ?? meta?.kind ?? null);
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* 저장소 없음 — 그래도 남긴다 */ }
    const r = ["consumer", "company", "admin"].includes(role) ? role : null;
    logActivity({
      userId: getCurrentUserId() ?? null, role: r, action: uspAction(uspId),
      targetType: tid ? (targetType ?? "request") : null, targetId: tid, metadata: { usp: Number(uspId), ...meta },
    }).catch(() => {});
  } catch { /* 기록 보조 — 무시 */ }
}
