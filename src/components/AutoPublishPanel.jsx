// ════════════════════════════════════════════════════════════════════
// AutoPublishPanel — AI Autopilot (Auto Publish Ready · Phase 35)
//
//   승인 → 자동 예약 → (예약 시각 도래) → 자동 발행 → 이력. ON/OFF · Emergency Stop · Safety Gate.
//   실제 발행은 기존 publish API(adminUpdateLoungeDraft) 를 executor 로 주입 — 기존 로직 무수정.
//   ⚠️ Cron 없음: 화면 진입 시 도래분 처리 + "지금 처리" 버튼. Additive · Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import {
  getPublishQueue, enqueuePublish, updatePublishJob, removePublishJob, publishSummary,
  getAutopilotConfig, setAutopilotConfig, PUB_STATUS,
} from "../lib/publishQueue";
import { schedulePublishAt, pubSlotLabel } from "../lib/publishScheduler";
import { processDuePublishes } from "../lib/publishWorker";
import { publishHistoryStats, getPublishLog } from "../lib/publishHistory";
import { adminUpdateLoungeDraft } from "../lib/supabase";
import { classifyContentType } from "../lib/contentTypes";
import DraftPreviewModal from "./DraftPreviewModal";
import { evaluateQuality } from "../lib/qualityEvaluator";
import { reviewByBoard } from "../lib/aiEditorialBoard";

const STATUS_COLOR = {
  approved: "#2563eb", scheduled: "#7c3aed", publishing: "#d97706",
  published: "#059669", failed: "#dc2626", draft: "#6b7280",
};

export default function AutoPublishPanel({ drafts = [], adminUserId, showToast, onReload }) {
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [previewDraft, setPreviewDraft] = useState(null); // 미리보기 모달 대상(Phase 41)
  const [rejectedIds, setRejectedIds] = useState(() => new Set()); // 반려 = 세션 내 목록 숨김(발행 안 함·DB 무변경)
  const refresh = () => setTick((t) => t + 1);
  const cfg = getAutopilotConfig();
  const jobs = getPublishQueue();
  const sum = publishSummary();
  const hist = publishHistoryStats();
  const log = getPublishLog().slice(0, 12);
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };
  void tick;

  // 실제 발행 executor — 기존 API 재사용(무수정).
  const executor = async (job) => {
    if (!job.loungeId) return { error: new Error("발행 대상(초안 id) 없음") };
    return adminUpdateLoungeDraft(job.loungeId, { publishStatus: "published" }, adminUserId);
  };

  // 화면 진입 시 도래분 자동 처리(ON & !EmergencyStop 일 때만).
  useEffect(() => {
    if (cfg.autoPublishOn && !cfg.emergencyStop) {
      processDuePublishes({ executor }).then((r) => { if (r.published > 0) { showToast?.(`🚀 자동 발행 ${r.published}건`); refresh(); onReload?.(); } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCfg = (patch) => { setAutopilotConfig(patch); refresh(); };

  // 승인 초안 → 발행 큐 예약.
  const scheduleDraft = (d) => {
    const ct = d.content_type || classifyContentType(d.title || "");
    const j = enqueuePublish({ loungeId: d.id, title: d.title || "(무제)", contentType: ct, quality: 95 });
    const at = schedulePublishAt(ct);
    updatePublishJob(j.id, { status: "scheduled", scheduledAt: at.toISOString() });
    refresh(); showToast?.(`🗓️ 예약: ${pubSlotLabel(at.toISOString())}`);
  };

  // Phase 41 — 승인 예정 슬롯 라벨(미리보기 표시용, 실제 예약과 동일 계산).
  const slotLabelFor = (d) => {
    try { return pubSlotLabel(schedulePublishAt(d.content_type || classifyContentType(d.title || "")).toISOString()); }
    catch { return null; }
  };
  // 승인 — 목록·미리보기 공통(기존 예약 로직 위임). 미리보기에서 호출 시 모달 닫기.
  const approveDraft = (d) => { scheduleDraft(d); setPreviewDraft(null); };
  // 반려 — DB 무변경. 세션 내 승인대기 목록에서만 숨겨 오발행을 방지.
  const rejectDraft = (d) => {
    setRejectedIds((prev) => { const n = new Set(prev); n.add(d.id); return n; });
    setPreviewDraft(null); showToast?.("✕ 반려됨 — 목록에서 숨김(발행 안 됨 · DB 삭제 아님)");
  };

  const runNow = async () => {
    if (busy) return; setBusy(true);
    try {
      const r = await processDuePublishes({ executor, force: false });
      if (r.blocked) showToast?.(r.reason === "Auto Publish OFF" ? "자동발행이 OFF 입니다 — 먼저 ON 하세요" : "Emergency Stop 상태입니다");
      else showToast?.(`처리: 발행 ${r.published} · 스킵 ${r.skipped} · 실패 ${r.failed}`);
      refresh(); await onReload?.();
    } catch (e) { showToast?.("처리 오류: " + (e?.message ?? String(e))); }
    finally { setBusy(false); }
  };

  const publishOne = async (job) => {
    if (busy) return; setBusy(true);
    try {
      const { error } = await executor(job);
      if (error) { updatePublishJob(job.id, { status: "failed", error: error.message }); showToast?.("발행 실패: " + error.message); }
      else { updatePublishJob(job.id, { status: "published", publishedAt: Date.now() }); showToast?.("발행 완료"); await onReload?.(); }
      refresh();
    } finally { setBusy(false); }
  };
  const retry = (job) => { updatePublishJob(job.id, { status: "scheduled", error: null, scheduledAt: new Date().toISOString() }); refresh(); showToast?.("재시도 예약"); };

  const readyDrafts = (drafts || []).filter((d) => (d.publish_status || "draft") === "draft" && !rejectedIds.has(d.id)).slice(0, 12);
  const tile = (k, v, col) => (
    <div key={k} style={{ flex: "1 1 90px", background: C.bg, borderRadius: R.lg, padding: "9px 11px", border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 10, color: C.text3 }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: col || C.text1 }}>{v}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>🛫 AI Autopilot (자동발행 대기)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCfg({ autoPublishOn: !cfg.autoPublishOn })}
            style={{ padding: "7px 16px", borderRadius: R.full, fontWeight: 800, fontSize: 12.5, cursor: "pointer", border: "none", background: cfg.autoPublishOn ? C.brand : C.text4, color: "#fff" }}>
            {cfg.autoPublishOn ? "🟢 자동발행 ON" : "⚪ 자동발행 OFF"}
          </button>
          <button onClick={() => setCfg({ emergencyStop: !cfg.emergencyStop })}
            style={{ padding: "7px 14px", borderRadius: R.full, fontWeight: 800, fontSize: 12.5, cursor: "pointer", border: `1px solid ${cfg.emergencyStop ? "#dc2626" : C.bgWarm}`, background: cfg.emergencyStop ? "#dc2626" : "#fff", color: cfg.emergencyStop ? "#fff" : C.red }}>
            {cfg.emergencyStop ? "⛔ 정지됨" : "🛑 Emergency Stop"}
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg, lineHeight: 1.6 }}>
        관리자는 <b>승인</b>만 하면, 승인분이 편성 시간에 <b>예약</b>되고 시각 도래 시 <b>자동 발행</b>됩니다.
        Safety Gate(품질 {cfg.minQuality}점+ · 승인 · 예약)를 통과해야만 발행됩니다. {cfg.emergencyStop && <b style={{ color: C.red }}>⛔ 현재 자동발행 정지됨.</b>}
      </div>

      {/* 대시보드 */}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {tile("예약", sum.scheduled, "#7c3aed")}{tile("발행중", sum.publishing, "#d97706")}{tile("오늘 발행", sum.publishedToday, "#059669")}
        {tile("승인됨", sum.approved)}{tile("실패", sum.failed, sum.failed ? "#dc2626" : undefined)}{tile("재시도", sum.retries)}
        {tile("이번주", hist.week)}{tile("이번달", hist.month)}
      </div>

      {/* 승인 초안 → 예약 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>✅ 승인 초안 → 예약 추가 ({readyDrafts.length})</div>
        {readyDrafts.length === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>예약할 초안이 없습니다(초안 상태 글).</div> : readyDrafts.map((d) => {
          let q = null; try { q = evaluateQuality(d); } catch { q = null; }
          let b = null; try { b = reviewByBoard(d, { evaluation: q }); } catch { b = null; }
          const qColor = !q ? C.text4 : q.passed ? "#059669" : q.totalScore >= 80 ? C.gold : C.red;
          const bColor = !b ? C.text4 : b.hardGatePassed ? "#059669" : C.red;
          return (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "5px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
            <span style={{ color: C.text1, fontWeight: 600, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title || d.content?.slice(0, 30)}</span>
            {q && <span title={q.weakPoints.slice(0, 4).join(" · ")} style={{ padding: "2px 8px", borderRadius: R.full, fontSize: 9.5, fontWeight: 800, background: qColor + "22", color: qColor, whiteSpace: "nowrap" }}>품질 {q.totalScore}·{q.band}</span>}
            {b && <span title={b.reviewers.map((r) => `${r.role}:${r.decision}`).join(" · ")} style={{ padding: "2px 8px", borderRadius: R.full, fontSize: 9.5, fontWeight: 800, background: bColor + "22", color: bColor, whiteSpace: "nowrap" }}>4인 {b.approvalCount}/4·게이트 {b.hardGatePassed ? "PASS" : "FAIL"}</span>}
            <button onClick={() => setPreviewDraft(d)} style={{ padding: "4px 11px", background: "#fff", color: C.brandD, border: `1px solid ${C.brandD}`, borderRadius: R.md, fontWeight: 700, fontSize: 10.5, cursor: "pointer" }}>👁 미리보기</button>
            <button onClick={() => scheduleDraft(d)} style={{ padding: "4px 11px", background: C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 10.5, cursor: "pointer" }}>🗓️ 예약</button>
            <button onClick={() => rejectDraft(d)} style={{ padding: "4px 10px", background: "#fff", color: C.red, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontWeight: 700, fontSize: 10.5, cursor: "pointer" }}>✕ 반려</button>
          </div>
          );
        })}
      </div>

      {/* 발행 큐 */}
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.sm }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>📋 발행 큐 ({jobs.length})</div>
          <button onClick={runNow} disabled={busy} style={{ padding: "6px 13px", background: busy ? C.text4 : C.brand, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 11.5, cursor: busy ? "default" : "pointer" }}>
            {busy ? "처리 중…" : "▶ 지금 처리 (도래분 발행)"}
          </button>
        </div>
        {jobs.length === 0 ? <div style={{ fontSize: 12, color: C.text3, padding: "8px 0" }}>발행 큐가 비어 있습니다. 위 승인 초안을 예약하세요.</div> : jobs.slice(0, 30).map((j) => (
          <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "6px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
            <span style={{ padding: "1px 8px", borderRadius: R.full, fontSize: 9.5, fontWeight: 800, background: (STATUS_COLOR[j.status] || "#6b7280") + "22", color: STATUS_COLOR[j.status] || "#6b7280" }}>{PUB_STATUS[j.status] || j.status}</span>
            <span style={{ color: C.text1, fontWeight: 600, flex: 1, minWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.title}</span>
            {j.scheduledAt && <span style={{ fontSize: 10, color: "#7c3aed" }}>🗓️ {pubSlotLabel(j.scheduledAt)}</span>}
            {j.retries > 0 && <span style={{ fontSize: 10, color: C.text3 }}>재시도 {j.retries}</span>}
            {(j.status === "scheduled" || j.status === "approved") && <button onClick={() => publishOne(j)} disabled={busy} style={miniBtn(C.brandD)}>발행</button>}
            {j.status === "failed" && <button onClick={() => retry(j)} style={miniBtn(C.gold)}>재시도</button>}
            <button onClick={() => { removePublishJob(j.id); refresh(); }} style={miniBtn(C.text4)}>삭제</button>
            {j.error && <span style={{ fontSize: 9.5, color: C.red, width: "100%" }}>⚠ {j.error}</span>}
          </div>
        ))}
      </div>

      {/* 발행 이력 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🧾 발행 이력 <span style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}>오늘 {hist.today} · 이번주 {hist.week} · 이번달 {hist.month} · 실패 {hist.failures}</span></div>
        {log.length === 0 ? <div style={{ fontSize: 12, color: C.text3 }}>이력이 없습니다.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {log.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, padding: "2px 0", borderBottom: `1px solid ${C.bg}` }}>
                <span style={{ color: C.text4, minWidth: 88 }}>{new Date(e.at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span style={{ padding: "1px 6px", borderRadius: R.full, fontSize: 9, fontWeight: 800, background: (STATUS_COLOR[e.status] || "#6b7280") + "22", color: STATUS_COLOR[e.status] || "#6b7280" }}>{PUB_STATUS[e.status] || e.status}</span>
                <span style={{ color: C.text1, flex: 1, minWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phase 41 — 승인 전 미리보기 모달(승인/반려는 목록과 동일 동작) */}
      {previewDraft && (
        <DraftPreviewModal
          draft={previewDraft}
          scheduleLabel={slotLabelFor(previewDraft)}
          onClose={() => setPreviewDraft(null)}
          onApprove={approveDraft}
          onReject={rejectDraft}
        />
      )}
    </div>
  );
}

const miniBtn = (bg) => ({ padding: "3px 9px", background: bg, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 10, cursor: "pointer" });
