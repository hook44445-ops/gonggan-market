// ════════════════════════════════════════════════════════════════════
// 공간라운지 Space Connection Engine — 공간 지식 그래프 (Phase 3)
//
//   Phase 1·2 가 "글을 잘 만드는" 단계였다면, Phase 3 는 "글을 잘 연결하는" 단계다.
//   AI 는 새 글을 쓰기 전에 이미 존재하는 콘텐츠를 먼저 이해하고, 새 글을 기존 글과
//   연결한다. 콘텐츠가 1만·10만 개가 돼도 서로 유기적으로 이어져 하나의
//   Space Knowledge Network(공간 지식 네트워크)를 이룬다 — 가장 강력한 진입장벽.
//
//   구현 원칙(Phase 1·2 와 동일):
//     · 결정론적 순수 함수(외부 API·저장·Migration 없음). 관리자 화면/글 상세에서 항상 재계산.
//     · Space is Everything — 모든 연결 판단은 "공간 관점(spaceKeyword)"을 축으로 한다.
//     · 기존 카테고리/글 데이터(lounge_posts)만 사용한다(Regression Zero).
//     · Phase 4: relatednessScore 내부를 임베딩/LLM 유사도로 교체(반환 형태 유지).
// ════════════════════════════════════════════════════════════════════

import { reinterpretThroughSpace } from "../constants/spacePhilosophy.js";
import { clusterOfCategory, sameCluster, categoriesLinked, relatedCategoryIds } from "../constants/knowledgeMap.js";
import { slugify } from "./duplicateChecker.js";

// 한국어/영문 토큰화(2글자 이상 단어) — 제목/태그 기반 유사도의 기본 신호.
function tokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
}

// 글 1건에서 "연결 신호(signature)"를 추출한다 — 공간 관점으로 재해석한 결과 + 태그 + 토큰.
//   post: { id, title, content?, category, tags?, ai_topic? }
export function postSignature(post = {}) {
  const title = post.title ?? "";
  const topic = post.ai_topic || title;
  const reinterpret = reinterpretThroughSpace(topic);
  const tagList = Array.isArray(post.tags) ? post.tags.map((t) => String(t).toLowerCase()) : [];
  const tok = new Set([...tokens(title), ...tagList.flatMap(tokens)]);
  return {
    id: post.id,
    category: post.category || reinterpret.category,
    cluster: clusterOfCategory(post.category)?.id ?? null,
    spaceKeyword: reinterpret.spaceKeyword,
    lensId: reinterpret.lensId,
    tags: new Set(tagList),
    tokens: tok,
  };
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

// 두 글의 "공간 연결도"(0~100). 여러 신호를 가중 합산한다.
//   · 같은 공간 관점(spaceKeyword)      : 가장 강함(같은 렌즈로 세상을 본 글)
//   · 같은 카테고리 / 같은 클러스터 / 지식 지도상 인접 카테고리
//   · 태그 겹침 · 제목 토큰 겹침
export function relatednessScore(a, b) {
  if (!a || !b || a.id === b.id) return 0;
  let s = 0;
  if (a.spaceKeyword && a.spaceKeyword === b.spaceKeyword) s += 34;
  else if (a.lensId && a.lensId === b.lensId) s += 18;

  if (a.category && a.category === b.category) s += 22;
  else if (sameCluster(a.category, b.category)) s += 14;
  else if (categoriesLinked(a.category, b.category)) s += 10;

  s += Math.round(jaccard(a.tags, b.tags) * 24);
  s += Math.round(jaccard(a.tokens, b.tokens) * 20);
  return Math.max(0, Math.min(100, s));
}

// ── Related Article ─────────────────────────────────────────────────
// "같이 보면 좋은 글" — 한 글에 대해 공간 연결도가 높은 순으로 관련 글을 뽑는다.
//   post: 기준 글 · candidates: 후보 글 배열 · n: 개수 · minScore: 최소 연결도(잡음 컷)
//   반환: [{ ...candidate, _score }] (연결도 내림차순)
export function relatedArticles(post, candidates = [], n = 4, minScore = 8) {
  const base = postSignature(post);
  return candidates
    .filter((c) => c && c.id !== post?.id)
    .map((c) => ({ post: c, _score: relatednessScore(base, postSignature(c)) }))
    .filter((x) => x._score >= minScore)
    .sort((a, b) => b._score - a._score)
    .slice(0, n)
    .map((x) => ({ ...x.post, _score: x._score }));
}

// 이미 후보를 서버에서 받아온 경우(관련글 SEO 풀 등)를 "공간 그래프"로 재정렬만 한다.
//   연결도가 minScore 미만이라도 자리를 채워야 하는 SEO 링크 용도이므로 컷하지 않고 정렬만 한다.
export function rankBySpaceGraph(post, candidates = [], n = 4) {
  const base = postSignature(post);
  return candidates
    .filter((c) => c && c.id !== post?.id)
    .map((c) => ({ c, _score: relatednessScore(base, postSignature(c)) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, n)
    .map((x) => ({ ...x.c, _score: x._score }));
}

// ── Space Graph(전체 그래프) ────────────────────────────────────────
// 코퍼스 전체의 노드/엣지를 만든다. 성능을 위해 글당 상위 maxEdgesPerNode 개만 남긴다.
//   반환: { nodes:[{id,category,cluster,spaceKeyword}], edges:[{source,target,weight}] }
export function buildSpaceGraph(posts = [], { maxEdgesPerNode = 5, minScore = 12 } = {}) {
  const sigs = posts.filter((p) => p && p.id != null).map(postSignature);
  const nodes = sigs.map((s) => ({ id: s.id, category: s.category, cluster: s.cluster, spaceKeyword: s.spaceKeyword }));
  const edges = [];
  const seen = new Set();
  for (let i = 0; i < sigs.length; i++) {
    const scored = [];
    for (let j = 0; j < sigs.length; j++) {
      if (i === j) continue;
      const w = relatednessScore(sigs[i], sigs[j]);
      if (w >= minScore) scored.push({ j, w });
    }
    scored.sort((a, b) => b.w - a.w);
    for (const { j, w } of scored.slice(0, maxEdgesPerNode)) {
      const key = i < j ? `${i}|${j}` : `${j}|${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: sigs[i].id, target: sigs[j].id, weight: w });
    }
  }
  return { nodes, edges };
}

// ── 콘텐츠 연결률 ──────────────────────────────────────────────────
// 관련 글(연결도 minScore 이상)이 1개 이상 있는 글의 비율(%). 네트워크 밀도의 핵심 지표.
//   반환: { total, connected, isolated, rate(0~100), avgDegree }
export function connectionRate(posts = [], { minScore = 12 } = {}) {
  const sigs = posts.filter((p) => p && p.id != null).map(postSignature);
  const total = sigs.length;
  if (total === 0) return { total: 0, connected: 0, isolated: 0, rate: 0, avgDegree: 0 };
  let connected = 0;
  let degreeSum = 0;
  for (let i = 0; i < sigs.length; i++) {
    let degree = 0;
    for (let j = 0; j < sigs.length; j++) {
      if (i === j) continue;
      if (relatednessScore(sigs[i], sigs[j]) >= minScore) degree += 1;
    }
    if (degree > 0) connected += 1;
    degreeSum += degree;
  }
  return {
    total,
    connected,
    isolated: total - connected,
    rate: Math.round((connected / total) * 100),
    avgDegree: Math.round((degreeSum / total) * 10) / 10,
  };
}

// ── Topic Cluster 집계 ─────────────────────────────────────────────
// 발행/초안 글을 토픽 클러스터별로 묶는다. 각 클러스터의 건수/조회/좋아요/댓글 합계.
//   반환: [{ id, label, emoji, count, views, likes, comments, categories:{catId:count} }]
export function clusterBreakdown(posts = []) {
  const acc = new Map();
  for (const p of posts) {
    const cl = clusterOfCategory(p.category);
    if (!cl) continue;
    if (!acc.has(cl.id)) acc.set(cl.id, { id: cl.id, label: cl.label, emoji: cl.emoji, count: 0, views: 0, likes: 0, comments: 0, categories: {} });
    const row = acc.get(cl.id);
    row.count += 1;
    row.views += p.view_count ?? 0;
    row.likes += p.like_count ?? 0;
    row.comments += p.comment_count ?? 0;
    row.categories[p.category] = (row.categories[p.category] ?? 0) + 1;
  }
  return Array.from(acc.values()).sort((a, b) => b.count - a.count);
}

// ── Knowledge Map 집계 ─────────────────────────────────────────────
// 카테고리 노드(글 수)와 지식 지도 엣지를 실제 콘텐츠 수와 합쳐 반환한다.
//   반환: { nodes:[{category, count}], edges:[{source, target, both}] }
export function knowledgeMap(posts = []) {
  const counts = new Map();
  for (const p of posts) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  const nodes = Array.from(counts.entries())
    .map(([category, count]) => ({ category, count, cluster: clusterOfCategory(category)?.id ?? null }))
    .sort((a, b) => b.count - a.count);
  const seen = new Set();
  const edges = [];
  for (const [cat] of counts) {
    for (const other of relatedCategoryIds(cat)) {
      if (!counts.has(other)) continue; // 실제 글이 있는 카테고리끼리만 연결
      const key = cat < other ? `${cat}|${other}` : `${other}|${cat}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: cat, target: other });
    }
  }
  return { nodes, edges };
}

// ── 오늘의 Space / Editor's Pick ────────────────────────────────────
// 오늘 가장 중요한 공간 이야기 Top N. 인기(조회·좋아요·댓글) + 공간 연결도(네트워크 허브)를 함께 본다.
//   허브(연결이 많은 글)를 살짝 우대해 "고립된 인기글"보다 "네트워크의 중심"을 위로 올린다.
export function todaysSpace(posts = [], n = 10) {
  const sigs = posts.map(postSignature);
  return posts
    .map((p, i) => {
      let degree = 0;
      for (let j = 0; j < sigs.length; j++) {
        if (i === j) continue;
        if (relatednessScore(sigs[i], sigs[j]) >= 12) degree += 1;
      }
      const engagement = (p.view_count ?? 0) + (p.like_count ?? 0) * 5 + (p.comment_count ?? 0) * 8;
      return { ...p, _hubDegree: degree, _spaceScore: engagement + degree * 12 };
    })
    .sort((a, b) => b._spaceScore - a._spaceScore)
    .slice(0, n);
}

// Editor's Pick — 오늘의 Space 중 "공간라운지에서만 볼 수 있는" 허브형 글 1건(연결이 가장 많은 것 우선).
export function editorsPick(posts = []) {
  const top = todaysSpace(posts, 20);
  return top.slice().sort((a, b) => (b._hubDegree - a._hubDegree) || (b._spaceScore - a._spaceScore))[0] ?? null;
}
