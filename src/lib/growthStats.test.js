import { test } from "node:test";
import assert from "node:assert/strict";
import { growthCards, fmtCount } from "./growthStats.js";

test("숫자가 있으면 그대로 · 초대 비율 %", () => {
  const cards = growthCards({ users_7d: 12, users_30d: 40, users_total: 200, referred_total: 50, referred_7d: 5, testers_total: 9, testers_waiting: 3 });
  const by = Object.fromEntries(cards.map(c => [c.key, c]));
  assert.equal(by.users.value, 12);
  assert.equal(by.users.sub, "30일 40 · 전체 200");
  assert.equal(by.referred.sub, "전체 50 · 가입의 25%");
  assert.equal(by.testers.sub, "Play 추가 대기 3");
  assert.equal(by.testers.href, "/testers");
});

test("SQL 전(값 null)이면 «—»와 무엇이 필요한지", () => {
  const by = Object.fromEntries(growthCards({}).map(c => [c.key, c]));
  assert.equal(by.referred.value, null);
  assert.equal(by.referred.sub, "SQL 146 전");
  assert.equal(by.testers.sub, "SQL 147 전");
  assert.equal(by.slug.sub, "SQL 149 전");
  assert.equal(fmtCount(null), "—");
  assert.equal(fmtCount(1234), "1,234");
});
