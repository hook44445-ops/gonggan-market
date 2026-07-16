// Repetition Guard 단위 테스트 (Phase 59 §3)
import { test } from "node:test";
import assert from "node:assert/strict";
import { primaryEntity, similarity, isRepeat, entityConcentration } from "./repetitionGuard.js";

const nvidiaBody = "엔비디아가 이번 분기 실적을 발표했다. AI 반도체 수요가 강하게 이어지며 데이터센터 매출이 크게 늘었다. 반도체 랠리가 지속될지 관심이 모인다. ".repeat(4);

test("primaryEntity — 핵심 엔티티 추출", () => {
  assert.equal(primaryEntity({ title: "엔비디아 실적과 AI 반도체 랠리", content: nvidiaBody }), "엔비디아");
});

test("similarity — 유사 본문 높은 점수", () => {
  assert.ok(similarity(nvidiaBody, nvidiaBody) > 0.9);
  assert.ok(similarity("완전히 다른 주제 인테리어 시공 가이드", nvidiaBody) < 0.2);
});

test("case1/3 — 엔비디아 유사 주제(새 신호 없음) → 반복 차단", () => {
  const existing = [{ id: 1, title: "엔비디아 실적과 AI 반도체 랠리", content: nvidiaBody, publish_status: "published", created_at: "2026-07-10" }];
  const cand = { title: "엔비디아 실적으로 본 반도체 전망", content: nvidiaBody + "전망을 정리한다." };
  const r = isRepeat(cand, existing, { hasNewSignal: false });
  assert.equal(r.repeat, true);
});

test("case2 — 엔비디아 신규 공식 발표(새 신호) → 반복 아님", () => {
  const existing = [{ id: 1, title: "엔비디아 실적과 AI 반도체 랠리", content: nvidiaBody, publish_status: "published", created_at: "2026-07-10" }];
  const cand = { title: "엔비디아 신규 GPU 공식 발표 요약", content: "엔비디아가 오늘 신규 GPU 를 공식 발표했다. 새 사양과 가격이 처음 공개됐다. " + nvidiaBody };
  const r = isRepeat(cand, existing, { hasNewSignal: true });
  assert.equal(r.repeat, false);
});

test("entityConcentration — 오늘 특정 엔티티 10% 초과 감지", () => {
  const recs = Array.from({ length: 10 }, (_, i) => ({ id: i, title: i < 3 ? "엔비디아 관련 기사" : `기타 주제 ${i}`, content: i < 3 ? nvidiaBody : "다른 내용", publish_status: "published", created_at: "2026-07-12T05:00:00Z" }));
  const c = entityConcentration(recs, { now: Date.parse("2026-07-12T05:00:00Z") });
  assert.ok(c.total >= 10);
});
