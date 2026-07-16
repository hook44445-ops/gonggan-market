// ════════════════════════════════════════════════════════════════════
// OperationMonitor — AI 무인 운영 검증 (Phase 38)
//
//   무인 운영 모드 ON → 60초마다 오늘 편성 자동 생성(중복 방지)·Watchdog 점검·Self-Healing 복구·
//   Daily Summary upsert·도래분 발행. 운영점수·Health Trend·7일 PASS·인시던트를 표시한다.
//   ⚠️ 기존 엔진/발행 API 재사용(무수정) · additive. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { C, R, S } from "../constants";
import { ensureTodayProgram, isTodayGenerated } from "../lib/dayScheduler";
import { runWatchdog, buildIncidents } from "../lib/watchdog";
import { heal } from "../lib/selfHealing";
import { operationScore } from "../lib/operationScore";
import { upsertTodaySummary, healthTrend, sevenDayReport, getDailySummaries } from "../lib/dailySummary";
import { getAutopilotConfig, setAutopilotConfig } from "../lib/publishQueue";
import { adminCreateLoungeDraft, adminUpdateLoungeDraft } from "../lib/supabase";
import { workflowKpis, runScheduler, WORKFLOW_ORDER, WORKFLOW_LABEL, buildWorkflowQueue } from "../lib/workflowEngine";
import ServerAutonomousStatus from "./ServerAutonomousStatus";

const LV = { high: "#dc2626", mid: "#d97706", info: "#6b7280" };
const AUTONOMY_KEY = "space_autonomy_mode_v1";

export default function OperationMonitor({ published = [], drafts = [], adminUserId, showToast, onReload }) {
  const [tick, setTick] = useState(0);
  const [autonomy, setAutonomy] = useState(() => { try { return localStorage.getItem(AUTONOMY_KEY) === "1"; } catch { return false; } });
  const [lastHeal, setLastHeal] = useState(null);
  const busyRef = useRef(false);
  const refresh = () => setTick((t) => t + 1);
  void tick;
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };

  const createDraft = async ({ title, body, aiTopic }) => adminCreateLoungeDraft({ category: "daily", title, content: body, aiTopic, publishStatus: "draft" }, adminUserId);
  const executor = async (job) => job.loungeId ? adminUpdateLoungeDraft(job.loungeId, { publishStatus: "published" }, adminUserId) : { error: new Error("id 없음") };
  // Phase 57 — 통합 WorkflowQueue: DB(publish_status='scheduled') 도래분을 같은 파이프라인으로 발행.
  const dbExecutor = async (rec) => rec.id ? adminUpdateLoungeDraft(rec.id, { publishStatus: "published" }, adminUserId) : { error: new Error("id 없음") };

  const runCycle = async (silent = true) => {
    if (busyRef.current) return; busyRef.current = true;
    try {
      await ensureTodayProgram({ createDraft }, { published });
      const h = await heal({ createDraft, executor }, { published });
      // 예약 도래분(DB) 발행 — 무인운영도 발행센터와 동일한 WorkflowQueue를 사용.
      const sched = await runScheduler({ records: [...(drafts || []), ...(published || [])], executor: dbExecutor });
      upsertTodaySummary();
      setLastHeal(h);
      refresh();
      const total = (h.published || 0) + (h.healed || 0) + (sched.published || 0);
      if (total > 0) { if (!silent) showToast?.(`🔧 복구 ${h.healed} · 발행 ${h.published + sched.published}`); await onReload?.(); }
    } catch (e) { if (!silent) showToast?.("사이클 오류: " + (e?.message ?? String(e))); }
    finally { busyRef.current = false; }
  };

  // 무인 운영 모드 — 60초 사이클.
  useEffect(() => {
    if (!autonomy) return;
    runCycle(true);
    const id = setInterval(() => runCycle(true), 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autonomy]);

  const toggleAutonomy = () => {
    const next = !autonomy;
    try { localStorage.setItem(AUTONOMY_KEY, next ? "1" : "0"); } catch {}
    if (next) setAutopilotConfig({ autoPublishOn: true }); // 무인 운영은 자동발행 필요
    setAutonomy(next); showToast?.(next ? "🤖 무인 운영 모드 ON" : "무인 운영 모드 OFF");
  };

  const ops = operationScore();
  const issues = runWatchdog();
  const incidents = buildIncidents(issues);
  const trend = healthTrend(7);
  const seven = sevenDayReport();
  const today = getDailySummaries()[0];
  const cfg = getAutopilotConfig();
  const scoreColor = ops.score >= 90 ? "#059669" : ops.score >= 75 ? C.gold : C.red;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>🤖 무인 운영 (7-Day Autonomous)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: C.text3 }}>운영점수</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor }}>{ops.score}</span>
          <button onClick={toggleAutonomy} style={{ padding: "7px 16px", borderRadius: R.full, fontWeight: 800, fontSize: 12.5, cursor: "pointer", border: "none", background: autonomy ? C.brand : C.text4, color: "#fff" }}>
            {autonomy ? "🤖 무인 ON" : "⚪ 무인 OFF"}
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg, lineHeight: 1.6 }}>
        무인 운영 ON이면 화면이 열려 있는 동안 <b>60초마다</b> 오늘 편성 자동 생성(중복 방지)·Watchdog 점검·Self-Healing 복구·발행·일일 요약을 수행합니다.
        {" "}오늘 편성 {isTodayGenerated() ? "✅ 생성됨" : "⏳ 대기"}. {cfg.emergencyStop && <b style={{ color: C.red }}>⛔ 정지됨.</b>}
      </div>

      {/* Phase 57 — 통합 워크플로우(WorkflowQueue · DB 단일 진실원) — 운영센터·발행센터와 동일 수치 */}
      {(() => {
        const recs = [...(drafts || []), ...(published || [])];
        const wf = workflowKpis(recs);
        const q = buildWorkflowQueue(recs);
        return (
          <div style={{ ...box, background: "#0b1220", border: "1px solid #1e293b" }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8fe3c4", marginBottom: S.sm }}>🔗 통합 워크플로우 (WorkflowQueue · DB 기준)</div>
            <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
              {[["오늘 생성", wf.todayCreated], ["검토", wf.todayReviewed], ["PASS", wf.todayPass], ["수정", wf.revision], ["예약", wf.scheduled], ["발행", wf.published], ["실패", wf.failed], ["평균품질", wf.avgQuality != null ? wf.avgQuality + "점" : "-"]].map(([k, v]) => (
                <div key={k} style={{ flex: "1 1 78px", background: "#111c2e", borderRadius: R.lg, padding: "7px 10px", border: "1px solid #1e293b" }}>
                  <div style={{ fontSize: 9.5, color: "#94a3b8" }}>{k}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#e2e8f0" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {WORKFLOW_ORDER.filter((s) => q.counts[s] > 0).map((s) => (
                <span key={s} style={{ fontSize: 10, fontWeight: 700, background: "#111c2e", color: "#cbd5e1", borderRadius: R.full, padding: "2px 9px", border: "1px solid #1e293b" }}>{WORKFLOW_LABEL[s]} {q.counts[s]}</span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Phase 39 — 서버 자율 트리거(브라우저 닫혀도 운영) */}
      <ServerAutonomousStatus />

      {/* 운영점수 breakdown + 수동 사이클 */}
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.sm }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>📊 운영 점수 {ops.score}점</div>
          <button onClick={() => runCycle(false)} style={{ padding: "5px 12px", background: C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>🔧 지금 점검·복구</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(ops.breakdown).map(([k, v]) => (
            <span key={k} style={{ fontSize: 11, background: C.bg, borderRadius: R.full, padding: "3px 10px", color: v < 0 ? C.red : C.text2 }}>{k} {v > 0 ? "+" : ""}{v}</span>
          ))}
        </div>
      </div>

      {/* Watchdog + Self-Healing */}
      <div style={{ display: "flex", gap: S.md, flexWrap: "wrap", marginBottom: S.xl }}>
        <div style={{ ...box, flex: "1 1 240px", marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🐕 Watchdog {issues.length === 0 ? "✅ 정상" : `(${issues.length})`}</div>
          {issues.length === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>이상 없음.</div> : issues.map((i, x) => (
            <div key={x} style={{ fontSize: 11.5, color: LV[i.level], padding: "2px 0" }}>{i.level === "high" ? "🔴" : i.level === "mid" ? "🟡" : "•"} {i.message}{i.fixable ? " (복구가능)" : ""}</div>
          ))}
        </div>
        <div style={{ ...box, flex: "1 1 240px", marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🔧 Self-Healing</div>
          {!lastHeal || lastHeal.healed === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>복구 동작 없음(정상).</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {lastHeal.actions.map((a, i) => <div key={i} style={{ fontSize: 11.5, color: C.brandD }}>✔ {a.kind}{a.title ? `: ${a.title.slice(0, 24)}` : a.note ? `: ${a.note}` : ""} <span style={{ color: "#059669" }}>Recovered</span></div>)}
            </div>
          )}
          {incidents.length > 0 && <div style={{ fontSize: 10.5, color: C.red, marginTop: 6 }}>🚨 인시던트 {incidents.length}건 → Slack/Telegram(구조 준비)</div>}
        </div>
      </div>

      {/* Daily Summary */}
      {today && (
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🗒️ 오늘 요약 ({today.date}) {today.pass ? <span style={{ color: "#059669" }}>PASS</span> : <span style={{ color: C.gold }}>진행중</span>}</div>
          <div style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.8 }}>
            생성 {today.generated ? "✅" : "-"} · 발행 {today.published} · 실패 {today.failed} · 재시도 {today.retries} · 평균품질 {today.avgQuality ?? "-"} · 토큰 {(today.tokens || 0).toLocaleString()} · 비용 ₩{(today.costKRW || 0).toLocaleString()} · 운영점수 {today.opsScore}
          </div>
        </div>
      )}

      {/* Health Trend (7일) */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📈 Health Trend (최근 7일)</div>
        {trend.length === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>아직 데이터가 없습니다(운영 시작 후 누적).</div> : (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            {trend.map((s) => (
              <div key={s.date} style={{ textAlign: "center", flex: "1 1 60px" }}>
                <div style={{ height: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                  <div style={{ width: 22, height: `${Math.max(6, (s.opsScore || 40))}%`, background: s.pass ? C.brand : C.gold, borderRadius: "4px 4px 0 0" }} title={`발행 ${s.published} · 점수 ${s.opsScore}`} />
                </div>
                <div style={{ fontSize: 9, color: C.text3, marginTop: 3 }}>{s.date.slice(5)}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: s.pass ? "#059669" : C.gold }}>{s.published}건</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7일 검증 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🗓️ 7일 자동 운영 검증</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const d = seven[i];
            return (
              <span key={i} style={{ padding: "5px 12px", borderRadius: R.md, fontSize: 11, fontWeight: 800, border: `1px solid ${C.bgWarm}`,
                background: d ? (d.status === "PASS" ? "#05966922" : "#dc262622") : C.bg, color: d ? (d.status === "PASS" ? "#059669" : "#dc2626") : C.text4 }}>
                Day{i + 1} {d ? d.status : "-"}
              </span>
            );
          })}
        </div>
        <div style={{ fontSize: 10.5, color: C.text3, marginTop: S.sm }}>매일 발행이 이뤄지고 실패가 없으면 PASS. 7일 연속 PASS 면 무인 운영이 검증됩니다.</div>
      </div>
    </div>
  );
}
