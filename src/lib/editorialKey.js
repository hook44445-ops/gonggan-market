// ════════════════════════════════════════════════════════════════════
// 공간라운지 Editorial Key — 편성 중복 키 · KST 날짜 (Phase 46)
//
//   같은 편성이 여러 번 생성/예약되는 것을 막기 위한 결정론적 키를 만든다.
//     기본 키 = content_type + editorial_date_kst + normalized_title + schedule_slot
//     추가 비교 = body_hash · source_type · scheduled_at
//   날짜형 콘텐츠의 제목/편성일은 반드시 Asia/Seoul(KST) 날짜를 기준으로 한다.
//   ⚠️ 순수 함수 · DB/Cron/localStorage 없음. Regression Zero.
// ════════════════════════════════════════════════════════════════════

const KST_OFFSET_MS = 9 * 3600 * 1000;
const pad = (n) => String(n).padStart(2, "0");

// KST 날짜(YYYY-MM-DD) — 발행 예정 시각 기준. scheduledAt 있으면 그 날짜, 없으면 now.
export function editorialDateKST(ref = Date.now()) {
  const ms = typeof ref === "string" ? Date.parse(ref) : ref;
  const d = new Date((Number.isFinite(ms) ? ms : Date.now()) + KST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// 제목 정규화 — 공백/기호/날짜 토큰 제거 후 소문자.
export function normalizeTitle(title = "") {
  return String(title)
    .replace(/\d{4}[-.\s년]*\d{1,2}[-.\s월]*\d{1,2}\s*일?/g, " ") // 날짜 토큰 제거(같은 편성 판정)
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim()
    .toLowerCase()
    .slice(0, 80);
}

// 편성 슬롯(콘텐츠 타입별 발행 시각 라벨) — publishScheduler PUBLISH_HOUR 과 동일 개념.
const SLOT_HOUR = { qt: 5, astrology: 6, morning_brief: 7, space_market: 14, trend_past: 14, trend_present: 14, trend_future: 14, series: 19, breaking: -1 };
export function scheduleSlot(contentType, scheduledAt = null) {
  if (scheduledAt) { const d = new Date(Date.parse(scheduledAt) + KST_OFFSET_MS); return pad(d.getUTCHours()); }
  const h = SLOT_HOUR[contentType];
  return h == null ? "xx" : h < 0 ? "now" : pad(h);
}

// 경량 body 해시(FNV-1a 32bit hex) — 동일 본문 판정.
export function bodyHash(body = "") {
  const s = String(body).replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// 편성 키. rec: { content_type|contentType, title, scheduled_at|scheduledAt, editorial_date, created_at }
export function editorialKey(rec = {}) {
  const type = rec.content_type || rec.contentType || "general";
  const sAt = rec.scheduled_at || rec.scheduledAt || null;
  const date = rec.editorial_date || editorialDateKST(sAt || rec.created_at || Date.now());
  const slot = scheduleSlot(type, sAt);
  return `${type}|${date}|${normalizeTitle(rec.title)}|${slot}`;
}

// 같은 편성 키가 활성 상태로 이미 존재하는가(draft~published).
const ACTIVE = new Set(["draft", "review", "approved", "scheduled", "publishing", "published"]);
export function findDuplicate(rec, existing = []) {
  const key = editorialKey(rec);
  const bh = bodyHash(rec.content ?? rec.body ?? "");
  return existing.find((e) => {
    if (e.id != null && rec.id != null && e.id === rec.id) return false;
    const st = e.publish_status || "draft";
    if (!ACTIVE.has(st)) return false;
    if (editorialKey(e) === key) return true;                       // 편성 키 일치
    if (bh && (e.content || e.body) && bodyHash(e.content ?? e.body) === bh) return true; // 본문 동일
    return false;
  }) || null;
}

// 대표본 우선순위 — 보존 대상 1건 선택(㉓).
const STATUS_RANK = { published: 6, publishing: 5, scheduled: 4, approved: 3, review: 2, draft: 1, failed: 0 };
export function pickRepresentative(records = []) {
  return [...records].sort((a, b) => {
    const sr = (STATUS_RANK[b.publish_status] ?? 0) - (STATUS_RANK[a.publish_status] ?? 0);
    if (sr) return sr;
    const url = (b.published_url ? 1 : 0) - (a.published_url ? 1 : 0);
    if (url) return url;
    return Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0);
  })[0] || null;
}
