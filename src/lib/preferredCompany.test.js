import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { rememberPreferredCompany, peekPreferredCompany, markPreferredOpened, clearPreferredCompany, preferredNotifyTarget } = await import("./preferredCompany.js");

beforeEach(() => store.clear());

test("기억 → 3일 안에만 · 열었다 표시 · 지우기", () => {
  const t0 = Date.parse("2026-10-02T10:00:00+09:00");
  rememberPreferredCompany({ id: "c1", name: "반듯수리", ownerId: "u9" }, t0);
  assert.equal(peekPreferredCompany(t0 + 1000).name, "반듯수리");
  assert.equal(peekPreferredCompany(t0 + 1000).opened, false);
  assert.equal(peekPreferredCompany(t0 + 3 * 86400000 + 1), null);
  markPreferredOpened();
  assert.equal(peekPreferredCompany().opened, true);
  clearPreferredCompany();
  assert.equal(peekPreferredCompany(), null);
});

test("알릴 사람 — 업체 주인만, 자기 업체에 요청하면 안 알림", () => {
  assert.equal(preferredNotifyTarget({ ownerId: "u9" }, "u1"), "u9");
  assert.equal(preferredNotifyTarget({ ownerId: "u9" }, "u9"), null);
  assert.equal(preferredNotifyTarget({ ownerId: null }, "u1"), null);
  assert.equal(preferredNotifyTarget(null, "u1"), null);
});
