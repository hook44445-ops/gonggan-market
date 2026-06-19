// 업체 성장 — 연속 활동(Streak)·업적(Achievement)·레벨업 추적 (클라이언트 전용).
//   ⚠️ 보조/표시 전용. DB·API·Migration 미사용(기기 localStorage 만 사용).
//   XP·레벨·공간온도·성실기록 계산 로직과 완전히 분리되어 있으며 그 값을 변경하지 않는다.
//   서버 권위 데이터가 아니라 '꾸준한 성장의 재미'를 보조하기 위한 로컬 기록이다.

const NS = "gonggan.growth";

const pad = (n) => String(n).padStart(2, "0");
// 로컬 자정 기준 날짜 키(YYYY-MM-DD).
function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dayDiff(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / 864e5);
}

function read(cid) {
  if (typeof localStorage === "undefined" || !cid) return {};
  try { return JSON.parse(localStorage.getItem(`${NS}.${cid}`) || "{}") || {}; }
  catch { return {}; }
}
function write(cid, data) {
  if (typeof localStorage === "undefined" || !cid) return;
  try { localStorage.setItem(`${NS}.${cid}`, JSON.stringify(data)); } catch { /* quota/SSR 무시 */ }
}

// 현재 연속 활동 요약 — 하루 이상 비면 0으로 초기화(레벨/XP 와 무관).
function summarize(data) {
  const today = todayKey();
  const last = data.lastActiveDate || null;
  let current = data.streak || 0;
  if (!last || dayDiff(last, today) > 1) current = 0;
  return { current, longest: data.longest || 0, lastActiveDate: last, activeToday: last === today };
}

// 오늘 '의미 있는 활동'(견적·현장기록·계약·완료·A/S 등) 1회 이상 수행 → 연속 활동 갱신.
//   단순 로그인은 호출하지 않는다.
export function recordCompanyActivity(cid) {
  if (!cid) return summarize({});
  const data = read(cid);
  const today = todayKey();
  if (data.lastActiveDate === today) return summarize(data); // 오늘 이미 기록됨
  const last = data.lastActiveDate;
  let streak = data.streak || 0;
  streak = last && dayDiff(last, today) === 1 ? streak + 1 : 1; // 어제→연속, 아니면 재시작
  data.lastActiveDate = today;
  data.streak = streak;
  data.longest = Math.max(data.longest || 0, streak);
  if (!data.firstActiveDate) data.firstActiveDate = today;
  write(cid, data);
  return summarize(data);
}

export function getStreak(cid) {
  return summarize(read(cid));
}

// ── 업적: 이미 사용자에게 알린 id 집합 ──────────────────────────────
export function getSeenAchievements(cid) {
  return new Set(read(cid).seenAchievements || []);
}
export function markAchievementsSeen(cid, ids) {
  if (!cid || !ids || !ids.length) return;
  const data = read(cid);
  const set = new Set(data.seenAchievements || []);
  ids.forEach((id) => set.add(id));
  data.seenAchievements = [...set];
  write(cid, data);
}

// ── 레벨업 감지: 마지막으로 사용자에게 보여준 레벨 ───────────────────
export function getLastSeenLevel(cid) {
  const v = read(cid).lastSeenLevel;
  return typeof v === "number" ? v : null;
}
export function setLastSeenLevel(cid, lvl) {
  if (!cid) return;
  const data = read(cid);
  data.lastSeenLevel = lvl;
  write(cid, data);
}
