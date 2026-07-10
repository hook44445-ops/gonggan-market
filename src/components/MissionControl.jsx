// ════════════════════════════════════════════════════════════════════
// MissionControl — AI 운영센터 (Phase 33)
//
//   대시보드 · AI Health · 장애/알림 · Queue Monitor · Retry Center · 비용/품질 ·
//   총괄비서 브리핑 · 운영 로그 · 운영 점수. 관리자는 한눈에 파악하고 승인/재시도만.
//   ⚠️ 읽기 전용 집계 + 재시도(큐 상태 변경)만 · 발행/기존 로직 무변경(additive).
// ════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { C, R, S } from "../constants";
import { missionSnapshot } from "../lib/missionControl";
import { getQueue, updateJob } from "../lib/automationQueue";
import { activityRows } from "../lib/activityLog";

const HEALTH_ICON = { green: "🟢", yellow: "🟡", red: "🔴", idle: "⚪" };
const LV_COLOR = { high: "#dc2626", mid: "#d97706", info: "#2563eb" };

export default function MissionControl({ showToast }) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const snap = missionSnapshot();
  const logs = activityRows({ limit: 18 });
  const failedJobs = getQueue().filter((j) => j.status === "failed");
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };
  void tick;

  const retryJob = (id) => { updateJob(id, { status: "queued", error: null }); refresh(); showToast?.("재시도 대기열로 이동"); };
  const retryAll = () => { failedJobs.forEach((j) => updateJob(j.id, { status: "queued", error: null })); refresh(); showToast?.(`${failedJobs.length}건 재시도 대기열로 이동`); };

  const d = snap.dashboard;
  const scoreColor = snap.opsScore >= 90 ? "#059669" : snap.opsScore >= 75 ? C.gold : C.red;
  const tile = (k, v) => (
    <div key={k} style={{ flex: "1 1 86px", background: C.bg, borderRadius: R.lg, padding: "9px 11px", border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 10, color: C.text3 }}>{k}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>{v}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>🛰️ Mission Control (AI 운영센터)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: C.text3 }}>운영점수</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor }}>{snap.opsScore}</span>
        </div>
      </div>
      {/* 총괄비서 브리핑 */}
      <div style={{ background: "#111827", borderRadius: R.lg, padding: "11px 14px", marginBottom: S.lg, color: "#e5e7eb" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 3 }}>🧠 총괄비서 브리핑</div>
        <div style={{ fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.6 }}>{snap.briefing}</div>
      </div>

      {/* 대시보드 */}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {tile("오늘 생성", d.todayCreated)}{tile("예약", d.scheduled)}{tile("발행", d.published)}{tile("승인대기", d.approvalPending)}
        {tile("대기", d.queued)}{tile("실패", d.failed)}{tile("재시도", d.retries)}
        {tile("평균 품질", d.avgQuality != null ? d.avgQuality + "점" : "-")}{tile("AI 비용", "₩" + (d.costKRW || 0).toLocaleString())}{tile("절약 시간", d.savedHours + "h")}
      </div>

      {/* 알림 + 이상징후 추천 */}
      {(snap.alerts.length > 0 || snap.recommendations.length > 0) && (
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🔔 관리자 알림</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {snap.alerts.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                <span style={{ padding: "1px 7px", borderRadius: R.full, fontSize: 9, fontWeight: 800, background: (LV_COLOR[a.level] || "#6b7280") + "22", color: LV_COLOR[a.level] || "#6b7280" }}>{a.level === "high" ? "경고" : a.level === "mid" ? "주의" : "정보"}</span>
                <span style={{ color: C.text2 }}>{a.message}</span>
              </div>
            ))}
            {snap.recommendations.map((r, i) => (
              <div key={"r" + i} style={{ fontSize: 11.5, color: C.brandD }}>💡 {r}</div>
            ))}
          </div>
        </div>
      )}

      {/* AI Health Monitor */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>❤️ AI Health Monitor</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6 }}>
          {snap.health.map((h) => (
            <div key={h.model} style={{ background: C.bg, borderRadius: R.md, padding: "7px 10px", border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text1 }}>{HEALTH_ICON[h.status] || "⚪"} {h.name}</div>
              <div style={{ fontSize: 9.5, color: C.text3, marginTop: 2 }}>{h.note || `최근 ${h.recent}건 · 실패 ${h.failRate}%`}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue Monitor + Retry Center */}
      <div style={{ display: "flex", gap: S.md, flexWrap: "wrap", marginBottom: S.xl }}>
        <div style={{ ...box, flex: "1 1 240px", marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📊 Queue Monitor</div>
          {[["진행중", snap.queue.running, "#2563eb"], ["대기", snap.queue.queued, "#6b7280"], ["승인대기", snap.queue.approvalPending, "#d97706"], ["예약", snap.queue.scheduled, "#7c3aed"], ["완료", snap.queue.published, "#059669"], ["실패", snap.queue.failed, "#dc2626"]].map(([k, v, col]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "3px 0" }}>
              <span style={{ color: C.text2, minWidth: 64 }}>{k}</span>
              <div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, v * 12)}%`, height: "100%", background: col }} />
              </div>
              <span style={{ fontWeight: 800, color: C.text1, minWidth: 20, textAlign: "right" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ ...box, flex: "1 1 240px", marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.sm }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>🔁 Retry Center ({failedJobs.length})</div>
            {failedJobs.length > 0 && <button onClick={retryAll} style={{ padding: "4px 10px", background: C.gold, color: "#1a1a1a", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 10.5, cursor: "pointer" }}>전체 재시도</button>}
          </div>
          {failedJobs.length === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>실패 작업이 없습니다.</div> : failedJobs.slice(0, 8).map((j) => (
            <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "3px 0", borderBottom: `1px solid ${C.bg}` }}>
              <span style={{ color: C.text1, flex: 1, minWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.topic}</span>
              <span style={{ color: C.red, fontSize: 9.5 }}>{(j.error || "").slice(0, 20)}</span>
              <button onClick={() => retryJob(j.id)} style={{ padding: "3px 9px", background: C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 10, cursor: "pointer" }}>재시도</button>
            </div>
          ))}
        </div>
      </div>

      {/* 비용 분석 + 품질 리포트 */}
      <div style={{ display: "flex", gap: S.md, flexWrap: "wrap", marginBottom: S.xl }}>
        <div style={{ ...box, flex: "1 1 240px", marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>💰 AI 비용 분석</div>
          <div style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.8 }}>
            오늘 ₩{snap.cost.todayKRW.toLocaleString()} · 이번달 ₩{snap.cost.monthKRW.toLocaleString()} · 누적 ₩{snap.cost.allKRW.toLocaleString()}<br />
            평균 글당 ₩{snap.cost.avgPerArticleKRW ?? "-"} · 예상 월 ₩{snap.cost.projectedMonthKRW?.toLocaleString() ?? "-"}
          </div>
          {snap.cost.byModel.length > 0 && (
            <div style={{ fontSize: 10.5, color: C.text3, marginTop: 6 }}>
              {snap.cost.byModel.map((m) => <span key={m.model} style={{ marginRight: 10 }}>{m.model} ₩{m.costKRW.toLocaleString()}</span>)}
            </div>
          )}
        </div>
        <div style={{ ...box, flex: "1 1 240px", marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📈 품질 리포트</div>
          <div style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.8 }}>
            평균 {snap.quality.avg ?? "-"}점 · 최고 {snap.quality.max ?? "-"} · 최저 {snap.quality.min ?? "-"}<br />
            대기열 평균 품질 {snap.quality.queueAvg ?? "-"}점
          </div>
        </div>
      </div>

      {/* 운영 로그 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📡 AI 운영 로그</div>
        {logs.length === 0 ? <div style={{ fontSize: 12, color: C.text3 }}>로그가 없습니다.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {logs.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, padding: "2px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
                <span style={{ minWidth: 14 }}>{a.icon}</span>
                <span style={{ color: C.text2, fontWeight: 700, minWidth: 70 }}>{a.label}</span>
                <span style={{ color: C.text1, flex: 1, minWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title || a.note || ""}</span>
                <span style={{ color: C.text4 }}>{a.rel}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
