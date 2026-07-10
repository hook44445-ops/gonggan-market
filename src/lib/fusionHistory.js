// ════════════════════════════════════════════════════════════════════
// 공간마켓 Fusion History — 실행 이력 저장/통계 (Phase 31)
//   Fusion 실행 결과(모델·소요시간·토큰·비용·성공여부·단계)를 localStorage 에 보관한다.
//   ⚠️ DB/API 없음 · 순수 저장/집계. Regression Zero.
// ════════════════════════════════════════════════════════════════════

const KEY = "space_fusion_history_v1";
const CAP = 100;

export function getFusionHistory() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

export function appendFusionRun(run) {
  const rec = { id: `fus_${Date.now()}`, at: Date.now(), ...run };
  try { localStorage.setItem(KEY, JSON.stringify([rec, ...getFusionHistory()].slice(0, CAP))); } catch {}
  return rec;
}

const isToday = (ts, now) => { const d = new Date(ts), n = new Date(now); return d.toDateString() === n.toDateString(); };

// 실행 통계(오늘/누적). 관리자 카드용.
export function fusionStats(now = Date.now()) {
  const h = getFusionHistory();
  const today = h.filter((r) => isToday(r.at, now));
  const done = h.filter((r) => r.ok);
  const attempts = h.length;
  const durs = h.filter((r) => Number.isFinite(r.totalMs)).map((r) => r.totalMs);
  return {
    todayRuns: today.length,
    todayCostKRW: today.reduce((n, r) => n + (r.totalCostKRW || 0), 0),
    totalRuns: attempts,
    successRate: attempts ? Math.round((done.length / attempts) * 100) : null,
    avgMs: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null,
  };
}
