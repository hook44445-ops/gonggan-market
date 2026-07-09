// ════════════════════════════════════════════════════════════════════
// 공간라운지 Space Index — 공간 색인 엔진 (Phase 6)
//
//   전체 콘텐츠를 하나의 Space Index 로 관리한다. 각 글이 (1) 어느 공간 영역에 속하고
//   (2) 어떤 카테고리와 연결되며 (3) 어떤 글과 연결되고 (4) 어떤 후속 글이 필요하며
//   (5) 어떤 PC/Archive/Search 화면에서 쓰이는지를 한 레코드로 색인한다.
//
//   이 색인은 Publishing OS 의 최종 산출물이자, 향후 PC 버전(Magazine/Archive/Search/
//   Knowledge)이 그대로 읽어 쓸 수 있는 통합 데이터 레이어다.
//
//   결정론적 순수 함수 · 저장/Migration 없음 · 기존 엔진 재사용(Regression Zero).
// ════════════════════════════════════════════════════════════════════

import { postSignature, relatedArticles } from "./spaceGraph.js";
import { clusterOfCategory, relatedCategoryIds } from "../constants/knowledgeMap.js";
import { communityScore } from "./communityScore.js";
import { recommendFollowupsForPost } from "./followupRecommender.js";
import { timeBucket } from "./archive.js";
import { SPACE_COVERAGE_AREAS } from "./spaceCoverage.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";

const norm = (s) => String(s ?? "").toLowerCase();
const label = (id) => CATEGORY_LABEL[id] || id;

// 한 글이 속한 공간 영역 id(첫 매칭). 커버리지 영역 정의를 재사용한다.
function areaOf(post) {
  for (const area of SPACE_COVERAGE_AREAS) {
    if (area.category && post.category === area.category) return area;
    const hay = `${norm(post.title)} ${norm(post.ai_topic)}`;
    if (area.keywords.some((k) => hay.includes(norm(k)))) return area;
  }
  return null;
}

// 글 1건의 색인 레코드.
//   반환: {
//     id, title, category, categoryLabel, area, cluster,
//     linkedCategories:[{category,label}], relatedArticleIds:[id],
//     followups:[{type,topic}], community, timeBucket,
//     usage: { magazine, archive, search, encyclopedia }   // 어느 화면에서 쓰이는지
//   }
export function indexPost(post, corpus = [], now = Date.now()) {
  const c = communityScore(post, now);
  const area = areaOf(post);
  const cluster = clusterOfCategory(post.category);
  const linkedCategories = relatedCategoryIds(post.category).map((id) => ({ category: id, label: label(id) }));
  const related = relatedArticles(post, corpus, 6, 8);
  const followups = recommendFollowupsForPost(post, null, now).map((f) => ({ type: f.type, topic: f.topic }));

  return {
    id: post.id,
    title: post.title,
    category: post.category,
    categoryLabel: label(post.category),
    area: area ? { id: area.id, label: area.label } : null,
    cluster: cluster ? { id: cluster.id, label: cluster.label } : null,
    linkedCategories,
    relatedArticleIds: related.map((r) => r.id),
    relatedCount: related.length,
    followups,
    community: c.communityScore,
    evergreen: c.evergreen,
    timeBucket: timeBucket(post, now),
    usage: {
      magazine: c.communityScore >= 60 || c.evergreen,   // 매거진 노출 후보
      archive: true,                                       // 모든 글은 아카이브 대상
      search: Boolean(post.title),                          // 검색 색인 대상
      encyclopedia: related.length >= 2,                    // 백과사전형 상시 연결 후보
    },
  };
}

// 전체 코퍼스를 색인한다.
//   반환: { records:[...], stats:{ total, indexed, isolated, evergreen, byArea:{areaId:count} } }
export function buildSpaceIndex(posts = [], now = Date.now()) {
  const corpus = (posts || []).filter((p) => p && p.id != null && p.title);
  const records = corpus.map((p) => indexPost(p, corpus, now));
  const byArea = {};
  let isolated = 0, evergreen = 0;
  for (const r of records) {
    const key = r.area?.id ?? "unmapped";
    byArea[key] = (byArea[key] ?? 0) + 1;
    if (r.relatedCount === 0) isolated += 1;
    if (r.evergreen) evergreen += 1;
  }
  return {
    records,
    stats: {
      total: corpus.length,
      indexed: records.length,
      isolated,
      evergreen,
      byArea,
      unmapped: byArea.unmapped ?? 0,
    },
  };
}
