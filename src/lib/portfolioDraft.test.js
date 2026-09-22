import { test } from "node:test";
import assert from "node:assert/strict";
import { draftFromContract, contractsReadyForShowcase, PHOTO_STEP } from "./portfolioDraft.js";

const contract = { id: "k1", total_amount: 24000000, requests: { area: "서울 강서구", space_type: "아파트 전체", size: "30평대" } };
const rows = [
  { contract_id: "k1", step: PHOTO_STEP.start, photos: ["b1", "b2"] },
  { contract_id: "k1", step: PHOTO_STEP.mid, photos: ["m1"] },
  { contract_id: "k1", step: PHOTO_STEP.done, photos: ["a1", "a2"] },
  { contract_id: "k1", step: PHOTO_STEP.done, photos: ["a2", "a3"] },
];

test("완료 사진 → 시공 후 · 착공 사진 → 시공 전 · 중간 사진은 쓰지 않는다", () => {
  const d = draftFromContract(contract, rows);
  assert.deepEqual(d.after_photos, ["a1", "a2", "a3"]);
  assert.deepEqual(d.before_photos, ["b1", "b2"]);
});

test("요청 정보로 제목·공간·지역·평수 · 금액은 만원 단위", () => {
  const d = draftFromContract(contract, rows);
  assert.equal(d.title, "30평대 아파트 전체 시공");
  assert.equal(d.space_type, "아파트 전체");
  assert.equal(d.area, "서울 강서구");
  assert.equal(d.size, "30평대");
  assert.equal(d.budget, 2400);
  assert.equal(d.desc, "");
});

test("완료 사진이 없으면 초안을 만들지 않는다", () => {
  assert.equal(draftFromContract(contract, rows.filter((r) => r.step !== PHOTO_STEP.done)), null);
});

test("사진은 8장까지", () => {
  const many = [{ contract_id: "k1", step: PHOTO_STEP.done, photos: Array.from({ length: 12 }, (_, i) => `a${i}`) }];
  assert.equal(draftFromContract(contract, many).after_photos.length, 8);
});

test("요청 정보가 비어도 제목이 선다", () => {
  const d = draftFromContract({ id: "k2" }, [{ contract_id: "k2", step: PHOTO_STEP.done, photos: ["x"] }]);
  assert.equal(d.title, "시공 사례");
  assert.equal(d.budget, null);
});

test("이미 이 공사 사진으로 만든 사례가 있으면 목록에서 빠진다", () => {
  const ready = contractsReadyForShowcase({ contracts: [contract], photoRows: rows, portfolios: [] });
  assert.equal(ready.length, 1);
  const done = contractsReadyForShowcase({ contracts: [contract], photoRows: rows, portfolios: [{ after_photos: ["a2"] }] });
  assert.equal(done.length, 0);
});

test("사진이 다른 계약에 섞이지 않는다", () => {
  const ready = contractsReadyForShowcase({
    contracts: [contract, { id: "k9", requests: {} }],
    photoRows: [...rows, { contract_id: "k9", step: PHOTO_STEP.start, photos: ["only-before"] }],
  });
  assert.deepEqual(ready.map((r) => r.contract.id), ["k1"]);
});

test("계약 id로 이미 만든 사례도 빠진다(사진을 바꿔 저장했어도)", () => {
  const ready = contractsReadyForShowcase({ contracts: [contract], photoRows: rows, portfolios: [{ contract_id: "k1", after_photos: ["other"] }] });
  assert.equal(ready.length, 0);
});
