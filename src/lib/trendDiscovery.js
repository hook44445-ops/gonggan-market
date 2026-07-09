// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI Trend Discovery Engine — 기획 AI (Phase 14)
//
//   지금까지는 사람이 이슈를 넣으면 AI 가 "생성"했다. 이 엔진은 그 앞단 — AI 가 먼저
//   "무엇을 써야 하는지" 판단하는 기획 레이어다. 트렌드 후보를 모아 점수화하고,
//   카테고리 다양성과 최근 발행 기록을 고려해 발행 우선순위를 추천한다.
//
//   ⚠️ 지금은 실제 뉴스/Google Trends/RSS 를 연결하지 않는다 — Mock 데이터로 구현하되,
//   provider 함수를 분리해 향후 실제 API 로 "함수만 교체"할 수 있게 한다(수집부 = collect()).
//
//   결정론적(seed 로 회전) · 저장/Migration/API/Cron 없음 · 기존 데이터(발행글)만 참고.
//   Phase 12 콘텐츠 영역 레지스트리를 재사용해 topic→카테고리/키워드를 얻는다(엔진 무수정).
// ════════════════════════════════════════════════════════════════════

import { CONTENT_AREAS, contentAreaFor, recommendedKeywordsFor } from "../constants/contentAreas.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const label = (id) => CATEGORY_LABEL[id] || id;

// ── Mock Trend Pool (수집부 = collect 교체 지점) ────────────────────
// 각 항목: { topic, areaId, baseInterest(0~100), urgency('breaking'|'high'|'normal') }
// 향후 이 배열을 Google Trends/News/RSS 응답으로 대체하면 나머지 로직은 그대로 동작한다.
const MOCK_TREND_POOL = [
  { topic: "미국 기준금리 동결과 하반기 전망", areaId: "economy",   baseInterest: 88, urgency: "high" },
  { topic: "반도체 슈퍼사이클과 코스피 방향",   areaId: "kr_stock",  baseInterest: 85, urgency: "high" },
  { topic: "엔비디아 실적과 AI 반도체 랠리",     areaId: "us_stock",  baseInterest: 90, urgency: "breaking" },
  { topic: "생성형 AI 에이전트, 업무를 어떻게 바꾸나", areaId: "ai",   baseInterest: 92, urgency: "breaking" },
  { topic: "온디바이스 AI 와 스마트폰 트렌드",   areaId: "it",        baseInterest: 76, urgency: "normal" },
  { topic: "전세사기 이후 달라진 임대차 체크",   areaId: "realestate", baseInterest: 80, urgency: "high" },
  { topic: "가을 국내 단풍 여행 코스 정리",       areaId: "travel",    baseInterest: 72, urgency: "normal" },
  { topic: "올해의 인문 베스트셀러 다시 읽기",   areaId: "book",      baseInterest: 64, urgency: "normal" },
  { topic: "조선의 위기 대응에서 배우는 것",     areaId: "history",   baseInterest: 58, urgency: "normal" },
  { topic: "불확실성의 시대, 스토아 철학의 쓸모", areaId: "philosophy", baseInterest: 55, urgency: "normal" },
  { topic: "작심삼일을 이기는 습관 설계",         areaId: "self_dev",  baseInterest: 70, urgency: "normal" },
  { topic: "올가을 기대 신작 게임 라인업",       areaId: "game",      baseInterest: 68, urgency: "normal" },
  { topic: "전기차 보조금 개편과 구매 타이밍",   areaId: "auto",      baseInterest: 74, urgency: "high" },
  { topic: "가을 개봉 화제작 미리보기",           areaId: "movie",     baseInterest: 66, urgency: "normal" },
  { topic: "환절기 수면의 질 높이는 법",         areaId: "health",    baseInterest: 71, urgency: "normal" },
  { topic: "1인 가구를 위한 살림 루틴",           areaId: "self_dev",  baseInterest: 62, urgency: "normal" },
  { topic: "물가와 소비, 요즘 지갑 사정",         areaId: "economy",   baseInterest: 77, urgency: "normal" },
  { topic: "배당주로 만드는 현금흐름 전략",       areaId: "kr_stock",  baseInterest: 73, urgency: "normal" },
];

const URGENCY_BONUS = { breaking: 25, high: 12, normal: 0 };
const URGENCY_LABEL = { breaking: "긴급", high: "상승", normal: "일반" };

// 결정론적 시드 지터 — "추천 새로 찾기"(seed 변경) 시 순위가 살짝 바뀌게 한다(트렌드는 시시각각 변함).
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295; // 0~1
}
function seedJitter(topic, seed) {
  // seed 를 문자열 앞에 둔다 — FNV 해시 특성상 앞 바이트가 전체에 전파돼 시드별로 값이 확실히 달라진다.
  return (hashStr(`${seed}:${topic}`) - 0.5) * 30; // ±15 — 새로고침 때 중위권 순위가 실제로 바뀌게
}

// Mock provider — seed 로 회전(추천 새로 찾기 시 다른 조합). 실제 API 교체 시 이 함수만 바꾼다.
//   반환: raw candidate[] ({ topic, areaId, baseInterest, urgency })
export function mockTrendProvider({ seed = 0 } = {}) {
  const n = MOCK_TREND_POOL.length;
  const offset = ((seed % n) + n) % n;
  return MOCK_TREND_POOL.map((_, i) => MOCK_TREND_POOL[(i + offset) % n]);
}

// 최근 발행글에서 카테고리 빈도(다양성 판단용). 최신 window 개만 본다.
function recentCategoryFreq(recentPublished = [], window = 12) {
  const sorted = (recentPublished || [])
    .filter((p) => p && p.category)
    .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))
    .slice(0, window);
  const freq = new Map();
  sorted.forEach((p) => freq.set(p.category, (freq.get(p.category) || 0) + 1));
  return { freq, mostRecentCategory: sorted[0]?.category ?? null };
}

// Trend Score(0~100) — 관심도 + 시의성 − 최근 과다발행 카테고리 페널티.
function computeTrendScore(raw, area, freq) {
  const base = raw.baseInterest;
  const urgency = URGENCY_BONUS[raw.urgency] ?? 0;
  const cat = area?.category ?? "free";
  const seen = freq.get(cat) || 0;
  const diversityPenalty = Math.min(seen * 12, 30); // 최근 많이 낸 카테고리일수록 감점
  return clamp(base * 0.72 + urgency + 8 - diversityPenalty);
}

export function priorityFromTrendScore(score) {
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

// 한 raw 후보 → Trend Candidate(스펙 구조). trendScore 는 시드와 무관하게 정확히 표시한다.
function toCandidate(raw, freq, mostRecentCategory) {
  const area = CONTENT_AREAS.find((a) => a.id === raw.areaId) || contentAreaFor(raw.topic);
  const category = area?.category ?? "free";
  const trendScore = computeTrendScore(raw, area, freq);
  const priority = priorityFromTrendScore(trendScore);
  const estimatedInterest = Math.round(400 + trendScore * 28 + (raw.urgency === "breaking" ? 800 : raw.urgency === "high" ? 300 : 0));
  const seen = freq.get(category) || 0;
  const reasonParts = [];
  if (raw.urgency !== "normal") reasonParts.push(`${URGENCY_LABEL[raw.urgency]} 이슈`);
  reasonParts.push(`관심도 ${raw.baseInterest}`);
  reasonParts.push(seen === 0 ? "최근 이 카테고리 발행 없음(다양성↑)" : `최근 ${seen}건 발행됨`);
  return {
    topic: raw.topic,
    keywords: (recommendedKeywordsFor(raw.topic).length ? recommendedKeywordsFor(raw.topic) : (area?.recommended ?? [])).slice(0, 6),
    category,
    categoryLabel: label(category),
    area: area ? { id: area.id, label: area.label } : null,
    priority,
    reason: reasonParts.join(" · "),
    trendScore,
    estimatedInterest,
    publishRecommendation: trendScore >= 75 ? "지금 발행 추천" : trendScore >= 55 ? "검토 후 발행" : "보류",
    urgency: raw.urgency,
    _sameAsMostRecent: category === mostRecentCategory,
  };
}

// 카테고리 다양성 재정렬 — 랭크(점수+시드지터)순 정렬 후, 같은 카테고리 연속 배치를 피한다(그리디).
//   _rank 는 정렬 전용(표시 trendScore 는 불변). 시드가 바뀌면 순위·선택이 달라진다(추천 새로 찾기).
function diversify(cands) {
  const sorted = cands.slice().sort((a, b) => b._rank - a._rank);
  const out = [];
  const pool = sorted.slice();
  let lastCat = null;
  while (pool.length) {
    let idx = pool.findIndex((c) => c.category !== lastCat);
    if (idx === -1) idx = 0; // 남은 게 전부 같은 카테고리면 그냥 순서대로
    const [picked] = pool.splice(idx, 1);
    out.push(picked);
    lastCat = picked.category;
  }
  return out;
}

// ── discoverTrendingTopics — 기획 AI 진입점 ─────────────────────────
//   opts: { recentPublished, limit, seed, provider }
//   반환: [{ topic, keywords, category, priority, reason, trendScore, estimatedInterest, publishRecommendation, ... }]
export function discoverTrendingTopics({ recentPublished = [], limit = 8, seed = 0, provider = mockTrendProvider } = {}) {
  const raw = provider({ seed });
  const { freq, mostRecentCategory } = recentCategoryFreq(recentPublished);

  // 중복 topic 제거 후 후보화.
  const seen = new Set();
  const cands = [];
  for (const r of raw) {
    const key = String(r.topic).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const cand = toCandidate(r, freq, mostRecentCategory);
    cand._rank = cand.trendScore + seedJitter(cand.topic, seed); // 정렬/선택 전용(표시 점수 불변)
    cands.push(cand);
  }
  const picked = diversify(cands).slice(0, limit);
  picked.forEach((c) => { delete c._rank; }); // 내부 필드 정리
  return picked;
}

// 요약 지표(패널 헤더용).
export function trendSummary(candidates = []) {
  const byPriority = { High: 0, Medium: 0, Low: 0 };
  candidates.forEach((c) => { byPriority[c.priority] = (byPriority[c.priority] || 0) + 1; });
  const categories = new Set(candidates.map((c) => c.category));
  return { total: candidates.length, ...byPriority, categoryDiversity: categories.size };
}
