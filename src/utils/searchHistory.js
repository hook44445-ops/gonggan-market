// ─────────────────────────────────────────────────────
// Space Media — 검색 기록 유틸 (Phase 9)
//
//   순수 클라이언트 저장(localStorage). "최근 검색어"를 기기 로컬에 남겨 검색 편의(최근 검색·
//   재검색)에 쓴다. DB/Supabase/서버/API 무변경. 새 엔진이 아니라 helper 다.
// ─────────────────────────────────────────────────────

const KEY = "space_media_search_history_v1";
const CAP = 20;

export function getRecentSearches() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP))); } catch {}
}

// 검색어 기록(중복 제거 후 맨 앞). 반환: 최신 목록.
export function recordSearch(query) {
  const q = String(query ?? "").trim();
  if (!q) return getRecentSearches();
  const cur = getRecentSearches().filter((x) => x.toLowerCase() !== q.toLowerCase());
  const next = [q, ...cur];
  persist(next);
  return next;
}

export function removeSearch(query) {
  const q = String(query ?? "").trim().toLowerCase();
  const next = getRecentSearches().filter((x) => x.toLowerCase() !== q);
  persist(next);
  return next;
}

export function clearSearchHistory() {
  try { localStorage.removeItem(KEY); } catch {}
}
