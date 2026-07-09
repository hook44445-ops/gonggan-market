// ─────────────────────────────────────────────────────
// Space Media — 북마크(저장) 유틸 (Phase 7)
//
//   순수 클라이언트 저장(localStorage) — DB/Supabase/서버를 전혀 건드리지 않는다.
//   "저장한 공간 이야기"를 기기 로컬에 담아두는 UI 편의 기능일 뿐, 새 엔진이 아니다.
//   post id 배열만 보관하고, 화면에서 로드된 글 목록과 교차해 실제 카드를 그린다.
// ─────────────────────────────────────────────────────

const KEY = "space_media_bookmarks_v1";

export function getBookmarkIds() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function persist(ids) {
  try { localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 500))); } catch {}
}

export function isBookmarked(id) {
  if (id == null) return false;
  return getBookmarkIds().includes(String(id));
}

// 토글 후 최신 id 목록을 돌려준다(호출부가 상태를 갱신할 수 있게).
export function toggleBookmark(id) {
  if (id == null) return getBookmarkIds();
  const key = String(id);
  const cur = getBookmarkIds();
  const next = cur.includes(key) ? cur.filter((x) => x !== key) : [key, ...cur];
  persist(next);
  return next;
}

export function bookmarkCount() {
  return getBookmarkIds().length;
}
