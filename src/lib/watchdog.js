// ════════════════════════════════════════════════════════════════════
// 공간마켓 Watchdog — 무인 운영 자동 점검 (Phase 38)
//   Queue 적체·예약 누락·발행 실패·Retry 초과·품질 Gate 대기·오늘 미생성을 점검한다.
//   ⚠️ 읽기 전용 점검(호출만) · DB 없음. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { getPublishQueue, getAutopilotConfig } from "./publishQueue.js";
import { dueJobs } from "./publishScheduler.js";
import { isTodayGenerated } from "./dayScheduler.js";

// 점검 결과: [{ kind, level, message, fixable }]
export function runWatchdog({ now = Date.now(), backlogLimit = 12 } = {}) {
  const q = getPublishQueue();
  const cfg = getAutopilotConfig();
  const maxRetry = cfg.maxRetry ?? 3;
  const issues = [];

  const backlog = q.filter((j) => ["approved", "scheduled"].includes(j.status)).length;
  if (backlog >= backlogLimit) issues.push({ kind: "queue_backlog", level: "mid", message: `Queue 적체: 대기 ${backlog}건`, fixable: true });

  const missingSlot = q.filter((j) => j.status === "approved" && !j.scheduledAt);
  if (missingSlot.length) issues.push({ kind: "missing_schedule", level: "mid", message: `예약 누락 ${missingSlot.length}건`, fixable: true });

  const failed = q.filter((j) => j.status === "failed");
  if (failed.length) issues.push({ kind: "publish_failed", level: "high", message: `발행 실패 ${failed.length}건`, fixable: true });

  const retryExceeded = q.filter((j) => (j.retries || 0) >= maxRetry && j.status === "failed");
  if (retryExceeded.length) issues.push({ kind: "retry_exceeded", level: "high", message: `Retry 초과 ${retryExceeded.length}건 — 확인 필요`, fixable: false });

  const gateWaiting = q.filter((j) => j.status === "approved" && j.quality != null && j.quality < (cfg.minQuality ?? 90));
  if (gateWaiting.length) issues.push({ kind: "gate_waiting", level: "info", message: `품질 Gate 대기 ${gateWaiting.length}건`, fixable: false });

  const due = dueJobs(q, now);
  if (due.length && cfg.autoPublishOn && !cfg.emergencyStop) issues.push({ kind: "due_unpublished", level: "mid", message: `발행 도래 미처리 ${due.length}건`, fixable: true });

  if (!isTodayGenerated(now)) issues.push({ kind: "not_generated", level: "info", message: "오늘 편성 미생성", fixable: true });

  return issues;
}

// 인시던트 알림(구조만 — 실제 Slack/Telegram 연동은 추후). 채널 설정 시 payload 반환.
export function buildIncidents(issues, { now = Date.now() } = {}) {
  return issues.filter((i) => i.level === "high").map((i) => ({
    at: now, kind: i.kind, message: i.message,
    channels: ["slack", "telegram"], // 구조만 준비
    payload: { text: `[공간라운지 Watchdog] ${i.message}` },
  }));
}
