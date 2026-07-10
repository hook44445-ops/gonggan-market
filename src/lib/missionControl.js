// ════════════════════════════════════════════════════════════════════
// 공간마켓 Mission Control — AI 운영센터 집계 (Phase 33)
//
//   AI 회사가 "스스로 감시·보고·이상징후 발견"하도록, 이미 쌓인 데이터를 한 곳으로 모은다:
//     대시보드 · AI Health · 장애 감지 · 관리자 알림 · 비용/품질 리포트 · 브리핑 · 운영점수.
//
//   ⚠️ 전부 "읽기 전용 집계" — 기존 엔진/큐/발행/DB 무변경(호출만). Regression Zero.
//   DB/API/Cron/ENV 없음 · 순수 함수.
// ════════════════════════════════════════════════════════════════════

import { queueSummary } from "./automationQueue.js";
import { aiBudget, staffPerformance } from "./aiPerformance.js";
import { usageMoneyOverview, usageByModel, usageStats } from "./usageDashboard.js";
import { fusionStats } from "./fusionHistory.js";
import { getActivityLog } from "./activityLog.js";
import { providerStatus, LLM_PROVIDERS } from "./llmProviders.js";
import { AI_STAFF } from "./aiOrg.js";
import { budgetStatus, getAutoConfig } from "./autoPublish.js";
import { isLLMConfigured } from "./llmClient.js";

// ── AI Health (🟢🟡🔴) — 최근 활동의 실패율 + 연결 상태로 판정 ──────────
const shortModel = (m) => String(m || "").split("/").pop();

function recentStats(model, now = Date.now()) {
  const win = 3 * 3600 * 1000; // 최근 3시간
  const rows = getActivityLog().filter((r) => r.model && (r.model === model || shortModel(r.model) === shortModel(model)) && now - r.at <= win);
  const fail = rows.filter((r) => r.kind === "failed" || /failed/.test(r.kind) || r.ok === false).length;
  const ok = rows.length - fail;
  return { total: rows.length, ok, fail, failRate: rows.length ? Math.round((fail / rows.length) * 100) : 0 };
}

// AI 직원(모델)별 상태.
export function providersHealth(now = Date.now()) {
  const seen = new Set();
  const rows = [];
  for (const s of AI_STAFF) {
    if (seen.has(s.model)) continue; seen.add(s.model);
    // 모든 모델이 OpenRouter 경유로 호출되므로, OpenRouter 키가 있으면 사용 가능(직접 키가 있으면 더 좋음).
    const configured = (LLM_PROVIDERS[s.provider]?.isConfigured?.() ?? false) || isLLMConfigured();
    const rs = recentStats(s.model, now);
    let status = "green";
    if (!configured) status = "red";
    else if (rs.total >= 3 && rs.failRate >= 50) status = "red";
    else if (rs.failRate >= 20 || rs.total === 0) status = rs.total === 0 ? "idle" : "yellow";
    rows.push({ name: s.name, model: s.model, provider: s.provider, status, recent: rs.total, failRate: rs.failRate });
  }
  // 외부 서비스(향후 편입) — 정직한 상태 표시.
  rows.push({ name: "Perplexity(리서치)", model: "perplexity", provider: "openrouter", status: "yellow", recent: 0, failRate: 0, note: "OpenRouter 경유 · 가용 불확실" });
  rows.push({ name: "Flux(이미지)", model: "flux", provider: "image", status: "red", recent: 0, failRate: 0, note: "미연결" });
  rows.push({ name: "Veo(영상)", model: "veo", provider: "video", status: "red", recent: 0, failRate: 0, note: "미연결" });
  return rows;
}

// ── 장애/이상징후 감지 ──────────────────────────────────────────────
export function detectAnomalies(now = Date.now()) {
  const out = [];
  const q = queueSummary(now);
  const today = usageStats("today", now);
  const cfg = getAutoConfig();
  const bud = budgetStatus(cfg, now);
  const health = providersHealth(now);

  // API 실패율 증가.
  const failedTotal = today.failed || 0, req = today.requests || 0;
  if (req >= 4 && failedTotal / req >= 0.3) out.push({ level: "high", kind: "api_fail", message: `API 실패율 ${Math.round((failedTotal / req) * 100)}% (오늘 ${failedTotal}/${req})` });
  // Queue 적체.
  if (q.queued + q.approvalPending >= 10) out.push({ level: "mid", kind: "queue_backlog", message: `작업 적체: 대기 ${q.queued} · 승인대기 ${q.approvalPending}` });
  // 비용 급증(예산 대비).
  if (bud.limitTodayKRW > 0 && bud.todayPct >= 80) out.push({ level: "high", kind: "cost", message: `오늘 예산 ${bud.todayPct}% 사용 (₩${bud.todayKRW}/₩${bud.limitTodayKRW})` });
  // 품질 하락.
  if (q.avgQuality != null && q.avgQuality < 80) out.push({ level: "mid", kind: "quality", message: `평균 품질 하락: ${q.avgQuality}점` });
  // 실패 작업.
  if (q.failed >= 1) out.push({ level: "mid", kind: "job_fail", message: `실패 작업 ${q.failed}건 — 재시도 필요` });
  // Health red.
  const reds = health.filter((h) => h.status === "red" && h.recent >= 3);
  for (const r of reds) out.push({ level: "high", kind: "model_down", message: `${r.name} 오류율 증가(${r.failRate}%)` });
  return out;
}

// ── 관리자 알림 ─────────────────────────────────────────────────────
export function buildAlerts(now = Date.now()) {
  const alerts = detectAnomalies(now).map((a) => ({ ...a, at: now }));
  const q = queueSummary(now);
  const cfg = getAutoConfig();
  const bud = budgetStatus(cfg, now);
  // 정보성 알림.
  if (q.approvalPending > 0) alerts.push({ level: "info", kind: "approval", message: `승인 대기 ${q.approvalPending}건`, at: now });
  if (q.scheduled > 0) alerts.push({ level: "info", kind: "reserved", message: `예약 작업 ${q.scheduled}건`, at: now });
  if (bud.limitTodayKRW > 0) alerts.push({ level: "info", kind: "budget", message: `오늘 예산 ${bud.todayPct ?? 0}% 사용`, at: now });
  return alerts;
}

// ── 이상징후 추천 ───────────────────────────────────────────────────
export function anomalyRecommendations(now = Date.now()) {
  const recs = [];
  const perf = staffPerformance(now);
  const totalJobs = perf.reduce((n, p) => n + p.jobs, 0);
  const top = perf.filter((p) => p.jobs > 0).sort((a, b) => b.jobs - a.jobs)[0];
  if (top && totalJobs >= 5 && top.jobs / totalJobs >= 0.7) recs.push(`${top.name} 사용량 집중 → 다른 직원(GPT/Gemini) 분산 추천`);
  for (const h of providersHealth(now)) {
    if (h.status === "red" && h.recent >= 3) recs.push(`${h.name} 실패 증가 → Claude 대체 추천`);
  }
  return recs;
}

// ── 비용 분석 ───────────────────────────────────────────────────────
export function costAnalysis(now = Date.now()) {
  const money = usageMoneyOverview(now);
  return {
    todayKRW: money.todayKRW, monthKRW: money.monthKRW, allKRW: money.allKRW,
    avgPerArticleKRW: money.avgPerArticleKRW, projectedMonthKRW: money.projectedMonthKRW,
    byModel: usageByModel("month", now),
    fusionTodayKRW: fusionStats(now).todayCostKRW,
  };
}

// ── 품질 리포트 ─────────────────────────────────────────────────────
export function qualityReport(now = Date.now()) {
  const perf = staffPerformance(now).filter((p) => p.avgEditorial != null && p.jobs > 0);
  const scores = perf.map((p) => p.avgEditorial);
  const q = queueSummary(now);
  return {
    avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : (q.avgQuality ?? null),
    max: scores.length ? Math.max(...scores) : null,
    min: scores.length ? Math.min(...scores) : null,
    queueAvg: q.avgQuality,
  };
}

// ── 총괄비서 브리핑 ─────────────────────────────────────────────────
export function dailyBriefing(now = Date.now()) {
  const q = queueSummary(now);
  const money = usageMoneyOverview(now);
  const qr = qualityReport(now);
  return `오늘 생성 ${q.todayCreated}건 · 예약 ${q.scheduled}건 · 승인대기 ${q.approvalPending}건 · 실패 ${q.failed}건 · 평균품질 ${qr.avg ?? "-"}점 · 예산 ₩${money.todayKRW.toLocaleString()}.`;
}

// ── AI 운영 점수(100점 기준, 이상징후 차감) ─────────────────────────
export function opsScore(now = Date.now()) {
  let score = 100;
  for (const a of detectAnomalies(now)) score -= a.level === "high" ? 12 : a.level === "mid" ? 6 : 2;
  const health = providersHealth(now);
  const reds = health.filter((h) => h.status === "red" && h.recent >= 3).length;
  score -= reds * 5;
  return Math.max(40, Math.min(100, score));
}

// ── 종합 스냅샷 ─────────────────────────────────────────────────────
export function missionSnapshot(now = Date.now()) {
  const q = queueSummary(now);
  const budget = aiBudget(now);
  return {
    dashboard: {
      todayCreated: q.todayCreated, scheduled: q.scheduled, published: q.published,
      approvalPending: q.approvalPending, queued: q.queued, failed: q.failed, retries: q.retries,
      avgQuality: q.avgQuality, costKRW: usageMoneyOverview(now).todayKRW, savedHours: budget.savedHours,
    },
    health: providersHealth(now),
    anomalies: detectAnomalies(now),
    alerts: buildAlerts(now),
    recommendations: anomalyRecommendations(now),
    cost: costAnalysis(now),
    quality: qualityReport(now),
    briefing: dailyBriefing(now),
    opsScore: opsScore(now),
    queue: { queued: q.queued, running: q.running, approvalPending: q.approvalPending, scheduled: q.scheduled, published: q.published, failed: q.failed },
    providers: providerStatus(),
  };
}
