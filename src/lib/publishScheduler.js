// ════════════════════════════════════════════════════════════════════
// 공간마켓 Publish Scheduler — 편성 시간 기반 예약 (Phase 35)
//   승인된 발행 작업을 콘텐츠 타입의 편성 시간(큐티 05·운세 06·Morning Brief 07·긴급 수시 등)에
//   맞춰 예약(scheduledAt)한다. 실제 발행은 Publish Worker 가 시각 도래 시 수행.
//   ⚠️ 순수 함수 · DB/Cron 없음. Regression Zero.
// ════════════════════════════════════════════════════════════════════

// 콘텐츠 타입별 발행 시각(시). 긴급은 즉시(+5분).
const PUBLISH_HOUR = {
  qt: 5, astrology: 6, morning_brief: 7,
  space_market: 14, trend_past: 14, trend_present: 14, trend_future: 14,
  series: 19, breaking: null, // 수시(즉시)
};

// 다음 발행 시각 제안. breaking=즉시(+5분), 그 외=오늘 해당 시(지났으면 내일).
export function schedulePublishAt(contentType, { now = Date.now() } = {}) {
  const hour = PUBLISH_HOUR[contentType];
  if (hour == null) return new Date(now + 5 * 60 * 1000); // 긴급 즉시
  const d = new Date(now); d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1); // 지난 시각이면 내일
  return d;
}

// 예약 시각이 도래한 작업들.
export function dueJobs(jobs, now = Date.now()) {
  return jobs.filter((j) => j.status === "scheduled" && j.scheduledAt && new Date(j.scheduledAt).getTime() <= now);
}

// 사람이 읽는 라벨.
export function pubSlotLabel(iso, now = Date.now()) {
  if (!iso) return "-";
  const d = new Date(iso), n = new Date(now);
  const same = d.toDateString() === n.toDateString();
  const tmr = new Date(n); tmr.setDate(tmr.getDate() + 1);
  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  if (same) return `오늘 ${hh}:${mm}`;
  if (d.toDateString() === tmr.toDateString()) return `내일 ${hh}:${mm}`;
  return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
