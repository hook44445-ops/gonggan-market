// ════════════════════════════════════════════════════════════════════
// 공간마켓 Fusion Logger — Fusion 실행을 Activity Log 에 기록 (Phase 31)
//   기존 activityLog.logActivity 를 호출만 한다(엔진 무수정). Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { logActivity } from "./activityLog.js";

// 단계 시작/완료 로그.
export function logStageStart(stage, idx, total) {
  try { logActivity("llm_response", { title: `[Fusion ${idx}/${total}] ${stage.staff} · ${stage.role}`, model: stage.model, note: "실행 시작" }); } catch { /* */ }
}
export function logStageDone(res, idx, total) {
  try {
    logActivity(res.ok ? "llm_response" : "failed", {
      title: `[Fusion ${idx}/${total}] ${res.staff} · ${res.role}`,
      model: res.usedModel || res.model, latencyMs: res.latencyMs, costKRW: res.costKRW,
      ok: res.ok, note: res.ok ? (res.fallbackUsed ? `대체 모델 사용(${res.usedModel})` : "완료") : `실패: ${res.error}`,
    });
  } catch { /* */ }
}
export function logFusionDone(run) {
  try {
    logActivity(run.ok ? "published" : "failed", {
      title: `Fusion 완료: ${run.topic}`.slice(0, 60),
      note: `${run.mode} · ${run.steps?.length || 0}단계 · ${Math.round((run.totalMs || 0) / 100) / 10}s · ₩${run.totalCostKRW || 0}`,
      ok: run.ok,
    });
  } catch { /* */ }
}
