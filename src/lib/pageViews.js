// 내 업체 페이지 방문 수(156) — 같은 기기는 하루 한 번, 업체 주인이 자기 페이지를 연 건 세지 않는다.
const key = (companyId) => `gonggan_pv:${companyId}`;

// 한국 날짜(YYYY-MM-DD)
export function kstDay(now = Date.now()) {
  return new Date(now + 9 * 3600000).toISOString().slice(0, 10);
}

export function shouldCountView({ companyId, ownerId = null, viewerId = null, lastDay = null, now = Date.now() }) {
  if (!companyId) return false;
  if (ownerId && viewerId && ownerId === viewerId) return false;
  return lastDay !== kstDay(now);
}

export function lastCountedDay(companyId) {
  try { return localStorage.getItem(key(companyId)); } catch { return null; }
}
export function markViewCounted(companyId, now = Date.now()) {
  try { localStorage.setItem(key(companyId), kstDay(now)); } catch { /* noop */ }
}

// 마이페이지 한 줄 — SQL 전이거나 실패하면 null(원래 문구)
export function statsLine(s) {
  if (!s?.ok) return null;
  const week = Number(s.week) || 0, total = Number(s.total) || 0;
  if (total === 0) return "아직 방문이 없어요 · 명함 QR·카톡으로 알려 보세요";
  return `이번 주 방문 ${week}명 · 누적 ${total}명`;
}
