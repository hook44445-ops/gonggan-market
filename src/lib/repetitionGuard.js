// ════════════════════════════════════════════════════════════════════
// 공간라운지 Repetition Guard — 반복 주제 차단 (Phase 59 §3)
//
//   최근 DB(draft/review/approved/scheduled/publishing/published) 전체와 후보를 비교해
//   "제목만 바꾼 유사 기사·같은 주제·본문/결론 재사용"을 차단한다.
//   비교: normalized_title · core_topic · primary_entity · editorial_date · body hash · 본문 유사도.
//   특정 엔티티(기업/인물/키워드)가 하루 전체의 10% 초과 시 집중 경고.
//
//   ⚠️ 신규 순수 함수 · DB/Schema/Executor 무변경. editorialKey(normalizeTitle/bodyHash) 재사용.
// ════════════════════════════════════════════════════════════════════

import { normalizeTitle, bodyHash, editorialDateKST } from "./editorialKey.js";

const ACTIVE = new Set(["draft", "review", "approved", "scheduled", "publishing", "published"]);
const STOP = new Set(["그리고", "하지만", "그러나", "이번", "오늘", "관련", "위한", "대한", "있는", "하는", "되는", "그것", "우리", "정말", "각각", "모든", "다시", "그의", "the", "and", "for", "with", "그", "및", "등", "수", "것", "더"]);

// 한국어 조사 제거(엔비디아가 → 엔비디아). 3자+ 토큰 끝의 흔한 조사만 1회 제거.
const JOSA = /(으로서|으로써|에서는|에게서|으로|에서|에게|까지|부터|이라|라고|과의|와의|에는|에도|께서|은|는|이|가|을|를|의|에|와|과|도|만|로|라)$/;
export function stripJosa(w = "") {
  if (w.length >= 3) { const s = w.replace(JOSA, ""); if (s.length >= 2) return s; }
  return w;
}

// 텍스트 → 유의미 토큰(2자+, 불용어 제외, 조사 제거).
export function tokens(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map(stripJosa)
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

// 핵심 엔티티 — 가장 자주 등장하는 유의미 토큰(제목 가중).
export function primaryEntity(record = {}) {
  const title = String(record.title ?? "");
  const body = String(record.content ?? record.body ?? "");
  const titleTokens = tokens(title);
  const freq = {};
  for (const t of titleTokens) freq[t] = (freq[t] || 0) + 3; // 제목 가중
  for (const t of tokens(body).slice(0, 400)) freq[t] = (freq[t] || 0) + 1;
  if (titleTokens[0]) freq[titleTokens[0]] += 5; // 헤드라인 주어(첫 토큰) 가중 — 주 엔티티 편향
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : null;
}

// 핵심 주제 키 — 상위 토큰 집합(순서 무관).
export function coreTopic(record = {}) {
  const freq = {};
  for (const t of tokens(record.title ?? "")) freq[t] = (freq[t] || 0) + 3;
  for (const t of tokens(record.content ?? record.body ?? "").slice(0, 300)) freq[t] = (freq[t] || 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w).sort().join(" ");
}

// 두 텍스트 유사도(0~1) — 토큰 자카드.
export function similarity(a = "", b = "") {
  const sa = new Set(tokens(a)), sb = new Set(tokens(b));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

// 후보가 최근 콘텐츠와 최대 얼마나 유사한가 + 어떤 기존글과.
export function maxSimilarityTo(candidate, existing = []) {
  const cTitle = String(candidate.title ?? "");
  const cBody = String(candidate.content ?? candidate.body ?? "");
  const cText = `${cTitle} ${cBody}`;
  let max = 0, match = null;
  for (const e of existing) {
    if (e.id != null && candidate.id != null && e.id === candidate.id) continue;
    if (!ACTIVE.has(e.publish_status || "draft")) continue;
    const sim = similarity(cText, `${e.title ?? ""} ${e.content ?? e.body ?? ""}`);
    if (sim > max) { max = sim; match = e; }
  }
  return { similarity: Math.round(max * 100) / 100, match };
}

// 반복 판정 — 제목만 다르고 주제/본문/엔티티가 같으면 반복.
//   hasNewSignal=true(새 사건/수치/발표)면 변화분 중심 새 기사로 허용.
export function isRepeat(candidate, existing = [], { now = Date.now(), simThreshold = 0.5, hasNewSignal = false } = {}) {
  const nt = normalizeTitle(candidate.title);
  const bh = bodyHash(candidate.content ?? candidate.body ?? "");
  const pe = primaryEntity(candidate);
  const ct = coreTopic(candidate);
  const { similarity: sim, match } = maxSimilarityTo(candidate, existing);

  // 정확 일치(제목 정규화 or 본문 해시).
  for (const e of existing) {
    if (e.id != null && candidate.id != null && e.id === candidate.id) continue;
    if (!ACTIVE.has(e.publish_status || "draft")) continue;
    if (nt && normalizeTitle(e.title) === nt) return verdict(true, "SAME_NORMALIZED_TITLE", e, sim);
    if (bh && (e.content || e.body) && bodyHash(e.content ?? e.body) === bh) return verdict(true, "SAME_BODY_HASH", e, sim);
  }
  // 유사 주제(같은 엔티티 + 같은 코어토픽 + 높은 유사도) → 새 신호 없으면 반복.
  if (match && (sim >= simThreshold)) {
    const sameEntity = pe && primaryEntity(match) === pe;
    const sameTopic = ct && coreTopic(match) === ct;
    if ((sameEntity || sameTopic) && !hasNewSignal) return verdict(true, "SIMILAR_TOPIC_NO_NEW_SIGNAL", match, sim);
    if (sim >= 0.75 && !hasNewSignal) return verdict(true, "HIGH_SIMILARITY", match, sim);
  }
  void now;
  return verdict(false, hasNewSignal ? "NEW_SIGNAL_OK" : "UNIQUE", match, sim);
}
function verdict(repeat, reason, match, sim) {
  return { repeat, reason, matchId: match?.id ?? null, similarity: sim, primaryEntity: match ? primaryEntity(match) : null };
}

// 엔티티 집중도(§3) — 오늘 기사 중 특정 엔티티 비율이 10% 초과인지.
export function entityConcentration(records = [], { now = Date.now(), cap = 0.1 } = {}) {
  const today = editorialDateKST(now);
  const todays = records.filter((r) => ACTIVE.has(r.publish_status || "draft") && editorialDateKST(r.scheduled_at || r.created_at || now) === today);
  const total = todays.length || 1;
  const byEntity = {};
  for (const r of todays) { const e = primaryEntity(r); if (e) byEntity[e] = (byEntity[e] || 0) + 1; }
  const rows = Object.entries(byEntity)
    .map(([entity, count]) => ({ entity, count, share: Math.round((count / total) * 100) / 100, over: count / total > cap }))
    .sort((a, b) => b.count - a.count);
  return { total: todays.length, cap, overCapEntities: rows.filter((r) => r.over), rows };
}

// 특정 후보 엔티티가 오늘 상한을 넘겼는지(생성 억제용).
export function entityOverCap(candidate, records = [], { now = Date.now(), cap = 0.1 } = {}) {
  const pe = primaryEntity(candidate);
  if (!pe) return { over: false, entity: null };
  const conc = entityConcentration(records, { now, cap });
  const row = conc.rows.find((r) => r.entity === pe);
  // 후보 1건을 더했을 때 상한 초과 여부.
  const projected = ((row?.count || 0) + 1) / ((conc.total || 0) + 1);
  return { over: projected > cap && (conc.total + 1) >= 5, entity: pe, projectedShare: Math.round(projected * 100) / 100 };
}
