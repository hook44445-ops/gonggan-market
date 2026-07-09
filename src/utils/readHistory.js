// ─────────────────────────────────────────────────────
// Space Media — 최근 읽은 글 기록 유틸 (Phase 9)
//
//   순수 클라이언트 저장(localStorage) — DB/Supabase/서버/API 를 전혀 건드리지 않는다.
//   "최근 읽은 글"을 기기 로컬에 남겨 추천(recommendation)·"이어서 읽기"에 쓰는 UI 편의 기능이다.
//   새 엔진이 아니라 helper 다(post id + 읽은 시각만 보관).
// ─────────────────────────────────────────────────────

const KEY = "space_media_read_history_v1";
const CAP = 100;

// [{ id, at }] — 최근 읽은 순(내림차순).
export function getReadHistory() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && x.id != null).map((x) => ({ id: String(x.id), at: Number(x.at) || 0 })) : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP))); } catch {}
}

// 글을 읽음으로 기록(중복 제거 후 맨 앞으로). 반환: 최신 목록.
export function recordRead(id) {
  if (id == null) return getReadHistory();
  const key = String(id);
  const cur = getReadHistory().filter((x) => x.id !== key);
  const next = [{ id: key, at: Date.now() }, ...cur];
  persist(next);
  return next;
}

// 최근 읽은 글 id 목록(최신순, n개).
export function getRecentReadIds(n = 20) {
  return getReadHistory().slice(0, n).map((x) => x.id);
}

export function hasReadHistory() {
  return getReadHistory().length > 0;
}

export function clearReadHistory() {
  try { localStorage.removeItem(KEY); } catch {}
}
