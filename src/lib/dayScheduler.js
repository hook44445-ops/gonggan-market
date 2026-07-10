// ════════════════════════════════════════════════════════════════════
// 공간마켓 Day Scheduler — 날짜 변경 시 오늘 편성 자동 생성 (Phase 38)
//   버튼 없이 "새로운 날"이 되면 오늘 기본편성을 1회 자동 생성한다(중복 생성 방지).
//   ⚠️ 기존 dayRunner.runDay 재사용(무수정) · localStorage 플래그만. Cron 없음(호출 시점 판단).
//   Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { runDay } from "./dayRunner.js";

const KEY = "space_day_scheduler_v1";
const dayStr = (now) => new Date(now).toDateString();

function getState() { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") || {}; } catch { return {}; } }
function setState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

export function lastGeneratedDate() { return getState().lastDate || null; }
export function isTodayGenerated(now = Date.now()) { return getState().lastDate === dayStr(now); }
export function markTodayGenerated(now = Date.now(), meta = {}) { setState({ lastDate: dayStr(now), at: now, ...meta }); }

// 오늘 편성이 아직 없으면 자동 생성. deps: { createDraft }.
//   반환: { ran, result } · ran=false 면 이미 오늘 생성됨(중복 방지).
export async function ensureTodayProgram(deps = {}, { published = [], mode = "realtime", now = Date.now() } = {}) {
  if (isTodayGenerated(now)) return { ran: false, reason: "이미 오늘 생성됨" };
  const result = await runDay(deps, { mode, published, now });
  markTodayGenerated(now, { generated: result.generated, approved: result.approved });
  return { ran: true, result };
}

// 검증/디버그용 — 오늘 생성 플래그 리셋(재생성 허용).
export function resetTodayFlag() { setState({}); }
