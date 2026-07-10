// ════════════════════════════════════════════════════════════════════
// 공간마켓 Automation Scheduler — 예약 슬롯 분산 (Phase 32)
//
//   승인된 작업을 오늘 오전/오후/내일/다음주 슬롯으로 자동 분산한다.
//   ⚠️ 실제 발행은 하지 않는다 — 예약 시각(scheduledAt)만 배정한다(기존 발행 흐름 재사용).
//   AI 근무시간(콘텐츠 유형별 발행 시간대)도 여기서 제안한다.
//   Regression Zero: 순수 함수 · DB/Cron 없음.
// ════════════════════════════════════════════════════════════════════

// 콘텐츠 유형별 권장 근무/발행 시간대(시).
const WORK_HOURS = {
  breaking: 8, trend_present: 8, trend_past: 8, trend_future: 8, // 뉴스/트렌드 아침
  morning_brief: 7, qt: 5, astrology: 6,
  space_market: 14, magazine: 14, column: 14, // 매거진/공간 오후
  series: 17, sns: 11,
};

const at = (base, addDays, hour) => { const d = new Date(base); d.setDate(d.getDate() + addDays); d.setHours(hour, 0, 0, 0); return d; };

// 다음 예약 시각 제안 — 유형 근무시간 우선, 지났으면 다음 슬롯(오후/내일)로.
export function suggestSlot(contentType, { now = Date.now(), offsetIndex = 0 } = {}) {
  const base = new Date(now);
  const hour = WORK_HOURS[contentType] ?? 10;
  const slots = [
    at(base, 0, hour),            // 오늘 유형 근무시간
    at(base, 0, Math.max(hour, base.getHours() + 2 > 20 ? 20 : base.getHours() + 2)), // 오늘 오후/저녁
    at(base, 1, hour),            // 내일
    at(base, 7, hour),            // 다음주
  ];
  // 지난 슬롯 제외 + offsetIndex 로 분산.
  const future = slots.filter((d) => d.getTime() > now);
  const pick = (future[offsetIndex % Math.max(1, future.length)]) || at(base, 1, hour);
  return pick;
}

// 여러 작업을 슬롯에 분산 배정. jobs:[{id, draft:{contentType}}] → [{id, scheduledAt}]
export function distributeSlots(jobs, { now = Date.now() } = {}) {
  return jobs.map((j, i) => ({ id: j.id, scheduledAt: suggestSlot(j.draft?.contentType || "magazine", { now, offsetIndex: i }).toISOString() }));
}

// 사람이 읽는 슬롯 라벨.
export function slotLabel(iso, now = Date.now()) {
  if (!iso) return "-";
  const d = new Date(iso), n = new Date(now);
  const sameDay = d.toDateString() === n.toDateString();
  const tmr = new Date(n); tmr.setDate(tmr.getDate() + 1);
  const isTmr = d.toDateString() === tmr.toDateString();
  const hh = String(d.getHours()).padStart(2, "0");
  if (sameDay) return `오늘 ${hh}:00`;
  if (isTmr) return `내일 ${hh}:00`;
  return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit" });
}
