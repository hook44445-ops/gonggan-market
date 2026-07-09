// ════════════════════════════════════════════════════════════════════
// 공간라운지 Recommendation — 최근 읽은 글 기반 추천 (Phase 9 · helper)
//
//   ⚠️ 새 엔진이 아니다. 기존 Space Graph(relatedArticles)와 Community(rankByCommunity)
//   결과를 "최근 읽은 글" 신호로 묶어 재구성하는 helper 다. 새 점수 모델을 만들지 않는다.
//
//   최근 읽은 글들과 공간 연결도가 높은 글을 모아, 이미 읽은 글은 제외하고 추천한다.
//   읽은 기록이 없으면 인기 글(Community)로 폴백한다.
//   결정론적 · 저장/Migration 없음 · 클라이언트에서 이미 로드된 글 목록만 사용.
// ════════════════════════════════════════════════════════════════════

import { relatedArticles } from "./spaceGraph.js";
import { rankByCommunity } from "./communityScore.js";

// posts: 로드된 글 목록 · recentReadIds: 최근 읽은 글 id(최신순).
//   반환: [{ ...post, _reasonFrom }]  (_reasonFrom: 이 추천이 어떤 읽은 글에서 왔는지 제목)
export function recommendFromHistory(posts = [], recentReadIds = [], { n = 12, seedN = 6, now = Date.now() } = {}) {
  const list = (posts || []).filter((p) => p && p.id != null && p.title);
  if (list.length === 0) return [];
  const byId = new Map(list.map((p) => [String(p.id), p]));
  const readSet = new Set(recentReadIds.map(String));

  // 최근 읽은 글 중 실제 목록에 있는 것들을 시드로.
  const seeds = recentReadIds.map(String).map((id) => byId.get(id)).filter(Boolean).slice(0, seedN);
  if (seeds.length === 0) {
    // 폴백 — 읽은 기록 없음: 인기 글 추천.
    return rankByCommunity(list, "community", n, now).map((p) => ({ ...p, _reasonFrom: null }));
  }

  // 각 시드의 관련 글을 모아 점수(연결도)+등장 빈도로 집계. 이미 읽은 글은 제외.
  const agg = new Map(); // id -> { post, score, from }
  for (const seed of seeds) {
    const rel = relatedArticles(seed, list, 8, 8);
    for (const r of rel) {
      const key = String(r.id);
      if (readSet.has(key)) continue;
      const prev = agg.get(key);
      const score = (r._score ?? 0) + (prev ? prev.score : 0);
      if (!prev || score > prev.score) agg.set(key, { post: r, score, from: seed.title });
      else prev.score = score;
    }
  }

  const recommended = Array.from(agg.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => ({ ...x.post, _reasonFrom: x.from }));

  // 부족하면 인기 글로 보강(읽은 글·이미 추천된 글 제외).
  if (recommended.length < n) {
    const have = new Set([...recommended.map((p) => String(p.id)), ...readSet]);
    for (const p of rankByCommunity(list, "community", n * 2, now)) {
      if (have.has(String(p.id))) continue;
      recommended.push({ ...p, _reasonFrom: null });
      if (recommended.length >= n) break;
    }
  }
  return recommended;
}

// "같이 읽으면 좋은 글" — 한 글 기준(Reading ⑦). relatedArticles 재사용.
export function alsoRead(post, posts = [], { n = 6 } = {}) {
  if (!post) return [];
  return relatedArticles(post, posts, n, 8);
}
