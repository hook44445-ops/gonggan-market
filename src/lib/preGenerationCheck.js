// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI 체크 — 글 생성 전 사전 점검 (Phase 3)
//
//   콘텐츠 원칙: "AI 는 절대로 중복 글을 만들지 않는다."
//   새 글을 쓰기 전에 반드시 기존 콘텐츠를 먼저 이해한다. 작업지시서의 5가지를 확인한다:
//     ① 기존 글 존재 여부   ② 중복 여부   ③ 더 좋은 글 작성 가능 여부
//     ④ 관련 글 연결 여부   ⑤ 카테고리 연결 여부
//
//   결과 verdict:
//     · "skip"   — 48h 내 사실상 동일한 글이 이미 있음(중복). 생성하지 않는다.
//     · "enrich" — 유사한 글이 있으나 부족함. 새로 쓰지 말고 "부족한 부분만" 보강 권장.
//     · "create" — 관련 글은 있으나 중복 아님. 생성하되 관련 글과 연결(Related)한다.
//
//   결정론적(외부 API 없음). Phase 4 에서 의미 유사도(임베딩)로 판단부를 교체하면 된다.
// ════════════════════════════════════════════════════════════════════

import { isDuplicateTopic, slugify } from "./duplicateChecker.js";
import { reinterpretThroughSpace } from "../constants/spacePhilosophy.js";
import { classifyCategory } from "../constants/aiContentFactory.js";
import { relatedArticles, postSignature, relatednessScore } from "./spaceGraph.js";
import { categoriesLinked, clusterOfCategory } from "../constants/knowledgeMap.js";

// enrich 판정 임계값 — 이 이상으로 닮은(그러나 완전 중복은 아닌) 글이 있으면 "보강" 권장.
const ENRICH_SCORE = 55;

// candidate: { topic, category? }  existingPosts: [{ id, title, category, ai_topic?, tags?, created_at }]
// 반환: {
//   verdict: 'create'|'enrich'|'skip',
//   topic, category, spaceKeyword, chain,
//   existingCount, isDuplicate, nearest:{post,score}|null,
//   related:[{...post,_score}],       // 연결할 관련 글
//   categoryLinked: boolean,          // 카테고리가 지식 지도에 연결돼 있는가
//   reasons: [string],                // 사람이 읽는 근거
// }
export function preGenerationCheck({ topic, category } = {}, existingPosts = []) {
  const t = String(topic ?? "").trim();
  const reinterpret = reinterpretThroughSpace(t);
  const cat = category || reinterpret.category || classifyCategory(t);

  // ① 기존 글 존재 여부 — 같은/연결된 카테고리 안에서 후보를 좁힌다.
  const pool = existingPosts.filter((p) => p && p.id != null && p.title);
  const existingCount = pool.length;

  // ② 중복 여부(48h 슬러그 동일) — Phase 2 duplicateChecker 재사용.
  const isDuplicate = isDuplicateTopic(t, pool, 48);

  // ④ 관련 글 연결 — 공간 그래프로 "같이 보면 좋은 글" 후보를 뽑는다.
  const pseudoPost = { id: `__candidate_${slugify(t)}`, title: t, ai_topic: t, category: cat, tags: [] };
  const related = relatedArticles(pseudoPost, pool, 5, 8);

  // ③ 더 좋은 글 작성 가능 여부 — 가장 닮은 글(nearest)의 연결도. 매우 높으면 "보강".
  const baseSig = postSignature(pseudoPost);
  let nearest = null;
  for (const p of pool) {
    const score = relatednessScore(baseSig, postSignature(p));
    if (!nearest || score > nearest.score) nearest = { post: p, score };
  }

  // ⑤ 카테고리 연결 여부 — 지식 지도상 다른 카테고리와 연결돼 있는가(고립 카테고리 경고).
  const cluster = clusterOfCategory(cat);
  const categoryLinked = pool.some((p) => p.category && p.category !== cat && categoriesLinked(cat, p.category));

  let verdict = "create";
  if (isDuplicate) verdict = "skip";
  else if (nearest && nearest.score >= ENRICH_SCORE) verdict = "enrich";

  const reasons = [];
  reasons.push(existingCount === 0 ? "기존 글 없음 — 새 주제입니다" : `기존 글 ${existingCount}건 확인`);
  if (isDuplicate) reasons.push("48시간 내 사실상 동일한 글이 있어 생성을 건너뜁니다");
  else if (verdict === "enrich") reasons.push(`매우 유사한 글이 있습니다(연결도 ${nearest.score}) — 새로 쓰지 말고 부족한 부분만 보강 권장`);
  else reasons.push("중복 아님 — 생성 후 관련 글과 연결합니다");
  reasons.push(related.length > 0 ? `연결할 관련 글 ${related.length}건` : "연결할 관련 글 없음(새 허브가 됩니다)");
  reasons.push(cluster ? `카테고리 클러스터: ${cluster.label}` : "클러스터 미지정 카테고리");

  return {
    verdict,
    topic: t,
    category: cat,
    spaceKeyword: reinterpret.spaceKeyword,
    chain: reinterpret.chain,
    existingCount,
    isDuplicate,
    nearest,
    related,
    categoryLinked,
    reasons,
  };
}
