// ════════════════════════════════════════════════════════════════════
// 공간마켓 Publish Worker — 예약 도래분 자동 발행 (Phase 35)
//
//   scheduled → publishing → published(성공) / failed(재시도 초과).
//   Safety Gate(품질 90+·승인·예약 존재), Auto Publish ON/OFF, Emergency Stop, Retry 1~3.
//   실제 발행은 executor(기존 publish API) 주입. Cron 없음 — 호출 시점에 도래분 처리.
//
//   ⚠️ 기존 publish API 재사용(무수정). DB/Migration 없음. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { getPublishQueue, updatePublishJob, getAutopilotConfig } from "./publishQueue.js";
import { dueJobs } from "./publishScheduler.js";
import { appendPublishEvent } from "./publishHistory.js";

// Safety Gate — 자동발행 허용 조건.
export function safetyGate(job, cfg = getAutopilotConfig()) {
  if (job.status !== "scheduled") return { ok: false, reason: "예약 상태 아님" };
  if (!job.scheduledAt) return { ok: false, reason: "예약 시각 없음" };
  if (job.quality != null && job.quality < (cfg.minQuality ?? 90)) return { ok: false, reason: `품질 ${job.quality} < ${cfg.minQuality ?? 90}` };
  return { ok: true };
}

// 도래분 자동 발행. executor: async (job) => { error } | throws.
//   opts: { executor, now, config, onJob, force } · force=true 면 ON/EmergencyStop 무시(수동 실행).
export async function processDuePublishes({ executor, now = Date.now(), config = getAutopilotConfig(), onJob = null, force = false } = {}) {
  const result = { published: 0, failed: 0, skipped: 0, blocked: false, items: [] };
  if (!force) {
    if (config.emergencyStop) { result.blocked = true; return { ...result, reason: "Emergency Stop" }; }
    if (!config.autoPublishOn) { result.blocked = true; return { ...result, reason: "Auto Publish OFF" }; }
  }
  const due = dueJobs(getPublishQueue(), now);
  for (const job of due) {
    const gate = safetyGate(job, config);
    if (!gate.ok) { result.skipped += 1; result.items.push({ id: job.id, status: "skipped", reason: gate.reason }); continue; }
    updatePublishJob(job.id, { status: "publishing" });
    appendPublishEvent({ jobId: job.id, title: job.title, status: "publishing" });
    let ok = false, lastErr = null;
    const maxRetry = config.maxRetry ?? 3;
    for (let attempt = 1; attempt <= maxRetry; attempt++) {
      try {
        const r = executor ? await executor(job) : { error: new Error("no executor") };
        if (r && r.error) throw new Error(r.error.message || String(r.error));
        ok = true; break;
      } catch (e) {
        lastErr = e?.message ?? String(e);
        appendPublishEvent({ jobId: job.id, title: job.title, status: "retry", attempt, error: lastErr });
        updatePublishJob(job.id, { retries: attempt, error: lastErr });
      }
    }
    if (ok) {
      updatePublishJob(job.id, { status: "published", publishedAt: Date.now(), error: null });
      appendPublishEvent({ jobId: job.id, title: job.title, status: "published" });
      result.published += 1; result.items.push({ id: job.id, status: "published" });
      onJob?.(job.id, "published");
    } else {
      updatePublishJob(job.id, { status: "failed", error: lastErr });
      appendPublishEvent({ jobId: job.id, title: job.title, status: "failed", error: lastErr });
      result.failed += 1; result.items.push({ id: job.id, status: "failed", error: lastErr });
      onJob?.(job.id, "failed");
    }
  }
  return result;
}
