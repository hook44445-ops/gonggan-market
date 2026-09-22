import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAction, progressSteps } from "./escrowNext.js";

const L = { 1: "결제", 2: "자재비", 3: "공사 시작", 4: "중간", 5: "완료" };
const base = { 1: "done", 2: "done", 3: "company_todo", 4: "locked", 5: "locked" };

test("업체 차례: 파트너는 올리기, 의뢰인은 기다림", () => {
  const p = nextAction({ stageStatus: base, isConsumer: false, labels: L });
  assert.equal(p.cta, "사진 올리기"); assert.equal(p.anchor, "stage-3"); assert.equal(p.tone, "act");
  const c = nextAction({ stageStatus: base, isConsumer: true, labels: L });
  assert.equal(c.cta, null); assert.equal(c.tone, "wait"); assert.equal(c.title, "업체가 착공 사진을 준비하고 있어요");
});

test("고객 확인 차례: 의뢰인은 확인하기, 파트너는 기다림", () => {
  const s = { ...base, 3: "pending_customer" };
  const c = nextAction({ stageStatus: s, isConsumer: true, labels: L });
  assert.equal(c.cta, "사진 확인하기"); assert.equal(c.anchor, "stage-3"); assert.equal(c.tone, "act");
  const p = nextAction({ stageStatus: s, isConsumer: false, labels: L });
  assert.equal(p.tone, "wait");
});

test("이의 신청 중이면 다른 무엇보다 먼저", () => {
  const c = nextAction({ stageStatus: { ...base, 3: "pending_customer" }, isConsumer: true, labels: L, disputed: true });
  assert.equal(c.tone, "warn"); assert.equal(c.cta, null);
});

test("정산 완료: 후기 전엔 후기 쓰기, 후엔 마무리", () => {
  const s = { 1: "done", 2: "done", 3: "done", 4: "done", 5: "done" };
  assert.equal(nextAction({ stageStatus: s, isConsumer: true, labels: L }).cta, "후기 쓰기");
  assert.equal(nextAction({ stageStatus: s, isConsumer: true, labels: L, reviewed: true }).cta, null);
  assert.equal(nextAction({ stageStatus: base, isConsumer: false, labels: L, settled: true }).tone, "done");
});

test("진행 막대: 완료·진행·잠김", () => {
  assert.deepEqual(progressSteps(base).map((x) => x.state), ["done", "done", "active", "locked", "locked"]);
});

test("문장에는 짧은 이름 — «확인 사진을 확인» 겹침 없음", () => {
  const c = nextAction({ stageStatus: { ...base, 3: "done", 4: "pending_customer" }, isConsumer: true, labels: L });
  assert.equal(c.title, "중간 점검 사진이 올라왔어요");
  assert.equal(nextAction({ stageStatus: base, isConsumer: false, labels: L }).title, "착공 사진을 올려 주세요");
});
