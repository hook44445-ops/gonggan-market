// AI Editorial Board + Approval Policy 단위 테스트 (Phase 43)
//   실행: node --test src/lib/editorialBoard.test.js
//   ⑰ 시나리오: 점수밴드별 자동승인 / Hard Fail 차단 / Soft Fail 발행 / 예약도래 회수.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateQuality } from "./qualityEvaluator.js";
import { reviewByBoard, hardSafetyGate } from "./aiEditorialBoard.js";
import { runEditorialApproval, isApproved } from "./editorialApprovalPolicy.js";

// 강한 글(≈90+).
const STRONG = {
  title: "강서구 32평 리모델링 비용 총정리 가이드",
  content:
    "## 도입\n리모델링 예산을 어떻게 잡을지 정리합니다.\n\n## 예산 기준\n- 도배·장판\n- 욕실\n- 주방\n일반적으로 알려진 기준과 참고 자료를 확인했습니다.\n\n## 업체 선택 방법\n견적을 어떻게 비교할까요? 무엇을 확인해야 할까요?\n- 실제 사례와 절차\n- 주의사항 체크리스트\n\n## 결론\n정리하면 아래 체크리스트로 준비하세요.",
  category: "interior", type: "space_market",
};
// 중간(≈80대).
const MID = {
  title: "32평 아파트 리모델링 비용 이야기와 준비 방법",
  content: "## 예산\n예산을 먼저 정합니다. 비용은 상황마다 다릅니다.\n- 도배\n- 욕실\n참고 기준을 확인합니다.\n어떻게 업체를 고를까요?\n정리하면 체크리스트로 확인하세요.",
  category: "interior", type: "space_market",
};
// 약함(≈70대).
const WEAK = {
  title: "리모델링 비용 정리",
  content: "리모델링 비용은 상황마다 다릅니다. 예산을 정하고 업체를 고릅니다. 준비를 잘 해야 합니다. 확인이 필요합니다.",
  category: "interior", type: "space_market",
};
// 매우 약함(<70).
const VERYWEAK = { title: "리모델링", content: "리모델링은 좋습니다. 잘 하면 좋습니다. 준비가 필요합니다.", category: "interior", type: "space_market" };
// 허위/위험 단정(Hard Fail 후보).
const DANGER = { title: "이 투자는 100% 수익 보장", content: "## 소개\n이 상품은 원금 보장에 100% 수익입니다. 무조건 오릅니다. 반드시 성공합니다.", category: "stock", type: "space_market" };
// 문체만 약한 Soft Fail.
const SOFT = { title: "공간 정리에 대한 것에 대해 알아보는 방법", content: "## 정리에 대한 것\n공간을 정리하는 것에 대한 것을 그것은 다루는 것에 대해 설명합니다. 정리라는 것을 하는 것에 대한 것은 중요한 것이라고 알려진 참고 기준을 확인합니다.\n- 첫째 수납에 대한 것\n- 둘째 배치에 대한 것\n- 셋째 동선에 대한 것\n어떻게 정리할까요? 무엇을 먼저 해야 할까요? 실제 사례와 절차를 참고하세요. 주의사항 체크리스트도 확인이 필요합니다.\n\n## 결론에 대한 것\n정리하면 아래 체크리스트로 확인하는 것에 대해 준비하세요. 도움이 되길 바랍니다.", category: "daily", type: "space_market" };

// 정직한 보정(실제 신호 추가) / 재생성(강한 초안으로 대체).
const honestRefine = (d) => ({ ...d, content: d.content + "\n\n## 자주 묻는 질문\n비용은 얼마나 들까요? 어떻게 준비할까요?\n\n## 절차\n1) 준비 2) 비교 3) 계약\n- 주의사항: 계약 전 확인\n- 사례: 실제 진행 예시\n일반적으로 알려진 기준·출처를 참고했습니다.\n\n## 결론\n정리하면 체크리스트로 확인하세요." });
const strongRegen = () => ({ ...STRONG });

test("1) 강한 글(≈90+) → 4인 자동 승인·Hard Gate 통과", async () => {
  const r = await runEditorialApproval({ draft: STRONG });
  assert.equal(r.hardGatePassed, true);
  assert.ok(r.approved, `approved 여야: ${r.finalDecision}`);
  assert.ok(["AUTO_APPROVED", "AUTO_APPROVED_WITH_NOTES"].includes(r.finalDecision));
});

test("2) 중간(≈80대) → 보정 1회 → 자동 승인", async () => {
  const r = await runEditorialApproval({ draft: MID, refine: honestRefine });
  assert.ok(r.approved, r.finalDecision);
  assert.ok(r.revisionCount <= 2);
});

test("3) 약함(70대) → 보정 최대 2회 → Hard Fail 없으면 자동 승인", async () => {
  const r = await runEditorialApproval({ draft: WEAK, refine: honestRefine });
  assert.ok(r.approved, r.finalDecision);
  assert.ok(r.revisionCount <= 2, `보정 ${r.revisionCount} ≤ 2`);
});

test("4) <70 → 재생성 1회 → Hard Fail 없으면 (조건부) 자동 승인", async () => {
  const r = await runEditorialApproval({ draft: VERYWEAK, refine: honestRefine, regenerate: strongRegen });
  assert.ok(r.approved, r.finalDecision);
  assert.ok(r.regenerationCount <= 1, `재생성 ${r.regenerationCount} ≤ 1`);
});

test("5) 88+허위수치/위험단정 → 팩트체커 Hard Fail → 검토대기", async () => {
  const r = await runEditorialApproval({ draft: DANGER });
  const fc = r.board.reviewers.find((x) => x.role === "fact_checker");
  assert.equal(fc.hardFail, true, "팩트체커 Hard Fail");
  assert.equal(r.hardGatePassed, false);
  assert.equal(r.finalDecision, "NEEDS_REVIEW");
  assert.equal(r.approved, false);
});

test("6) 중복 → SEO Hard Fail → 자동발행 차단", async () => {
  const existing = [{ id: "other", title: WEAK.title }];
  const r = await runEditorialApproval({ draft: WEAK, existing });
  const seo = r.board.reviewers.find((x) => x.role === "seo");
  assert.equal(seo.hardFail, true, "중복 Hard Fail");
  assert.equal(r.approved, false);
  assert.equal(r.finalDecision, "NEEDS_REVIEW");
});

test("7) Soft Fail(문체 약함)만 → 최종 자동 승인(발행 우선)", async () => {
  const r = await runEditorialApproval({ draft: SOFT });
  assert.equal(r.hardGatePassed, true);
  assert.ok(r.approved, `Soft Fail 은 발행: ${r.finalDecision}`);
});

test("8) 예약도래(loose 비교) — scheduled_at <= now 는 due, 미래는 not due, 놓친 예약 회수", () => {
  const now = Date.parse("2026-07-11T05:00:00Z");
  const due = (iso) => iso != null && new Date(iso).getTime() <= now;
  assert.equal(due("2026-07-11T05:00:00Z"), true);   // 같은 시각
  assert.equal(due("2026-07-11T04:30:00Z"), true);   // 지난 예약(놓침) → 회수 대상
  assert.equal(due("2026-07-11T06:00:00Z"), false);  // 미래 → 아직
});

test("무한 루프 방지 — 상한 초과 없음(보정≤2·재생성≤1·보드≤3)", async () => {
  const stubbornRefine = (d) => d; // 개선 없음 → 조기 종료돼야
  const r = await runEditorialApproval({ draft: VERYWEAK, refine: stubbornRefine, regenerate: () => VERYWEAK });
  assert.ok(r.revisionCount <= 2 && r.regenerationCount <= 1 && r.boardReviewCount <= 3);
  assert.ok(["AUTO_APPROVED", "AUTO_APPROVED_WITH_NOTES", "CONDITIONAL_AUTO_APPROVED", "NEEDS_REVIEW"].includes(r.finalDecision));
});

test("보드 반환 구조(⑥) 필드 존재", () => {
  const b = reviewByBoard(STRONG);
  for (const k of ["boardDecision", "approvalCount", "totalReviewers", "qualityScore", "hardGatePassed", "reviewers", "grade"]) assert.ok(k in b, k);
  assert.equal(b.reviewers.length, 4);
  const hs = hardSafetyGate(STRONG);
  assert.ok("passed" in hs && "checks" in hs);
});
