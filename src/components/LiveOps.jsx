// ════════════════════════════════════════════════════════════════════
// LiveOps — 라이브 자동 운영 (Phase 37 · Live Auto Publishing)
//
//   Auto Publish ON → [오늘 편성 자동 실행] → 실제 생성·검수·자동승인·예약 → (도래 시) 실제 발행.
//   테스트 글이 아니라 실제 라운지 글. 화면이 열려 있는 동안 도래분을 자동 발행한다(무-Cron 트리거).
//   ⚠️ 기존 엔진/발행 API 재사용(무수정) · additive. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { C, R, S } from "../constants";
import { runDay, DAY_PROGRAM } from "../lib/dayRunner";
import { publishSummary, getAutopilotConfig, setAutopilotConfig, getPublishQueue, PUB_STATUS } from "../lib/publishQueue";
import { processDuePublishes } from "../lib/publishWorker";
import { publishHistoryStats } from "../lib/publishHistory";
import { pubSlotLabel } from "../lib/publishScheduler";
import { adminCreateLoungeDraft, adminUpdateLoungeDraft } from "../lib/supabase";
import { contentTypeMeta } from "../lib/contentTypes";

const ITEM_STATUS = {
  generating: { t: "생성중", c: "#2563eb" }, reviewing: { t: "검수중", c: "#d97706" },
  scheduled: { t: "예약됨", c: "#7c3aed" }, needs_review: { t: "승인대기", c: "#d97706" },
  failed: { t: "실패", c: "#dc2626" }, published: { t: "발행완료", c: "#059669" },
};

export default function LiveOps({ published = [], adminUserId, showToast, onReload }) {
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState({});
  const [tick, setTick] = useState(0);
  const busyRef = useRef(false);
  const refresh = () => setTick((t) => t + 1);
  void tick;
  const cfg = getAutopilotConfig();
  const sum = publishSummary();
  const hist = publishHistoryStats();
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };

  const executor = async (job) => job.loungeId ? adminUpdateLoungeDraft(job.loungeId, { publishStatus: "published" }, adminUserId) : { error: new Error("id 없음") };
  const createDraft = async ({ title, body, aiTopic }) => adminCreateLoungeDraft({ category: "daily", title, content: body, aiTopic, publishStatus: "draft" }, adminUserId);

  // 화면 열려 있는 동안 도래분 자동 발행(ON & !EmergencyStop). 25초 간격.
  useEffect(() => {
    let alive = true;
    const pump = async () => {
      const c = getAutopilotConfig();
      if (busyRef.current || !c.autoPublishOn || c.emergencyStop) return;
      busyRef.current = true;
      try {
        const r = await processDuePublishes({ executor });
        if (alive && r.published > 0) { showToast?.(`🚀 자동 발행 ${r.published}건`); refresh(); await onReload?.(); }
      } catch { /* */ } finally { busyRef.current = false; }
    };
    pump();
    const id = setInterval(pump, 25000);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCfg = (patch) => { setAutopilotConfig(patch); refresh(); };

  const runToday = async () => {
    if (running) return;
    if (!window.confirm("오늘 편성(QT·인도점성술·Morning Brief·공간마켓·Time Trend)을 실제 생성하고 예약합니다.\n품질 통과분은 자동 승인되어, Auto Publish ON이면 곧 실제 발행됩니다. 진행할까요?")) return;
    setRunning(true); setItems({});
    try {
      const r = await runDay({ createDraft }, { mode: "realtime", published, onItem: (type, status, ex) => setItems((p) => ({ ...p, [type]: { status, ...ex } })) });
      showToast?.(`✅ 오늘 편성: 생성 ${r.generated} · 자동승인 ${r.approved} · 승인대기 ${r.pendingReview} · 실패 ${r.failed} · ₩${r.costKRW}`);
      refresh(); await onReload?.();
    } catch (e) { showToast?.("실행 오류: " + (e?.message ?? String(e))); }
    finally { setRunning(false); }
  };

  const runNow = async () => {
    const r = await processDuePublishes({ executor, force: false });
    if (r.blocked) showToast?.(r.reason === "Auto Publish OFF" ? "자동발행이 OFF 입니다" : "Emergency Stop 상태");
    else { showToast?.(`발행 ${r.published} · 스킵 ${r.skipped} · 실패 ${r.failed}`); refresh(); await onReload?.(); }
  };

  const todayStr = new Date().toDateString();
  const todayPublished = (published || []).filter((p) => p.created_at && new Date(p.created_at).toDateString() === todayStr).slice(0, 20);
  const queue = getPublishQueue().filter((j) => ["scheduled", "publishing", "approved"].includes(j.status)).slice(0, 20);

  const tile = (k, v, col) => (
    <div key={k} style={{ flex: "1 1 88px", background: C.bg, borderRadius: R.lg, padding: "9px 11px", border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 10, color: C.text3 }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: col || C.text1 }}>{v}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>📡 라이브 운영 (Live Auto Publishing)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCfg({ autoPublishOn: !cfg.autoPublishOn })}
            style={{ padding: "7px 16px", borderRadius: R.full, fontWeight: 800, fontSize: 12.5, cursor: "pointer", border: "none", background: cfg.autoPublishOn ? C.brand : C.text4, color: "#fff" }}>
            {cfg.autoPublishOn ? "🟢 자동발행 ON" : "⚪ 자동발행 OFF"}
          </button>
          <button onClick={() => setCfg({ emergencyStop: !cfg.emergencyStop })}
            style={{ padding: "7px 12px", borderRadius: R.full, fontWeight: 800, fontSize: 12, cursor: "pointer", border: `1px solid ${cfg.emergencyStop ? "#dc2626" : C.bgWarm}`, background: cfg.emergencyStop ? "#dc2626" : "#fff", color: cfg.emergencyStop ? "#fff" : C.red }}>
            {cfg.emergencyStop ? "⛔ 정지됨" : "🛑 Stop"}
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg, lineHeight: 1.6 }}>
        <b>실제 하루를 AI가 운영</b>합니다. [오늘 편성 자동 실행] → 실제 생성·검수·자동승인·예약 → Auto Publish ON이면 <b>실제 라운지 글</b>로 발행됩니다.
        {" "}화면이 열려 있는 동안 예약 도래분을 자동 발행합니다(25초 간격). {cfg.emergencyStop && <b style={{ color: C.red }}>⛔ 현재 정지됨.</b>}
      </div>

      {/* 대시보드 */}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {tile("오늘 발행", sum.publishedToday, "#059669")}{tile("예약", sum.scheduled, "#7c3aed")}{tile("발행중", sum.publishing, "#d97706")}
        {tile("승인됨", sum.approved)}{tile("실패", sum.failed, sum.failed ? "#dc2626" : undefined)}{tile("재시도", sum.retries)}
        {tile("이번주", hist.week)}{tile("이번달", hist.month)}
      </div>

      {/* 오늘 편성 실행 */}
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: S.sm }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>🗓️ 오늘 편성 자동 운영</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={runNow} style={{ padding: "6px 12px", background: "#fff", color: C.brandD, border: `1px solid ${C.brandM}`, borderRadius: R.md, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>▶ 지금 발행 처리</button>
            <button onClick={runToday} disabled={running} style={{ padding: "6px 14px", background: running ? C.text4 : C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 11.5, cursor: running ? "default" : "pointer" }}>
              {running ? "실행 중…" : "▶ 오늘 편성 자동 실행"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {DAY_PROGRAM.map((type) => {
            const it = items[type]; const st = it?.status; const meta = ITEM_STATUS[st];
            return (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, background: C.bg, borderRadius: R.md, padding: "6px 10px", border: `1px solid ${C.bgWarm}` }}>
                <span style={{ fontWeight: 700, color: C.text1, minWidth: 130 }}>{contentTypeMeta(type).icon} {contentTypeMeta(type).label}</span>
                {st ? <span style={{ padding: "1px 8px", borderRadius: R.full, fontSize: 9.5, fontWeight: 800, background: (meta?.c || "#6b7280") + "22", color: meta?.c || "#6b7280" }}>{meta?.t || st}</span>
                  : <span style={{ fontSize: 10.5, color: C.text4 }}>대기</span>}
                {it?.quality != null && <span style={{ fontSize: 10.5, color: C.text3 }}>품질 {it.quality}</span>}
                {it?.title && <span style={{ color: C.text3, flex: 1, minWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>}
                {it?.error && <span style={{ fontSize: 10, color: C.red }}>{it.error}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 예약 큐 */}
      {queue.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>⏳ 예약/발행 대기 ({queue.length})</div>
          {queue.map((j) => (
            <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "4px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
              <span style={{ padding: "1px 7px", borderRadius: R.full, fontSize: 9.5, fontWeight: 800, background: "#7c3aed22", color: "#7c3aed" }}>{PUB_STATUS[j.status]}</span>
              <span style={{ color: C.text1, flex: 1, minWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.title}</span>
              {j.scheduledAt && <span style={{ fontSize: 10, color: "#7c3aed" }}>🗓️ {pubSlotLabel(j.scheduledAt)}</span>}
            </div>
          ))}
        </div>
      )}

      {/* 오늘 발행 목록(실제 라운지) */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>✅ 오늘 발행 (실제 라운지 · {todayPublished.length})</div>
        {todayPublished.length === 0 ? <div style={{ fontSize: 12, color: C.text3 }}>아직 오늘 발행된 글이 없습니다.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {todayPublished.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "3px 0", borderBottom: `1px solid ${C.bg}` }}>
                <span style={{ color: "#059669" }}>○</span>
                <span style={{ color: C.text1, flex: 1, minWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title || p.content?.slice(0, 30)}</span>
                <span style={{ fontSize: 10, color: C.text4 }}>{p.created_at ? new Date(p.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
