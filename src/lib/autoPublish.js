// ════════════════════════════════════════════════════════════════════
// 공간라운지 Production Auto Publishing OS — 자동발행 운영 (Phase 17.5)
//
//   90점+ 검증 콘텐츠를 관리자 없이 자동 발행하는 운영 레이어. 게이트 통과분을 3시간 슬롯에
//   "예약"하고(긴급은 즉시 발행), 실제 발행/예약은 기존 supabase 함수 + 기존 예약발행 크론을
//   그대로 재사용한다 — 새 API/Cron/Migration 없음.
//
//   ⚠️ Regression Zero: PublishingOS/Workbench/TrendDiscovery/CommunityEngine 등은 수정하지 않고
//   export 함수만 호출한다. 설정/로그/재시도 상태는 localStorage 에만 저장한다.
//
//   실행(발행/예약/롤백)은 executor 를 주입받아 수행한다(관리자 화면이 supabase 함수를 주입).
// ════════════════════════════════════════════════════════════════════

import { evaluateGate } from "./autoPublishGate.js";
import { discoverTrendingTopics } from "./trendDiscovery.js";
import { usageStats } from "./usageDashboard.js";
import { logActivity } from "./activityLog.js";

// ── 설정 / 로그 / 재시도 스토어 (localStorage · DB 아님) ─────────────
const CFG_KEY = "space_auto_publish_cfg_v1";
const LOG_KEY = "space_auto_publish_log_v1";
const RETRY_KEY = "space_auto_publish_retry_v1";

// Phase 24 — 자동발행 조건/예산 전체(관리자 설정). 기존 4키(enabled/intervalHours/dailyLimit/
//   emergencyTrendMin)는 그대로 유지 + 게이트 임계치·검사토글·재시도·예산 추가. 전부 localStorage.
export const DEFAULT_CFG = {
  enabled: false,          // 자동발행 ON/OFF (기본 OFF · 반드시 관리자가 켜야 함)
  testMode: false,         // 테스트모드 (기본 OFF) — ON 시 Q70/경고, Draft 테스트발행
  intervalHours: 3,        // 예약 슬롯 간격
  dailyLimit: 11,          // 하루 최대 발행수(상한선)
  minEditorialScore: 90,   // 최소 품질(Editorial/유용성)
  minConfidence: 90,       // 최소 Confidence
  minBodyLength: 700,      // 본문 최소 길이
  minReadMinutes: 0,       // 최소 읽기 시간(0=미적용)
  dupHours: 48,            // 중복 차단 시간(48/24/12/0=OFF)
  humanizationCheck: true, // Humanization 검사
  seoCheck: true,          // SEO 검사
  reviewRequired: true,    // Review 필수
  approvedRequired: false, // Approved 필수
  maxRetry: 3,             // 최대 Retry
  emergencyInstant: true,  // 긴급 즉시발행
  emergencyTrendMin: 95,   // 긴급 판정 TrendScore
  budgetTodayKRW: 0,       // 오늘 최대 비용(0=무제한)
  budgetMonthKRW: 0,       // 이번달 최대 비용(0=무제한)
  // Phase 24 — 콘텐츠 타입 편성 토글(기본 ON). 하루 편성에서 제외하려면 false.
  typeMorningBrief: true,
  typeQt: true,
  typeAstrology: true,
  typeSeries: true,
  typeSpaceMarket: true,
  typeTimeTrend: true,
};

// 콘텐츠 타입 토글 → contentTypes.dailyComposition 이 쓰는 { [typeId]: bool } 맵.
export function typeToggles(cfg = getAutoConfig()) {
  return {
    morning_brief: cfg.typeMorningBrief !== false,
    qt: cfg.typeQt !== false,
    astrology: cfg.typeAstrology !== false,
    series: cfg.typeSeries !== false,
    space_market: cfg.typeSpaceMarket !== false,
    trend_past: cfg.typeTimeTrend !== false,
    trend_present: cfg.typeTimeTrend !== false,
    trend_future: cfg.typeTimeTrend !== false,
    breaking: true,
  };
}

export function getAutoConfig() {
  try { return { ...DEFAULT_CFG, ...(JSON.parse(localStorage.getItem(CFG_KEY) ?? "{}") || {}) }; }
  catch { return { ...DEFAULT_CFG }; }
}
export function setAutoConfig(patch) {
  const next = { ...getAutoConfig(), ...patch };
  try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// ── 예산 보호(Phase 24) — usageDashboard 비용 집계 + 설정 한도 비교 ──────
//   초과 시 blocked=true → 자동발행 계획이 실행을 막고 관리자 알림.
export function budgetStatus(cfg = getAutoConfig(), now = Date.now()) {
  let today = 0, month = 0;
  try {
    today = usageStats("today", now).costKRW || 0;
    month = usageStats("month", now).costKRW || 0;
  } catch { /* 집계 실패 시 0 */ }
  const overToday = cfg.budgetTodayKRW > 0 && today >= cfg.budgetTodayKRW;
  const overMonth = cfg.budgetMonthKRW > 0 && month >= cfg.budgetMonthKRW;
  return {
    todayKRW: today, monthKRW: month,
    limitTodayKRW: cfg.budgetTodayKRW, limitMonthKRW: cfg.budgetMonthKRW,
    overToday, overMonth, blocked: overToday || overMonth,
    todayPct: cfg.budgetTodayKRW > 0 ? Math.round((today / cfg.budgetTodayKRW) * 100) : null,
    monthPct: cfg.budgetMonthKRW > 0 ? Math.round((month / cfg.budgetMonthKRW) * 100) : null,
  };
}

export function getPublishLog() {
  try { const v = JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export function appendPublishLog(entry) {
  const rec = { at: Date.now(), ...entry };
  try { localStorage.setItem(LOG_KEY, JSON.stringify([rec, ...getPublishLog()].slice(0, 200))); } catch {}
  return rec;
}

function getRetry() { try { return JSON.parse(localStorage.getItem(RETRY_KEY) ?? "{}") || {}; } catch { return {}; } }
function setRetry(map) { try { localStorage.setItem(RETRY_KEY, JSON.stringify(map)); } catch {} }

// ── 3시간 슬롯 계산 ─────────────────────────────────────────────────
// 다음 정렬 슬롯들(00,03,06,…). now 이후 count 개.
export function nextSlots(now = Date.now(), count = 8, intervalHours = 3) {
  const stepMs = intervalHours * 36e5;
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  // 다음 슬롯 경계로 올림.
  const h = d.getHours();
  const nextH = Math.ceil((h + (new Date(now).getMinutes() > 0 || new Date(now).getSeconds() > 0 ? 0.0001 : 0)) / intervalHours) * intervalHours;
  d.setHours(nextH);
  let t = d.getTime();
  if (t <= now) t += stepMs;
  const slots = [];
  for (let i = 0; i < count; i++) slots.push(new Date(t + i * stepMs));
  return slots;
}

// ── 긴급 발행 판정 — Priority HIGH & Trend Score ≥ min ───────────────
// 현재 트렌드에서 topic 이 긴급인지 판단(TrendDiscovery 재사용).
export function emergencyTopicSet(published = [], { min = 95 } = {}) {
  const cands = discoverTrendingTopics({ recentPublished: published, limit: 20, seed: 0 });
  const set = new Map();
  for (const c of cands) {
    if (c.priority === "High" && c.trendScore >= min) set.set(String(c.topic).trim(), c);
  }
  return set;
}
function matchEmergency(draft, emergSet) {
  const topic = String(draft.ai_topic || draft.title || "").trim();
  if (emergSet.has(topic)) return emergSet.get(topic);
  // 부분 일치(제목이 트렌드 토픽을 포함)도 허용.
  for (const [k, v] of emergSet) if (topic && (topic.includes(k) || k.includes(topic))) return v;
  return null;
}

const isToday = (ts, now) => {
  if (!ts) return false;
  const d = new Date(ts), n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

// 오늘 자동발행 수(긴급 제외, 실패 제외) — 일일 한도 계산용.
export function todayAutoCount(now = Date.now()) {
  return getPublishLog().filter((e) => e.mode === "auto" && e.status !== "failed" && isToday(e.at, now)).length;
}

// ── 계획 수립 — 무엇을 긴급/예약/스킵할지 ──────────────────────────
//   deps: { drafts, published, wbIndex(Map title→{confidence,promptVersion,source,...}), stages, now }
//   config: getAutoConfig()
//   반환: { emergency:[{draft,cand,gate}], scheduled:[{draft,slot,gate}], skipped:[{draft,gate}], dailyRemaining, enabled }
export function planAutoPublish({ drafts = [], published = [], wbIndex = new Map(), stages = {}, config = getAutoConfig(), now = Date.now() } = {}) {
  const norm = (s) => String(s ?? "").trim().toLowerCase();
  const existing = [...published, ...drafts].filter((p) => p && p.title).map((p) => ({ ai_topic: p.ai_topic, title: p.title, created_at: p.created_at }));
  const emergSet = emergencyTopicSet(published, { min: config.emergencyTrendMin });

  const candidates = drafts.filter((d) => d && d.title && (d.publish_status || "draft") === "draft");
  const emergency = [], scheduled = [], skipped = [];

  const gateCfg = {
    testMode: config.testMode,
    minQuality: config.minEditorialScore, minConfidence: config.minConfidence,
    dupHours: config.dupHours, minBodyLength: config.minBodyLength,
    seoCheck: config.seoCheck, reviewRequired: config.reviewRequired,
  };
  for (const d of candidates) {
    const rec = wbIndex.get(norm(d.title));
    const stage = stages[String(d.id)]?.stage || "draft";
    const gate = evaluateGate(d, { confidence: typeof rec?.confidence === "number" ? rec.confidence : null, existing, stage, cfg: gateCfg });
    const emg = matchEmergency(d, emergSet);
    if (gate.pass && emg) emergency.push({ draft: d, cand: emg, gate, rec: rec || null });
    else if (gate.pass) scheduled.push({ draft: d, gate, rec: rec || null });
    else skipped.push({ draft: d, gate });
  }

  // 일일 한도(긴급 제외) — 남은 수만큼만 예약, 3시간 슬롯 배정.
  const used = todayAutoCount(now);
  const dailyRemaining = Math.max(0, config.dailyLimit - used);
  const slots = nextSlots(now, dailyRemaining, config.intervalHours);
  const scheduledPlan = scheduled
    .sort((a, b) => (b.rec?.confidence ?? 0) - (a.rec?.confidence ?? 0) || b.gate.quality - a.gate.quality)
    .slice(0, dailyRemaining)
    .map((s, i) => ({ ...s, slot: slots[i] }));

  const budget = budgetStatus(config, now);

  return {
    enabled: !!config.enabled,
    testMode: config.testMode !== false,
    emergency,
    scheduled: scheduledPlan,
    skipped,
    dailyRemaining,
    dailyUsed: used,
    dailyLimit: config.dailyLimit,
    budget,
    // 예산 초과 시 실행을 막는다(관리자 알림). enabled 여도 blocked 면 실행 금지.
    blocked: budget.blocked,
    blockReason: budget.overToday ? "오늘 예산 초과" : budget.overMonth ? "이번달 예산 초과" : null,
  };
}

// ── 실행 — executor 주입(발행/예약/롤백). 재시도/롤백/로그 처리 ──────
//   executors: { publish:(id)=>Promise<{error}>, schedule:(id,iso)=>Promise<{error}>, revert:(id)=>Promise<{error}> }
//   반환: { published, scheduledCount, failed, alerts }
export async function executeAutoPublishPlan(plan, executors, { now = Date.now(), dryRun = false, maxRetry = 3 } = {}) {
  const result = { published: 0, scheduledCount: 0, failed: 0, alerts: [] };
  // Phase 24 — 예산 초과 또는 테스트모드면 실제 실행하지 않는다(계획만).
  if (plan?.blocked) return { ...result, blocked: true, alerts: [`⛔ 자동발행 중지 — ${plan.blockReason}. 예산 설정을 확인하세요.`] };
  if (plan?.testMode) dryRun = true;
  const retry = getRetry();

  const logEntry = (draft, mode, gate, cand, status, extra = {}) => appendPublishLog({
    postId: draft.id, title: draft.title, mode, status,
    reason: mode === "emergency" ? `긴급(TrendScore ${cand?.trendScore ?? "-"})` : "게이트 통과 자동발행",
    quality: gate?.quality ?? null, confidence: gate?.confidence ?? null,
    trendScore: cand?.trendScore ?? null,
    promptVersion: extra.promptVersion ?? null, llm: extra.source ?? null,
    category: draft.category, readingMinutes: extra.readingMinutes ?? null,
  });

  const attempt = async (fn, id) => {
    const st = retry[String(id)] || { attempts: 0 };
    try {
      const { error } = await fn(id);
      if (error) throw new Error(error.message || String(error));
      delete retry[String(id)];
      return { ok: true };
    } catch (e) {
      st.attempts = (st.attempts || 0) + 1;
      st.nextRetryAt = now + 5 * 60 * 1000; // 5분 후 재시도
      st.lastError = e?.message ?? String(e);
      retry[String(id)] = st;
      if (st.attempts >= maxRetry) { result.alerts.push(`⚠️ ${id} 발행 ${maxRetry}회 실패 — 관리자 확인 필요 (${st.lastError})`); }
      return { ok: false, error: st.lastError, attempts: st.attempts };
    }
  };

  if (dryRun) return { ...result, dryRun: true };

  // 1) 긴급 즉시 발행 + 롤백 안전망(발행 후 금칙어 재검증 실패 시 draft 복귀).
  for (const it of plan.emergency) {
    const r = await attempt(executors.publish, it.draft.id);
    if (r.ok) {
      result.published += 1;
      logEntry(it.draft, "emergency", it.gate, it.cand, "published", { promptVersion: it.rec?.promptVersion, source: it.rec?.source });
      logActivity("published", { title: it.draft.title, note: `긴급 즉시발행(TrendScore ${it.cand?.trendScore ?? "-"})`, ok: true });
      // Safe Rollback — 발행 직후 이상(금칙어) 발견 시 즉시 Draft 복귀.
      if (it.gate?.checks?.banned && it.gate.checks.banned.ok === false && executors.revert) {
        await executors.revert(it.draft.id);
        appendPublishLog({ postId: it.draft.id, title: it.draft.title, mode: "rollback", status: "reverted", reason: "발행 후 이상 감지 — Draft 복귀" });
      }
    } else { result.failed += 1; logEntry(it.draft, "emergency", it.gate, it.cand, "failed"); logActivity("failed", { title: it.draft.title, ok: false, note: r.error }); }
  }

  // 2) 일반 게이트 통과분 3시간 슬롯 예약(기존 예약발행 크론이 시각 도래 시 발행).
  for (const it of plan.scheduled) {
    const iso = (it.slot instanceof Date ? it.slot : new Date(it.slot)).toISOString();
    const st = retry[String(it.draft.id)] || { attempts: 0 };
    try {
      const { error } = await executors.schedule(it.draft.id, iso);
      if (error) throw new Error(error.message || String(error));
      delete retry[String(it.draft.id)];
      result.scheduledCount += 1;
      logEntry(it.draft, "auto", it.gate, null, "scheduled", { promptVersion: it.rec?.promptVersion, source: it.rec?.source });
      logActivity("scheduled", { title: it.draft.title, note: `예약 ${iso}`, ok: true });
    } catch (e) {
      st.attempts = (st.attempts || 0) + 1; st.nextRetryAt = now + 5 * 60 * 1000; st.lastError = e?.message ?? String(e);
      retry[String(it.draft.id)] = st;
      if (st.attempts >= maxRetry) result.alerts.push(`⚠️ ${it.draft.id} 예약 ${maxRetry}회 실패 — 관리자 확인 필요`);
      result.failed += 1; logEntry(it.draft, "auto", it.gate, null, "failed");
    }
  }

  setRetry(retry);
  return result;
}

// ── 대시보드 통계 ───────────────────────────────────────────────────
export function autoPublishStats(published = [], drafts = [], now = Date.now()) {
  const log = getPublishLog();
  const todayLogs = log.filter((e) => isToday(e.at, now));
  const publishedToday = todayLogs.filter((e) => e.status === "published").length;
  const scheduledCount = drafts.filter((d) => (d.publish_status || "") === "scheduled").length;
  const emergencyToday = todayLogs.filter((e) => e.mode === "emergency" && e.status === "published").length;
  const failures = todayLogs.filter((e) => e.status === "failed").length;
  const attempts = todayLogs.filter((e) => e.status === "published" || e.status === "failed").length;
  const successRate = attempts ? Math.round(((attempts - failures) / attempts) * 100) : null;

  const scored = todayLogs.filter((e) => typeof e.quality === "number");
  const avgScore = scored.length ? Math.round(scored.reduce((n, e) => n + e.quality, 0) / scored.length) : null;
  const pubViews = published.filter((p) => isToday(p.created_at, now));
  const avgViews = pubViews.length ? Math.round(pubViews.reduce((n, p) => n + (p.view_count ?? 0), 0) / pubViews.length) : null;

  return { publishedToday, scheduledCount, emergencyToday, failures, successRate, avgScore, avgViews, dailyUsed: todayAutoCount(now) };
}
