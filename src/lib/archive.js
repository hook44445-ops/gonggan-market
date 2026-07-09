// ════════════════════════════════════════════════════════════════════
// 공간라운지 Archive — 아카이브 구조 (Phase 5 · Space Media)
//
//   공간라운지를 게시판이 아니라 "아카이브"로 만든다 — 시간이 지날수록 가치가 쌓이는 Space Media.
//   글을 시간(오늘/이번주/이번달/올해)·카테고리·태그로 정리해 되찾을 수 있게 한다.
//
//   결정론적 순수 함수 · 저장/Migration 없음 · UI 분리(PC Archive 재사용).
// ════════════════════════════════════════════════════════════════════

import { normalizeTags } from "./readingExperience.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";

const startOfDay = (now) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); };

// 시간 버킷 정의 — 오늘/이번주(7일)/이번달(30일)/올해(365일)/이전.
export function timeBucket(post, now = Date.now()) {
  const t = post?.created_at ? new Date(post.created_at).getTime() : 0;
  if (!t) return "older";
  const today0 = startOfDay(now);
  if (t >= today0) return "today";
  if (t >= now - 7 * 864e5) return "week";
  if (t >= now - 30 * 864e5) return "month";
  if (t >= now - 365 * 864e5) return "year";
  return "older";
}

export const TIME_BUCKETS = [
  { id: "today", label: "오늘" },
  { id: "week",  label: "이번 주" },
  { id: "month", label: "이번 달" },
  { id: "year",  label: "올해" },
  { id: "older", label: "이전" },
];

// 시간 축 아카이브 — 각 버킷의 글 수 + 최신 몇 개.
//   반환: [{ id, label, count, sample:[post...] }]
export function archiveByTime(posts = [], now = Date.now(), sampleN = 5) {
  const map = new Map(TIME_BUCKETS.map((b) => [b.id, []]));
  for (const p of posts) {
    if (!p || p.id == null) continue;
    map.get(timeBucket(p, now)).push(p);
  }
  return TIME_BUCKETS.map((b) => {
    const arr = (map.get(b.id) || []).sort((a, c) => new Date(c.created_at ?? 0) - new Date(a.created_at ?? 0));
    return { id: b.id, label: b.label, count: arr.length, sample: arr.slice(0, sampleN) };
  });
}

// 카테고리 축 아카이브 — 카테고리별 글 수(많은 순).
export function archiveByCategory(posts = []) {
  const map = new Map();
  for (const p of posts) {
    const c = p?.category || "free";
    map.set(c, (map.get(c) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, label: CATEGORY_LABEL[category] || category, count }))
    .sort((a, b) => b.count - a.count);
}

// 태그 축 아카이브 — 태그 클라우드(빈도순).
export function archiveByTag(posts = [], limit = 40) {
  const map = new Map();
  for (const p of posts) {
    for (const t of normalizeTags(p)) map.set(t, (map.get(t) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// 아카이브 전체 요약(관리자/PC Archive 헤더용).
export function composeArchive(posts = [], now = Date.now()) {
  return {
    total: posts.filter((p) => p && p.id != null).length,
    byTime: archiveByTime(posts, now),
    byCategory: archiveByCategory(posts),
    byTag: archiveByTag(posts),
  };
}
