import { test } from "node:test";
import assert from "node:assert/strict";
import { peerMonthLabel, hasPeerBoard, peerMeLine, peerMeSub } from "./peerInvite.js";

test("이번 달 — 한국 시간 기준", () => {
  assert.equal(peerMonthLabel("2026-08-31T15:00:00+00:00"), "9월");   // 9월 1일 0시(한국)
  assert.equal(peerMonthLabel("2026-09-30T15:00:00+00:00"), "10월");
  assert.equal(peerMonthLabel(null, Date.parse("2026-12-31T16:00:00Z")), "1월");
});

test("순위판 보일지 — 183 전·실패면 숨김", () => {
  assert.equal(hasPeerBoard({ ok: true, top: [] }), true);
  assert.equal(hasPeerBoard(null), false);
  assert.equal(hasPeerBoard({ ok: false }), false);
});

test("내 줄", () => {
  const since = "2026-08-31T15:00:00+00:00";
  assert.equal(peerMeLine({ since, me: { rank: 1, count: 2 } }), "9월 2곳 · 1등");
  assert.equal(peerMeLine({ since, me: { rank: null, count: 0 } }), "9월 아직 없어요");
  assert.equal(peerMeSub({ me: { total: 3, waiting: 1 } }), "지금까지 3곳 · 가입만 하고 업체 등록 전 1명");
  assert.equal(peerMeSub({ me: { total: 0, waiting: 0 } }), "");
});

test("보상 약속 문구 없음", () => {
  const all = [peerMeLine({ me: { rank: 1, count: 5 } }), peerMeSub({ me: { total: 5, waiting: 2 } })].join(" ");
  assert.doesNotMatch(all, /토큰|상금|보상|혜택|드려요/);
});
