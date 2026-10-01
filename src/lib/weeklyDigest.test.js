import { test } from "node:test";
import assert from "node:assert/strict";
import { kstDateLabel, weeklyFileName, weakCandidates, buildWeeklyMarkdown } from "./weeklyDigest.js";
import { uspRows } from "./uspBoard.js";

const MON = Date.parse("2026-10-05T01:00:00Z");   // 한국 10-05 월 10시

test("한국 날짜·파일 이름", () => {
  assert.equal(kstDateLabel(MON), "2026-10-05 (월)");
  assert.equal(weeklyFileName(MON), "docs/WEEKLY-2026-10-05.md");
});

test("없는 숫자는 «—» — 지어내지 않는다", () => {
  const md = buildWeeklyMarkdown({ now: MON });
  assert.match(md, /새 가입 — · 30일 — · 전체 —/);
  assert.match(md, /## 2\. 푸시\n- —/);
  assert.match(md, /규칙에 걸린 숫자 없음/);
  assert.match(md, /\*\*고른 것:\*\* ____/);
  assert.equal((md.match(/^- \d+ /gm) ?? []).length, 15);   // USP 15줄(12 + 라운지 3)
});

test("약한 숫자 후보 — PLAN 5절 규칙을 숫자로만", () => {
  const usp = uspRows([
    { usp: 2, used: 10, converted: 3, base_used: 10, base_converted: 2 },
    { usp: 7, used: 8, converted: 2, base_used: 9, base_converted: 3 },
  ]);
  const c = weakCandidates({
    growth: { users_7d: 40, referred_7d: 2 },
    pushReach: { users: 100, reach: 12 },
    notify: [{ type: "REVIEW_5STAR", sent: 30, read: 3 }, { type: "BID_VIEWED", sent: 5, read: 0 }],
    usp,
  });
  assert.ok(c.some((x) => /푸시 받는 사람 12%/.test(x)));
  assert.ok(c.some((x) => /읽음 10% \(보냄 30\)/.test(x)));
  assert.ok(!c.some((x) => /보냄 5\)/.test(x)));           // 표본 10 미만은 빼고
  assert.ok(c.some((x) => /초대로 가입 2\/40/.test(x)));
  assert.ok(c.some((x) => /입찰 받은 비율 30%/.test(x)));
  assert.ok(c.some((x) => /USP 7 .*\(차이 -8%p\)/.test(x)));   // 25% vs 33%
});

test("마크다운에 USP 줄 · 비교 %p", () => {
  const md = buildWeeklyMarkdown({ now: MON, uspData: { rows: [{ usp: 2, used: 10, converted: 8, base_used: 10, base_converted: 3 }] } });
  assert.match(md, /- 2 현장 사진: 사진 붙은 요청 10 → 입찰 1곳 이상 받음 8 \(80%\) · 비교\(사진 없는 요청\) 30% \(\+50%p\)/);
});
