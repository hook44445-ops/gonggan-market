import { test } from "node:test";
import assert from "node:assert/strict";
import { contractGate, bizGrace, BIZ_GRACE_HOURS } from "./contractGate.js";

test("A안: 사업자 확인된 업체만 계약", () => {
  assert.deepEqual(contractGate({ verified: true }), { ok: true, code: null });
  assert.equal(contractGate({ verified: false }).code, "BIZ_REQUIRED");
  assert.equal(contractGate({}).code, "BIZ_REQUIRED");            // 칸이 없으면 확인 안 된 것
  assert.equal(contractGate({ verified: "true" }).code, "BIZ_REQUIRED"); // 글자 "true" 는 인정하지 않는다
  assert.equal(contractGate(null).code, "COMPANY_UNKNOWN");
});

test("A안: 기한은 선택 뒤 72시간", () => {
  assert.equal(BIZ_GRACE_HOURS, 72);
  const sel = "2026-09-24T00:00:00Z";
  const g1 = bizGrace(sel, "2026-09-25T00:00:00Z");
  assert.equal(g1.hoursLeft, 48);
  assert.equal(g1.expired, false);
  const g2 = bizGrace(sel, "2026-09-27T00:00:01Z");
  assert.equal(g2.hoursLeft, 0);
  assert.equal(g2.expired, true);
});

test("A안: 선택 시각을 모르면 기한을 지어내지 않는다", () => {
  assert.equal(bizGrace(null), null);
  assert.equal(bizGrace("nope"), null);
});
