// ─────────────────────────────────────────────────────
// Space Media — 북마크(저장) 유틸 (Phase 7 · Phase 9 업그레이드)
//
//   순수 클라이언트 저장(localStorage) — DB/Supabase/서버를 전혀 건드리지 않는다.
//   "저장한 공간 이야기"를 기기 로컬에 담아두는 UI 편의 기능일 뿐, 새 엔진이 아니다.
//   post id 배열만 보관하고, 화면에서 로드된 글 목록과 교차해 실제 카드를 그린다.
//
//   Phase 9: 기존 API(getBookmarkIds/toggleBookmark/isBookmarked/bookmarkCount)는
//   시그니처·동작 100% 호환 유지. "최근 저장" 정렬을 위해 저장 시각 메타(id→at)만 추가한다.
// ─────────────────────────────────────────────────────

const KEY = "space_media_bookmarks_v1";
const META_KEY = "space_media_bookmarks_meta_v1"; // { [id]: savedAt } — Phase 9 추가(부가 정보)

export function getBookmarkIds() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function getMeta() {
  try {
    const v = JSON.parse(localStorage.getItem(META_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function persist(ids, meta) {
  try { localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 500))); } catch {}
  if (meta) { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {} }
}

export function isBookmarked(id) {
  if (id == null) return false;
  return getBookmarkIds().includes(String(id));
}

// 토글 후 최신 id 목록을 돌려준다(호출부가 상태를 갱신할 수 있게 — 기존 동작 유지).
export function toggleBookmark(id) {
  if (id == null) return getBookmarkIds();
  const key = String(id);
  const cur = getBookmarkIds();
  const meta = getMeta();
  let next;
  if (cur.includes(key)) {
    next = cur.filter((x) => x !== key);
    delete meta[key];
  } else {
    next = [key, ...cur];
    meta[key] = Date.now();
  }
  persist(next, meta);
  return next;
}

export function bookmarkCount() {
  return getBookmarkIds().length;
}

// ── Phase 9 추가(부가) — 저장 시각 포함 항목. 기존 API 에 영향 없음. ──
// [{ id, at }] — 저장 시각 내림차순(메타 없는 레거시 id 는 배열 순서를 시각 대용으로).
export function getBookmarkEntries() {
  const ids = getBookmarkIds();
  const meta = getMeta();
  return ids
    .map((id, i) => ({ id, at: Number(meta[id]) || (ids.length - i) })) // 레거시: 배열 앞일수록 최근으로 근사
    .sort((a, b) => b.at - a.at);
}
