// ════════════════════════════════════════════════════════════════════
// 공간라운지 Knowledge Map & Topic Cluster — 지식 지도/토픽 클러스터 (Phase 3)
//
//   "Space is Everything." 공간은 최상위 개념이고, 모든 카테고리는 공간 아래에서
//   서로 연결되어 있다. 이 파일은 카테고리와 카테고리 사이의 "지식 연결"을 정의한다.
//   AI 는 새 글을 많이 쓰는 것이 아니라, 이 지도를 따라 글과 글을 연결한다.
//
//   작업지시서의 지식 사슬(Knowledge Chain)을 그대로 옮긴 구조 데이터다:
//     · MBTI → 연애 → 결혼 → 신혼집 → 인테리어 → 시공후기 → 견적 → 계약 → 리뷰
//     · 창업 → 카페 → 상가 → 인테리어 → 부동산 → 경제
//     · 주식 → 반도체 → AI → 건설 → 공간산업 → 부동산
//
//   결정론적 순수 데이터/함수다(외부 API·저장·Migration 없음). 실제 라운지 카테고리
//   id(LOUNGE_CATEGORIES)만 사용해 기존 구조를 그대로 재사용한다(Regression Zero).
// ════════════════════════════════════════════════════════════════════

import { LOUNGE_CATEGORIES } from "./lounge.js";

const VALID = new Set(LOUNGE_CATEGORIES.map((c) => c.id));

// ── 지식 사슬 ──────────────────────────────────────────────────────
// 사람의 삶이 공간을 따라 흐르는 순서. 각 항목은 실제 라운지 카테고리 id 다.
// (MBTI·신혼집·반도체 같은 개념적 노드는 가장 가까운 라운지 카테고리로 착지시킨다 —
//  예: MBTI→연애(dating), 신혼집→결혼(marriage), 반도체/건설→주식(stock).)
export const KNOWLEDGE_CHAINS = [
  {
    id: "life-to-home",
    label: "사람 → 집 → 거래",
    // MBTI → 연애 → 결혼 → 신혼집 → 인테리어 → 시공후기 → 견적 → 계약 → 리뷰
    nodes: ["dating", "marriage", "move_in", "interior", "review", "quote_worry"],
  },
  {
    id: "startup-to-realty",
    label: "창업 → 상업공간 → 부동산",
    // 창업 → 카페 → 상가 → 인테리어 → 부동산 → 경제
    nodes: ["startup", "staff-talk", "interior", "realestate", "stock"],
  },
  {
    id: "economy-to-space",
    label: "경제 → 공간산업 → 부동산",
    // 주식 → 반도체 → AI → 건설 → 공간산업 → 부동산
    nodes: ["stock", "jobs", "realestate", "interior"],
  },
  {
    id: "living-space",
    label: "일상 → 생활공간",
    nodes: ["daily", "room_deco", "health", "pet", "local"],
  },
  {
    id: "leisure-space",
    label: "여가 → 머무는 공간",
    nodes: ["travel", "restaurant", "exercise", "humor", "free"],
  },
];

// ── 토픽 클러스터 ──────────────────────────────────────────────────
// 콘텐츠를 대주제(클러스터)로 묶어서 관리한다. 하나의 카테고리는 하나의 클러스터에 속한다.
// (작업지시서 ④ AI Topic Cluster — 콘텐츠를 클러스터로 관리)
export const TOPIC_CLUSTERS = [
  { id: "home",     label: "🏠 주거·공간",   emoji: "🏠", categories: ["interior", "review", "quote_worry", "room_deco", "move_in"] },
  { id: "biz",      label: "💼 창업·업무",   emoji: "💼", categories: ["startup", "staff-talk", "jobs"] },
  { id: "economy",  label: "📈 경제·부동산", emoji: "📈", categories: ["realestate", "stock"] },
  { id: "life",     label: "🌿 일상·관계",   emoji: "🌿", categories: ["marriage", "dating", "health", "pet", "daily", "local"] },
  { id: "leisure",  label: "🎒 취미·여가",   emoji: "🎒", categories: ["exercise", "travel", "restaurant", "humor", "free"] },
];

// category id → cluster (조회 맵)
const CATEGORY_TO_CLUSTER = TOPIC_CLUSTERS.reduce((acc, cl) => {
  cl.categories.forEach((cat) => { acc[cat] = cl; });
  return acc;
}, {});

// 특정 카테고리가 속한 클러스터를 반환(없으면 null).
export function clusterOfCategory(categoryId) {
  return CATEGORY_TO_CLUSTER[categoryId] ?? null;
}

// 두 카테고리가 같은 클러스터에 속하는가.
export function sameCluster(a, b) {
  const ca = CATEGORY_TO_CLUSTER[a];
  const cb = CATEGORY_TO_CLUSTER[b];
  return Boolean(ca && cb && ca.id === cb.id);
}

// ── 카테고리 인접 지도(무방향) ─────────────────────────────────────
// 지식 사슬에서 앞뒤로 이어지는 카테고리는 "지식으로 연결"돼 있다고 본다.
// 예) interior ↔ review ↔ quote_worry, startup ↔ staff-talk …
const ADJACENCY = (() => {
  const map = new Map(); // catId -> Set(catId)
  const link = (a, b) => {
    if (a === b || !VALID.has(a) || !VALID.has(b)) return;
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a).add(b);
    map.get(b).add(a);
  };
  for (const chain of KNOWLEDGE_CHAINS) {
    for (let i = 0; i < chain.nodes.length - 1; i++) {
      link(chain.nodes[i], chain.nodes[i + 1]);
    }
  }
  // 같은 클러스터 안의 카테고리도 서로 인접(지식 연결)으로 취급한다.
  for (const cl of TOPIC_CLUSTERS) {
    for (let i = 0; i < cl.categories.length; i++) {
      for (let j = i + 1; j < cl.categories.length; j++) {
        link(cl.categories[i], cl.categories[j]);
      }
    }
  }
  return map;
})();

// 특정 카테고리와 지식으로 연결된(인접) 카테고리 id 목록.
export function relatedCategoryIds(categoryId) {
  return Array.from(ADJACENCY.get(categoryId) ?? []);
}

// 두 카테고리가 지식 지도상 인접(연결)인가.
export function categoriesLinked(a, b) {
  return Boolean(ADJACENCY.get(a)?.has(b));
}

// Knowledge Map 시각화용 엣지 목록: [{ source, target }] (무방향 · 중복 제거).
export function knowledgeMapEdges() {
  const seen = new Set();
  const edges = [];
  for (const [a, set] of ADJACENCY.entries()) {
    for (const b of set) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: a, target: b });
    }
  }
  return edges;
}
