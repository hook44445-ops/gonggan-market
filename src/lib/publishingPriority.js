// ════════════════════════════════════════════════════════════════════
// 공간라운지 Publishing Priority Engine — 발행 우선순위 (Phase 22)
//
//   예약 발행만 하면 안 된다. 긴급 뉴스가 오면 먼저 나가야 한다.
//   Editorial OS 지향점(속도 50 / Evergreen 40 / 연재 10)에 맞춰 하루 발행을 편성한다.
//
//     P1  긴급 뉴스(Breaking)   — 실시간 이슈, 즉시
//     P2  Trending             — 상승 트렌드
//     P3  예약 발행(Scheduled)  — Evergreen 검색 자산
//     ⭐  연재(Story)           — 하루 1개 재방문 콘텐츠
//
//   관리자가 Evergreen:Breaking 비율(5:5 / 7:3 / 8:2 …)을 바꿀 수 있다.
//   긴급 뉴스가 없으면 예약 글만 발행한다.
//
//   ⚠️ Regression Zero: 순수 함수 · 저장은 localStorage · 기존 엔진(TrendDiscovery)은 호출만.
//   실제 발행은 기존 발행 흐름/크론을 재사용한다(여기서는 "무엇을 언제" 편성만).
// ════════════════════════════════════════════════════════════════════

import { discoverTrendingTopics } from "./trendDiscovery.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";

// Evergreen — 시간이 지나도 검색되는 자산 영역.
export const EVERGREEN_HINTS = ["ai", "인공지능", "경제", "공간", "인테리어", "라이프", "창업", "건강", "신앙", "종교", "여행", "책", "역사", "철학", "자기계발"];
// Breaking — 실시간 이슈 신호.
export const BREAKING_HINTS = ["금리", "발표", "정책", "전쟁", "재난", "지진", "선거", "엔비디아", "삼성", "openai", "chatgpt", "claude", "출시", "규제", "급등", "급락", "속보", "긴급"];

const norm = (s) => String(s ?? "").toLowerCase();
const label = (id) => CATEGORY_LABEL[id] || id;
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

export function isBreakingTopic(topic) {
  const t = norm(topic);
  return BREAKING_HINTS.some((k) => t.includes(norm(k)));
}
export function isEvergreenTopic(topic, category) {
  const t = `${norm(topic)} ${norm(label(category))}`;
  return EVERGREEN_HINTS.some((k) => t.includes(norm(k)));
}

// 우선순위 분류 — P1(Breaking)/P2(Trending)/P3(Scheduled).
//   opts: { trendScore, priority('High'|'Medium'|'Low') }  (TrendDiscovery 결과가 있으면 활용)
export function classifyPriority(topic, { trendScore = null, priority = null, category = null } = {}) {
  const breaking = isBreakingTopic(topic) && (trendScore == null || trendScore >= 70 || priority === "High");
  if (breaking) return { level: "P1", label: "긴급", kind: "breaking" };
  if (priority === "High" || (trendScore != null && trendScore >= 75)) return { level: "P2", label: "Trending", kind: "trending" };
  return { level: "P3", label: "예약", kind: "scheduled" };
}

// ── 설정(localStorage) — 비율/일일 한도/연재 여부 ──────────────────
const CFG_KEY = "space_publishing_priority_v1";
export const DEFAULT_PRIORITY_CFG = { evergreen: 5, breaking: 5, dailyTotal: 10, storySlot: true };
export const RATIO_PRESETS = [
  { id: "5:5", evergreen: 5, breaking: 5, label: "5:5 (균형)" },
  { id: "7:3", evergreen: 7, breaking: 3, label: "7:3 (Evergreen 중심)" },
  { id: "8:2", evergreen: 8, breaking: 2, label: "8:2 (검색 자산 중심)" },
];
export function getPriorityConfig() {
  try { return { ...DEFAULT_PRIORITY_CFG, ...(JSON.parse(localStorage.getItem(CFG_KEY) ?? "{}") || {}) }; }
  catch { return { ...DEFAULT_PRIORITY_CFG }; }
}
export function setPriorityConfig(patch) {
  const next = { ...getPriorityConfig(), ...patch };
  try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// ── 오늘의 발행 편성 ────────────────────────────────────────────────
//   drafts: 예약/초안 후보([{id,title,category,ai_topic,publish_status}])
//   config: getPriorityConfig()  ·  storyReady: 연재 다음 화 준비됨 여부
//   반환: { slots:[{slot,level,label,item}], breaking, evergreenPlanned, breakingPlanned, storyPlanned, ratioLabel }
export function buildDailyPlan({ drafts = [], published = [], config = getPriorityConfig(), storyReady = false, now = Date.now() } = {}) {
  const trend = discoverTrendingTopics({ recentPublished: published, limit: 12, seed: 0 });
  const trendByTopic = new Map(trend.map((t) => [norm(t.topic), t]));

  const cand = drafts.filter((d) => d && d.title).map((d) => {
    const t = trendByTopic.get(norm(d.ai_topic || d.title));
    const cls = classifyPriority(d.ai_topic || d.title, { trendScore: t?.trendScore ?? null, priority: t?.priority ?? null, category: d.category });
    return { draft: d, cls, trendScore: t?.trendScore ?? 0, evergreen: isEvergreenTopic(d.ai_topic || d.title, d.category) };
  });

  const breaking = cand.filter((c) => c.cls.kind === "breaking").sort((a, b) => b.trendScore - a.trendScore);
  const trending = cand.filter((c) => c.cls.kind === "trending").sort((a, b) => b.trendScore - a.trendScore);
  const evergreen = cand.filter((c) => c.cls.kind === "scheduled" || c.evergreen).sort((a, b) => b.trendScore - a.trendScore);

  const storyN = config.storySlot && storyReady ? 1 : 0;
  const contentSlots = Math.max(0, config.dailyTotal - storyN);
  // 비율로 목표 분배. 긴급 후보가 부족하면 남는 만큼 Evergreen 으로 채운다.
  const ratioSum = Math.max(1, config.evergreen + config.breaking);
  let breakingTarget = Math.round(contentSlots * (config.breaking / ratioSum));
  let evergreenTarget = contentSlots - breakingTarget;

  const pickedBreaking = [...breaking, ...trending].slice(0, breakingTarget);
  const shortfall = breakingTarget - pickedBreaking.length; // 긴급/트렌딩 부족분
  evergreenTarget += Math.max(0, shortfall);
  // 이미 긴급/트렌딩으로 뽑힌 글은 Evergreen 슬롯에서 제외(중복 방지).
  const pickedIds = new Set(pickedBreaking.map((c) => c.draft.id));
  const pickedEvergreen = evergreen.filter((c) => !pickedIds.has(c.draft.id)).slice(0, evergreenTarget);

  const slots = [];
  if (storyN) slots.push({ level: "Story", label: "⭐ 연재", kind: "story", item: null });
  pickedBreaking.forEach((c) => slots.push({ level: c.cls.level, label: c.cls.label, kind: c.cls.kind, item: annotate(c) }));
  pickedEvergreen.forEach((c) => slots.push({ level: "P3", label: "Evergreen", kind: "evergreen", item: annotate(c) }));

  return {
    slots,
    ratioLabel: `${config.evergreen}:${config.breaking}`,
    breakingPlanned: pickedBreaking.length,
    evergreenPlanned: pickedEvergreen.length,
    storyPlanned: storyN,
    breakingAvailable: breaking.length,
    hasBreaking: breaking.length > 0,
    dailyTotal: config.dailyTotal,
  };
}

function annotate(c) {
  return { id: c.draft.id, title: c.draft.title, category: c.draft.category, categoryLabel: label(c.draft.category), trendScore: c.trendScore, level: c.cls.level };
}

// Editorial OS 목표 믹스(속도50/Evergreen40/연재10) 대비 현재 편성 비율.
export function targetMix() { return { breaking: 50, evergreen: 40, story: 10 }; }
