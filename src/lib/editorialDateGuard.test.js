// Editorial Date Guard 단위 테스트 (Phase 59 §4)
import { test } from "node:test";
import assert from "node:assert/strict";
import { editorialDate, checkDateConsistency, detectStaleDates, normalizeDatesInText, weekdayOf } from "./editorialDateGuard.js";

const now = Date.parse("2026-07-16T02:00:00Z"); // KST 11:00, 2026-07-16

test("editorialDate — KST 단일 기준", () => {
  assert.equal(editorialDate({}, { now }), "2026-07-16");
  assert.equal(editorialDate({ scheduled_at: "2026-07-20T05:00:00Z" }, { now }), "2026-07-20");
});

test("case4 — 2023년 샘플 날짜 혼입 → DATE_REVISE + 보정", () => {
  const rec = { title: "오늘의 브리핑", content: "이 자료는 2023년 5월 10일 기준으로 작성되었습니다. 최신 동향을 정리합니다." };
  const chk = checkDateConsistency(rec, { now });
  assert.equal(chk.verdict, "DATE_REVISE");
  assert.ok(chk.staleDates.length >= 1);

  const fixed = normalizeDatesInText(rec.content, chk.editorialDate);
  assert.ok(!/2023/.test(fixed), "과거 연도 제거됨");
  assert.ok(/2026/.test(fixed), "현재 연도로 보정");
});

test("detectStaleDates — 현재 연도는 stale 아님", () => {
  assert.equal(detectStaleDates("2026년 7월 16일 발표", "2026-07-16").length, 0);
  assert.equal(detectStaleDates("2021년 통계 인용", "2026-07-16").length, 1);
});

test("weekdayOf — KST 요일", () => {
  assert.equal(weekdayOf("2026-07-16"), "목");
});

test("일관된 날짜 → OK", () => {
  const chk = checkDateConsistency({ title: "정상 기사", content: "오늘 상황을 정리합니다. 날짜 혼입 없음." }, { now });
  assert.equal(chk.verdict, "OK");
});
