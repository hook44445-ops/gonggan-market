// ════════════════════════════════════════════════════════════════════════════
// gpsTrust.js — GPS 신뢰 레이어 (Space OS Trust Layer v2)
//   기존 checkpoint 데이터만으로 "이 GPS가 믿을 수 있는가"를 계산한다(읽기 전용).
//   · DB/API/Migration/RPC 변경 없음 — admin_project_flow_list 행만 사용.
//   · AdminScreen 의 deriveFlowFlags 와 동일 기준(단계: site_visit/contract/
//     start/middle/complete, GPS 단계 = start/middle/complete)을 독립 모듈로 미러링.
//   · 정확도 임계값은 GpsOpsDashboard(OVER_ACC=50) / cp lowAcc(30) 와 일치.
// ════════════════════════════════════════════════════════════════════════════

export const ACC_GOOD = 30; // m 이하 = 양호
export const ACC_OVER = 50; // m 초과 = 위치오차 과다

const FLOW_STAGE_INDEX = {
  REQUESTED: 0, BID_SUBMITTED: 1, SITE_VISIT: 2, FINAL_QUOTE: 3, CONTRACTED: 4,
  ESCROW_STARTED: 5, MID_INSPECTION: 6, COMPLETED: 7, SETTLED_OR_REVIEWED: 8,
};

const cpFind = (cps, types) => (cps || []).find(c => types.includes(c.checkpoint_type)) || null;
const hasGps = (cp) => !!cp && cp.lat != null && cp.lng != null;
const photoN = (cp) => (Array.isArray(cp?.photos) ? cp.photos.length : 0);
const accOf  = (cp) => {
  const a = Number(cp?.accuracy);
  return (cp?.accuracy != null && Number.isFinite(a)) ? a : null;
};

// 신뢰등급/티어 메타
export const TIER_META = {
  trust:   { emoji: "🟢", label: "신뢰",      color: "#1F9D55" },
  caution: { emoji: "🟡", label: "확인 필요",  color: "#E6A100" },
  review:  { emoji: "🔴", label: "검토 필요",  color: "#E74C3C" },
  none:    { emoji: "⚪", label: "진행전",     color: "#9AA0A6" },
};
// 프로젝트 신뢰 티어 라벨(목록/카드용)
export const PROJECT_TIER_LABEL = {
  trust: "신뢰 프로젝트", caution: "주의 프로젝트", review: "검토 필요", none: "진행전",
};

// ── 증빙 일치성 (GPS ↔ 사진) ────────────────────────────────────────────────
export function evidenceMatch(cp) {
  const g = hasGps(cp), p = photoN(cp) > 0;
  if (g && p)  return { key: "match",         label: "증빙 일치", color: "#1F9D55" };
  if (g && !p) return { key: "photo_missing", label: "사진 누락", color: "#E67E22" };
  if (!g && p) return { key: "gps_missing",   label: "GPS 누락",  color: "#E74C3C" };
  return { key: "none", label: "증빙 없음", color: "#9AA0A6" };
}

// ── 체크포인트 GPS 신뢰등급 (🟢🟡🔴) ────────────────────────────────────────
//   기준: GPS 존재 / 사진 존재 / 위치오차.
export function checkpointGrade(cp) {
  if (!cp)        return { ...TIER_META.review, reason: "체크포인트 없음", gps: false, photo: false, accuracy: null };
  const g = hasGps(cp), p = photoN(cp) > 0, a = accOf(cp);
  if (!g)         return { ...TIER_META.review, reason: "GPS 좌표 없음", gps: false, photo: p, accuracy: a };
  const accBad = a != null && a > ACC_OVER;
  if (g && p && !accBad)
    return { ...TIER_META.trust, reason: a != null ? `정확도 ${Math.round(a)}m` : "GPS+사진", gps: true, photo: true, accuracy: a };
  const reason = !p ? "사진 누락" : accBad ? `위치오차 ${Math.round(a)}m` : "확인 필요";
  return { ...TIER_META.caution, reason, gps: true, photo: p, accuracy: a };
}

// ── 단계 구성(deriveFlowFlags 미러) ─────────────────────────────────────────
export function trustStages(row) {
  const cps = row.checkpoints || [];
  const esc = row.escrow || null;
  const sv  = row.site_visit || null;
  const si  = FLOW_STAGE_INDEX[row.flow_stage] ?? 0;
  const ts  = esc?.transaction_status;

  const cpVisit    = cpFind(cps, ["site_visit"]);
  const cpContract = cpFind(cps, ["contract"]);
  const cpStart    = cpFind(cps, ["start", "construction_start"]);
  const cpMid      = cpFind(cps, ["middle", "mid_inspection"]);
  const cpComp     = cpFind(cps, ["complete", "completion"]);

  const contractReached = !!row.selected_bid || !!esc
    || ["CONTRACTED", "COMPANY_SELECTED", "STARTED", "MID_INSPECTION", "COMPLETED", "SETTLED"].includes(ts);
  const startReached    = si >= FLOW_STAGE_INDEX.ESCROW_STARTED || ts === "STARTED"        || !!cpStart;
  const middleReached   = si >= FLOW_STAGE_INDEX.MID_INSPECTION  || ts === "MID_INSPECTION" || !!cpMid;
  const completeReached = si >= FLOW_STAGE_INDEX.COMPLETED       || ts === "COMPLETED"      || !!esc?.step4_approved_at || !!cpComp;

  return [
    { key: "site_visit", label: "현장방문/실측", reached: !!sv || !!cpVisit, cp: cpVisit,    gpsStage: false },
    { key: "contract",   label: "최종계약",       reached: contractReached,  cp: cpContract, gpsStage: false },
    { key: "start",      label: "착공",           reached: startReached,     cp: cpStart,    gpsStage: true  },
    { key: "middle",     label: "중간점검",       reached: middleReached,    cp: cpMid,      gpsStage: true  },
    { key: "complete",   label: "완료",           reached: completeReached,  cp: cpComp,     gpsStage: true  },
  ];
}

// ── 프로젝트 신뢰점수(Trust Score) ──────────────────────────────────────────
//   GPS 단계(착공/중간/완료) 도달분에 대해 GPS·사진·정확도·단계완료를 합산(읽기 전용).
//   단계 점수(최대 100): GPS 40 + 사진 30 + 정확도 20 + 단계존재 10.
//   GPS 단계 미도달이면 scored=false(진행전 — 신뢰/주의/검토 집계 제외).
export function projectTrust(row) {
  const stages = trustStages(row);
  const gpsStages = stages.filter(s => s.gpsStage && s.reached);
  const warnings = [];
  if ((row.direct_deal_reports || []).length > 0) warnings.push("직거래 의심");

  if (!gpsStages.length) {
    return { scored: false, score: null, tier: "none", stages, gpsStages, warnings, gpsRate: null, photoRate: null, n: 0 };
  }

  let sum = 0, gpsOk = 0, photoOk = 0, stagePresent = 0, accBadN = 0;
  for (const s of gpsStages) {
    const cp = s.cp;
    let pts = 0;
    if (cp) {
      stagePresent++;
      const g = hasGps(cp), p = photoN(cp) > 0, a = accOf(cp);
      if (g) { pts += 40; gpsOk++; }
      if (p) { pts += 30; photoOk++; }
      if (a != null) { if (a <= ACC_GOOD) pts += 20; else if (a <= ACC_OVER) pts += 10; else accBadN++; }
      else if (g) pts += 10; // 좌표 있으나 정확도 미상 → 부분점수
      pts += 10; // 체크포인트 존재
    }
    sum += pts;
  }
  const n = gpsStages.length;
  const score = Math.round(sum / n);
  const gpsRate = Math.round((gpsOk / n) * 100);
  const photoRate = Math.round((photoOk / n) * 100);

  if (gpsOk < n)        warnings.push("GPS 누락");
  if (photoOk < n)      warnings.push("사진 누락");
  if (stagePresent < n) warnings.push("단계 미완료");
  if (accBadN > 0)      warnings.push("GPS 오차 큼");

  const tier = score >= 85 ? "trust" : score >= 60 ? "caution" : "review";
  return { scored: true, score, tier, stages, gpsStages, warnings, gpsRate, photoRate, stagePresent, n };
}

// ── 업체 신뢰지수 (평균 신뢰점수 / GPS 기록률 / 사진 첨부율) ─────────────────
export function companyTrustIndex(rows) {
  const m = new Map();
  for (const r of rows || []) {
    const c = r.company;
    if (!c || !c.id) continue;
    const t = projectTrust(r);
    if (!t.scored) continue; // GPS 단계 도달 프로젝트만 집계
    const cur = m.get(c.id) || { id: c.id, name: c.name || "—", projects: 0, scoreSum: 0, gpsSum: 0, photoSum: 0 };
    cur.projects++; cur.scoreSum += t.score; cur.gpsSum += t.gpsRate; cur.photoSum += t.photoRate;
    m.set(c.id, cur);
  }
  return [...m.values()].map(c => ({
    id: c.id, name: c.name, projects: c.projects,
    avgScore: Math.round(c.scoreSum / c.projects),
    gpsRate:  Math.round(c.gpsSum / c.projects),
    photoRate: Math.round(c.photoSum / c.projects),
  }));
}
