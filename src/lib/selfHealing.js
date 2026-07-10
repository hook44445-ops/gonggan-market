// ════════════════════════════════════════════════════════════════════
// 공간마켓 Self-Healing — 무인 운영 자동 복구 (Phase 38)
//   Watchdog 이상 → 자동 복구: 예약 누락→예약 · 실패→재큐 · 도래 미처리→Worker 재실행 ·
//   오늘 미생성→자동 생성. Recovered 로 로그.
//   ⚠️ 기존 엔진 재사용(무수정): publishQueue/scheduler/worker · dayScheduler. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { getPublishQueue, updatePublishJob, getAutopilotConfig } from "./publishQueue.js";
import { schedulePublishAt } from "./publishScheduler.js";
import { processDuePublishes } from "./publishWorker.js";
import { ensureTodayProgram, isTodayGenerated } from "./dayScheduler.js";
import { logActivity } from "./activityLog.js";

// 자동 복구. deps: { executor, createDraft } · opts: { published, now }
export async function heal(deps = {}, { published = [], now = Date.now() } = {}) {
  const cfg = getAutopilotConfig();
  const maxRetry = cfg.maxRetry ?? 3;
  const actions = [];
  const q = getPublishQueue();

  // 1) 예약 누락 → 편성 시간 예약.
  for (const j of q.filter((x) => x.status === "approved" && !x.scheduledAt)) {
    const at = schedulePublishAt(j.contentType, { now });
    updatePublishJob(j.id, { status: "scheduled", scheduledAt: at.toISOString() });
    actions.push({ kind: "schedule", title: j.title }); logActivity("scheduled", { title: j.title, note: "Self-Heal: 예약 복구", ok: true });
  }
  // 2) 실패 & 재시도 여유 → 재큐(즉시 재예약).
  for (const j of q.filter((x) => x.status === "failed" && (x.retries || 0) < maxRetry)) {
    updatePublishJob(j.id, { status: "scheduled", scheduledAt: new Date(now).toISOString(), error: null });
    actions.push({ kind: "requeue", title: j.title }); logActivity("retry", { title: j.title, note: "Self-Heal: 재큐", ok: true });
  }
  // 3) 오늘 미생성 → 자동 생성.
  if (!isTodayGenerated(now) && deps.createDraft) {
    const r = await ensureTodayProgram({ createDraft: deps.createDraft }, { published, now });
    if (r.ran) { actions.push({ kind: "generate", note: `생성 ${r.result.generated}` }); logActivity("draft", { title: "Self-Heal: 오늘 편성 생성", ok: true }); }
  }
  // 4) 도래 미처리 → Worker 재실행(발행).
  let published_ = 0;
  if (cfg.autoPublishOn && !cfg.emergencyStop && deps.executor) {
    const res = await processDuePublishes({ executor: deps.executor, now });
    published_ = res.published || 0;
    if (published_ > 0) { actions.push({ kind: "worker", note: `발행 ${published_}` }); logActivity("published", { title: `Self-Heal: 도래분 발행 ${published_}`, ok: true }); }
  }

  return { actions, healed: actions.length, published: published_, recovered: actions.length > 0 };
}
