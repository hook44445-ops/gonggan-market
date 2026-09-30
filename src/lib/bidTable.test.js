// 견적 «나란히 비교» 표 — 「비교견적」의 본질이 깨지지 않게 지키는 검사.
import test from "node:test";
import assert from "node:assert/strict";
import { compareBids, perDay, proofsOf, bidColumn, MAX_COMPARE } from "./bidTable.js";

const bid = (over = {}) => ({ id: 1, price: 1000, period: 20, material: "LX 바닥재", comment: "12년 경력",
  company: { name: "가업체", verified: true, completedJobs: 5 }, ...over });

test("하루당 = 금액 ÷ 기간 · 기간을 안 적었으면 계산하지 않는다", () => {
  assert.equal(perDay(1000, 20), 50);
  assert.equal(perDay(980, 45), 21.8);
  assert.equal(perDay(1000, 0), null);   // 0 으로 나눈 이상한 숫자를 만들지 않는다
  assert.equal(perDay(0, 20), null);
});

test("증빙은 카드 엠블럼과 같은 칸을 본다", () => {
  assert.deepEqual(proofsOf({ verified: true }), { biz: true, insurance: false, deposit: false });
  assert.equal(proofsOf({ has_insurance: true }).insurance, true);
  assert.equal(proofsOf({ hasInsurance: true }).insurance, true);
  // 보증금은 «걸려 있는 상태 + 금액»이 둘 다 있어야 한다
  assert.equal(proofsOf({ guarantee_status: "ACTIVE", guarantee_amount: 100 }).deposit, true);
  assert.equal(proofsOf({ guarantee_status: "ACTIVE", guarantee_amount: 0 }).deposit, false);
  assert.equal(proofsOf({ guarantee_amount: 100 }).deposit, false);
});

// ★ 이 검사가 이 기능의 핵심이다.
// 안 적은 업체를 가려 주면 비교가 아니라 광고가 된다. 빈 칸은 빈 칸으로 보여야 한다.
test("안 적은 칸은 숨기지 않고 «안 적음»으로 드러낸다", () => {
  const r = compareBids([bid(), bid({ id: 2, material: "", comment: "", company: { name: "나업체" } })]);
  const material = r.rows.find(x => x.key === "material");
  assert.equal(material.cells[0].missing, false);
  assert.equal(material.cells[1].missing, true);
  assert.equal(material.cells[1].text, "안 적음");
  assert.ok(r.missingCount >= 2, "안 적은 칸 수를 센다");
  assert.ok(r.notes.some(n => n.includes("안 적힌 칸")), "물어보라고 알려 준다");
});

test("완료 0건은 «안 적음»이 아니라 «아직 없음» — 새 업체를 빠뜨린 업체로 만들지 않는다", () => {
  const r = compareBids([bid({ company: { name: "새업체" } })]);
  const done = r.rows.find(x => x.key === "done");
  assert.equal(done.cells[0].text, "아직 없음");
  assert.equal(done.cells[0].missing, false);
});

test("가장 싼 곳을 표시하고, 나머지는 차액을 같이 보인다", () => {
  const r = compareBids([bid({ id: 1, price: 1200 }), bid({ id: 2, price: 980 })]);
  const price = r.rows.find(x => x.key === "price");
  assert.equal(price.cells[1].best, true);
  assert.equal(price.cells[0].best, false);
  assert.equal(price.cells[0].sub, "+220만원");
  assert.deepEqual(r.spread, { low: 980, high: 1200, gap: 220 });
  assert.ok(r.notes.some(n => n.includes("220만원")));
});

test("한 곳만 있으면 «가장 싼 곳»을 표시하지 않는다 — 비교가 아니다", () => {
  const r = compareBids([bid()]);
  assert.equal(r.spread, null);
  assert.equal(r.rows.find(x => x.key === "price").cells[0].best, false);
  assert.ok(!r.notes.some(n => n.includes("차이예요")));
});

// 이 표는 «최종 금액을 고르는 표»가 아니라 «누구를 부를지 좁히는 표»다(대표 09-30).
// 큰 공사는 어차피 실측 뒤 금액이 바뀐다 — 그 사실을 표가 먼저 말해야 한다.
test("최종 금액을 약속하지 않고, 표의 쓸모를 먼저 말한다", () => {
  const r = compareBids([bid(), bid({ id: 2 })]);
  assert.ok(r.notes[0].includes("2~3곳"), "첫 줄이 «먼저 몇 곳만 불러 보라»여야 한다");
  assert.ok(r.notes.some(n => n.includes("현장을 보고 나면 금액이 바뀝니다")), "금액이 바뀐다고 분명히 말한다");
  assert.ok(!r.notes.some(n => /최종 금액은 .*확정입니다|금액이 그대로/.test(n)), "최종가를 약속하지 않는다");
});

test(`한 번에 ${MAX_COMPARE}곳까지만 — 폰에서 글자가 뭉개지지 않게`, () => {
  const r = compareBids([bid({ id: 1 }), bid({ id: 2 }), bid({ id: 3 }), bid({ id: 4 })]);
  assert.equal(r.cols.length, MAX_COMPARE);
});

test("입찰이 없거나 이상한 값이어도 깨지지 않는다", () => {
  for (const v of [[], null, undefined, "x"]) {
    const r = compareBids(v);
    assert.deepEqual(r.cols, []);
    assert.deepEqual(r.rows, []);
  }
});

test("DB 칸 이름(period_days · material_note)으로 와도 읽는다", () => {
  const c = bidColumn({ id: 9, price: 500, period_days: 10, material_note: "국산 타일", company: {} });
  assert.equal(c.period, 10);
  assert.equal(c.material, "국산 타일");
  assert.equal(c.perDay, 50);
});

test("«가장 낮음»은 금액 줄에서만 — 증빙 줄엔 증빙 줄의 말을 붙인다", () => {
  const full = { name: "가업체", verified: true, has_insurance: true, guarantee_status: "ACTIVE", guarantee_amount: 100 };
  const r = compareBids([bid({ id: 1, price: 1200, company: full }), bid({ id: 2, price: 980, company: { name: "나업체", verified: true } })]);
  const price = r.rows.find(x => x.key === "price");
  const proof = r.rows.find(x => x.key === "proof");
  assert.equal(price.cells[1].bestText, "가장 낮음");
  assert.equal(proof.cells[0].best, true);
  assert.equal(proof.cells[0].bestText, "셋 다 냄");   // 「가장 낮음」이 붙으면 안 된다
  assert.notEqual(proof.cells[0].bestText, "가장 낮음");
});
