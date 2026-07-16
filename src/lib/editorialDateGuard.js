// ════════════════════════════════════════════════════════════════════
// 공간라운지 Editorial Date Guard — 날짜 단일 기준 (Phase 59 §4)
//
//   기사의 날짜는 반드시 editorial_date(KST) 하나만 사용한다. 제목·본문·요일·메타·예약일·
//   이미지 문구·OG 가 모두 이 날짜에서 파생되도록 강제하고, 프롬프트/템플릿의 과거 날짜가
//   본문에 혼입되면 DATE_REVISE 로 전환한다.
//
//   ⚠️ 신규 순수 함수 · editorialDateKST 재사용. DB/Schema 무변경.
// ════════════════════════════════════════════════════════════════════

import { editorialDateKST } from "./editorialKey.js";

const KST_OFFSET_MS = 9 * 3600 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// editorial_date(YYYY-MM-DD, KST) — 예약시각 우선, 없으면 now.
export function editorialDate(record = {}, { now = Date.now() } = {}) {
  const ref = record.scheduled_at || record.editorial_date || now;
  return editorialDateKST(ref);
}
export function weekdayOf(dateStr) {
  const d = new Date(Date.parse(`${dateStr}T00:00:00Z`) + KST_OFFSET_MS);
  return WEEKDAYS[d.getUTCDay()];
}

// 본문/제목에서 날짜 토큰 추출(YYYY-MM-DD, YYYY년 M월 D일, YYYY.MM.DD).
const DATE_RE = /(20\d{2})[.\-\s년]+\s*(\d{1,2})[.\-\s월]+\s*(\d{1,2})\s*일?/g;
const YEAR_RE = /(20\d{2})\s*년/g;

export function extractDates(text = "") {
  const out = [];
  const s = String(text);
  let m;
  DATE_RE.lastIndex = 0;
  while ((m = DATE_RE.exec(s))) out.push({ raw: m[0], y: +m[1], mo: +m[2], d: +m[3] });
  YEAR_RE.lastIndex = 0;
  while ((m = YEAR_RE.exec(s))) out.push({ raw: m[0], y: +m[1], mo: null, d: null });
  return out;
}

// 과거/불일치 날짜 검출 — editorial_date 의 연도와 다른 연도가 본문/제목에 있으면 stale.
export function detectStaleDates(text = "", editorialDateStr) {
  const curYear = Number(String(editorialDateStr).slice(0, 4));
  return extractDates(text).filter((d) => d.y !== curYear);
}

// 날짜 일관성 검사 → OK | DATE_REVISE.
//   record: { title, content|body, scheduled_at, editorial_date }
export function checkDateConsistency(record = {}, { now = Date.now() } = {}) {
  const date = editorialDate(record, { now });
  const text = `${record.title ?? ""}\n${record.content ?? record.body ?? ""}`;
  const stale = detectStaleDates(text, date);
  const consistent = stale.length === 0;
  return {
    editorialDate: date,
    weekday: weekdayOf(date),
    consistent,
    verdict: consistent ? "OK" : "DATE_REVISE",
    staleDates: stale.map((d) => d.raw),
    reason: consistent ? null : `과거/불일치 날짜 ${stale.length}건(기준 ${date})`,
  };
}

// 과거 날짜 토큰을 editorial_date 로 치환(보정). 연도만 있는 표기는 현재 연도로.
export function normalizeDatesInText(text = "", editorialDateStr) {
  const [y, mo, d] = String(editorialDateStr).split("-").map(Number);
  const curYear = y;
  return String(text)
    .replace(DATE_RE, (raw, yy) => (Number(yy) !== curYear ? `${y}년 ${mo}월 ${d}일` : raw))
    .replace(YEAR_RE, (raw, yy) => (Number(yy) !== curYear ? `${curYear}년` : raw));
}

// 발행 레코드에 날짜 파생값을 일괄 세팅(단일 기준).
export function withEditorialDate(record = {}, { now = Date.now() } = {}) {
  const date = editorialDate(record, { now });
  return { ...record, editorial_date: date, editorial_weekday: weekdayOf(date) };
}
