// 공사 화면 단계 수 — 파트너 상태(사업자·보증금)와 공사 금액에 따라 다르게(대표 09-25).
//   공사 화면 칸: 1 계약 확정 · 2 자재비 · 3 공사 시작 확인 · 4 중간 확인 · 5 공사 완료 확인
import { test } from "node:test";
import assert from "node:assert/strict";
import { stagePlanFor, planUsesStage, STAGE_PLANS, advanceDepositNeed } from "./calculations.js";

const stepsOf = (plan) => [1, 2, 3, 4, 5].filter(id => planUsesStage(plan, id));

test("500만원 미만 — 계약 확정 · 공사 시작 확인 · 공사 완료 확인(3칸, 30/70)", () => {
  const plan = stagePlanFor({ bizVerified: true, totalManwon: 240 });
  assert.equal(plan, "2STEP");
  assert.deepEqual(stepsOf(plan), [1, 3, 5]);
  assert.deepEqual(STAGE_PLANS[plan], [0, 30, 0, 70]);
});

test("500만~1,000만원 — 보증금 없으면 4칸(자재비 없음), 100만원 이상이면 5칸", () => {
  const noDep = stagePlanFor({ bizVerified: true, totalManwon: 800 });
  assert.equal(noDep, "3STEP");
  assert.deepEqual(stepsOf(noDep), [1, 3, 4, 5]);
  assert.equal(stagePlanFor({ bizVerified: true, totalManwon: 800, depositManwon: 50 }), "3STEP");   // 베이직은 모자람
  const dep = stagePlanFor({ bizVerified: true, totalManwon: 800, depositManwon: 100 });
  assert.equal(dep, "4STEP");
  assert.deepEqual(stepsOf(dep), [1, 2, 3, 4, 5]);
});

test("1,000만원 초과 — 입찰 조건(보험+구간 보증금)을 갖춘 업체는 늘 5칸", () => {
  // 입찰하려면 보증금 × 10 ≥ 공사 금액 → 등급(200·500·1,000)이 곧 구간 끝 10% 이상
  for (const [amt, dep] of [[1200, 200], [2000, 200], [3500, 500], [9000, 1000]]) {
    assert.ok(dep >= advanceDepositNeed(amt), `${amt}만원 · 보증금 ${dep}`);
    assert.deepEqual(stepsOf(stagePlanFor({ bizVerified: true, totalManwon: amt, depositManwon: dep })), [1, 2, 3, 4, 5]);
  }
});

test("사업자 확인 전 — 1STEP(결제는 막히고, 칸은 기록용 3칸)", () => {
  const plan = stagePlanFor({ bizVerified: false, totalManwon: 800 });
  assert.equal(plan, "1STEP");
  assert.deepEqual(stepsOf(plan), [1, 3, 5]);
});

test("단계 비율 합은 늘 100", () => {
  for (const [k, v] of Object.entries(STAGE_PLANS)) assert.equal(v.reduce((a, b) => a + b, 0), 100, k);
});
