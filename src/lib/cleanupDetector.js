// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI Cleanup Detector — 청소 후보 탐지(1단계) (Phase 46)
//
//   중복/오류/정체 레코드를 "탐지만" 한다. 데이터는 수정하지 않는다(읽기 전용).
//   기존 편성 키(editorialKey)로 완전 중복을, scheduled_at 으로 도래/정체를 판정한다.
//   ⚠️ 순수 함수 · 삭제/격리/상태변경 없음. Hard Delete 미구현. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { editorialKey, editorialDateKST, bodyHash, pickRepresentative } from "./editorialKey.js";

const GRACE_MS = 5 * 60 * 1000; // 도래 판정 여유(분 단위 엄격비교 금지).
const STALE_DRAFT_MS = 3 * 24 * 3600 * 1000;
const ACTIVE = new Set(["draft", "review", "approved", "scheduled", "publishing", "published"]);
const isTest = (t) => /\b(test|테스트|샘플|sample|dummy)\b/i.test(String(t || ""));
const emptyBody = (c) => String(c || "").replace(/\s/g, "").length < 80;

// 청소 후보 탐지. records: lounge_posts 배열. 반환 [{type,targetId,confidence,reason,recommendedAction,groupKey}]
export function detectCleanupCandidates(records = [], { now = Date.now() } = {}) {
  const out = [];
  const groups = new Map(); // editorialKey → records[]
  for (const r of records) {
    const k = editorialKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  // 1) 완전 중복 — 같은 편성 키가 활성 상태로 2건 이상 → 대표본 제외 나머지 후보.
  for (const [key, recs] of groups) {
    const active = recs.filter((r) => ACTIVE.has(r.publish_status || "draft"));
    if (active.length < 2) continue;
    const rep = pickRepresentative(active);
    for (const r of active) {
      if (r.id === rep?.id) continue;
      const sameBody = bodyHash(r.content ?? "") === bodyHash(rep?.content ?? "");
      out.push({
        type: (r.publish_status === "scheduled" ? "duplicate_scheduled" : "duplicate_draft"),
        targetId: r.id, groupKey: key,
        confidence: sameBody ? 96 : 82,
        reason: `같은 편성 키 ${active.length}건 중 대표본 제외`,
        recommendedAction: "QUARANTINE",
        representativeId: rep?.id ?? null,
      });
    }
  }

  const flagged = new Set(out.map((c) => c.targetId));
  for (const r of records) {
    if (flagged.has(r.id)) continue;
    const st = r.publish_status || "draft";
    // 2) 도래 미발행 — scheduled 이고 시각이 지남(청소 아님 → 발행 복구 대상으로 표시).
    if (st === "scheduled" && r.scheduled_at && Date.parse(r.scheduled_at) <= now - GRACE_MS) {
      out.push({ type: "overdue_scheduled", targetId: r.id, confidence: 90, reason: "예약 시각 도래(미발행)", recommendedAction: "RECOVER_PUBLISH" });
      continue;
    }
    // 3) 날짜 불일치 — 예약일 KST 와 제목 날짜 토큰 불일치(관리자 검토).
    if (st === "scheduled" && r.scheduled_at) {
      const titleDate = (String(r.title || "").match(/\d{4}[-.\s년]*\d{1,2}[-.\s월]*\d{1,2}/) || [null])[0];
      if (titleDate) {
        const norm = titleDate.replace(/[^\d]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const schedDate = editorialDateKST(r.scheduled_at).replace(/-0/g, "-");
        if (norm && !editorialDateKST(r.scheduled_at).includes(norm.split("-").map((x) => x.padStart(2, "0")).join("-")) && !schedDate.startsWith(norm.slice(0, 4))) {
          out.push({ type: "date_mismatch", targetId: r.id, confidence: 70, reason: `제목 날짜(${titleDate}) vs 예약일(${editorialDateKST(r.scheduled_at)})`, recommendedAction: "REVIEW_REQUIRED" });
          continue;
        }
      }
    }
    // 4) 오래된 draft.
    if (st === "draft" && r.created_at && Date.parse(r.created_at) <= now - STALE_DRAFT_MS) {
      out.push({ type: "stale_draft", targetId: r.id, confidence: 60, reason: "3일+ 방치 draft", recommendedAction: "REVIEW_REQUIRED" });
      continue;
    }
    // 5) 수동 테스트 콘텐츠.
    if (isTest(r.title)) { out.push({ type: "test_content", targetId: r.id, confidence: 88, reason: "테스트 제목", recommendedAction: "QUARANTINE" }); continue; }
    // 6) 깨진 결과(본문 사실상 비어 있음, 미발행).
    if (st !== "published" && emptyBody(r.content)) { out.push({ type: "broken_fusion_result", targetId: r.id, confidence: 85, reason: "본문 공백/깨짐", recommendedAction: "QUARANTINE" }); continue; }
  }
  return out;
}

// ⑭ 큐 분류표 — 21건 등 현재 레코드를 사람이 읽는 버킷으로 분류(읽기 전용).
export function classifyQueue(records = [], { now = Date.now() } = {}) {
  const cands = detectCleanupCandidates(records, { now });
  const byId = new Map(cands.map((c) => [c.targetId, c]));
  const buckets = { normal_future: [], overdue_unpublished: [], exact_duplicate: [], date_error: [], manual_test: [], broken: [], published: [] };
  for (const r of records) {
    const st = r.publish_status || "draft";
    const c = byId.get(r.id);
    const row = { id: r.id, title: r.title, content_type: r.content_type || null, editorial_date: r.scheduled_at ? editorialDateKST(r.scheduled_at) : editorialDateKST(r.created_at), scheduled_at: r.scheduled_at || null, status: st, candidate: c?.type || null, action: c?.recommendedAction || "KEEP", representative: c ? c.targetId !== r.id : true };
    if (st === "published") buckets.published.push(row);
    else if (c?.type === "overdue_scheduled") buckets.overdue_unpublished.push(row);
    else if (c?.type === "duplicate_scheduled" || c?.type === "duplicate_draft") buckets.exact_duplicate.push(row);
    else if (c?.type === "date_mismatch") buckets.date_error.push(row);
    else if (c?.type === "test_content") buckets.manual_test.push(row);
    else if (c?.type === "broken_fusion_result") buckets.broken.push(row);
    else if (st === "scheduled" && r.scheduled_at && Date.parse(r.scheduled_at) > now) buckets.normal_future.push(row);
    else buckets.normal_future.push(row);
  }
  return buckets;
}
