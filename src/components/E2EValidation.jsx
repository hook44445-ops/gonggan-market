// ════════════════════════════════════════════════════════════════════
// E2EValidation — Real Production Validation (Phase 36)
//
//   실제 OpenRouter 키로 Research→Fusion→SEO→Review→Approval→Schedule→Publish→
//   Verification→History 전 과정을 1건 실제 수행하고 결과를 검증한다.
//   ⚠️ 실제 발행됩니다(검증용). 실제 저장/발행/검증은 기존 API 주입 — 기존 로직 무수정(additive).
// ════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { C, R, S } from "../constants";
import { runE2E, STEP_LABEL } from "../lib/e2eValidator";
import { getValidationHistory, getProductionReady } from "../lib/validationHistory";
import { adminCreateLoungeDraft, adminUpdateLoungeDraft, adminListPublishedAiContent } from "../lib/supabase";

const STEP_KEYS = ["research", "fusion", "seo", "review", "approval", "schedule", "publish", "verification", "history"];
const ICON = { running: "⏳", pass: "✔", fail: "✕", skip: "◦", pending: "·" };
const COLOR = { running: "#d97706", pass: "#059669", fail: "#dc2626", skip: "#6b7280", pending: "#9ca3af" };

export default function E2EValidation({ adminUserId, showToast, onReload }) {
  const [topic, setTopic] = useState("Morning Brief E2E 검증");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState({});
  const [result, setResult] = useState(null);
  const [tick, setTick] = useState(0);
  void tick;
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };
  const ready = getProductionReady();
  const history = getValidationHistory().slice(0, 10);

  const origin = (typeof window !== "undefined" && window.location?.origin) || "https://gonggan-market.vercel.app";
  const deps = {
    createDraft: async ({ title, body, aiTopic }) =>
      adminCreateLoungeDraft({ category: "daily", title, content: body, aiTopic, publishStatus: "draft" }, adminUserId),
    publishDraft: async (id) => adminUpdateLoungeDraft(id, { publishStatus: "published" }, adminUserId),
    verifyPublished: async (id) => {
      const { data } = await adminListPublishedAiContent();
      const found = (data || []).find((p) => p.id === id);
      return { verified: !!found, status: found ? "published" : "not_found", url: `${origin}/?post=${id}` };
    },
    maxRetry: 3,
  };

  const run = async () => {
    if (running) return;
    if (!window.confirm("실제 OpenRouter 호출 + 실제 발행이 수행됩니다(검증용 글 1건 게시). 진행할까요?")) return;
    setRunning(true); setResult(null); setSteps({});
    try {
      const r = await runE2E(topic.trim(), deps, { onStep: (k, status, ex) => setSteps((prev) => ({ ...prev, [k]: { status, ...ex } })) });
      setResult(r); setTick((t) => t + 1);
      showToast?.(r.productionReady ? "🟢 E2E PASS — Production Ready" : "E2E 일부 실패 — 결과를 확인하세요");
      await onReload?.();
    } catch (e) { showToast?.("E2E 오류: " + (e?.message ?? String(e))); }
    finally { setRunning(false); }
  };

  const stepStatus = (k) => steps[k]?.status || "pending";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>🔬 Production Validation (E2E)</div>
        {ready && (
          <span style={{ padding: "5px 12px", borderRadius: R.full, fontSize: 11.5, fontWeight: 800, background: "#05966922", color: "#059669" }}>
            🟢 Production Ready · E2E Passed
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg, lineHeight: 1.6 }}>
        <b>실제 OpenRouter 키</b>로 Fusion→SEO→검수→승인→예약→발행→검증까지 <b>1건 실제 수행</b>합니다.
        "설계가 맞는가"가 아니라 <b>"실제로 자동발행이 된다"</b>를 확인합니다. ⚠️ 검증용 글 1건이 실제 발행됩니다(확인 후 삭제 가능).
      </div>

      {/* 실행 */}
      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="검증 주제"
            style={{ flex: "1 1 240px", padding: "9px 11px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }} />
          <button onClick={run} disabled={running}
            style={{ padding: "9px 18px", background: running ? C.text4 : C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 800, fontSize: 13, cursor: running ? "default" : "pointer" }}>
            {running ? "실행 중…" : "▶ 실제 E2E 테스트"}
          </button>
        </div>
        {/* 진행상황 */}
        {(running || result) && (
          <div style={{ marginTop: S.md, background: C.bg, borderRadius: R.lg, padding: S.md, border: `1px solid ${C.bgWarm}` }}>
            {STEP_KEYS.map((k) => {
              const st = stepStatus(k);
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "3px 0" }}>
                  <span style={{ color: COLOR[st], fontWeight: 800, minWidth: 16 }}>{ICON[st]}</span>
                  <span style={{ fontWeight: 700, color: C.text1, minWidth: 110 }}>{STEP_LABEL[k]}</span>
                  <span style={{ color: st === "fail" ? C.red : C.text3, flex: 1, minWidth: 100 }}>
                    {st === "running" ? "Running…" : st === "pending" ? "Pending" : (steps[k]?.note || steps[k]?.error || (st === "pass" ? "완료" : st))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Card */}
      {result && (
        <div style={{ ...box, borderColor: result.productionReady ? "#059669" : C.gold }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>
            📋 Summary — {result.productionReady ? <span style={{ color: "#059669" }}>🟢 Production Validation PASS</span> : <span style={{ color: C.gold }}>⚠️ 일부 실패</span>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.sm }}>
            {Object.entries(result.summary).map(([k, v]) => (
              <span key={k} style={{ padding: "2px 9px", borderRadius: R.full, fontSize: 10.5, fontWeight: 800, background: v === "PASS" ? "#05966922" : "#dc262622", color: v === "PASS" ? "#059669" : "#dc2626" }}>{k} {v}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.7 }}>
            소요 {(result.durationMs / 1000).toFixed(1)}s · 품질 {result.quality ?? "-"}점 · 비용 ₩{result.costKRW} · 재시도 {result.retry.count}{result.retry.recovered ? "(Recovered)" : ""}<br />
            {result.url && <>게시 URL: <a href={result.url} target="_blank" rel="noopener" style={{ color: C.brand }}>{result.url}</a></>}
          </div>
        </div>
      )}

      {/* Validation History */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🧾 Validation History ({history.length})</div>
        {history.length === 0 ? <div style={{ fontSize: 12, color: C.text3 }}>아직 검증 이력이 없습니다.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {history.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, padding: "3px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
                <span style={{ color: C.text4, minWidth: 88 }}>{new Date(r.at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span style={{ padding: "1px 6px", borderRadius: R.full, fontSize: 9, fontWeight: 800, background: r.productionReady ? "#05966922" : "#dc262622", color: r.productionReady ? "#059669" : "#dc2626" }}>{r.productionReady ? "PASS" : "FAIL"}</span>
                <span style={{ color: C.text1, flex: 1, minWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                <span style={{ color: C.text3 }}>{((r.durationMs || 0) / 1000).toFixed(1)}s · ₩{r.costKRW || 0} · 재시도 {r.retry?.count ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
