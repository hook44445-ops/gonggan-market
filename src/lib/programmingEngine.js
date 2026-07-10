// ════════════════════════════════════════════════════════════════════
// 공간마켓 Daily Programming Engine V2 — 기본 편성 시스템 (Phase 34)
//
//   Daily Editorial "목록"을 AI 편성국의 "기본 편성 시스템"으로 승격한다.
//   고정편성(잠금 🔒) + 그룹(Morning/Realtime/Day/Evening) + 편성타입 + 기본시간 +
//   설명 + 주간통계 + 검증 + 커스텀 추가 + 관리자 메모.
//
//   ⚠️ 기존 Daily Editorial 로직 무수정 — contentTypes(CONTENT_TYPES/dailyComposition) 호출만.
//   추가만(커스텀/메모는 localStorage). 삭제/순서변경/OFF 불가(고정편성). Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { CONTENT_TYPES, dailyComposition, contentTypeMeta } from "./contentTypes.js";

const CUSTOM_KEY = "space_programming_custom_v1";
const MEMO_KEY = "space_programming_memo_v1";

// ── 편성 그룹(자동) ─────────────────────────────────────────────────
export const PROGRAM_GROUPS = [
  { id: "morning",  label: "🌅 Morning",  desc: "하루를 여는 고정 콘텐츠",       types: ["qt", "astrology", "morning_brief"] },
  { id: "realtime", label: "🚨 Realtime", desc: "수시 발생 즉시 대응",           types: ["breaking"] },
  { id: "day",      label: "☀️ Day",      desc: "낮 시간대 공간·트렌드",         types: ["space_market", "trend_past", "trend_present", "trend_future"] },
  { id: "evening",  label: "🌙 Evening",  desc: "저녁 재방문 콘텐츠",           types: ["series"] },
];

// ── 편성 타입(Badge → 편성타입 승격) ────────────────────────────────
const PROGRAM_TYPE = {
  morning_brief: "SEO", breaking: "뉴스형", space_market: "공간관점",
  trend_past: "뉴스형", trend_present: "뉴스형", trend_future: "뉴스형",
  qt: "일반", astrology: "일반", series: "일반",
};
export function programType(typeId) {
  if (PROGRAM_TYPE[typeId]) return PROGRAM_TYPE[typeId];
  const m = contentTypeMeta(typeId);
  if (m.seoFirst) return "SEO";
  if (m.news) return "뉴스형";
  if (m.spacePerspective) return "공간관점";
  return "일반";
}
export const PROGRAM_TYPE_COLOR = { "뉴스형": "#0369a1", "공간관점": "#7c3aed", "SEO": "#059669", "일반": "#6b7280" };

// ── 기본 발행 시간(고정) ────────────────────────────────────────────
export const DEFAULT_TIME = {
  qt: "05:00", astrology: "06:00", morning_brief: "07:00",
  breaking: "수시", space_market: "낮", trend_past: "낮", trend_present: "낮", trend_future: "낮", series: "저녁",
};

// ── 기본편성 설명 ───────────────────────────────────────────────────
export const PROGRAM_DESC = {
  qt: "하루를 여는 말씀·묵상 — 공유/저장/검색 노출",
  astrology: "1~12월생 월별 운세 — 쉽고 재미있게, 공유형",
  morning_brief: "11개 신문사설 · 주요신문 헤드라인 · 매-세-지 요약 — 검색노출용 정리",
  breaking: "속보·긴급 이슈 즉시 발행 — 순수 뉴스(공간 관점 미적용)",
  space_market: "인테리어·견적·시공·집수리·고객사례 — 공간 관점 기본 적용",
  series: "연재 스토리 — 다음 화가 기다려지는 재방문 콘텐츠",
  trend_past: "Time Trend · 과거에서 오늘 다시 읽을 인사이트",
  trend_present: "Time Trend · 지금 왜 이 주제를 찾는가",
  trend_future: "Time Trend · 앞으로 무엇이 바뀌는가",
};

// ── 커스텀 콘텐츠(추가만) ────────────────────────────────────────────
export function getCustomPrograms() {
  try { const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export function addCustomProgram({ label, group = "day", time = "낮", type = "일반" } = {}) {
  const item = { id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, label: String(label || "").trim(), group, time, type, locked: false, createdAt: Date.now() };
  if (!item.label) return getCustomPrograms();
  const list = [item, ...getCustomPrograms()].slice(0, 40);
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch {}
  return list;
}
export function removeCustomProgram(id) {
  const list = getCustomPrograms().filter((x) => x.id !== id);
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch {}
  return list;
}
export const CUSTOM_PRESETS = [
  { label: "오늘 경제", group: "day", time: "낮", type: "뉴스형" },
  { label: "오늘 역사", group: "day", time: "낮", type: "일반" },
  { label: "오늘 영어", group: "morning", time: "07:00", type: "SEO" },
];

// ── 관리자 메모 ─────────────────────────────────────────────────────
export function getMemos() { try { return JSON.parse(localStorage.getItem(MEMO_KEY) ?? "{}") || {}; } catch { return {}; } }
export function setMemo(typeId, text) {
  const m = { ...getMemos(), [typeId]: text };
  try { localStorage.setItem(MEMO_KEY, JSON.stringify(m)); } catch {}
  return m;
}

// ── 편성표(그룹별 고정편성 + 커스텀) ────────────────────────────────
export function programmingBoard() {
  const memos = getMemos();
  const customs = getCustomPrograms();
  const groups = PROGRAM_GROUPS.map((g) => {
    const fixed = g.types.filter((t) => CONTENT_TYPES[t]).map((t) => ({
      typeId: t, label: contentTypeMeta(t).label, icon: contentTypeMeta(t).icon,
      time: DEFAULT_TIME[t] || "-", type: programType(t), desc: PROGRAM_DESC[t] || "",
      locked: true, memo: memos[t] || "",
    }));
    const custom = customs.filter((c) => c.group === g.id).map((c) => ({ ...c, typeId: c.id, icon: "➕", desc: "커스텀 편성", memo: memos[c.id] || "" }));
    return { ...g, entries: [...fixed, ...custom] };
  });
  return { groups, fixedCount: Object.keys(PROGRAM_TYPE).length, customCount: customs.length };
}

// ── 오늘 미리보기(기존 dailyComposition 재사용) ─────────────────────
export function todayPreview({ published = [], toggles = {}, now = Date.now() } = {}) {
  return dailyComposition({ published, toggles, now }); // { rows, cap, publishedToday, remaining }
}

// ── 주간 통계(최근 7일 발행 수, 콘텐츠 타입별) ──────────────────────
export function weeklyStats(published = [], now = Date.now()) {
  const weekAgo = now - 7 * 864e5;
  const counts = {};
  for (const p of published) {
    const ts = p.created_at ? new Date(p.created_at).getTime() : 0;
    if (ts < weekAgo) continue;
    const ct = p.content_type || p.contentType;
    if (ct) counts[ct] = (counts[ct] || 0) + 1;
  }
  return Object.keys(CONTENT_TYPES).map((t) => ({ typeId: t, label: contentTypeMeta(t).label, count: counts[t] || 0 }))
    .sort((a, b) => b.count - a.count);
}

// ── 편성 검증(중복/시간충돌/빈슬롯) ────────────────────────────────
export function validateProgram({ published = [], now = Date.now() } = {}) {
  const board = programmingBoard();
  const issues = [];
  // 시간 충돌 — 같은 고정 시각(HH:MM 형식)에 2개 이상.
  const timeMap = {};
  for (const g of board.groups) for (const e of g.entries) {
    if (/^\d{2}:\d{2}$/.test(e.time)) (timeMap[e.time] ||= []).push(e.label);
  }
  for (const [t, arr] of Object.entries(timeMap)) if (arr.length > 1) issues.push({ kind: "time_conflict", level: "mid", message: `${t} 시간 충돌: ${arr.join(", ")}` });
  // 중복 — 커스텀이 고정 콘텐츠 타입과 라벨 중복.
  const fixedLabels = new Set(Object.keys(PROGRAM_TYPE).map((t) => contentTypeMeta(t).label));
  for (const c of getCustomPrograms()) if (fixedLabels.has(c.label)) issues.push({ kind: "duplicate", level: "info", message: `커스텀 "${c.label}" 이 고정편성과 중복` });
  // 빈 슬롯 — 오늘 아직 0건인 고정 타입.
  const comp = todayPreview({ published, now });
  const empty = comp.rows.filter((r) => r.done === 0).map((r) => r.label);
  if (empty.length) issues.push({ kind: "empty_slot", level: "info", message: `오늘 미제작 슬롯 ${empty.length}: ${empty.slice(0, 6).join(", ")}` });
  return { issues, ok: issues.filter((i) => i.level !== "info").length === 0 };
}
