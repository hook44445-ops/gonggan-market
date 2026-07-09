// ════════════════════════════════════════════════════════════════════
// 공간라운지 Space Search — 지식 검색 (Phase 5 · Space Media)
//
//   검색을 "게시글 검색"이 아니라 "지식 검색"으로 만든다. 제목·본문·태그·카테고리를 함께
//   검색하고, Space Graph(공간 관점)로 확장해 직접 매칭이 없어도 연결된 글을 찾아준다.
//
//   결정론적 순수 함수(외부 API·인덱스 없음) — 클라이언트에서 이미 로드된 글 목록을 검색한다.
//   Phase 6 에서 서버 전문검색(FTS)/임베딩으로 교체해도 반환 형태는 유지(UI 무변경).
// ════════════════════════════════════════════════════════════════════

import { reinterpretThroughSpace } from "../constants/spacePhilosophy.js";
import { relatednessScore, postSignature } from "./spaceGraph.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";

// 본문에서 마크다운 마커를 제거한 한 줄 요약(검색 결과 스니펫용). richText.jsx 의 plainExcerpt 와
//   동작이 같지만, 순수 lib 가 컴포넌트(.jsx)에 의존하지 않도록 여기 인라인한다.
function plainExcerpt(content = "") {
  return String(content)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-•]\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const norm = (s) => String(s ?? "").toLowerCase();
const tokenize = (s) => norm(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 1);

// 한 글에 대한 직접 매칭 점수(제목 > 태그 > 카테고리 > 본문).
function directScore(query, post) {
  const q = norm(query);
  const qTokens = tokenize(query);
  if (!q) return 0;
  const title = norm(post.title);
  const tags = (Array.isArray(post.tags) ? post.tags : []).map(norm);
  const catLabel = norm(CATEGORY_LABEL[post.category] || post.category);
  const body = norm(post.content);

  let s = 0;
  if (title.includes(q)) s += 60;
  if (tags.some((t) => t.includes(q))) s += 35;
  if (catLabel.includes(q)) s += 25;
  if (body.includes(q)) s += 20;
  // 토큰 부분매칭(제목/본문) — 다어절 질의 보강.
  for (const tok of qTokens) {
    if (title.includes(tok)) s += 8;
    if (body.includes(tok)) s += 3;
    if (tags.some((t) => t.includes(tok))) s += 5;
  }
  return s;
}

// 지식 검색. query: 검색어 · posts: 대상 글 목록.
//   반환: {
//     query, spaceKeyword, chain,        // 질의를 공간 관점으로 재해석한 결과(검색도 공간 관점)
//     results:[{ ...post, _score, _matched, _excerpt }],  // _matched: 'direct'|'graph'
//     categories:[{ category, label, count }],            // 결과의 카테고리 분포(패싯)
//   }
export function spaceSearch(query, posts = [], { limit = 30, includeGraph = true } = {}) {
  const q = String(query ?? "").trim();
  const reinterpret = reinterpretThroughSpace(q);
  const list = (posts || []).filter((p) => p && p.id != null && p.title);
  if (!q) return { query: q, spaceKeyword: reinterpret.spaceKeyword, chain: reinterpret.chain, results: [], categories: [] };

  // 1) 직접 매칭.
  const direct = [];
  const matchedIds = new Set();
  for (const p of list) {
    const s = directScore(q, p);
    if (s > 0) { direct.push({ ...p, _score: s, _matched: "direct" }); matchedIds.add(p.id); }
  }

  // 2) Space Graph 확장 — 직접 매칭된 상위 글과 공간 연결도가 높은 글을 보강(지식 검색).
  const graph = [];
  if (includeGraph && direct.length) {
    const seeds = direct.slice().sort((a, b) => b._score - a._score).slice(0, 5).map(postSignature);
    for (const p of list) {
      if (matchedIds.has(p.id)) continue;
      const sig = postSignature(p);
      let best = 0;
      for (const seed of seeds) best = Math.max(best, relatednessScore(seed, sig));
      if (best >= 20) graph.push({ ...p, _score: Math.round(best * 0.5), _matched: "graph" });
    }
  }

  const results = [...direct, ...graph]
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map((p) => ({ ...p, _excerpt: plainExcerpt(p.content).slice(0, 100) }));

  // 카테고리 패싯.
  const catMap = new Map();
  for (const r of results) {
    const c = r.category || "free";
    catMap.set(c, (catMap.get(c) || 0) + 1);
  }
  const categories = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, label: CATEGORY_LABEL[category] || category, count }))
    .sort((a, b) => b.count - a.count);

  return { query: q, spaceKeyword: reinterpret.spaceKeyword, chain: reinterpret.chain, results, categories };
}
