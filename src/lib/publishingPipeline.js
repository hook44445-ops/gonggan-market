// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI Publishing Pipeline — 콘텐츠 생산·발행 파이프라인 (Phase 13)
//
//   생성 엔진은 수정하지 않는다. 생성된 초안을 실제 운영 가능한 콘텐츠로 관리·발행하는
//   흐름(AI 생성 → 검토 → 승인 → 발행 → 추천)을 조립하는 helper 다.
//
//   ⚠️ Regression Zero 설계:
//     · DB Migration/API/Cron 없음. 실제 발행/예약은 기존 supabase 함수(adminUpdateLoungeDraft)와
//       기존 publish-scheduled 크론을 그대로 재사용한다.
//     · DB 는 publish_status(draft/scheduled/published) 만 안다. 그래서 추가 운영 상태
//       (Review/Approved)는 localStorage 파이프라인 스토어에 얹는다(Phase 11 워크벤치와 동일 패턴).
//     · 인기/추천/Today's Pick/통계는 기존 엔진(communityScore/spaceGraph/readingExperience)을
//       "호출만" 해서 계산한다(엔진 무수정).
// ════════════════════════════════════════════════════════════════════

import { communityScore, rankByCommunity } from "./communityScore.js";
import { editorsPick, todaysSpace } from "./spaceGraph.js";
import { readingTime } from "./readingExperience.js";
import { getWorkbenchRecords } from "./editorWorkbench.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";

const label = (id) => CATEGORY_LABEL[id] || id;
const norm = (s) => String(s ?? "").trim().toLowerCase();

// ── 파이프라인 스테이지 스토어 (localStorage · DB 아님) ─────────────
// draft(DB) 위에 얹는 운영 하위 상태. { [draftId]: { stage:'review'|'approved', at } }
const STAGE_KEY = "space_publishing_stages_v1";

export function getPipelineStages() {
  try { const v = JSON.parse(localStorage.getItem(STAGE_KEY) ?? "{}"); return v && typeof v === "object" ? v : {}; }
  catch { return {}; }
}
export function setPipelineStage(draftId, stage) {
  if (draftId == null) return getPipelineStages();
  const cur = getPipelineStages();
  if (stage) cur[String(draftId)] = { stage, at: Date.now() };
  else delete cur[String(draftId)];
  try { localStorage.setItem(STAGE_KEY, JSON.stringify(cur)); } catch {}
  return cur;
}
export function clearPipelineStage(draftId) { return setPipelineStage(draftId, null); }

// ── 워크벤치 기록 인덱스(제목 기준) — Confidence/PromptVersion/LLM·Mock 매칭 ──
export function workbenchIndex() {
  const idx = new Map();
  for (const rec of getWorkbenchRecords()) {
    const key = norm(rec?.draft?.title);
    if (key && !idx.has(key)) idx.set(key, rec); // 최신(맨 앞) 우선
  }
  return idx;
}

// ── 1. 초안(Draft) 관리 — 운영 관점 주석 ────────────────────────────
// 스테이지: draft → review → approved → (scheduled) → published
export function annotateDraft(draft, wbIndex = new Map(), stages = {}) {
  const rec = wbIndex.get(norm(draft.title)) || null;
  const dbStatus = draft.publish_status || "draft";
  const localStage = stages[String(draft.id)]?.stage || null;
  const stage = dbStatus === "scheduled" ? "scheduled" : dbStatus === "published" ? "published" : (localStage || "draft");
  return {
    id: draft.id,
    title: draft.title,
    category: draft.category,
    categoryLabel: label(draft.category),
    createdAt: draft.created_at ?? null,
    scheduledAt: draft.scheduled_at ?? null,
    stage,
    promptVersion: rec?.promptVersion ?? null,
    source: rec?.source ?? null,               // 'llm' | 'mock' | null
    confidence: typeof rec?.confidence === "number" ? rec.confidence : null,
    readingMinutes: readingTime(draft.content ?? "", 0).minutes,
  };
}

export const PIPELINE_STAGES = [
  { id: "draft",     label: "Draft",     color: "#6b7280" },
  { id: "review",    label: "Review",    color: "#d97706" },
  { id: "approved",  label: "Approved",  color: "#2563eb" },
  { id: "scheduled", label: "Scheduled", color: "#7c3aed" },
  { id: "published", label: "Published", color: "#059669" },
];

// 초안 보드 — 스테이지별 그룹.
export function buildDraftBoard(drafts = [], wbIndex = new Map(), stages = {}) {
  const rows = drafts.filter((d) => d && d.title).map((d) => annotateDraft(d, wbIndex, stages));
  const board = { draft: [], review: [], approved: [], scheduled: [] };
  for (const r of rows) (board[r.stage] || board.draft).push(r);
  return { rows, board };
}

// ── 4. 발행 히스토리 ────────────────────────────────────────────────
export function publishHistory(published = [], now = Date.now()) {
  return published
    .filter((p) => p && p.title)
    .map((p) => {
      const c = communityScore(p, now);
      return {
        id: p.id, title: p.title, category: p.category, categoryLabel: label(p.category),
        publishedAt: p.created_at ?? null,
        views: p.view_count ?? 0, likes: p.like_count ?? 0, comments: p.comment_count ?? 0,
        saves: c.saves, community: c.communityScore,
      };
    })
    .sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0));
}

// ── 5. 인기 콘텐츠 계산 (기존 엔진 재사용) ──────────────────────────
export function popularContent(published = [], now = Date.now()) {
  const list = published.filter((p) => p && p.title);
  return {
    editorsPick: editorsPick(list),
    rising: todaysSpace(list, 5),
    popular: rankByCommunity(list, "engagement", 6, now),
    recommended: rankByCommunity(list, "community", 6, now),
  };
}

// ── 6. Today's Pick — 매일 대표 콘텐츠 1개 ──────────────────────────
// Quality(communityScore) + Confidence(워크벤치) + 조회 + 저장 종합.
export function todaysPick(published = [], wbIndex = new Map(), now = Date.now()) {
  const list = published.filter((p) => p && p.title);
  if (list.length === 0) return null;
  let best = null;
  for (const p of list) {
    const c = communityScore(p, now);
    const rec = wbIndex.get(norm(p.title));
    const conf = typeof rec?.confidence === "number" ? rec.confidence : 60;
    const score = c.communityScore * 0.5 + conf * 0.2 + Math.min((p.view_count ?? 0) / 20, 20) + c.saves * 2;
    if (!best || score > best.score) best = { post: p, score: Math.round(score), community: c.communityScore, confidence: conf };
  }
  return best;
}

// ── 7. 운영 통계 ────────────────────────────────────────────────────
const isToday = (ts, now) => {
  if (!ts) return false;
  const d = new Date(ts), n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export function opsStats(drafts = [], published = [], wbIndex = new Map(), now = Date.now()) {
  const catMap = new Map();
  for (const p of published) catMap.set(p.category, (catMap.get(p.category) || 0) + 1);
  const byCategory = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, label: label(category), count }))
    .sort((a, b) => b.count - a.count);

  // 평균 Confidence — 워크벤치 기록이 있는 글만 평균.
  let confSum = 0, confN = 0;
  for (const p of [...published, ...drafts]) {
    const rec = wbIndex.get(norm(p.title));
    if (typeof rec?.confidence === "number") { confSum += rec.confidence; confN += 1; }
  }
  // 평균 Reading Time.
  const rtList = published.filter((p) => p.content || p.title);
  const rtAvg = rtList.length
    ? Math.round(rtList.reduce((n, p) => n + readingTime(p.content ?? "", 0).minutes, 0) / rtList.length)
    : 0;

  return {
    draftCount: drafts.filter((d) => (d.publish_status || "draft") !== "published").length,
    publishedCount: published.length,
    todayCreated: [...drafts, ...published].filter((p) => isToday(p.created_at, now)).length,
    todayPublished: published.filter((p) => isToday(p.created_at, now)).length,
    byCategory,
    avgConfidence: confN ? Math.round(confSum / confN) : null,
    avgReadingMinutes: rtAvg,
  };
}
