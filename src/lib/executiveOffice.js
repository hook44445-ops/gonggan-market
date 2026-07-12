// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI Executive Office — 사장실 KPI · 발행결과 (Phase 51)
//
//   AI 사장실을 "조직형 대시보드"로 만들기 위한 실시간 KPI(오늘 생성/검토/발행/긴급/예약/평균품질/
//   평균처리시간)와 발행결과(§8: URL/게시시간/Elapsed/Publish ID)를 계산한다.
//   ⚠️ 모두 DB 레코드(lounge_posts)에서 파생 — localStorage 미의존. 순수 함수. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { editorialDateKST } from "./editorialKey.js";
import { classifyContentType } from "./contentTypes.js";
import { evaluateQuality } from "./qualityEvaluator.js";
import { reviewByBoard } from "./aiEditorialBoard.js";
import { decidePublishMode } from "./publishModeDecider.js";
import { computeBudget } from "./dailyPublishBudget.js";
import { buildPostPath } from "../utils/loungeSeo.js";

// 발행결과(§8) — published 레코드에서 URL/게시시간/Elapsed/Publish ID 파생.
export function publishResult(record = {}, { now = Date.now() } = {}) {
  if ((record.publish_status || "") !== "published") return null;
  let url = ""; try { url = buildPostPath(record); } catch { url = `/lounge/posts/${record.id}`; }
  const created = Date.parse(record.created_at || 0) || null;
  const publishedAt = Date.parse(record.updated_at || record.created_at || now) || now;
  const elapsedMs = created ? Math.max(0, publishedAt - created) : null;
  return {
    url,
    publishedAt: new Date(publishedAt).toISOString(),
    elapsedMin: elapsedMs != null ? Math.round(elapsedMs / 60000) : null,
    publishId: String(record.id ?? "").slice(0, 8),
  };
}

const isTodayKST = (ts, today) => ts && editorialDateKST(ts) === today;

// 실시간 KPI(§10). records: lounge_posts 배열.
export function executiveKpis(records = [], { now = Date.now() } = {}) {
  const today = editorialDateKST(now);
  const todayRecs = records.filter((r) => isTodayKST(r.created_at, today));
  const publishedToday = records.filter((r) => (r.publish_status || "") === "published" && isTodayKST(r.updated_at || r.created_at, today));

  // 오늘 생성분의 발행모드 분류(즉시/예약) — 파생.
  let immediate = 0, scheduled = 0, errors = 0, qSum = 0, qN = 0;
  for (const r of todayRecs) {
    const type = classifyContentType(r.title || r.ai_topic || "");
    const draft = { ...r, content_type: type };
    let ev, board, mode;
    try { ev = evaluateQuality(draft); board = reviewByBoard(draft, { evaluation: ev }); mode = decidePublishMode(draft, { board, now }); }
    catch { continue; }
    if (mode.mode === "IMMEDIATE") immediate += 1;
    else if (mode.mode === "SCHEDULED") scheduled += 1;
    else errors += 1; // HOLD
    if (ev && typeof ev.totalScore === "number") { qSum += ev.totalScore; qN += 1; }
  }

  // 평균 처리시간(생성→발행, 오늘 발행분) — 실제 신호.
  let elapsedSum = 0, elapsedN = 0;
  for (const r of publishedToday) {
    const pr = publishResult(r, { now });
    if (pr?.elapsedMin != null) { elapsedSum += pr.elapsedMin; elapsedN += 1; }
  }

  return {
    date: today,
    todayGenerated: todayRecs.length,
    todayReviewed: todayRecs.length,           // 결정론 검토라 생성분 전부 검토됨
    todayPublished: publishedToday.length,
    immediate, scheduled, errors,
    avgQuality: qN ? Math.round(qSum / qN) : null,
    avgProcessMin: elapsedN ? Math.round(elapsedSum / elapsedN) : null,
    scheduledPending: records.filter((r) => (r.publish_status || "") === "scheduled").length,
    budget: computeBudget(records, { now }),
  };
}
