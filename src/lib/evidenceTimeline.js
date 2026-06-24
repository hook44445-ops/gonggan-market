// ════════════════════════════════════════════════════════════════════════════
// evidenceTimeline.js — 증빙 타임라인 (Evidence Timeline v3)
//   GPS + 사진 + 시간(captured_at)의 일치성을 기존 체크포인트 데이터만으로 계산.
//   · 읽기 전용 — DB/API/Migration/RPC 변경 없음. admin_project_flow_list 행만 사용.
//   · 단계 구성은 v2 신뢰 레이어(gpsTrust.trustStages)를 그대로 재사용(미수정).
//   · 기존 timestamp 만 사용 — EXIF/원본검증/위변조탐지 없음.
// ════════════════════════════════════════════════════════════════════════════
import { trustStages } from "./gpsTrust";

const hasGps = (cp) => !!cp && cp.lat != null && cp.lng != null;
const photoN = (cp) => (Array.isArray(cp?.photos) ? cp.photos.length : 0);
const tms = (t) => { const d = t ? new Date(t).getTime() : NaN; return Number.isFinite(d) ? d : null; };

// ── 체크포인트 증빙 완성도 — GPS / 사진 / 단계완료(기록 존재) 3항목 ─────────
export function checkpointCompleteness(stage) {
  const cp = stage.cp;
  const gps = hasGps(cp);
  const photo = photoN(cp) > 0;
  const done = !!cp; // 체크포인트(기록) 존재 = 단계 완료 기록
  const n = (gps ? 1 : 0) + (photo ? 1 : 0) + (done ? 1 : 0);
  return { gps, photo, done, pct: Math.round((n / 3) * 100) };
}

// ── 증빙 타임라인 — 도달 단계를 captured_at 시간순으로 정렬한 이벤트 ────────
const STAGE_ORDER = { site_visit: 0, contract: 1, start: 2, middle: 3, complete: 4 };
export function buildTimeline(row) {
  const stages = trustStages(row);
  return stages
    .filter(s => s.reached)
    .map(s => {
      const c = checkpointCompleteness(s);
      const at = s.cp?.captured_at || null;
      return { key: s.key, label: s.label, gpsStage: s.gpsStage, cp: s.cp, at, ts: tms(at), ...c };
    })
    .sort((a, b) => {
      if (a.ts != null && b.ts != null) return a.ts - b.ts;     // 시간 기록 있으면 시간순
      if (a.ts != null) return -1;
      if (b.ts != null) return 1;
      return STAGE_ORDER[a.key] - STAGE_ORDER[b.key];           // 둘 다 없으면 단계순
    });
}

// ── 시간 일치성 — 단계 captured_at 이 자연스럽게 이어지는지 ─────────────────
//   🟢 정상 / 🟡 시간 차이 큼(일괄기록·과도간격) / 🔴 검토 필요(시간 역전).
const ORDER_KEYS = ["site_visit", "contract", "start", "middle", "complete"];
const CLUSTER_MS = 5 * 60 * 1000;            // 5분 — 여러 단계 일괄 기록 의심
const HUGE_GAP_MS = 90 * 24 * 60 * 60 * 1000; // 90일 — 단계 간 과도 간격
export function timeConsistency(row) {
  const stages = trustStages(row);
  const timed = ORDER_KEYS
    .map(k => stages.find(s => s.key === k))
    .filter(s => s && s.reached && s.cp && tms(s.cp.captured_at) != null)
    .map(s => ({ key: s.key, ts: tms(s.cp.captured_at) }));

  if (timed.length < 2)
    return { tier: "none", emoji: "⚪", label: "정보 부족", color: "#9AA0A6", reason: "비교할 시간 기록 부족" };

  for (let i = 1; i < timed.length; i++) {
    if (timed[i].ts < timed[i - 1].ts)
      return { tier: "red", emoji: "🔴", label: "검토 필요", color: "#E74C3C", reason: "단계 시간 역전 — 이후 단계가 더 이른 시각" };
  }
  const span = timed[timed.length - 1].ts - timed[0].ts;
  if (timed.length >= 3 && span < CLUSTER_MS)
    return { tier: "yellow", emoji: "🟡", label: "시간 차이 큼", color: "#E6A100", reason: "여러 단계가 단시간에 일괄 기록" };
  for (let i = 1; i < timed.length; i++) {
    if (timed[i].ts - timed[i - 1].ts > HUGE_GAP_MS)
      return { tier: "yellow", emoji: "🟡", label: "시간 차이 큼", color: "#E6A100", reason: "단계 간 간격 과도(90일 초과)" };
  }
  return { tier: "green", emoji: "🟢", label: "정상", color: "#1F9D55", reason: "시간 흐름 자연스러움" };
}

// ── 프로젝트 증빙 — 완료율/누락률 + 완성도 티어 + 시간 일치성 ───────────────
export function projectEvidence(row) {
  const stages = trustStages(row);
  const gpsStages = stages.filter(s => s.gpsStage && s.reached); // 착공/중간/완료
  const time = timeConsistency(row);
  if (!gpsStages.length)
    return { scored: false, completionRate: null, missingRate: null, tier: "none", time, gpsStages: [] };

  let pctSum = 0;
  for (const s of gpsStages) pctSum += checkpointCompleteness(s).pct;
  const completionRate = Math.round(pctSum / gpsStages.length);
  const missingRate = 100 - completionRate;
  const tier = completionRate >= 100 ? "complete" : completionRate >= 67 ? "partial" : "review";
  return { scored: true, completionRate, missingRate, tier, gpsStages, time };
}

export const EV_TIER = {
  complete: { emoji: "🟢", label: "증빙 완전", color: "#1F9D55" },
  partial:  { emoji: "🟡", label: "증빙 부족", color: "#E6A100" },
  review:   { emoji: "🔴", label: "검토 필요", color: "#E74C3C" },
  none:     { emoji: "⚪", label: "진행전",    color: "#9AA0A6" },
};

// ── 업체 평균 증빙률 (GPS / 사진 / 완료 종합) ───────────────────────────────
export function companyEvidenceIndex(rows) {
  const m = new Map();
  for (const r of rows || []) {
    const c = r.company;
    if (!c || !c.id) continue;
    const stages = trustStages(r).filter(s => s.gpsStage && s.reached);
    if (!stages.length) continue;
    let g = 0, p = 0, d = 0;
    for (const s of stages) { const cc = checkpointCompleteness(s); if (cc.gps) g++; if (cc.photo) p++; if (cc.done) d++; }
    const n = stages.length;
    const cur = m.get(c.id) || { id: c.id, name: c.name || "—", projects: 0, gpsSum: 0, photoSum: 0, doneSum: 0 };
    cur.projects++; cur.gpsSum += Math.round((g / n) * 100); cur.photoSum += Math.round((p / n) * 100); cur.doneSum += Math.round((d / n) * 100);
    m.set(c.id, cur);
  }
  return [...m.values()].map(c => ({
    id: c.id, name: c.name, projects: c.projects,
    gpsRate: Math.round(c.gpsSum / c.projects),
    photoRate: Math.round(c.photoSum / c.projects),
    doneRate: Math.round(c.doneSum / c.projects),
    avg: Math.round((c.gpsSum + c.photoSum + c.doneSum) / (3 * c.projects)),
  }));
}
