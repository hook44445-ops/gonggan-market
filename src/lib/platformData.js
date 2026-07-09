// ════════════════════════════════════════════════════════════════════
// 공간라운지 Platform Data Layer — 엔진 결과를 플랫폼 UI 형태로 재구성 (Phase 9 · helper)
//
//   ⚠️ 새 엔진이 아니다. Phase 5~6 엔진(composeMagazine/composeArchive/spaceSearch/
//   composeTopicHub/encyclopediaLinks) 의 결과를, SpaceMediaScreen 이 "콘텐츠 플랫폼"처럼
//   그릴 수 있도록 뷰모델로 조립하는 helper 다. 새 판단/점수 로직을 만들지 않는다.
//
//   결정론적 · 저장/Migration 없음 · 클라이언트에서 이미 로드된 글 목록만 사용(Regression Zero).
// ════════════════════════════════════════════════════════════════════

import { composeMagazine, toMagazineCard } from "./magazine.js";
import { composeArchive, timeBucket, TIME_BUCKETS } from "./archive.js";
import { composeTopicHub, encyclopediaLinks } from "./topicHub.js";
import { normalizeTags } from "./readingExperience.js";
import { rankByCommunity } from "./communityScore.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";

const label = (id) => CATEGORY_LABEL[id] || id;
const byIdMap = (posts) => new Map((posts || []).map((p) => [String(p.id), p]));

// ── ① Magazine Home ─────────────────────────────────────────────────
// composeMagazine 결과 + "많이 저장된 글" + "카테고리 추천" + "이어서 읽기"를 얹는다.
export function buildMagazineHome(posts = [], { savedIds = [], recentReadIds = [], now = Date.now() } = {}) {
  const mag = composeMagazine(posts, { now });
  const map = byIdMap(posts);

  // 많이 저장된 글 — 이 기기에서 저장한 글(로컬). 저장이 곧 "가치 있는 글" 신호.
  const mostSaved = savedIds.map((id) => map.get(String(id))).filter(Boolean).slice(0, 12).map(toMagazineCard);

  // 카테고리 추천 — 실제 글이 많은 카테고리(탐색 진입점).
  const catCount = new Map();
  for (const p of posts) catCount.set(p.category, (catCount.get(p.category) || 0) + 1);
  const categoryPicks = Array.from(catCount.entries())
    .map(([category, count]) => ({ category, label: label(category), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 이어서 읽기 — 최근 읽은 글(로컬).
  const continueReading = recentReadIds.map((id) => map.get(String(id))).filter(Boolean).slice(0, 8).map(toMagazineCard);

  return { ...mag, mostSaved, categoryPicks, continueReading };
}

// ── ② Archive ───────────────────────────────────────────────────────
// composeArchive + 정렬(최근/인기/조회) + 선택된 버킷/카테고리/태그의 실제 목록.
const SORTERS = {
  recent: (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0),
  views:  (a, b) => (b.view_count ?? 0) - (a.view_count ?? 0),
  likes:  (a, b) => (b.like_count ?? 0) - (a.like_count ?? 0),
};

export function buildArchiveView(posts = [], { sort = "recent", bucket = null, category = null, tag = null, now = Date.now() } = {}) {
  const base = composeArchive(posts, now);
  let filtered = (posts || []).filter((p) => p && p.id != null && p.title);
  if (bucket) filtered = filtered.filter((p) => timeBucket(p, now) === bucket);
  if (category) filtered = filtered.filter((p) => p.category === category);
  if (tag) filtered = filtered.filter((p) => normalizeTags(p).map((t) => t.toLowerCase()).includes(String(tag).toLowerCase()));

  let list;
  if (sort === "popular") list = rankByCommunity(filtered, "community", filtered.length, now);
  else list = filtered.slice().sort(SORTERS[sort] || SORTERS.recent);

  return { ...base, list, filter: { sort, bucket, category, tag }, filteredCount: list.length };
}

export const ARCHIVE_SORTS = [
  { id: "recent",  label: "최신순" },
  { id: "popular", label: "인기순" },
  { id: "views",   label: "조회순" },
];

// ── ③ Search helpers ────────────────────────────────────────────────
// 자동완성 — 입력 접두/부분과 매칭되는 제목·태그·카테고리 라벨 후보.
export function autocomplete(input, posts = [], { limit = 8 } = {}) {
  const q = String(input ?? "").trim().toLowerCase();
  if (q.length < 1) return [];
  const seen = new Set();
  const out = [];
  const push = (text) => {
    const t = String(text ?? "").trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k) || !k.includes(q)) return;
    seen.add(k); out.push(t);
  };
  for (const p of posts) {
    push(p.title);
    for (const tag of normalizeTags(p)) push(tag);
    if (out.length > limit * 3) break;
  }
  // 카테고리 라벨도 후보로.
  for (const p of posts) push(label(p.category));
  return out.slice(0, limit);
}

// 인기 검색 — 태그 빈도 상위(로컬 분석 없이 콘텐츠에서 유도한 추천 질의).
export function popularSearches(posts = [], { limit = 10 } = {}) {
  const map = new Map();
  for (const p of posts) for (const t of normalizeTags(p)) map.set(t, (map.get(t) || 0) + 1);
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
}

// 연관 검색 — 검색 결과의 공간 사슬 + 카테고리 라벨을 추천 질의로.
export function relatedSearches(searchResult) {
  if (!searchResult) return [];
  const out = [];
  const add = (c) => { const v = CATEGORY_LABEL[c] || c; if (v && !out.includes(v)) out.push(v); };
  (searchResult.chain || []).forEach(add); // 원본 카테고리 id 는 라벨로 치환
  (searchResult.categories || []).forEach((c) => { if (c.label && !out.includes(c.label)) out.push(c.label); });
  return out.slice(0, 8);
}

// ── ④ Encyclopedia ──────────────────────────────────────────────────
// composeTopicHub + 대표글의 encyclopediaLinks(관련글) + 관련 태그/키워드.
export function buildEncyclopediaView(categoryId, posts = [], { topN = 8 } = {}) {
  const hub = composeTopicHub(categoryId, posts, { topN });
  const list = (posts || []).filter((p) => p && p.category === categoryId && p.title);

  // 대표글 — 허브의 topPosts 첫 글.
  const representative = hub.topPosts[0] || null;
  const links = representative ? encyclopediaLinks(representative, posts, { n: 6 }) : null;

  // 관련 키워드/태그 — 이 카테고리 글들의 태그 빈도 상위.
  const tagMap = new Map();
  for (const p of list) for (const t of normalizeTags(p)) tagMap.set(t, (tagMap.get(t) || 0) + 1);
  const keywords = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([tag, count]) => ({ tag, count }));

  return {
    ...hub,
    representative,
    relatedArticles: links?.relatedArticles ?? [],
    keywords,
  };
}

// ── ⑤ Bookmark ──────────────────────────────────────────────────────
// 저장 항목을 검색/카테고리/정렬로 재구성. entries: [{id, at}] (bookmarks.getBookmarkEntries).
export function buildBookmarkView(posts = [], entries = [], { q = "", sort = "recent", category = "all", now = Date.now() } = {}) {
  const map = byIdMap(posts);
  const atOf = new Map(entries.map((e) => [String(e.id), e.at]));
  let saved = entries.map((e) => map.get(String(e.id))).filter(Boolean);

  // 카테고리별 집계(칩).
  const catCount = new Map();
  for (const p of saved) catCount.set(p.category, (catCount.get(p.category) || 0) + 1);
  const categories = Array.from(catCount.entries())
    .map(([c, count]) => ({ category: c, label: label(c), count }))
    .sort((a, b) => b.count - a.count);

  if (category && category !== "all") saved = saved.filter((p) => p.category === category);
  const qq = String(q ?? "").trim().toLowerCase();
  if (qq) saved = saved.filter((p) => String(p.title).toLowerCase().includes(qq) || normalizeTags(p).some((t) => t.toLowerCase().includes(qq)));

  if (sort === "popular") saved = rankByCommunity(saved, "community", saved.length, now);
  else if (sort === "views") saved = saved.slice().sort(SORTERS.views);
  else saved = saved.slice().sort((a, b) => (atOf.get(String(b.id)) || 0) - (atOf.get(String(a.id)) || 0)); // 최근 저장순

  return { saved, categories, total: entries.length };
}

export const BOOKMARK_SORTS = [
  { id: "recent",  label: "최근 저장순" },
  { id: "popular", label: "인기순" },
  { id: "views",   label: "조회순" },
];
