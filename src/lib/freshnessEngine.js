// ════════════════════════════════════════════════════════════════════
// 공간라운지 Freshness Engine — 신선도 점수·신호·구조 다양화 (Phase 59 §2·§7·§8)
//
//   새로움이 없는 반복 글을 억지로 만들지 않는다. 후보마다 noveltyScore 를 계산하고,
//   최소 2개의 새 요소(사건/데이터/출처/관점/질문/연결/실용결론)를 요구한다.
//   최근 5개 기사와 같은 구조 반복을 피한다.
//
//   ⚠️ 신규 순수 함수 · repetitionGuard(similarity) 재사용. DB/Executor 무변경.
//     새 사건/공식데이터 여부는 텍스트 신호로 추정하되, 외부에서 확실한 신호를 주입할 수 있다.
// ════════════════════════════════════════════════════════════════════

import { maxSimilarityTo } from "./repetitionGuard.js";

// ── 신선도 신호(§2) — 7종. 텍스트 휴리스틱 + 주입 override ────────────────
const SIGNAL_RULES = {
  newEvent:              { points: 25, re: /속보|발표|출시|공개|첫\s|최초|기록|합의|타결|착공|개장|개막|사망|당선|판결|리콜/ },
  newOfficialData:       { points: 20, re: /(통계청|한국은행|정부|국토부|기재부|금융위|공식|보고서|지표|집계)/ },
  newSource:             { points: 15, re: /(출처|근거|자료|보도|인용|according|발표에\s*따르면|밝혔다)/ },
  newPerspective:        { points: 15, re: /(관점|분석|해석|시사점|의미|왜냐하면|배경|맥락)/ },
  newQuestion:           { points: 15, re: /(\?|어떻게|무엇을|왜\s|어디서|과연|질문)/ },
  newConnection:         { points: 10, re: /(공간|인테리어|연결|접목|관련해|영향을|파급)/ },
  newPracticalConclusion:{ points: 15, re: /(체크리스트|방법|팁|정리|준비|가이드|결론적으로|요약하면)/ },
};
export const SIGNAL_KEYS = Object.keys(SIGNAL_RULES);

// 신호 감지 — override(주입) 우선, 없으면 텍스트로 추정.
export function detectSignals(candidate = {}, { override = {} } = {}) {
  const text = `${candidate.title ?? ""}\n${candidate.content ?? candidate.body ?? ""}`;
  const signals = {};
  for (const [k, rule] of Object.entries(SIGNAL_RULES)) {
    signals[k] = k in override ? Boolean(override[k]) : rule.re.test(text);
  }
  return signals;
}

// ── noveltyScore(§7) ─────────────────────────────────────────────────────
//   신호 점수 합 − 최근 유사도 페널티(최대 -50).
export function noveltyScore(candidate = {}, existing = [], { override = {}, now = Date.now() } = {}) {
  const signals = detectSignals(candidate, { override });
  const signalPoints = SIGNAL_KEYS.reduce((n, k) => n + (signals[k] ? SIGNAL_RULES[k].points : 0), 0);
  const { similarity } = maxSimilarityTo(candidate, existing);
  const penalty = Math.round(Math.min(1, similarity) * 50);
  const raw = signalPoints - penalty;
  const signalCount = SIGNAL_KEYS.filter((k) => signals[k]).length;
  void now;
  return {
    score: raw,
    display: Math.max(0, Math.min(100, raw)),
    signals, signalCount,
    signalPoints, similarity, penalty,
    hasNewInfo: signalCount > 0,
  };
}

// ── 신선도 판정(§7 임계) + 반복 무정보 차단 ──────────────────────────────
export function freshnessVerdict(candidate = {}, existing = [], { override = {}, now = Date.now(), minSignals = 2 } = {}) {
  const nv = noveltyScore(candidate, existing, { override, now });
  // 새 정보가 전혀 없으면 점수와 무관하게 발행 금지(§7 단서).
  if (!nv.hasNewInfo) return { ...nv, verdict: "DISCARD", blocked: true, reason: "새 정보 없음(반복글)" };
  // 최소 2개 새 요소 미달 → 보강 필요(§2).
  const freshnessOk = nv.signalCount >= minSignals;
  let verdict;
  if (nv.score >= 75) verdict = "PROCEED";
  else if (nv.score >= 60) verdict = "AUGMENT";
  else if (nv.score >= 40) verdict = "PIVOT";
  else verdict = "DISCARD";
  const blocked = verdict === "DISCARD" || !freshnessOk;
  return {
    ...nv, verdict, freshnessOk, blocked: verdict === "DISCARD",
    needsAugment: verdict === "AUGMENT" || (!freshnessOk && verdict !== "DISCARD"),
    reason: verdict === "PROCEED" ? "신선도 충분" : verdict === "AUGMENT" ? "관점·자료 보강 후 재평가" : verdict === "PIVOT" ? "다른 각도로 전환" : "후보 폐기",
  };
}

// ── 기사 구조 다양화(§8) ─────────────────────────────────────────────────
export const STRUCTURE_TYPES = [
  { id: "breaking",  label: "속보형",        re: /속보|긴급|발표|방금|현재/ },
  { id: "data",      label: "데이터 해설형", re: /수치|지표|통계|그래프|%|퍼센트|증가율/ },
  { id: "compare",   label: "비교형",        re: /비교|대비|vs|보다|차이|장단점/ },
  { id: "qna",       label: "문답형",        re: /\?|질문|답변|q&a|묻고/ },
  { id: "case",      label: "사례형",        re: /사례|후기|경험|스토리|실제로/ },
  { id: "cause",     label: "원인·결과형",   re: /원인|이유|결과|때문|영향/ },
  { id: "timeline",  label: "과거·현재·미래형", re: /과거|현재|미래|전망|앞으로|이전에/ },
  { id: "debate",    label: "반론·재반론형", re: /반론|찬반|논란|그러나|반대로/ },
  { id: "checklist", label: "체크리스트형",  re: /체크리스트|단계|준비물|목록|리스트/ },
  { id: "space",     label: "공간 관점 연결형", re: /공간|인테리어|집|시공|리모델/ },
];

export function detectStructure(candidate = {}) {
  const text = `${candidate.title ?? ""}\n${candidate.content ?? candidate.body ?? ""}`;
  const hit = STRUCTURE_TYPES.find((s) => s.re.test(text));
  return hit ? hit.id : "general";
}

// 최근 기사 구조 목록(최신순).
export function recentStructures(existing = [], { limit = 5 } = {}) {
  return [...existing]
    .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))
    .slice(0, limit)
    .map((e) => detectStructure(e));
}

// 후보 구조가 최근 5개와 겹치면 다른 구조를 추천(§8).
export function pickStructure(candidate, existing = [], { limit = 5 } = {}) {
  const recent = recentStructures(existing, { limit });
  const current = detectStructure(candidate);
  if (!recent.includes(current)) return { structure: current, repeats: false, recommended: current, recent };
  const alt = STRUCTURE_TYPES.map((s) => s.id).find((id) => !recent.includes(id)) || current;
  return { structure: current, repeats: true, recommended: alt, recent };
}
