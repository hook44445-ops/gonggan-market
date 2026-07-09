// ════════════════════════════════════════════════════════════════════
// 공간라운지 Category Health — 카테고리 건강 상태 (Phase 6)
//
//   카테고리별로 콘텐츠가 건강하게 쌓이고 있는지 진단한다. 글이 없거나 오래 방치된
//   카테고리는 "보강 필요", 반응이 오르는 카테고리는 "상승"으로 표시해 운영을 돕는다.
//
//   결정론적 순수 함수 · 저장/Migration 없음 · 기존 데이터로만 계산(Regression Zero).
// ════════════════════════════════════════════════════════════════════

import { communityScore } from "./communityScore.js";
import { extractSignals, reactionTotal, saveSignal } from "./userSignals.js";
import { clusterOfCategory } from "../constants/knowledgeMap.js";
import { LOUNGE_CATEGORIES, CATEGORY_LABEL } from "../constants/lounge.js";

const daysSince = (ts, now) => (ts ? Math.floor((now - new Date(ts).getTime()) / 864e5) : null);

// 카테고리별 건강 지표. 발행글이 없는 카테고리도 status:'empty' 로 함께 반환한다.
//   반환: [{ category, label, cluster, count, lastPublishedDaysAgo, views, comments, likes, saves,
//            avgCommunity, evergreenRatio, status }]
//   status ∈ empty | stale(30일+ 방치) | rising(상승) | quiet(조용) | healthy
export function categoryHealth(published = [], now = Date.now()) {
  const contentCats = LOUNGE_CATEGORIES.filter((c) => !["all", "popular"].includes(c.id));
  const byCat = new Map(contentCats.map((c) => [c.id, []]));
  for (const p of published) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category).push(p);
  }

  const rows = [];
  for (const [category, posts] of byCat.entries()) {
    const count = posts.length;
    let views = 0, comments = 0, likes = 0, saves = 0, cSum = 0, evergreen = 0, recent = 0, lastTs = 0;
    for (const p of posts) {
      const sig = extractSignals(p, now);
      views += sig.views; comments += sig.comments; likes += sig.likes;
      saves += saveSignal(sig).proxySaves;
      const c = communityScore(p, now);
      cSum += c.communityScore;
      if (c.evergreen) evergreen += 1;
      const t = p.created_at ? new Date(p.created_at).getTime() : 0;
      if (t > lastTs) lastTs = t;
      if (t && now - t <= 7 * 864e5) recent += 1;
    }
    const lastDays = lastTs ? daysSince(lastTs, now) : null;
    const avgCommunity = count ? Math.round(cSum / count) : 0;
    const reactionDensity = count ? (views + comments * 2 + likes) / count : 0;

    let status = "healthy";
    if (count === 0) status = "empty";
    else if (lastDays != null && lastDays >= 30) status = "stale";
    else if (recent >= 1 && reactionDensity >= 30) status = "rising";
    else if (reactionDensity < 8) status = "quiet";

    rows.push({
      category,
      label: CATEGORY_LABEL[category] || category,
      cluster: clusterOfCategory(category)?.label ?? null,
      count,
      lastPublishedDaysAgo: lastDays,
      views, comments, likes, saves,
      avgCommunity,
      evergreenRatio: count ? Math.round((evergreen / count) * 100) : 0,
      status,
    });
  }
  // 보강이 급한 순: empty → stale → quiet → 나머지, 그 안에서는 글 수 적은 순.
  const rank = { empty: 0, stale: 1, quiet: 2, rising: 3, healthy: 4 };
  return rows.sort((a, b) => (rank[a.status] - rank[b.status]) || (a.count - b.count));
}

// 요약 — 카테고리 건강 분포(운영 헤더용).
export function categoryHealthSummary(published = [], now = Date.now()) {
  const rows = categoryHealth(published, now);
  const tally = { empty: 0, stale: 0, quiet: 0, rising: 0, healthy: 0 };
  for (const r of rows) tally[r.status] += 1;
  return { total: rows.length, ...tally, rows };
}
