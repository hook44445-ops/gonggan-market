// ════════════════════════════════════════════════════════════════════
// 공간마켓 Operation Score — 무인 운영 점수 (Phase 38)
//   생성/발행/Retry/Queue 를 근거로 100점 기준 운영 점수를 산정한다.
//   ⚠️ 읽기 전용 · 기존 집계 호출만. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { publishSummary, getPublishQueue } from "./publishQueue.js";
import { isTodayGenerated } from "./dayScheduler.js";
import { runWatchdog } from "./watchdog.js";

export function operationScore(now = Date.now()) {
  const sum = publishSummary(now);
  const q = getPublishQueue();
  const issues = runWatchdog({ now });
  const generated = isTodayGenerated(now);
  const backlog = q.filter((j) => ["approved", "scheduled"].includes(j.status)).length;

  // 항목별 점수.
  const bGen = generated ? 100 : 0;
  const bPub = sum.publishedToday > 0 ? 100 : (generated ? 70 : 0);
  const bRetry = -Math.min(20, sum.retries * 2);
  const bQueue = -Math.min(20, Math.max(0, backlog - 6));

  let score = 100;
  for (const i of issues) score -= i.level === "high" ? 10 : i.level === "mid" ? 4 : 1;
  score = Math.max(40, Math.min(100, score + Math.round((bGen + bPub) / 2 - 100)));
  // (bGen/bPub 은 breakdown 표시용, score 는 이슈 기반 차감이 주도)

  return {
    score: Math.max(40, Math.min(100, score)),
    breakdown: { 생성: bGen, 발행: bPub, Retry: bRetry, Queue: bQueue },
    issues: issues.length,
    generated, publishedToday: sum.publishedToday, retries: sum.retries, backlog,
  };
}
