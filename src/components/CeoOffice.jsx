// ════════════════════════════════════════════════════════════════════
// CeoOffice — AI 사장실 / Automation Factory (Phase 32)
//
//   총괄비서 브리핑 · 운영현황 · 대시보드 · Automation Queue(주제→자동처리→승인대기) ·
//   승인함(승인→예약/초안저장 · 반려) · 회사 성과. 관리자는 승인/예약만 수행한다.
//   ⚠️ 발행 자동 금지 · 기존 엔진 호출만(additive). Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { C, R, S } from "../constants";
import { getQueue, enqueueJob, updateJob, removeJob, queueSummary, JOB_STATUS, JOB_STAGE } from "../lib/automationQueue";
import ChiefSecretaryBoard from "./ChiefSecretaryBoard";
import { processJob, processQueue } from "../lib/automationRunner";
import { suggestSlot, slotLabel } from "../lib/automationScheduler";
import { providerStatus } from "../lib/llmProviders";
import { aiBudget } from "../lib/aiPerformance";
import { adminCreateLoungeDraft } from "../lib/supabase";

const STATUS_COLOR = {
  queued: "#6b7280", running: "#2563eb", approval_pending: "#d97706",
  scheduled: "#7c3aed", published: "#059669", failed: "#dc2626", rejected: "#6b7280",
};

export default function CeoOffice({ adminUserId, showToast, onReload }) {
  const [topic, setTopic] = useState("");
  const [jobs, setJobs] = useState(() => getQueue());
  const [busy, setBusy] = useState(false);
  const [stageMsg, setStageMsg] = useState(null);
  const refresh = () => setJobs(getQueue());

  const sum = queueSummary();
  const budget = aiBudget();
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };

  const add = () => { if (!topic.trim()) { showToast?.("주제를 입력하세요"); return; } enqueueJob(topic.trim()); setTopic(""); refresh(); showToast?.("작업 대기열에 추가됨"); };

  const runOne = async (job) => {
    if (busy) return; setBusy(true); setStageMsg(`${job.topic} 처리 중…`);
    try { await processJob(job, { onStage: (s) => setStageMsg(`${job.topic} · ${JOB_STAGE[s] || s}`) }); refresh(); showToast?.("자동 처리 완료 — 승인 대기"); }
    catch (e) { showToast?.("처리 오류: " + (e?.message ?? String(e))); }
    finally { setBusy(false); setStageMsg(null); }
  };

  const runQueue = async () => {
    if (busy) return; setBusy(true);
    try { await processQueue(getQueue(), { onStage: (s) => setStageMsg(JOB_STAGE[s] || s), onJob: () => refresh(), limit: 5 }); refresh(); showToast?.("대기열 처리 완료"); }
    catch (e) { showToast?.("대기열 오류: " + (e?.message ?? String(e))); }
    finally { setBusy(false); setStageMsg(null); }
  };

  // 승인 → 예약 슬롯 배정 + 초안 저장(기존 함수) — 발행 아님.
  const approve = async (job) => {
    if (!job.draft?.body) return;
    const slot = suggestSlot(job.draft.contentType, { offsetIndex: sum.scheduled });
    try {
      const { error } = await adminCreateLoungeDraft(
        { category: "daily", title: job.draft.title || job.topic, content: job.draft.body, aiTopic: job.topic, publishStatus: "draft" },
        adminUserId
      );
      if (error) { showToast?.("초안 저장 실패: " + error.message); return; }
      updateJob(job.id, { status: "scheduled", scheduledAt: slot.toISOString() }); refresh();
      showToast?.(`✅ 승인 · 초안 저장 · 예약 ${slotLabel(slot.toISOString())} (발행은 관리자 승인 후)`);
      await onReload?.();
    } catch (e) { showToast?.("승인 오류: " + (e?.message ?? String(e))); }
  };
  const reject = (job) => { updateJob(job.id, { status: "rejected" }); refresh(); showToast?.("반려됨"); };

  const tile = (k, v) => (
    <div key={k} style={{ flex: "1 1 88px", background: C.bg, borderRadius: R.lg, padding: "9px 11px", border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 10, color: C.text3 }}>{k}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>{v}</div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 4 }}>🏛️ AI 사장실 (Automation Factory)</div>

      {/* Phase 48 — AI 품의·결재 타임라인(총괄비서실장) */}
      <ChiefSecretaryBoard />

      {/* 총괄비서 아침 브리핑 */}
      <div style={{ background: "#111827", borderRadius: R.lg, padding: "11px 14px", marginBottom: S.lg, color: "#e5e7eb" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 3 }}>🧠 총괄비서 브리핑</div>
        <div style={{ fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.6 }}>
          오늘 대기 <b>{sum.queued}</b> · 진행 <b>{sum.running}</b> · 승인대기 <b style={{ color: "#fcd34d" }}>{sum.approvalPending}</b> · 예약 <b>{sum.scheduled}</b> · 완료 <b>{sum.published}</b> · 실패 <b>{sum.failed}</b>.
          {" "}관리자는 <b>승인/예약</b>만 하면 됩니다. 발행은 자동으로 하지 않습니다.
        </div>
      </div>

      {/* 대시보드 */}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {tile("오늘 생성", sum.todayCreated)}{tile("예약", sum.scheduled)}{tile("발행", sum.published)}
        {tile("대기", sum.queued)}{tile("실패", sum.failed)}{tile("재시도", sum.retries)}
        {tile("평균 품질", sum.avgQuality != null ? sum.avgQuality + "점" : "-")}{tile("AI 비용", "₩" + (sum.costKRW || 0).toLocaleString())}{tile("절약 시간", budget.savedHours + "h")}
      </div>

      {/* 운영현황 */}
      <div style={{ fontSize: 11, color: C.text3, marginBottom: S.lg, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <b style={{ color: C.text2 }}>운영현황:</b>
        {providerStatus().map((p) => <span key={p.id} style={{ color: p.connected ? "#059669" : C.text4 }}>{p.connected ? "●" : "○"} {p.label}</span>)}
        <span style={{ color: C.text4 }}>○ Perplexity/Flux/Veo (편입 대기)</span>
      </div>

      {/* Automation Queue 입력 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🏭 Automation Queue</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="주제만 입력하면 리서치→작성→SEO→이미지→검수까지 자동"
            onKeyDown={(e) => e.key === "Enter" && add()}
            style={{ flex: "1 1 240px", padding: "9px 11px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }} />
          <button onClick={add} style={{ padding: "9px 14px", background: C.brand, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>+ 대기열 추가</button>
          <button onClick={runQueue} disabled={busy || sum.queued === 0} style={{ padding: "9px 14px", background: busy || sum.queued === 0 ? C.text4 : C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 12.5, cursor: busy || sum.queued === 0 ? "default" : "pointer" }}>
            {busy ? "처리 중…" : `▶ 대기열 처리 (${sum.queued})`}
          </button>
        </div>
        {stageMsg && <div style={{ fontSize: 11, color: C.brandD, marginTop: 8 }}>⏳ {stageMsg}</div>}
      </div>

      {/* 작업 목록 + 승인함 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.md }}>🗂️ 작업 · 승인함 ({jobs.length})</div>
        {jobs.length === 0 ? <div style={{ fontSize: 12, color: C.text3, padding: "8px 0" }}>대기열이 비어 있습니다. 위에 주제를 입력하세요.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {jobs.slice(0, 30).map((j) => (
              <div key={j.id} style={{ background: C.bg, borderRadius: R.md, padding: "8px 10px", border: `1px solid ${C.bgWarm}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ padding: "1px 8px", borderRadius: R.full, fontSize: 9.5, fontWeight: 800, background: (STATUS_COLOR[j.status] || "#6b7280") + "22", color: STATUS_COLOR[j.status] || "#6b7280" }}>
                    {JOB_STATUS[j.status] || j.status}{j.stage && j.status === "running" ? ` · ${JOB_STAGE[j.stage] || j.stage}` : ""}
                  </span>
                  <span style={{ fontWeight: 700, color: C.text1, fontSize: 12, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.draft?.title || j.topic}</span>
                  {j.scores?.composite != null && <span style={{ fontSize: 10.5, fontWeight: 800, color: j.scores.composite >= 90 ? "#059669" : C.gold }}>{j.scores.composite}점</span>}
                  {j.retries > 0 && <span style={{ fontSize: 10, color: C.text3 }}>재시도 {j.retries}</span>}
                  {j.scheduledAt && <span style={{ fontSize: 10, color: "#7c3aed" }}>🗓️ {slotLabel(j.scheduledAt)}</span>}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {j.status === "queued" && <button onClick={() => runOne(j)} disabled={busy} style={btn(C.brandD)}>실행</button>}
                  {j.status === "failed" && <button onClick={() => { updateJob(j.id, { status: "queued", error: null }); refresh(); }} style={btn(C.gold)}>재시도</button>}
                  {j.status === "approval_pending" && <>
                    <button onClick={() => approve(j)} style={btn(C.brand)}>✅ 승인 → 예약·초안저장</button>
                    <button onClick={() => reject(j)} style={btn("#dc2626")}>반려</button>
                  </>}
                  <button onClick={() => { removeJob(j.id); refresh(); }} style={btn(C.text4)}>삭제</button>
                </div>
                {j.error && <div style={{ fontSize: 10, color: C.red, marginTop: 4 }}>⚠ {j.error}</div>}
                {j.status === "approval_pending" && j.draft?.body && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ fontSize: 10.5, color: C.text3, cursor: "pointer" }}>미리보기 · SEO · 이미지 프롬프트</summary>
                    <div style={{ fontSize: 10.5, color: C.text2, lineHeight: 1.6, marginTop: 4, whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>{j.draft.body.slice(0, 600)}…</div>
                    {j.seo && <div style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>SEO: {j.seo.seoTitle} · /{j.seo.slug} · 태그 {(j.seo.tags || []).length}</div>}
                    {j.imagePrompt && <div style={{ fontSize: 10, color: C.text4, marginTop: 2 }}>🖼️ {j.imagePrompt.prompt.slice(0, 90)}…</div>}
                    {j.scores?.reasons?.length > 0 && <div style={{ fontSize: 10, color: C.gold, marginTop: 2 }}>검사: {j.scores.reasons.join(" · ")}</div>}
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 10.5, color: C.text3 }}>
        관리자는 <b>승인 · 반려 · 재시도 · 예약</b>만 수행합니다. 승인 시 초안으로 저장되고 예약 슬롯이 배정되며, <b>실제 발행은 기존 관리자 발행 흐름</b>을 그대로 사용합니다(자동발행 아님).
      </div>
    </div>
  );
}

const btn = (bg) => ({ padding: "4px 10px", background: bg, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 10.5, cursor: "pointer" });
