// ════════════════════════════════════════════════════════════════════
// 공간라운지 Topic Hub & Encyclopedia — 주제 허브/백과사전 (Phase 5 · Space Media)
//
//   카테고리를 "탭"이 아니라 "허브"로 만든다. 하나의 주제에서 관련 주제·관련 글·관련 공간으로
//   백과사전처럼 뻗어나간다. 모든 글은 하나의 철학(Space is Everything)으로 연결된다.
//
//     연애 → MBTI → 소개팅 → 결혼 → 신혼집 → 인테리어 → 공간마켓
//
//   결정론적 순수 함수 · 저장/Migration 없음. Phase 3 지식 지도(knowledgeMap) + Space Graph 재사용.
// ════════════════════════════════════════════════════════════════════

import { relatedCategoryIds, clusterOfCategory, KNOWLEDGE_CHAINS } from "../constants/knowledgeMap.js";
import { relatedArticles } from "./spaceGraph.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";

const label = (catId) => CATEGORY_LABEL[catId] || catId;

// 특정 카테고리가 포함된 지식 사슬(허브 경로)들을 라벨로 반환.
//   반환: [{ id, label, path:[{ category, label, active }] }]  active=현재 카테고리
export function hubChains(categoryId) {
  return KNOWLEDGE_CHAINS
    .filter((ch) => ch.nodes.includes(categoryId))
    .map((ch) => ({
      id: ch.id,
      label: ch.label,
      path: ch.nodes.map((c) => ({ category: c, label: label(c), active: c === categoryId })),
    }));
}

// 주제 허브 구성 — 한 카테고리를 중심으로 관련 카테고리 + 대표 글을 모은다.
//   posts: 발행 글 목록. 반환: {
//     category, label, cluster, chains, relatedCategories:[{category,label,count}], topPosts:[post...]
//   }
export function composeTopicHub(categoryId, posts = [], { topN = 6 } = {}) {
  const list = (posts || []).filter((p) => p && p.id != null && p.title);
  const inCat = list.filter((p) => p.category === categoryId);
  const cluster = clusterOfCategory(categoryId);

  const relIds = relatedCategoryIds(categoryId);
  const relatedCategories = relIds.map((c) => ({
    category: c,
    label: label(c),
    count: list.filter((p) => p.category === c).length,
  })).sort((a, b) => b.count - a.count);

  const topPosts = inCat
    .slice()
    .sort((a, b) => (b.view_count ?? 0) + (b.like_count ?? 0) * 5 - ((a.view_count ?? 0) + (a.like_count ?? 0) * 5))
    .slice(0, topN);

  return {
    category: categoryId,
    label: label(categoryId),
    cluster: cluster ? { id: cluster.id, label: cluster.label } : null,
    chains: hubChains(categoryId),
    relatedCategories,
    topPosts,
    count: inCat.length,
  };
}

// Encyclopedia — 한 글을 중심으로 "관련 글 · 관련 카테고리 · 관련 공간(사슬) · 관련 클러스터"를 잇는다.
//   작업지시서: AI → 관련 글 → 관련 사람 → 관련 공간 → 관련 카테고리 → 관련 프로젝트.
//   (관련 사람/프로젝트는 기존 신원/프로젝트 시스템 소관이라 링크 슬롯만 준비 — 여기서는 미채움.)
//   반환: { relatedArticles:[...], relatedCategories:[...], spaceChains:[...], cluster }
export function encyclopediaLinks(post, posts = [], { n = 6 } = {}) {
  const related = relatedArticles(post, posts, n, 8);
  const relIds = relatedCategoryIds(post?.category);
  const cluster = clusterOfCategory(post?.category);
  return {
    relatedArticles: related,
    relatedCategories: relIds.map((c) => ({ category: c, label: label(c) })),
    spaceChains: hubChains(post?.category),
    cluster: cluster ? { id: cluster.id, label: cluster.label } : null,
  };
}
