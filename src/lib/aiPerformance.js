// ════════════════════════════════════════════════════════════════════
// 공간마켓 AI 성과·인사 — 근무기록·성과평가·승진·채용·비활성 (Phase 30 · V3)
//
//   직원(AI)별 성과를 "이미 쌓인 기록"에서 집계한다: 워크벤치 생성기록(editorWorkbench,
//   localStorage)을 모델 슬러그로 묶어 근무건수·성공률·속도·비용·품질·별점·직급을 낸다.
//   신규 채용(OpenRouter 신모델 후보)·비활성(비싸고 품질 낮은 직원) 제안도 제공한다.
//
//   ⚠️ 기존 기록만 읽는다(호출만) · 기존 엔진/발행/통계 로직 무변경. Regression Zero.
//   DB/API/Cron 없음 · 순수 함수.
// ════════════════════════════════════════════════════════════════════

import { getWorkbenchRecords } from "./editorWorkbench.js";
import { AI_STAFF, DEPARTMENTS, staffStatus } from "./aiOrg.js";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const PRICE = {
  "anthropic/claude-3.5-sonnet": [3, 15], "google/gemini-flash-1.5": [0.075, 0.3],
  "openai/gpt-4o-mini": [0.15, 0.6], "x-ai/grok-2-1212": [2, 10],
  "deepseek/deepseek-chat": [0.14, 0.28], "qwen/qwen-2.5-72b-instruct": [0.35, 0.4],
};
const USD_TO_KRW = 1350;
const HUMAN_MIN_PER_ARTICLE = 55; // 사람이 글 1건에 쓰는 대략 시간(절약 시간 산정용).

function recCostKRW(r, model) {
  let inTok = num(r.promptTokens), outTok = num(r.completionTokens);
  if (!inTok && !outTok && num(r.totalTokens)) { inTok = Math.round(num(r.totalTokens) * 0.8); outTok = num(r.totalTokens) - inTok; }
  const [pin, pout] = PRICE[model] || [1, 3];
  return ((inTok / 1e6) * pin + (outTok / 1e6) * pout) * USD_TO_KRW;
}

const isToday = (ts, now) => { if (!ts) return false; const d = new Date(ts), n = new Date(now); return d.toDateString() === n.toDateString(); };

// 별점(1~5) — 품질(Editorial)·성공률 복합.
function ratingOf({ jobs, successRate, avgEditorial }) {
  if (!jobs) return null;
  const q = avgEditorial != null ? avgEditorial : 70;
  const s = successRate != null ? successRate : 100;
  const score = q * 0.7 + s * 0.3; // 0~100
  return Math.max(1, Math.min(5, Math.round(score / 20)));
}

// 승진 직급 — 5★이면 부서장, 그 외 등급별.
function promotionTitle(staff, rating) {
  if (rating == null) return "대기";
  if (rating >= 5) {
    return { claude_magazine: "편집국장", gpt_seo: "SEO팀장", gemini_breaking: "뉴스국장",
      gemini_trend: "운영실장", claude_reviewer: "검수팀장", grok_sns: "SNS팀장" }[staff.id] || "수석";
  }
  if (rating >= 4) return "선임";
  if (rating >= 3) return "담당";
  return "수습";
}

// 직원별 성과. 반환 배열: { ...staff, jobs, jobsToday, successRate, avgLatencyMs, avgEditorial, avgConfidence, costKRW, rating, title }
export function staffPerformance(now = Date.now()) {
  const recs = getWorkbenchRecords().filter((r) => r && r.savedAt);
  return AI_STAFF.map((s) => {
    const mine = recs.filter((r) => r.llmModel === s.model);
    const jobs = mine.length;
    const jobsToday = mine.filter((r) => isToday(r.savedAt, now)).length;
    const success = mine.filter((r) => r.source === "llm").length;
    let latSum = 0, latN = 0, edSum = 0, edN = 0, confSum = 0, confN = 0, cost = 0;
    for (const r of mine) {
      if (num(r.latency)) { latSum += num(r.latency); latN += 1; }
      if (num(r.editorialScore)) { edSum += num(r.editorialScore); edN += 1; }
      if (num(r.confidence)) { confSum += num(r.confidence); confN += 1; }
      cost += recCostKRW(r, s.model);
    }
    const successRate = jobs ? Math.round((success / jobs) * 100) : null;
    const avgEditorial = edN ? Math.round(edSum / edN) : null;
    const rating = ratingOf({ jobs, successRate, avgEditorial });
    return {
      ...staffStatus(s), jobs, jobsToday, successRate,
      avgLatencyMs: latN ? Math.round(latSum / latN) : null,
      avgEditorial, avgConfidence: confN ? Math.round(confSum / confN) : null,
      costKRW: Math.round(cost), rating, title: promotionTitle(s, rating),
    };
  }).sort((a, b) => (b.jobs - a.jobs) || ((b.rating || 0) - (a.rating || 0)));
}

// 모델 슬러그 → 표시명(직원명이 있으면 그걸, 없으면 슬러그 끝).
function modelDisplayName(model) {
  const s = AI_STAFF.find((x) => x.model === model);
  return s ? s.name : String(model || "unknown").split("/").pop();
}

// 근무기록 요약 — "AI(모델)별" 집계(같은 모델 공유 직원 중복 방지).
export function workLog(now = Date.now()) {
  const recs = getWorkbenchRecords().filter((r) => r && r.savedAt);
  const byModel = {}, byModelToday = {};
  for (const r of recs) {
    byModel[r.llmModel] = (byModel[r.llmModel] || 0) + 1;
    if (isToday(r.savedAt, now)) byModelToday[r.llmModel] = (byModelToday[r.llmModel] || 0) + 1;
  }
  const rows = (map) => Object.entries(map).map(([model, jobs]) => ({ model, name: modelDisplayName(model), jobs })).sort((a, b) => b.jobs - a.jobs);
  return {
    today: rows(byModelToday), total: rows(byModel),
    totalJobs: recs.length,
    todayJobs: recs.filter((r) => isToday(r.savedAt, now)).length,
  };
}

// AI 비용 요약 — 레코드 기준(중복 없음). 시간 절약 추정 포함.
export function aiBudget(now = Date.now()) {
  const recs = getWorkbenchRecords().filter((r) => r && r.savedAt);
  const totalJobs = recs.length;
  const todayJobs = recs.filter((r) => isToday(r.savedAt, now)).length;
  const totalKRW = Math.round(recs.reduce((n, r) => n + recCostKRW(r, r.llmModel), 0));
  const todayKRW = Math.round(recs.filter((r) => isToday(r.savedAt, now)).reduce((n, r) => n + recCostKRW(r, r.llmModel), 0));
  return {
    todayKRW, totalKRW, todayJobs, totalJobs,
    savedHours: Math.round((totalJobs * HUMAN_MIN_PER_ARTICLE) / 60),
    avgCostPerJobKRW: totalJobs ? Math.round(totalKRW / totalJobs) : 0,
  };
}

// ── 채용(신규 AI 후보) — OpenRouter 신모델. 편입 시 aiOrg.AI_STAFF 에 추가하면 됨 ──
export const HIRING_CANDIDATES = [
  { model: "anthropic/claude-3.7-sonnet", role: "심층 매거진(강화)", dept: "editorial" },
  { model: "openai/gpt-4o", role: "고급 SEO·카피", dept: "support" },
  { model: "google/gemini-2.0-flash-exp", role: "최신 속보(실험)", dept: "operations" },
  { model: "perplexity/llama-3.1-sonar-large-128k-online", role: "실시간 리서치·출처", dept: "support" },
  { model: "mistralai/mistral-large", role: "다국어·요약", dept: "support" },
];
export function hiringCandidates() {
  const owned = new Set(AI_STAFF.map((s) => s.model));
  return HIRING_CANDIDATES.filter((c) => !owned.has(c.model)).map((c) => ({ ...c, deptName: DEPARTMENTS[c.dept]?.name || c.dept }));
}

// ── 비활성/해고(?) 제안 — 비용 높은데 성과 낮은 직원 → OFF 권장 + 대체 직원 ──
export function deactivationSuggestions(now = Date.now()) {
  const perf = staffPerformance(now);
  const out = [];
  for (const p of perf) {
    const pricey = p.cost === "high" || p.cost === "top";
    const weak = p.rating != null && p.rating <= 2;
    if (pricey && weak) {
      const alt = perf.find((x) => x.id !== p.id && (x.cost === "low" || x.cost === "mid") && (x.defaultFor || []).some((k) => (p.defaultFor || []).includes(k)));
      out.push({ id: p.id, name: p.name, reason: `비용 ${p.costLabel}·품질 낮음(${p.rating}★)`, alternative: alt ? alt.name : "대체 없음" });
    }
  }
  return out;
}
