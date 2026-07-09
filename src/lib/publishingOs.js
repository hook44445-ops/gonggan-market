// ════════════════════════════════════════════════════════════════════
// 공간라운지 Publishing OS — 운영 파이프라인 (Phase 6)
//
//   Phase 1~5 의 엔진(콘텐츠 공장·편집국·Space Graph·Community·Space Media)을 하나의
//   운영 파이프라인으로 연결한다. AI 가 기획 → 생성 → 검수 → 연결 → 발행 → 분석 →
//   재기획까지 관리하는 Publishing OS. 이 파일은 화면을 그리지 않고, 관리자 화면이
//   운영 상태를 볼 수 있도록 데이터를 조립하는 순수 함수다(UI 분리 · PC 재사용).
//
//   결정론적 · 저장/Migration 없음 · 기존 lounge_posts 데이터로만 계산(Regression Zero).
//   기존 엔진을 재사용만 한다 — 새 판단 로직을 만들지 않는다.
// ════════════════════════════════════════════════════════════════════

import { scoreContent } from "./contentScore.js";
import { scoreTopic, priorityFromScore } from "./topicScore.js";
import { relatedArticles, todaysSpace, editorsPick } from "./spaceGraph.js";
import { communityScore, todaysLivingSpace, rankByCommunity } from "./communityScore.js";
import { communityTemperature } from "./communityTemperature.js";
import { reinterpretThroughSpace } from "../constants/spacePhilosophy.js";
import { clusterOfCategory } from "../constants/knowledgeMap.js";
import { CATEGORY_LABEL, LOUNGE_CATEGORIES } from "../constants/lounge.js";

const isToday = (ts, now = Date.now()) => {
  if (!ts) return false;
  const d = new Date(ts); const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
const label = (id) => CATEGORY_LABEL[id] || id;

// ── 1. Publishing Pipeline ──────────────────────────────────────────
// 전체 파이프라인 단계 + 각 단계의 현재 수치/상태. 관리자 화면이 흐름을 그대로 시각화한다.
//   반환: [{ id, label, stage, count, note }]
export function pipelineStages({ issues = [], drafts = [], published = [], todaysPicks = [] } = {}) {
  const scheduled = drafts.filter((d) => d.publish_status === "scheduled");
  const draftOnly = drafts.filter((d) => d.publish_status === "draft");
  const evergreen = published.filter((p) => communityScore(p).evergreen);
  return [
    { id: "issues",    label: "오늘의 이슈",        count: issues.length,       note: "도메인 시드 + 트렌드" },
    { id: "editor",    label: "AI Editor 편집회의",  count: todaysPicks.length,  note: "가치·공간 심의 후 제작 선정" },
    { id: "quality",   label: "품질평가",           count: draftOnly.length,    note: "7축 자기평가(90점 게이트)" },
    { id: "rewrite",   label: "재작성 루프",        count: draftOnly.filter((d) => scoreContent({ title: d.title, content: d.content, category: d.category }).needsRewrite).length, note: "90점 미만 재작성 권장" },
    { id: "graph",     label: "Space Graph 연결",   count: published.length,    note: "관련 글 자동 연결" },
    { id: "community", label: "Community Score 예상", count: draftOnly.length,   note: "발행 후 반응 예측" },
    { id: "queue",     label: "Draft Queue",        count: drafts.length,       note: "검수 대기 초안" },
    { id: "schedule",  label: "예약발행",           count: scheduled.length,    note: "예약 슬롯" },
    { id: "magazine",  label: "Magazine 편성",      count: published.length,    note: "매거진 섹션 구성" },
    { id: "archive",   label: "Archive 등록",       count: published.length,    note: "시간/카테고리/태그" },
    { id: "search",    label: "Search Index",       count: published.length,    note: "지식 검색 색인" },
    { id: "encyclopedia", label: "Encyclopedia 연결", count: evergreen.length,  note: "백과사전형 상시 연결" },
  ];
}

// ── 2. Draft Queue ──────────────────────────────────────────────────
// 초안 목록을 "운영 관점"으로 본다. 각 초안에 품질/공간관련성/우선순위/관련글수/추천여부를 붙인다.
//   drafts: publish_status draft|scheduled 목록 · published: 관련글 계산용 코퍼스
export function buildDraftQueue(drafts = [], published = []) {
  return drafts
    .filter((d) => d && d.title)
    .map((d) => {
      const q = scoreContent({ title: d.title, content: d.content, category: d.category });
      const topic = d.ai_topic || d.title;
      const ts = scoreTopic({ topic, region: d.region ?? null, collectedAt: d.created_at });
      const related = relatedArticles({ id: d.id, title: d.title, ai_topic: d.ai_topic, category: d.category, tags: d.tags }, published, 5, 8);
      const reinterpret = reinterpretThroughSpace(topic);
      return {
        id: d.id,
        title: d.title,
        category: d.category,
        categoryLabel: label(d.category),
        status: d.publish_status || "draft",
        qualityScore: q.total,
        needsRewrite: q.needsRewrite,
        spaceRelevance: q.axes.spaceRelevance,
        spaceKeyword: reinterpret.spaceKeyword,
        priority: priorityFromScore(ts.total),
        priorityScore: ts.total,
        scheduledAt: d.scheduled_at ?? null,
        relatedCount: related.length,
        recommended: q.total >= 90 && related.length > 0 && !q.needsRewrite,
      };
    })
    .sort((a, b) => (b.recommended - a.recommended) || (b.priorityScore - a.priorityScore) || (b.qualityScore - a.qualityScore));
}

// ── 3. Today's Dashboard ────────────────────────────────────────────
// 관리자가 오늘의 운영 상태를 한눈에. 발행글/초안 기준으로 오늘의 지표를 모은다.
export function todaysDashboard({ published = [], drafts = [], now = Date.now() } = {}) {
  const createdToday = published.filter((p) => isToday(p.created_at, now));
  const scheduledToday = drafts.filter((d) => d.publish_status === "scheduled" && isToday(d.scheduled_at, now));
  const popularToday = rankByCommunity(published.filter((p) => isToday(p.created_at, now)), "engagement", 5, now);
  const commentedToday = [...published].sort((a, b) => (b.comment_count ?? 0) - (a.comment_count ?? 0)).slice(0, 5).filter((p) => (p.comment_count ?? 0) > 0);
  const saveCandidates = published.map((p) => ({ ...p, _c: communityScore(p, now) })).filter((p) => p._c.saves >= 5 || p._c.evergreen).slice(0, 5);
  const living = todaysLivingSpace(published, { n: 5, now });
  const pick = editorsPick(published);
  const temp = communityTemperature(published, now);

  // 부족한 카테고리 — 실제 라운지 카테고리 중 발행글 수가 가장 적은 순(콘텐츠 보강 필요).
  const counts = new Map();
  for (const p of published) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  const contentCats = LOUNGE_CATEGORIES.filter((c) => !["all", "popular"].includes(c.id));
  const weakCategories = contentCats
    .map((c) => ({ category: c.id, label: c.label, count: counts.get(c.id) ?? 0 }))
    .sort((a, b) => a.count - b.count).slice(0, 6);

  // 추천 발행 슬롯 — 부족 카테고리 + 상승 카테고리를 합쳐 "오늘 무엇을 발행하면 좋은지" 제안.
  const recommendedSlots = [
    ...temp.risingTopics.slice(0, 3).map((c) => ({ category: c.category, label: c.label, reason: "반응 상승 — 관련 글 추가" })),
    ...weakCategories.filter((c) => c.count === 0).slice(0, 3).map((c) => ({ category: c.category, label: c.label, reason: "콘텐츠 없음 — 첫 글 필요" })),
  ];

  return {
    createdToday: createdToday.length,
    scheduledToday: scheduledToday.length,
    popularToday,
    commentedToday,
    saveCandidates,
    todaysSpace: living,
    editorsPick: pick,
    weakCategories,
    recommendedSlots,
    temperature: temp.temperature,
  };
}

// ── 4. Publishing Calendar ──────────────────────────────────────────
// 주간/월간 예약 발행 캘린더. 예약된 초안을 날짜별로 묶고, 과밀/부족을 경고한다.
//   반환: { days:[{ date, weekday, items:[{id,title,category}], count, overloaded }], emptyDates:[date], overloadedDates:[date] }
export function publishingCalendar(drafts = [], { days = 14, now = Date.now(), maxPerDay = 3 } = {}) {
  const scheduled = drafts.filter((d) => d.publish_status === "scheduled" && d.scheduled_at);
  const byDate = new Map();
  for (const d of scheduled) {
    const key = new Date(d.scheduled_at).toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push({ id: d.id, title: d.title, category: d.category, categoryLabel: label(d.category) });
  }
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const out = [];
  const emptyDates = [];
  const overloadedDates = [];
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 864e5);
    const key = d.toISOString().slice(0, 10);
    const items = byDate.get(key) ?? [];
    const overloaded = items.length > maxPerDay;
    if (items.length === 0) emptyDates.push(key);
    if (overloaded) overloadedDates.push(key);
    out.push({ date: key, weekday: WD[d.getDay()], items, count: items.length, overloaded });
  }
  // 카테고리 분포(예약분 전체).
  const catDist = new Map();
  for (const d of scheduled) catDist.set(d.category, (catDist.get(d.category) ?? 0) + 1);
  const categoryDistribution = Array.from(catDist.entries())
    .map(([category, count]) => ({ category, label: label(category), count }))
    .sort((a, b) => b.count - a.count);

  return { days: out, emptyDates, overloadedDates, categoryDistribution, totalScheduled: scheduled.length };
}
