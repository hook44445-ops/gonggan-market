// ════════════════════════════════════════════════════════════════════
// 공간마켓 Daily Summary — 일일 요약 · 7일 검증 · Health Trend (Phase 38)
//   매일(자정 개념) 오늘 지표를 요약 저장하고, 최근 7일 추이와 Day1~Day7 PASS 를 만든다.
//   Cron 없음 — 호출 시점에 오늘 요약을 upsert(하루 1행 유지).
//   ⚠️ 기존 집계 재사용 · localStorage. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { publishSummary } from "./publishQueue.js";
import { publishHistoryStats } from "./publishHistory.js";
import { usageStats } from "./usageDashboard.js";
import { operationScore } from "./operationScore.js";

const KEY = "space_daily_summary_v1";
const dayKey = (now) => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function getDailySummaries() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60))); } catch {} return list; }

// 오늘 요약 계산.
export function computeToday(now = Date.now()) {
  const sum = publishSummary(now);
  const hist = publishHistoryStats(now);
  const usage = usageStats("today", now);
  const ops = operationScore(now);
  const pass = hist.today > 0 && (sum.failed === 0 || hist.today > sum.failed);
  return {
    date: dayKey(now),
    generated: ops.generated ? 1 : 0, // 오늘 편성 생성 여부(1/0)
    published: hist.today, failed: sum.failed, retries: sum.retries,
    avgQuality: usage.avgEditorialScore, tokens: usage.totalTokens, costKRW: usage.costKRW,
    opsScore: ops.score, pass,
  };
}

// 오늘 요약 upsert(하루 1행).
export function upsertTodaySummary(now = Date.now()) {
  const today = computeToday(now);
  const list = getDailySummaries().filter((s) => s.date !== today.date);
  return save([today, ...list])[0];
}

// 최근 N일 추이(Health Trend).
export function healthTrend(days = 7, now = Date.now()) {
  return getDailySummaries().slice(0, days).reverse();
}

// 7일 검증 리포트 — Day1~Day7(오래된→최근) PASS/FAIL/-.
export function sevenDayReport(now = Date.now()) {
  const rows = getDailySummaries().slice(0, 7).reverse();
  return rows.map((s, i) => ({ day: i + 1, date: s.date, status: s.pass ? "PASS" : "FAIL", published: s.published, opsScore: s.opsScore }));
}
