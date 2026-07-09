// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI 편집국 — "오늘의 이슈" 자동 생성 (Phase 2·AI Editor)
//
//   매일 사회·경제·주식·부동산·문화·라이프·AI·날씨·계절 + 공간마켓 내부 데이터를
//   분석해 "오늘의 이슈 Top20" 을 만든다. 편집회의(aiEditor.js)의 입력이 된다.
//
//   Phase 2 는 결정론적이다 — 도메인별 시드 이슈 + 트렌드 Provider 수집분을 합쳐
//   중복을 제거하고 상위 N개를 낸다. Phase 3 에서 실제 뉴스/트렌드 API 가 붙으면
//   collectAllTrends() 결과와 아래 도메인 시드를 그대로 합치기만 하면 된다.
// ════════════════════════════════════════════════════════════════════

import { slugify } from "./duplicateChecker.js";

// 도메인별 시드 이슈 — 실 API 연결 전까지 편집회의가 끝까지 동작하도록 하는 기준 이슈.
// (Phase 3: 뉴스/트렌드 API 로 매일 갱신되는 실 이슈로 교체)
export const ISSUE_DOMAINS = [
  { id: "society",   label: "사회",   seeds: ["1인 가구 증가", "고령화 사회", "저출산"] },
  { id: "economy",   label: "경제",   seeds: ["금리 인하", "물가 상승", "대출 규제"] },
  { id: "stock",     label: "주식",   seeds: ["반도체 랠리", "증시 변동성"] },
  { id: "realestate",label: "부동산", seeds: ["부동산 대책", "전세사기", "청약 경쟁"] },
  { id: "culture",   label: "문화",   seeds: ["레트로 유행", "홈카페 열풍"] },
  { id: "life",      label: "라이프", seeds: ["미니멀 라이프", "반려동물 증가", "홈트레이닝"] },
  { id: "ai",        label: "AI",     seeds: ["AI 스마트홈", "생성형 AI 확산"] },
  { id: "weather",   label: "날씨",   seeds: ["폭염", "장마", "한파", "미세먼지"] },
  { id: "season",    label: "계절",   seeds: ["환절기", "이사철"] },
];

// 도메인 가중치 — 공간마켓 서비스 특성상 주거/부동산/생활 계열을 조금 더 위로 올린다(표시 순서용).
const DOMAIN_WEIGHT = {
  realestate: 6, life: 6, weather: 5, season: 5, economy: 4,
  society: 4, ai: 3, culture: 3, stock: 2,
};

// 오늘의 이슈 Top-N 생성.
//   trends:   외부에서 수집한 TrendItem[](선택) — collectAllTrends().items 를 그대로 넣으면 된다.
//   internal: 공간마켓 내부 데이터 힌트(선택) — [{ topic, domain }] 형태(예: 급증 검색어).
//   반환: [{ topic, domain, domainLabel, source, weight }] (weight 내림차순, 중복 슬러그 제거).
export function generateDailyIssues({ trends = [], internal = [], limit = 20 } = {}) {
  const pool = [];

  // 1) 도메인 시드
  for (const d of ISSUE_DOMAINS) {
    for (const s of d.seeds) {
      pool.push({ topic: s, domain: d.id, domainLabel: d.label, source: "domain_seed", weight: DOMAIN_WEIGHT[d.id] ?? 3 });
    }
  }
  // 2) 외부 트렌드(수집분) — 실 이슈이므로 시드보다 살짝 높은 가중치.
  for (const t of trends) {
    if (!t?.topic) continue;
    pool.push({ topic: t.topic, domain: "trend", domainLabel: "실시간", source: t.providerId ?? "trend", weight: 8 });
  }
  // 3) 내부 데이터 힌트 — 우리 서비스에서 실제로 뜨는 이슈이므로 최상위 가중치.
  for (const it of internal) {
    if (!it?.topic) continue;
    const dom = ISSUE_DOMAINS.find((d) => d.id === it.domain);
    pool.push({ topic: it.topic, domain: it.domain ?? "internal", domainLabel: dom?.label ?? "내부", source: "internal", weight: 10 });
  }

  // 슬러그 기준 중복 제거(가장 높은 weight 유지).
  const bySlug = new Map();
  for (const item of pool) {
    const key = slugify(item.topic);
    if (!key) continue;
    const prev = bySlug.get(key);
    if (!prev || item.weight > prev.weight) bySlug.set(key, item);
  }

  return [...bySlug.values()].sort((a, b) => b.weight - a.weight).slice(0, limit);
}
