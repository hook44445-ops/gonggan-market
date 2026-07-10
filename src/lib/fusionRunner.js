// ════════════════════════════════════════════════════════════════════
// 공간마켓 Fusion Runner — 실제 다단계 AI 협업 실행 (Phase 31)
//
//   planFusion(주제) 으로 단계를 만들고, 각 단계를 "순차" 실행한다(동시 호출 아님).
//   각 단계는 이전 결과를 이어받아 개선한다: 원고 → SEO → 교정 → 검수 → 최종.
//   최종본을 통합하고, 기존 게이트로 품질검사한 뒤 Preview 데이터를 반환한다.
//   ⚠️ 발행은 하지 않는다(관리자 승인 후 기존 발행 흐름). onStep 으로 진행률을 알린다.
//
//   ⚠️ 기존 엔진 무수정: planFusion(aiFusion)·executeStage(→callLLM)·evaluateGate 를 호출만.
//   Regression Zero: DB/API/Cron/ENV 변경 없음.
// ════════════════════════════════════════════════════════════════════

import { planFusion } from "./aiFusion.js";
import { executeStage } from "./fusionExecutor.js";
import { evaluateGate } from "./autoPublishGate.js";
import { appendFusionRun } from "./fusionHistory.js";
import { logStageStart, logStageDone, logFusionDone } from "./fusionLogger.js";

// 텍스트 → { title, body } (첫 비어있지 않은 줄 = 제목).
function splitTitleBody(text) {
  const lines = String(text || "").split(/\r?\n/);
  let ti = lines.findIndex((l) => l.trim());
  if (ti === -1) return { title: "", body: String(text || "").trim() };
  const title = lines[ti].replace(/^#+\s*/, "").trim();
  const body = lines.slice(ti + 1).join("\n").trim() || title;
  return { title, body };
}

// Fusion 실행. topic:string, opts:{ onStep, signal, temperature, region }
//   반환: { ok, topic, contentType, mode, steps:[{role,staff,model,usedModel,ok,text,latencyMs,costKRW,fallbackUsed}],
//           final:{title, body}, quality, totalMs, totalCostKRW }
export async function runFusion(topic, { onStep = null, signal = null, temperature = 0.85, region = null } = {}) {
  const t = String(topic || "").trim();
  const plan = planFusion(t);
  const stages = plan.stages;
  const total = stages.length;
  const steps = [];
  let prev = "";
  let totalCost = 0;
  const t0 = Date.now();

  for (let i = 0; i < total; i++) {
    const stage = stages[i];
    onStep?.({ index: i + 1, total, phase: "running", stage });
    logStageStart(stage, i + 1, total);
    const res = await executeStage({
      role: stage.role, staff: stage.staff, model: stage.model,
      topic: t, prev, region, temperature, signal,
    });
    logStageDone(res, i + 1, total);
    steps.push(res);
    totalCost += res.costKRW || 0;
    if (res.ok && res.text) prev = res.text; // 다음 단계로 결과 체이닝(실패 단계는 이전 유지).
    onStep?.({ index: i + 1, total, phase: res.ok ? "done" : "failed", stage, result: res });
    if (signal?.aborted) break;
  }

  const okAny = steps.some((s) => s.ok && s.text);
  const final = splitTitleBody(prev || (steps.find((s) => s.ok)?.text) || "");
  // 기존 게이트로 품질검사(길이/SEO/중복/금칙어/구조). testMode 로 경고 위주(발행 아님).
  let quality = null;
  try {
    quality = evaluateGate(
      { title: final.title, content: final.body, ai_topic: t },
      { confidence: null, existing: [], stage: null, cfg: { testMode: true, minBodyLength: 400 } }
    );
  } catch { /* */ }

  const run = {
    ok: okAny && !!final.body, topic: t, contentType: plan.contentType, mode: plan.modeLabel,
    steps: steps.map((s) => ({ role: s.role, staff: s.staff, model: s.model, usedModel: s.usedModel, ok: s.ok, fallbackUsed: s.fallbackUsed, latencyMs: s.latencyMs, costKRW: s.costKRW, textLen: (s.text || "").length })),
    final, quality: quality ? { pass: quality.pass, reasons: quality.reasons, warnings: quality.warnings, quality: quality.quality } : null,
    totalMs: Date.now() - t0, totalCostKRW: totalCost,
  };
  try { appendFusionRun(run); } catch { /* */ }
  logFusionDone(run);
  // 미리보기용으로 각 단계 전체 텍스트도 함께 반환(관리자 비교용) — 저장본엔 길이만.
  return { ...run, stepsFull: steps };
}
