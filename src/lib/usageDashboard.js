// ════════════════════════════════════════════════════════════════════
// 공간라운지 LLM Usage Dashboard — 사용량/비용/품질 대시보드 (Phase 20.7)
//
//   워크벤치 생성 기록(localStorage)을 집계해 운영자가 LLM 사용량·비용·품질·성공률을
//   한눈에 본다. DB/API/Cron 없음 — 기존 saveWorkbenchRecord 기록만 읽는다(호출만).
//
//   ⚠️ Regression Zero: 순수 함수 · editorWorkbench.getWorkbenchRecords() 호출만.
// ════════════════════════════════════════════════════════════════════

import { getWorkbenchRecords } from "./editorWorkbench.js";
import { llmConfig } from "./llmClient.js";

// OpenRouter anthropic/claude-3.5-sonnet 기준 단가(USD / 1M tokens). 필요 시 조정.
const PRICE_IN_PER_M = 3.0;
const PRICE_OUT_PER_M = 15.0;
const USD_TO_KRW = 1350;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isWithin = (ts, ms, now) => ts && now - ts <= ms;
const startOfToday = (now) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); };

// 레코드 1건의 비용(KRW). totalTokens 만 있으면 8:2(입력:출력) 가정으로 근사.
function recordCostKRW(r) {
  let inTok = num(r.promptTokens), outTok = num(r.completionTokens);
  if (!inTok && !outTok && num(r.totalTokens)) { inTok = Math.round(num(r.totalTokens) * 0.8); outTok = num(r.totalTokens) - inTok; }
  const usd = (inTok / 1e6) * PRICE_IN_PER_M + (outTok / 1e6) * PRICE_OUT_PER_M;
  return usd * USD_TO_KRW;
}

// 범위별 집계. range: 'today'|'week'|'month'|'all'
export function usageStats(range = "today", now = Date.now()) {
  const all = getWorkbenchRecords().filter((r) => r && r.savedAt);
  const winMs = { week: 7 * 864e5, month: 30 * 864e5 }[range];
  const rows = all.filter((r) => {
    if (range === "all") return true;
    if (range === "today") return r.savedAt >= startOfToday(now);
    return isWithin(r.savedAt, winMs, now);
  });

  const requests = rows.length;
  const success = rows.filter((r) => r.source === "llm").length;
  const failed = rows.filter((r) => r.source === "error").length;
  const regen = Math.max(0, requests - new Set(rows.map((r) => (r.draft?.title || "").trim().toLowerCase())).size); // 같은 제목 반복 = 재생성 근사

  let promptTok = 0, completionTok = 0, totalTok = 0, latencySum = 0, latencyN = 0, edSum = 0, edN = 0, confSum = 0, confN = 0, costKRW = 0, pick = 0;
  for (const r of rows) {
    promptTok += num(r.promptTokens); completionTok += num(r.completionTokens);
    totalTok += num(r.totalTokens) || (num(r.promptTokens) + num(r.completionTokens)) || num(r.tokens);
    if (num(r.latency)) { latencySum += num(r.latency); latencyN += 1; }
    if (num(r.editorialScore)) { edSum += num(r.editorialScore); edN += 1; if (num(r.editorialScore) >= 85) pick += 1; }
    if (num(r.confidence)) { confSum += num(r.confidence); confN += 1; }
    costKRW += recordCostKRW(r);
  }

  return {
    range, requests, success, failed,
    successRate: requests ? Math.round((success / requests) * 100) : null,
    regen,
    promptTokens: promptTok, completionTokens: completionTok, totalTokens: totalTok,
    avgLatencyMs: latencyN ? Math.round(latencySum / latencyN) : null,
    avgEditorialScore: edN ? Math.round(edSum / edN) : null,
    avgConfidence: confN ? Math.round(confSum / confN) : null,
    editorsPickRatio: edN ? Math.round((pick / edN) * 100) : null,
    costKRW: Math.round(costKRW),
  };
}

// 4개 범위 한 번에.
export function usageOverview(now = Date.now()) {
  return { today: usageStats("today", now), week: usageStats("week", now), month: usageStats("month", now), all: usageStats("all", now) };
}

// OpenRouter 상태 한 줄 — 🟢 연결 · 모델 · 평균속도 · 오늘 N회 · 비용.
export function openRouterStatus(now = Date.now()) {
  const cfg = llmConfig();
  const today = usageStats("today", now);
  const modelShort = String(cfg.model).split("/").pop().replace("claude-3.5-sonnet", "Claude Sonnet");
  return {
    connected: cfg.configured,
    provider: cfg.provider,
    model: modelShort,
    avgLatencySec: today.avgLatencyMs != null ? Math.round(today.avgLatencyMs / 100) / 10 : null,
    todayCount: today.requests,
    todayCostKRW: today.costKRW,
  };
}
