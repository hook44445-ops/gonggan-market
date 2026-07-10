// ════════════════════════════════════════════════════════════════════
// 공간마켓 Validation History — E2E 검증 이력 (Phase 36)
//   실제 End-to-End 검증 실행 결과(제목·소요·결과·URL·품질·재시도·비용)를 보관한다.
//   ⚠️ localStorage · DB 없음. Regression Zero.
// ════════════════════════════════════════════════════════════════════

const KEY = "space_validation_history_v1";
const READY_KEY = "space_production_ready_v1";
const CAP = 50;

export function getValidationHistory() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export function appendValidationRun(run) {
  const rec = { id: `val_${Date.now()}`, at: Date.now(), ...run };
  try { localStorage.setItem(KEY, JSON.stringify([rec, ...getValidationHistory()].slice(0, CAP))); } catch {}
  if (run.productionReady) setProductionReady({ at: Date.now(), title: run.title, url: run.url || null });
  return rec;
}

// 모든 단계 통과 시 Production Ready 플래그.
export function setProductionReady(info) { try { localStorage.setItem(READY_KEY, JSON.stringify(info)); } catch {} }
export function getProductionReady() {
  try { const v = JSON.parse(localStorage.getItem(READY_KEY) ?? "null"); return v && typeof v === "object" ? v : null; }
  catch { return null; }
}
