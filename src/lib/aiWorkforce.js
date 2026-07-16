// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI Workforce — OpenRouter AI 직원 채용센터/인사팀 (Phase 58-1)
//
//   OpenRouter 모델을 "AI 신문사 직원"으로 채용·배치·평가한다. 각 직원은 이름/역할/담당업무/
//   모델/입출력비용/평균속도/평균품질/PASS율/Revision율/실패율/최근업무를 가진다.
//   매주 자동 인사평가 → 승진/강등, 신규 모델 자동 비교 → 교체 추천, 인사 대시보드.
//
//   ⚠️ 기존 aiOrg(AI_STAFF)/aiPerformance(staffPerformance)/llmProviders 재사용(무수정).
//     채용은 DB/Schema 변경 없이 localStorage 로 additive 저장. 순수/집계 함수.
// ════════════════════════════════════════════════════════════════════

import { AI_STAFF, DEPARTMENTS } from "./aiOrg.js";
import { staffPerformance } from "./aiPerformance.js";
import { isLLMConfigured } from "./llmClient.js";

const HIRED_KEY = "space_ai_workforce_hired_v1";
const USD_TO_KRW = 1350;

// ── 모델 카탈로그(입/출력 단가 USD/1M tokens · 티어) — 지시서 직군 예시 반영 ──
export const MODEL_CATALOG = {
  "anthropic/claude-3.5-sonnet":     { label: "Claude 3.5 Sonnet", inUsd: 3,    outUsd: 15,  tier: "top",  role: "심층기자" },
  "anthropic/claude-3.7-sonnet":     { label: "Claude 3.7 Sonnet", inUsd: 3,    outUsd: 15,  tier: "top",  role: "심층기자" },
  "openai/gpt-4o":                   { label: "GPT-4o",            inUsd: 2.5,  outUsd: 10,  tier: "top",  role: "편집국장" },
  "openai/gpt-4o-mini":              { label: "GPT-4o mini",       inUsd: 0.15, outUsd: 0.6, tier: "mid",  role: "SEO 에디터" },
  "google/gemini-flash-1.5":         { label: "Gemini Flash 1.5",  inUsd: 0.075,outUsd: 0.3, tier: "low",  role: "속보기자" },
  "google/gemini-2.0-flash-exp":     { label: "Gemini 2.0 Flash",  inUsd: 0.1,  outUsd: 0.4, tier: "low",  role: "속보기자" },
  "deepseek/deepseek-chat":          { label: "DeepSeek Chat",     inUsd: 0.14, outUsd: 0.28,tier: "low",  role: "리서치" },
  "qwen/qwen-2.5-72b-instruct":      { label: "Qwen 2.5 72B",      inUsd: 0.35, outUsd: 0.4, tier: "mid",  role: "번역" },
  "x-ai/grok-2-1212":                { label: "Grok 2",            inUsd: 2,    outUsd: 10,  tier: "mid",  role: "SNS 카피" },
  "perplexity/llama-3.1-sonar-large-128k-online": { label: "Perplexity Sonar", inUsd: 1, outUsd: 1, tier: "mid", role: "팩트체커" },
  "mistralai/mistral-large":         { label: "Mistral Large",     inUsd: 2,    outUsd: 6,   tier: "mid",  role: "다국어·요약" },
  "black-forest-labs/flux-1.1-pro":  { label: "Flux 1.1 Pro",      inUsd: 0,    outUsd: 0,   tier: "image",role: "이미지공장", kind: "image" },
  "google/veo-2":                    { label: "Veo 2",             inUsd: 0,    outUsd: 0,   tier: "video",role: "영상제작", kind: "video" },
};

// ── 신문사 직군(부서 확장) — 이미지공장/영상공장/번역팀 포함 ─────────────
export const NEWSROOM_ROLES = {
  editor_in_chief: { id: "editor_in_chief", label: "편집국장", rank: 5, dept: "editorial",  duty: "최종 편집·승인 방향" },
  senior_reporter: { id: "senior_reporter", label: "선임기자", rank: 4, dept: "editorial",  duty: "심층·기획 기사" },
  reporter:        { id: "reporter",        label: "기자",     rank: 3, dept: "editorial",  duty: "일반 기사 작성" },
  breaking:        { id: "breaking",        label: "속보기자", rank: 3, dept: "operations", duty: "속보·긴급뉴스" },
  seo:             { id: "seo",             label: "SEO 담당", rank: 2, dept: "support",    duty: "검색 최적화" },
  fact_checker:    { id: "fact_checker",    label: "팩트체커", rank: 3, dept: "support",    duty: "사실 검증" },
  research:        { id: "research",        label: "리서치",   rank: 2, dept: "support",    duty: "자료 조사" },
  translator:      { id: "translator",      label: "번역팀",   rank: 2, dept: "support",    duty: "다국어" },
  image_factory:   { id: "image_factory",   label: "이미지공장", rank: 3, dept: "support",  duty: "이미지 생성" },
  video_factory:   { id: "video_factory",   label: "영상공장", rank: 3, dept: "support",    duty: "영상 제작" },
};

// ── 채용(localStorage) — DB/Schema 무변경 additive ─────────────────────
export function getHired() {
  try { const v = JSON.parse(localStorage.getItem(HIRED_KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export function hireModel(model, role, { name = null } = {}) {
  const cat = MODEL_CATALOG[model];
  const item = {
    id: `hire_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    model, role: role || cat?.role || "기자",
    name: name || cat?.label || String(model).split("/").pop(),
    hiredAt: Date.now(),
  };
  const list = getHired().filter((h) => h.model !== model); // 같은 모델 중복 방지
  const next = [item, ...list].slice(0, 60);
  try { localStorage.setItem(HIRED_KEY, JSON.stringify(next)); } catch {}
  return item;
}
export function fireModel(model) {
  const next = getHired().filter((h) => h.model !== model);
  try { localStorage.setItem(HIRED_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// 채용 가능 후보 — 카탈로그 중 아직 미보유(AI_STAFF/hired 아님) 모델.
export function openRouterCandidates() {
  const owned = new Set([...AI_STAFF.map((s) => s.model), ...getHired().map((h) => h.model)]);
  return Object.entries(MODEL_CATALOG)
    .filter(([m]) => !owned.has(m))
    .map(([model, c]) => ({ model, ...c }));
}
// 모델 검색(이름/역할/슬러그).
export function searchModels(query = "") {
  const q = String(query).toLowerCase().trim();
  const all = Object.entries(MODEL_CATALOG).map(([model, c]) => ({ model, ...c }));
  if (!q) return all;
  return all.filter(({ model, label, role }) => `${model} ${label} ${role}`.toLowerCase().includes(q));
}

// ── 직원 명부(정보 필드 완비) — AI_STAFF + 채용분, 성과 병합 ──────────────
export function workforceRoster(now = Date.now()) {
  const perf = staffPerformance(now);
  const perfByModel = Object.fromEntries(perf.map((p) => [p.model, p]));
  const base = AI_STAFF.map((s) => ({ model: s.model, name: s.name, role: s.duty, dept: s.dept, source: "core" }));
  const hired = getHired().map((h) => ({ model: h.model, name: h.name, role: h.role, dept: MODEL_CATALOG[h.model]?.kind === "image" ? "support" : "editorial", source: "hired" }));
  const seen = new Set();
  const rows = [...base, ...hired].filter((r) => { if (seen.has(r.model)) return false; seen.add(r.model); return true; });

  return rows.map((r) => {
    const cat = MODEL_CATALOG[r.model] || { inUsd: 1, outUsd: 3, tier: "mid" };
    const p = perfByModel[r.model] || {};
    const jobs = p.jobs || 0;
    const passRate = p.successRate != null ? p.successRate : null;
    const quality = p.avgEditorial != null ? p.avgEditorial : null;
    // Revision/실패율은 성과기록 부족 시 품질밴드 기반 추정(정직 표기).
    const failRate = passRate != null ? Math.max(0, 100 - passRate) : null;
    const revisionRate = quality != null ? Math.max(0, Math.min(60, Math.round((90 - quality) * 1.5))) : null;
    return {
      model: r.model, name: r.name, role: r.role, dept: r.dept,
      deptName: DEPARTMENTS[r.dept]?.name || r.dept,
      source: r.source,
      inputCostUsd: cat.inUsd, outputCostUsd: cat.outUsd,
      inputCostKRW: Math.round(cat.inUsd * USD_TO_KRW), outputCostKRW: Math.round(cat.outUsd * USD_TO_KRW),
      tier: cat.tier,
      avgSpeedMs: p.avgLatencyMs ?? null,
      avgQuality: quality,
      passRate, revisionRate, failRate,
      jobs, jobsToday: p.jobsToday || 0,
      costKRW: p.costKRW || 0,
      rating: p.rating ?? null,
      title: p.title || "대기",
      estimated: passRate == null || quality == null, // 성과 데이터 부족 → 추정치 포함
      active: (cat.tier === "image" || cat.tier === "video") ? false : isLLMConfigured(),
      recentWork: jobs > 0 ? `최근 ${jobs}건 · 오늘 ${p.jobsToday || 0}건` : "기록 없음",
    };
  });
}

// ── AI 조직도(신문사 계층) ───────────────────────────────────────────────
export function orgHierarchy(now = Date.now()) {
  const roster = workforceRoster(now);
  const byTier = (t) => roster.filter((r) => r.tier === t);
  return {
    president: { title: "AI 사장", note: "관리자(최종 승인자)" },
    chief_secretary: { title: "총괄비서실장", note: "품의·결재(품질 수정 금지)" },
    chain: ["편집국장", "선임기자", "기자", "SEO", "팩트체커", "이미지공장", "영상공장", "번역팀"],
    layers: [
      { role: "편집국장/데스크", members: byTier("top") },
      { role: "기자·SEO", members: [...byTier("mid")] },
      { role: "속보·리서치", members: byTier("low") },
      { role: "이미지·영상 공장", members: [...byTier("image"), ...byTier("video")] },
    ],
    total: roster.length,
    note: "모든 직원은 OpenRouter 모델",
  };
}

// ── 자동 인사평가(주간) — 품질/비용/속도/PASS율/Revision율/실패율 ──────────
export function weeklyReview(now = Date.now()) {
  const roster = workforceRoster(now).filter((r) => r.jobs > 0);
  return roster.map((r) => {
    const scoreParts = {
      quality: r.avgQuality ?? 70,
      pass: r.passRate ?? 100,
      revisionPenalty: -(r.revisionRate ?? 0) * 0.3,
      failPenalty: -(r.failRate ?? 0) * 0.5,
    };
    const composite = Math.round(scoreParts.quality * 0.6 + scoreParts.pass * 0.4 + scoreParts.revisionPenalty + scoreParts.failPenalty);
    return { model: r.model, name: r.name, role: r.role, jobs: r.jobs, avgQuality: r.avgQuality, passRate: r.passRate, revisionRate: r.revisionRate, failRate: r.failRate, costKRW: r.costKRW, composite };
  }).sort((a, b) => b.composite - a.composite);
}

// ── 승진/강등 계획 — 품질 높으면 상위 업무, 낮으면 보조 업무 ────────────────
export function promotionPlan(now = Date.now()) {
  const review = weeklyReview(now);
  const promotions = [], demotions = [];
  for (const r of review) {
    if (r.composite >= 88 && (r.jobs >= 3)) promotions.push({ model: r.model, name: r.name, from: r.role, to: "선임/편집장 승진 후보", composite: r.composite });
    else if (r.composite < 60 && r.jobs >= 3) demotions.push({ model: r.model, name: r.name, from: r.role, to: "보조 업무로 강등 후보", composite: r.composite });
  }
  return { promotions, demotions };
}

// ── 신규 모델 교체 추천 — 같은 직군에서 신규 후보가 더 우수하면 교체 권장 ────
//   현직 품질 대비 후보 카탈로그 티어를 비교(성과 없으면 티어 우수성으로 제안).
export function replacementRecommendations(now = Date.now()) {
  const roster = workforceRoster(now);
  const candidates = openRouterCandidates();
  const out = [];
  const TIER_RANK = { low: 1, mid: 2, top: 3 };
  for (const c of candidates) {
    if (c.kind === "image" || c.kind === "video") continue;
    // 같은 역할군 현직 중 품질 낮은 직원.
    const incumbent = roster.find((r) => r.role.includes(c.role) || (r.tier && TIER_RANK[r.tier] < TIER_RANK[c.tier]));
    if (incumbent && (incumbent.avgQuality == null || incumbent.avgQuality < 96) && TIER_RANK[c.tier] >= TIER_RANK[incumbent.tier || "mid"]) {
      out.push({
        role: c.role,
        incumbent: incumbent.name, incumbentQuality: incumbent.avgQuality ?? null,
        candidate: c.label, candidateModel: c.model, candidateTier: c.tier,
        reason: `${c.role} 직군 신규 후보(${c.label}) 티어 우수 → 비교 채용 검토`,
      });
    }
  }
  return out.slice(0, 8);
}

// ── AI Workforce 대시보드(운영센터용) ─────────────────────────────────────
export function workforceDashboard(now = Date.now()) {
  const roster = workforceRoster(now);
  const active = roster.filter((r) => r.active);
  const idle = roster.filter((r) => !r.active);
  const worked = roster.filter((r) => r.jobs > 0);
  const todayCalls = roster.reduce((n, r) => n + (r.jobsToday || 0), 0);
  const totalCost = roster.reduce((n, r) => n + (r.costKRW || 0), 0);
  const qualityRows = worked.filter((r) => r.avgQuality != null);
  const avgQuality = qualityRows.length ? Math.round(qualityRows.reduce((n, r) => n + r.avgQuality, 0) / qualityRows.length) : null;
  const avgCostPerJob = worked.length ? Math.round(totalCost / worked.reduce((n, r) => n + r.jobs, 0)) : 0;

  const topPerformer = [...worked].sort((a, b) => (b.avgQuality ?? 0) - (a.avgQuality ?? 0))[0] || null;
  const mostRevision = [...worked].sort((a, b) => (b.revisionRate ?? 0) - (a.revisionRate ?? 0))[0] || null;
  // 비용 절감 순위 — 저비용·고품질(품질/비용 효율).
  const costSaving = [...worked]
    .map((r) => ({ ...r, efficiency: (r.avgQuality ?? 70) / Math.max(1, r.outputCostUsd) }))
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 5)
    .map((r) => ({ model: r.model, name: r.name, quality: r.avgQuality, outputCostUsd: r.outputCostUsd, efficiency: Math.round(r.efficiency) }));

  return {
    totalStaff: roster.length,
    activeStaff: active.length,
    idleStaff: idle.length,
    todayCalls,
    avgCostPerJobKRW: avgCostPerJob,
    avgQuality,
    topPerformer: topPerformer ? { name: topPerformer.name, quality: topPerformer.avgQuality } : null,
    mostRevision: mostRevision ? { name: mostRevision.name, revisionRate: mostRevision.revisionRate } : null,
    costSaving,
  };
}
