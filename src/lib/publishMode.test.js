// Publish Mode Decider + Daily Budget + KST 예약 단위 테스트 (Phase 47)
//   실행: node --test src/lib/publishMode.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { decidePublishMode, isAutoImmediate } from "./publishModeDecider.js";
import { computeBudget, canPublish, isRegular, CAP_TOTAL } from "./dailyPublishBudget.js";
import { reviewByBoard } from "./aiEditorialBoard.js";
import { schedulePublishAt } from "./publishScheduler.js";
import { editorialDateKST } from "./editorialKey.js";

const LONG = ["## 도입","이 글은 독자에게 실제 도움이 되는 정보를 충분한 분량으로 정리합니다.","","## 본문 상세","- 첫 번째 준비 항목과 확인 방법","- 두 번째 비교 기준과 절차","- 세 번째 주의사항 체크리스트","일반적으로 알려진 기준과 참고 자료, 실제 사례와 절차를 함께 확인했습니다.","어떻게 준비할까요? 무엇을 먼저 확인해야 할까요? 비용은 얼마나 들까요?","","## 결론","정리하면 아래 체크리스트로 차근차근 준비하시면 도움이 됩니다."].join("\n");

// ── §24 즉시발행 사례 ────────────────────────────────
test("§24 집중호우 지하차도 통제 → IMMEDIATE P1 BREAKING_NEWS", () => {
  const m = decidePublishMode({ title: "오늘 수도권 집중호우로 일부 지하차도 통제", content: LONG, content_type: "breaking" });
  assert.equal(m.mode, "IMMEDIATE"); assert.equal(m.priority, "P1"); assert.equal(m.reason, "BREAKING_NEWS");
  assert.ok(isAutoImmediate(m.priority));
});
test("실시간 급등 → IMMEDIATE P2", () => {
  const m = decidePublishMode({ title: "○○ 검색량 급등 실시간 화제", content: LONG, content_type: "trend_present" });
  assert.equal(m.mode, "IMMEDIATE"); assert.equal(m.priority, "P2");
});
test("당일 한정 → IMMEDIATE P3", () => {
  const m = decidePublishMode({ title: "오늘만 진행하는 마감 임박 행사 공지", content: LONG, content_type: "general" });
  assert.equal(m.priority, "P3");
});
test("관리자 force_immediate → P4", () => {
  const m = decidePublishMode({ title: "일반 글", content: LONG, content_type: "space_market", force_immediate: true });
  assert.equal(m.priority, "P4"); assert.equal(m.reason, "ADMIN_FORCE");
});
test("도래 미발행 → IMMEDIATE P5 OVERDUE_RECOVERY", () => {
  const past = new Date(Date.now() - 3600e3).toISOString();
  const m = decidePublishMode({ title: "예약 지난 글", content: LONG, content_type: "space_market", scheduled_at: past });
  assert.equal(m.priority, "P5"); assert.equal(m.reason, "OVERDUE_RECOVERY");
});

// ── §24 예약발행 사례 ────────────────────────────────
test("§24 장마철 욕실 곰팡이 예방법 → SCHEDULED(EVERGREEN/PROGRAM)", () => {
  const m = decidePublishMode({ title: "장마철 욕실 곰팡이 예방법", content: LONG, content_type: "space_market" });
  assert.equal(m.mode, "SCHEDULED"); assert.equal(m.reason, "PROGRAM_SLOT");
});
test("QT/운세/Morning Brief → SCHEDULED", () => {
  for (const t of ["qt", "astrology", "morning_brief", "series", "trend_past"]) {
    assert.equal(decidePublishMode({ title: "오늘 편성 글", content: LONG, content_type: t }).mode, "SCHEDULED");
  }
});

// ── §24 HOLD 사례 ────────────────────────────────────
test("§24 출처 없는 의료 위험 단정 → HOLD(HARD_FAIL, Safety Gate 우회 불가)", () => {
  const draft = { title: "이 약은 반드시 낫는다 100% 완치", content: "## 소개\n이 약은 반드시 낫는다. 무조건 오른다. 반드시 성공합니다. " + LONG, category: "health", type: "space_market" };
  const board = reviewByBoard(draft);
  assert.equal(board.hardGatePassed, false, "위험 단정은 Hard Gate 실패");
  const m = decidePublishMode({ title: draft.title, content: draft.content, content_type: "space_market" }, { board });
  assert.equal(m.mode, "HOLD"); assert.equal(m.reason, "HARD_FAIL");
});
test("본문 공백 → HOLD BROKEN_BODY", () => {
  assert.equal(decidePublishMode({ title: "제목만", content: "짧음", content_type: "general" }).reason, "BROKEN_BODY");
});
test("긴급이어도 Hard Fail이면 HOLD(즉시발행 특례로 우회 금지)", () => {
  const m = decidePublishMode({ title: "속보 긴급", content: "짧음" }, { board: { hardGatePassed: false } });
  assert.equal(m.mode, "HOLD");
});

// ── §16-17 예산 ──────────────────────────────────────
test("정기/비정기 분류 + 예산 집계", () => {
  assert.equal(isRegular("qt"), true);
  assert.equal(isRegular("breaking"), false);
  const today = editorialDateKST(Date.now());
  const mk = (title, st) => ({ title, publish_status: st, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  const recs = [mk("오늘 큐티 말씀", "published"), mk("공간마켓 팁", "published"), mk("속보 긴급 사고", "published")];
  const b = computeBudget(recs, { now: Date.now() });
  assert.equal(b.total.pub, 3);
  assert.ok(b.regular.pub >= 2 && b.irregular.pub >= 1);
  void today;
});
test("§16 총 15건 초과 시 canPublish=false(자동 초과 금지)", () => {
  const b = { regular: { pub: 8, cap: 10 }, irregular: { pub: 7, cap: 5 }, total: { pub: 15, cap: CAP_TOTAL } };
  assert.equal(canPublish("qt", b), false);
  assert.equal(canPublish("breaking", b), false);
});
test("비정기 5건 초과 시 비정기만 차단(정기는 여지)", () => {
  const b = { regular: { pub: 3, cap: 10 }, irregular: { pub: 5, cap: 5 }, total: { pub: 8, cap: CAP_TOTAL } };
  assert.equal(canPublish("breaking", b), false);
  assert.equal(canPublish("qt", b), true);
});

// ── §18 KST 예약: 다음 주로 밀리지 않음 ───────────────
test("§18 schedulePublishAt — 지난 슬롯은 '내일'이지 다음 주가 아님", () => {
  // qt 슬롯 05시. 정오(로컬)에 호출 → 오늘 05시는 지났으므로 내일 05시(≤ +24h).
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const at = schedulePublishAt("qt", { now: now.getTime() });
  const diffH = (at.getTime() - now.getTime()) / 3600e3;
  assert.ok(diffH > 0 && diffH <= 24, `내일 이내여야: ${diffH.toFixed(1)}h`);
});
