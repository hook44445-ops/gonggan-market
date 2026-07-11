// Fusion Bridge · Editorial Key · Cleanup Board 단위 테스트 (Phase 46)
//   실행: node --test src/lib/fusionPipeline.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { editorialDateKST, normalizeTitle, editorialKey, findDuplicate, bodyHash, pickRepresentative } from "./editorialKey.js";
import { saveFusionFinal } from "./fusionPipelineBridge.js";
import { detectCleanupCandidates, classifyQueue } from "./cleanupDetector.js";
import { reviewCleanup, reviewCleanupBatch } from "./cleanupApprovalBoard.js";

const LONG = "## 소제목\n" + "공간 리모델링 비용과 절차를 정리한 실제 도움이 되는 본문입니다. ".repeat(6);

// ── Editorial Key / KST ──────────────────────────────────
test("KST 날짜 — UTC 15:00(=익일 00:00 KST) 경계", () => {
  assert.equal(editorialDateKST(Date.parse("2026-07-11T15:00:00Z")), "2026-07-12");
  assert.equal(editorialDateKST(Date.parse("2026-07-11T14:59:00Z")), "2026-07-11");
});
test("제목 정규화 — 날짜 토큰 제거로 같은 편성 판정", () => {
  assert.equal(normalizeTitle("2026년 7월 11일 오늘 큐티 말씀"), normalizeTitle("2026년 7월 12일 오늘 큐티 말씀"));
});
test("findDuplicate — 같은 편성 키 활성 존재 시 탐지", () => {
  const rec = { title: "오늘 큐티 말씀", content_type: "qt", content: LONG, scheduled_at: "2026-07-11T20:00:00Z" };
  const existing = [{ id: "x", title: "오늘 큐티 말씀", content_type: "qt", publish_status: "scheduled", content: LONG, scheduled_at: "2026-07-11T20:05:00Z" }];
  assert.ok(findDuplicate(rec, existing));
});
test("pickRepresentative — published > scheduled > draft", () => {
  const rep = pickRepresentative([{ id: "d", publish_status: "draft" }, { id: "p", publish_status: "published" }, { id: "s", publish_status: "scheduled" }]);
  assert.equal(rep.id, "p");
});

// ── Fusion Bridge ────────────────────────────────────────
const fusionOK = { final: { title: "강서구 리모델링 총정리", body: LONG }, steps: [{ ok: true }, { ok: true }, { ok: true }], contentType: "space_market" };

test("㉕ Fusion 3단계 성공 → 최종본 1건 자동 저장", async () => {
  let created = 0, savedId = null;
  const createDraft = async (rec) => { created += 1; savedId = "newid123"; return { data: { id: savedId } }; };
  const r = await saveFusionFinal({ fusionResult: fusionOK, topic: "강서구 리모델링", existing: [], createDraft });
  assert.equal(r.saved, true); assert.equal(r.draftId, "newid123"); assert.equal(created, 1);
  assert.equal(r.fusionCalls, 3);
});
test("㉕ 저장 실패 → saved=false, draftId 없음(성공 위장 금지)", async () => {
  const createDraft = async () => ({ error: new Error("db down") });
  const r = await saveFusionFinal({ fusionResult: fusionOK, topic: "t", existing: [], createDraft });
  assert.equal(r.saved, false); assert.equal(r.draftId, null); assert.equal(r.reason, "db_error");
});
test("㉕ 동일 Fusion 재저장 → 중복 차단(재생성 없음)", async () => {
  let created = 0;
  const createDraft = async () => { created += 1; return { data: { id: "id" } }; };
  const existing = [{ id: "prev", title: "강서구 리모델링 총정리", content_type: "space_market", publish_status: "draft", content: LONG }];
  const r = await saveFusionFinal({ fusionResult: fusionOK, topic: "강서구 리모델링", existing, createDraft });
  assert.equal(r.saved, false); assert.equal(r.duplicate, true); assert.equal(created, 0);
});
test("㉕ 빈 최종본 → 저장 금지(Hard Fail)", async () => {
  const r = await saveFusionFinal({ fusionResult: { final: { title: "t", body: "짧음" }, steps: [] }, createDraft: async () => ({ data: { id: "x" } }) });
  assert.equal(r.saved, false); assert.equal(r.reason, "no_final_body");
});

// ── Cleanup Detector + Board ─────────────────────────────
const now = Date.parse("2026-07-11T12:00:00Z");
const qt = (id, sAt, st = "scheduled") => ({ id, title: "2026년 7월 11일 오늘 큐티 말씀", content_type: "qt", content: LONG, publish_status: st, scheduled_at: sAt, is_seed: true, created_at: "2026-07-11T00:00:00Z" });

test("㉕ 같은 QT 4건 → 대표 1건 유지, 3건 격리 후보", () => {
  const recs = [qt("a", "2026-07-11T20:00:00Z"), qt("b", "2026-07-11T20:01:00Z"), qt("c", "2026-07-11T20:02:00Z"), qt("d", "2026-07-11T20:03:00Z")];
  const cands = detectCleanupCandidates(recs, { now });
  const dups = cands.filter((c) => c.type === "duplicate_scheduled");
  assert.equal(dups.length, 3, "4건 중 3건이 중복 후보");
  const byId = new Map(recs.map((r) => [r.id, r]));
  const { summary } = reviewCleanupBatch(dups, byId, { now });
  assert.equal(summary.quarantine, 3, "3건 격리 승인");
});
test("㉕ published 글 → 청소 거부(보호)", () => {
  const rec = { id: "p", title: "발행글", content_type: "space_market", content: LONG, publish_status: "published", published_url: "/lounge/posts/p", is_seed: true };
  const c = { type: "duplicate_scheduled", targetId: "p", confidence: 96, reason: "x" };
  assert.equal(reviewCleanup(c, rec, { now }).finalDecision, "REJECTED");
});
test("㉕ 사용자 작성 글(is_seed=false) → 청소 거부", () => {
  const rec = { id: "u", title: "테스트 글", content_type: "free", content: "짧", publish_status: "draft", is_seed: false };
  const c = { type: "test_content", targetId: "u", confidence: 88, reason: "x" };
  assert.equal(reviewCleanup(c, rec, { now }).finalDecision, "REJECTED");
});
test("㉕ 지난 예약 → overdue(청소 아님, 발행 복구 대상)", () => {
  const recs = [qt("late", "2026-07-11T05:00:00Z")]; // 과거
  const cands = detectCleanupCandidates(recs, { now });
  assert.ok(cands.some((c) => c.type === "overdue_scheduled" && c.recommendedAction === "RECOVER_PUBLISH"));
  const res = reviewCleanup(cands[0], recs[0], { now });
  assert.equal(res.finalDecision, "REVIEW_REQUIRED"); // 격리 아님
});
test("㉕ 정상 미래예약 → 청소 후보 아님", () => {
  const recs = [qt("future", "2026-07-20T20:00:00Z")]; // 단건, 미래
  const cands = detectCleanupCandidates(recs, { now });
  assert.equal(cands.length, 0);
});
test("⑭ classifyQueue — 버킷 분류", () => {
  const recs = [qt("a", "2026-07-11T20:00:00Z"), qt("b", "2026-07-11T20:01:00Z"), qt("late", "2026-07-11T05:00:00Z"), { id: "pub", title: "발행", content_type: "qt", content: LONG, publish_status: "published", is_seed: true }];
  const b = classifyQueue(recs, { now });
  assert.ok(b.published.length === 1);
  assert.ok(b.exact_duplicate.length >= 1 || b.overdue_unpublished.length >= 1);
});
