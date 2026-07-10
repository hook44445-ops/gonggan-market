// ════════════════════════════════════════════════════════════════════
// 공간라운지 Activity Log — AI 운영 활동 실시간 로그 (Phase 24)
//
//   자동발행/생성 파이프라인의 모든 단계를 한 줄씩 기록해 운영자가 흐름을 되짚는다:
//     트렌드 발견 · Draft 생성 · OpenRouter 호출 · Editorial · Confidence ·
//     Humanization · Gate 통과/탈락 · 예약 · 즉시발행 · 실패 · Retry · 비용.
//
//   ⚠️ Regression Zero: DB/API/Cron/테이블 없음(activitySchema.js 설계와 무관한 런타임 로그).
//   순수 localStorage. 어디서든 logActivity(...) 호출만 하면 된다(실패해도 무해).
// ════════════════════════════════════════════════════════════════════

const KEY = "space_activity_log_v1";
const CAP = 400;

// 활동 종류 — 표시 메타(아이콘/라벨/색상 힌트).
export const ACTIVITY_KINDS = {
  trend:        { icon: "🔭", label: "트렌드 발견" },
  draft:        { icon: "📝", label: "Draft 생성" },
  openrouter:   { icon: "🛰️", label: "OpenRouter 호출" },
  llm_response: { icon: "🤖", label: "LLM 응답" },
  editorial:    { icon: "📊", label: "Editorial 계산" },
  confidence:   { icon: "🎯", label: "Confidence 계산" },
  humanize:     { icon: "✍️", label: "Humanization" },
  gate_pass:    { icon: "✅", label: "Gate 통과" },
  gate_fail:    { icon: "🚧", label: "Gate 탈락" },
  scheduled:    { icon: "🗓️", label: "예약" },
  published:    { icon: "🚀", label: "즉시 발행" },
  failed:       { icon: "❌", label: "발행 실패" },
  retry:        { icon: "🔁", label: "Retry" },
  budget:       { icon: "💰", label: "예산" },
  story:        { icon: "📚", label: "연재" },
  // Phase 25 — 블로그 발행(JAFA1) 이벤트.
  blog_start:     { icon: "📤", label: "블로그 발행 시작" },
  blog_html:      { icon: "🧱", label: "HTML 생성" },
  blog_prepared:  { icon: "📦", label: "발행 준비(임시)" },
  blog_url:       { icon: "🔗", label: "URL 생성" },
  blog_published: { icon: "🚀", label: "블로그 발행" },
  blog_drafted:   { icon: "📝", label: "블로그 임시저장" },
  blog_retry:     { icon: "🔁", label: "블로그 Retry" },
  blog_failed:    { icon: "❌", label: "블로그 발행 실패" },
};

export function getActivityLog() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// 활동 1건 기록. entry: { kind, title?, model?, tokens?, latencyMs?, costKRW?, ok?, note? }
export function logActivity(kind, entry = {}) {
  const rec = { id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), kind, ...entry };
  try { localStorage.setItem(KEY, JSON.stringify([rec, ...getActivityLog()].slice(0, CAP))); } catch {}
  return rec;
}

export function clearActivityLog() {
  try { localStorage.removeItem(KEY); } catch {}
  return [];
}

// 화면용 정규화 — 아이콘/라벨/상대시각.
export function activityRows({ limit = 60, now = Date.now() } = {}) {
  return getActivityLog().slice(0, limit).map((r) => {
    const meta = ACTIVITY_KINDS[r.kind] || { icon: "•", label: r.kind };
    const sec = Math.max(0, Math.round((now - r.at) / 1000));
    const rel = sec < 60 ? `${sec}초 전` : sec < 3600 ? `${Math.round(sec / 60)}분 전` : sec < 86400 ? `${Math.round(sec / 3600)}시간 전` : `${Math.round(sec / 86400)}일 전`;
    return { ...r, icon: meta.icon, label: meta.label, rel };
  });
}

// 요약(오늘) — 종류별 카운트 + 총비용/평균Latency.
export function activitySummary(now = Date.now()) {
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const today = getActivityLog().filter((r) => r.at >= startOfDay.getTime());
  const byKind = {};
  let costKRW = 0, latSum = 0, latN = 0;
  for (const r of today) {
    byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    if (Number.isFinite(r.costKRW)) costKRW += r.costKRW;
    if (Number.isFinite(r.latencyMs)) { latSum += r.latencyMs; latN += 1; }
  }
  return { total: today.length, byKind, costKRW: Math.round(costKRW), avgLatencyMs: latN ? Math.round(latSum / latN) : null };
}

// Phase 24 — 콘텐츠 타입별 발행 비율 + Shareability 평균(발행 이벤트 기준).
//   range: 'today'|'week'|'all'. 발행/예약 이벤트에 붙은 contentType/shareabilityScore 집계.
export function contentMixSummary(range = "today", now = Date.now()) {
  const winMs = { week: 7 * 864e5 }[range];
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const rows = getActivityLog().filter((r) => {
    if (!["published", "scheduled", "llm_response"].includes(r.kind)) return false;
    if (range === "all") return true;
    if (range === "today") return r.at >= startOfDay.getTime();
    return winMs ? now - r.at <= winMs : true;
  });
  const byType = {};
  let shSum = 0, shN = 0;
  for (const r of rows) {
    const ct = r.contentType || "기타";
    byType[ct] = (byType[ct] || 0) + 1;
    if (Number.isFinite(r.shareabilityScore)) { shSum += r.shareabilityScore; shN += 1; }
  }
  const total = rows.length;
  const ratios = Object.entries(byType).map(([type, count]) => ({ type, count, pct: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
  return { total, ratios, avgShareability: shN ? Math.round(shSum / shN) : null };
}
