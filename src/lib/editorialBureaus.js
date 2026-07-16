// ════════════════════════════════════════════════════════════════════
// 공간라운지 Editorial Bureaus — 카테고리별 독립 편집국 + KPI + 주간성장 (Phase 58 §1·§6·§7)
//
//   각 카테고리(공간매거진/경제/AI/IT/생활/건강/신앙/뉴스브리핑)를 독립 편집국처럼 운영한다.
//   모든 편집국은 동일한 Workflow(기자→에디터→팩트체커→SEO→편집국장→발행)를 사용한다.
//   편집국별 KPI(PASS율/REVISION율/평균품질/평균비용/평균생성시간/발행수/예약수/조회수/CTR/SEO)와
//   주간 자동 성장(품질 유지 시 발행량 2배)을 계산한다.
//
//   ⚠️ 기존 Workflow Engine 무수정 · Additive. buildWorkflowQueue/workflowKpis 재사용.
//     성장 목표량은 localStorage 저장(DB/Schema 무변경). 순수/집계 함수.
// ════════════════════════════════════════════════════════════════════

import { buildWorkflowQueue, WORKFLOW_STATES, workflowAnalytics } from "./workflowEngine.js";
import { editorialDateKST } from "./editorialKey.js";

const GROWTH_KEY = "space_bureau_growth_v1";

// ── 편집국 정의 — 카테고리별. classify: 제목/주제 키워드 매칭 ─────────────
export const BUREAUS = [
  { id: "space",   label: "공간매거진 편집국", icon: "🏠", match: /인테리어|리모델|시공|공간|집수리|욕실|주방|거실|가구|자재/ },
  { id: "economy", label: "경제 편집국",       icon: "📈", match: /경제|금리|물가|증시|주식|투자|부동산|환율|매출|창업/ },
  { id: "ai",      label: "AI 편집국",         icon: "🤖", match: /\bai\b|인공지능|챗gpt|gpt|생성형|로봇|머신러닝/i },
  { id: "it",      label: "IT 편집국",         icon: "💻", match: /소프트웨어|개발|프로그래밍|클라우드|앱|스마트폰|반도체|it\b/i },
  { id: "life",    label: "생활 편집국",       icon: "🧺", match: /생활|살림|청소|정리|수납|절약|육아|반려/ },
  { id: "health",  label: "건강 편집국",       icon: "🩺", match: /건강|수면|운동|영양|다이어트|질환|의료|스트레스/ },
  { id: "faith",   label: "신앙 편집국",       icon: "🙏", match: /큐티|묵상|말씀|기도|신앙|교회|성경|점성|운세/ },
  { id: "news",    label: "뉴스브리핑 편집국", icon: "📰", match: /뉴스|속보|사설|헤드라인|브리핑|발표|정책|긴급/ },
  { id: "general", label: "종합 편집국",       icon: "🗞️", match: /.*/ },
];

// 각 편집국의 워크플로우(모든 편집국 동일).
export const BUREAU_WORKFLOW = ["AI 기자", "담당 에디터", "팩트체커", "SEO", "AI 편집국장", "발행"];

// 레코드 → 편집국 id(첫 매칭, 없으면 general).
export function bureauOf(record = {}) {
  const t = `${record.title ?? ""} ${record.ai_topic ?? ""} ${record.category ?? ""}`;
  for (const b of BUREAUS) { if (b.id === "general") continue; if (b.match.test(t)) return b.id; }
  return "general";
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ── 편집국별 KPI(§6) ─────────────────────────────────────────────────────
//   PASS율/REVISION율/평균품질/평균비용/평균생성시간/발행수/예약수/조회수/CTR/SEO점수
export function bureauKpis(records = [], { now = Date.now() } = {}) {
  const groups = {};
  for (const r of records) {
    const bid = bureauOf(r);
    (groups[bid] ||= []).push(r);
  }
  const out = BUREAUS.filter((b) => b.id !== "general" || groups.general?.length).map((b) => {
    const recs = groups[b.id] || [];
    const { items } = buildWorkflowQueue(recs, { now });
    const reviewed = items.filter((it) => it.state !== WORKFLOW_STATES.DRAFT);
    const denom = reviewed.length || 1;
    const passLike = items.filter((it) => [WORKFLOW_STATES.APPROVED, WORKFLOW_STATES.CHIEF_SECRETARY, WORKFLOW_STATES.SCHEDULED, WORKFLOW_STATES.PUBLISHING, WORKFLOW_STATES.PUBLISHED].includes(it.state)).length;
    const revision = items.filter((it) => it.state === WORKFLOW_STATES.REVISION).length;
    const published = items.filter((it) => it.state === WORKFLOW_STATES.PUBLISHED);
    const scheduled = items.filter((it) => [WORKFLOW_STATES.SCHEDULED, WORKFLOW_STATES.PUBLISHING].includes(it.state)).length;
    const scored = items.filter((it) => typeof it.quality === "number");
    const avgQuality = scored.length ? Math.round(scored.reduce((n, it) => n + it.quality, 0) / scored.length) : null;

    // 조회수(발행분 view_count 합), 평균 생성시간(생성→발행 분).
    const views = recs.reduce((n, r) => n + num(r.view_count), 0);
    const likes = recs.reduce((n, r) => n + num(r.like_count), 0);
    let elapsedSum = 0, elapsedN = 0;
    for (const it of published) {
      const c = Date.parse(it.createdAt || 0), p = Date.parse(it.updatedAt || it.createdAt || now);
      if (c && p >= c) { elapsedSum += (p - c) / 60000; elapsedN += 1; }
    }
    // CTR = 좋아요/조회(프록시) · SEO점수 = 품질 기반 프록시(실측 지표 미연결 → 추정).
    const ctr = views > 0 ? Math.round((likes / views) * 1000) / 10 : null; // %
    const seoScore = avgQuality != null ? Math.min(100, avgQuality + 3) : null;

    return {
      id: b.id, label: b.label, icon: b.icon,
      total: recs.length,
      passRate: Math.round((passLike / denom) * 100),
      revisionRate: Math.round((revision / denom) * 100),
      avgQuality,
      avgProcessMin: elapsedN ? Math.round(elapsedSum / elapsedN) : null,
      published: published.length,
      scheduled,
      views, ctr, seoScore,
      estimated: true, // CTR/SEO/비용 일부는 실측 지표 미연결 추정 포함
    };
  });
  return out.sort((a, b) => b.total - a.total);
}

// ── 주간 자동 성장(§7) — 품질 유지 시 발행량 2배(20→40→…→2560) ───────────
export const GROWTH_SEQUENCE = [20, 40, 80, 160, 320, 640, 1280, 2560];
export const GROWTH_GATE = { minPassRate: 85, minAvgQuality: 85, maxFailRate: 5, maxCostKRWPerJob: 400 };

export function getGrowthState() {
  try {
    const v = JSON.parse(localStorage.getItem(GROWTH_KEY) ?? "null");
    if (v && typeof v.weeklyTarget === "number") return v;
  } catch { /* */ }
  return { weeklyTarget: GROWTH_SEQUENCE[0], level: 0, lastReviewedWeek: null, history: [] };
}
export function saveGrowthState(s) { try { localStorage.setItem(GROWTH_KEY, JSON.stringify(s)); } catch {} return s; }

// 성장 게이트 판정 — 주간 성과가 기준을 만족하면 다음 주 발행량 2배.
export function evaluateGrowth(metrics = {}, { now = Date.now(), state = getGrowthState() } = {}) {
  const { passRate = 0, avgQuality = 0, failRate = 100, costPerJobKRW = 9999 } = metrics;
  const g = GROWTH_GATE;
  const checks = {
    pass: passRate >= g.minPassRate,
    quality: avgQuality >= g.minAvgQuality,
    fail: failRate <= g.maxFailRate,
    cost: costPerJobKRW <= g.maxCostKRWPerJob,
  };
  const qualified = Object.values(checks).every(Boolean);
  const level = state.level ?? 0;
  const nextLevel = qualified ? Math.min(GROWTH_SEQUENCE.length - 1, level + 1) : level;
  const nextTarget = GROWTH_SEQUENCE[nextLevel];
  return {
    qualified, checks,
    currentTarget: GROWTH_SEQUENCE[level],
    nextTarget,
    doubled: qualified && nextLevel > level,
    reason: qualified ? `기준 충족 → 발행량 ${GROWTH_SEQUENCE[level]}→${nextTarget}` : "기준 미달 → 발행량 유지(품질 우선)",
    week: editorialDateKST(now),
    nextLevel,
  };
}

// 실측 지표 → 성장 게이트 입력. WorkflowQueue 분석(실제 DB) + AI 비용(주입)에서 파생.
//   passRate/avgQuality/failRate 는 workflowAnalytics(실측), costPerJobKRW 는 aiBudget 등에서 주입.
export function growthMetrics(records = [], { aiCostPerJobKRW = 0, now = Date.now() } = {}) {
  const a = workflowAnalytics(records, { now });
  return {
    passRate: a.passRate,
    avgQuality: a.avgQuality ?? 0,   // 데이터 없으면 0 → 게이트 보수적으로 미달 처리
    failRate: a.failRate,
    costPerJobKRW: Math.round(aiCostPerJobKRW || 0),
    sampleSize: a.total,
  };
}

// 실측 지표로 이번 주 성장 판정·적용(주간 1회).
export function runWeeklyGrowth(records = [], { aiCostPerJobKRW = 0, now = Date.now(), minSample = 5 } = {}) {
  const metrics = growthMetrics(records, { aiCostPerJobKRW, now });
  // 표본이 너무 적으면 성장 보류(과대평가 방지) — 상태는 건드리지 않는다.
  if (metrics.sampleSize < minSample) {
    return { ...evaluateGrowth(metrics, { now }), applied: false, reason: `표본 부족(${metrics.sampleSize}/${minSample}) → 성장 보류`, metrics };
  }
  return { ...applyGrowth(metrics, { now }), metrics };
}

// 성장 적용(주간 1회) — 판정 결과를 상태에 반영·저장.
export function applyGrowth(metrics = {}, { now = Date.now() } = {}) {
  const state = getGrowthState();
  const week = editorialDateKST(now);
  if (state.lastReviewedWeek === week) return { ...evaluateGrowth(metrics, { now, state }), applied: false, reason: "이번 주 이미 평가됨" };
  const decision = evaluateGrowth(metrics, { now, state });
  const next = {
    weeklyTarget: decision.nextTarget,
    level: decision.nextLevel,
    lastReviewedWeek: week,
    history: [{ week, qualified: decision.qualified, target: decision.nextTarget }, ...(state.history || [])].slice(0, 12),
  };
  saveGrowthState(next);
  return { ...decision, applied: true };
}
