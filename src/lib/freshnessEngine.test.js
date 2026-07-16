// Freshness Engine 단위 테스트 (Phase 59 §2·§7·§8)
import { test } from "node:test";
import assert from "node:assert/strict";
import { noveltyScore, freshnessVerdict, detectStructure, pickStructure, SIGNAL_KEYS } from "./freshnessEngine.js";

test("noveltyScore — 새 신호 많을수록 고점, 유사도 페널티", () => {
  const cand = { title: "속보 정부 공식 발표", content: "정부가 오늘 공식 발표했다. 통계청 지표에 따르면 수치가 올랐다. 출처를 함께 정리한다. 왜 중요한가? 체크리스트로 정리." };
  const nv = noveltyScore(cand, []);
  assert.ok(nv.score >= 60, `풍부한 신호 → 고점 (got ${nv.score})`);
  assert.ok(nv.signalCount >= 3);
});

test("§7 단서 — 새 정보 전혀 없으면 점수와 무관 차단", () => {
  const cand = { title: "그냥 잡담", content: "별다른 정보 없이 이런저런 이야기를 늘어놓는 평범한 글." };
  const v = freshnessVerdict(cand, []);
  assert.equal(v.blocked, true);
  assert.equal(v.verdict, "DISCARD");
});

test("freshnessVerdict — 임계(75/60/40) 판정", () => {
  const rich = { title: "속보 공식 발표 자료", content: "정부가 오늘 공식 발표했다. 통계청 자료 출처. 왜 중요한가? 체크리스트 정리. 공간과 연결." };
  assert.ok(["PROCEED", "AUGMENT"].includes(freshnessVerdict(rich, []).verdict));
});

test("§8 구조 다양화 — 최근 5개와 같은 구조면 다른 구조 추천", () => {
  assert.equal(SIGNAL_KEYS.length, 7);
  const existing = Array.from({ length: 5 }, (_, i) => ({ title: `체크리스트 준비물 단계 ${i}`, content: "체크리스트 단계 목록", created_at: `2026-07-1${i}` }));
  const cand = { title: "체크리스트 단계 정리", content: "준비물 목록 체크리스트" };
  const p = pickStructure(cand, existing);
  assert.equal(detectStructure(cand), "checklist");
  assert.equal(p.repeats, true);
  assert.notEqual(p.recommended, "checklist");
});
