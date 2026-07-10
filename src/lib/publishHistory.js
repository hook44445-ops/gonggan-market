// ════════════════════════════════════════════════════════════════════
// 공간마켓 Publish History — 발행 이력/통계 (Phase 35)
//   예약/발행/실패/재시도/완료 이벤트를 기록하고 오늘/이번주/이번달로 집계한다.
//   ⚠️ localStorage · DB 없음. Regression Zero.
// ════════════════════════════════════════════════════════════════════

const KEY = "space_publish_history_v1";
const CAP = 300;

export function getPublishLog() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export function appendPublishEvent(entry) {
  const rec = { at: Date.now(), ...entry };
  try { localStorage.setItem(KEY, JSON.stringify([rec, ...getPublishLog()].slice(0, CAP))); } catch {}
  return rec;
}

const within = (ts, ms, now) => ts && now - ts <= ms;
const isToday = (ts, now) => ts && new Date(ts).toDateString() === new Date(now).toDateString();

export function publishHistoryStats(now = Date.now()) {
  const log = getPublishLog();
  const pub = log.filter((e) => e.status === "published");
  return {
    today: pub.filter((e) => isToday(e.at, now)).length,
    week: pub.filter((e) => within(e.at, 7 * 864e5, now)).length,
    month: pub.filter((e) => within(e.at, 30 * 864e5, now)).length,
    failures: log.filter((e) => e.status === "failed" && isToday(e.at, now)).length,
    retries: log.filter((e) => e.status === "retry").length,
  };
}
