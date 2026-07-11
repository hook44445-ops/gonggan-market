// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI Cleanup Approval Board — 청소 전 4단계 승인 (Phase 46)
//
//   탐지된 후보를 즉시 처리하지 않고 4단계 AI 직급 승인을 거친다:
//     1) 탐지  2) 영향 분석  3) 안전 검증  4) 청소관리자 최종 결정
//   보호 대상(published·게시 URL·정상 미래예약·사용자 글·기본편성·수동승인 이력·감사자료)은
//   불확실하면 무조건 CLEANUP_BLOCKED. 기본 최종결정은 APPROVED_FOR_QUARANTINE(격리, 삭제 아님).
//   ⚠️ 읽기 전용 판정 · 상태변경/삭제 없음. Hard Delete 미구현. Regression Zero.
// ════════════════════════════════════════════════════════════════════

const BASIC_PROGRAM = new Set(["qt", "astrology", "morning_brief", "breaking", "space_market", "series", "trend_past", "trend_present", "trend_future"]);

// 2단계 — 영향 분석.
function impactStage(cand, rec) {
  const st = rec.publish_status || "draft";
  if (st === "published" || st === "publishing" || rec.published_url) return { decision: "BLOCKED", reason: "발행됨/게시 URL 존재" };
  if (rec.is_seed === false) return { decision: "BLOCKED", reason: "사용자 작성 글" };
  if (cand.type === "overdue_scheduled") return { decision: "REVIEW_REQUIRED", reason: "도래 미발행 → 발행 복구 대상" };
  if (cand.type === "date_mismatch" || cand.type === "stale_draft") return { decision: "REVIEW_REQUIRED", reason: "본문 유효 가능 — 관리자 검토" };
  return { decision: "SAFE", reason: "파이프라인 미사용 중복/테스트/깨짐" };
}

// 3단계 — 안전 검증(보호 우선). 하나라도 불확실 → CLEANUP_BLOCKED.
function safetyStage(cand, rec, now) {
  const st = rec.publish_status || "draft";
  const protect = [];
  if (st === "published" || st === "publishing") protect.push("published");
  if (rec.published_url) protect.push("게시 URL");
  if (rec.is_seed === false) protect.push("사용자 글");
  // 정상 미래 기본편성은 보호 — 단, 중복 "복사본"(대표본 아님)은 정상예약이 아니므로 보호 제외(대표본이 슬롯 유지).
  const isDupCopy = String(cand.type || "").startsWith("duplicate");
  if (!isDupCopy && BASIC_PROGRAM.has(rec.content_type) && st === "scheduled" && rec.scheduled_at && Date.parse(rec.scheduled_at) > now) protect.push("정상 미래 기본편성");
  if (rec.approved_by || rec.manual_approved) protect.push("관리자 승인 이력");
  const passed = protect.length === 0;
  return { decision: passed ? "SAFE" : "CLEANUP_BLOCKED", protect };
}

// 4단계 — 청소관리자 최종 결정.
function managerStage(cand, impact, safety) {
  if (safety.decision === "CLEANUP_BLOCKED") return { decision: "REJECTED", reason: safety.protect.join(", ") };
  if (impact.decision === "BLOCKED") return { decision: "REJECTED", reason: impact.reason };
  if (impact.decision === "REVIEW_REQUIRED") return { decision: "REVIEW_REQUIRED", reason: impact.reason };
  // 완전 중복/테스트/깨짐 + 안전 통과 → 기본 격리(삭제 아님).
  if (cand.confidence >= 85 && ["duplicate_draft", "duplicate_scheduled", "test_content", "broken_fusion_result"].includes(cand.type))
    return { decision: "APPROVED_FOR_QUARANTINE", reason: "완전 중복/테스트/깨짐 · 안전 통과" };
  return { decision: "REVIEW_REQUIRED", reason: "확신 부족 — 관리자 검토" };
}

// 후보 1건 4단계 검토. rec = 대상 레코드.
export function reviewCleanup(cand, rec = {}, { now = Date.now() } = {}) {
  const detect = { decision: "CANDIDATE", type: cand.type, confidence: cand.confidence, reason: cand.reason };
  const impact = impactStage(cand, rec);
  const safety = safetyStage(cand, rec, now);
  const manager = managerStage(cand, impact, safety);
  return { targetId: cand.targetId, type: cand.type, stages: { detect, impact, safety, manager }, finalDecision: manager.decision };
}

// 후보 배치 검토 + 요약.
export function reviewCleanupBatch(candidates = [], recordsById = new Map(), { now = Date.now() } = {}) {
  const results = candidates.map((c) => reviewCleanup(c, recordsById.get?.(c.targetId) || recordsById[c.targetId] || {}, { now }));
  const summary = { total: results.length, quarantine: 0, review: 0, rejected: 0, recover: 0 };
  for (const r of results) {
    if (r.finalDecision === "APPROVED_FOR_QUARANTINE" || r.finalDecision === "APPROVED_FOR_ARCHIVE") summary.quarantine += 1;
    else if (r.finalDecision === "REJECTED") summary.rejected += 1;
    else summary.review += 1;
    if (r.type === "overdue_scheduled") summary.recover += 1;
  }
  return { results, summary };
}
