// 초대왕 이벤트(155) — 화면 안내용 계산. 순위·지급은 서버(referral_event_board · admin_referral_event_settle)가 한다.
//   대표 09-28 추천안: 2026년 10월 한 달(한국 시간) · 1~3등 공간토큰 300/200/100 · 고객·업체 모두.

export const CURRENT_EVENT = {
  id: "2026-10",
  title: "10월 초대왕",
  startsAt: "2026-10-01T00:00:00+09:00",
  endsAt: "2026-11-01T00:00:00+09:00",
  prizes: [300, 200, 100],
};

// upcoming · live · ended
export function eventStatus(ev = CURRENT_EVENT, now = Date.now()) {
  const s = Date.parse(ev.startsAt ?? ev.starts_at), e = Date.parse(ev.endsAt ?? ev.ends_at);
  if (now < s) return "upcoming";
  if (now < e) return "live";
  return "ended";
}

// 남은 날(한국 날짜 기준 D-n) — 진행 중일 때만, 마지막 날은 0
export function daysLeft(ev = CURRENT_EVENT, now = Date.now()) {
  if (eventStatus(ev, now) !== "live") return null;
  const end = Date.parse(ev.endsAt ?? ev.ends_at) - 1;
  const kstDay = (t) => Math.floor((t + 9 * 3600000) / 86400000);
  return kstDay(end) - kstDay(now);
}

export function prizeFor(rank, ev = CURRENT_EVENT) {
  const p = ev.prizes ?? [];
  return rank >= 1 && rank <= p.length ? p[rank - 1] : 0;
}

export function eventLine(ev = CURRENT_EVENT, now = Date.now()) {
  const st = eventStatus(ev, now);
  const prizes = (ev.prizes ?? []).map((p, i) => `${i + 1}등 ${p}`).join(" · ");
  if (st === "upcoming") return `10월 1일 시작 · ${prizes} 토큰`;
  if (st === "live") { const d = daysLeft(ev, now); return `${d === 0 ? "오늘 마감" : `D-${d}`} · ${prizes} 토큰`; }
  return `마감 · ${prizes} 토큰`;
}
