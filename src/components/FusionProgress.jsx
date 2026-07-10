// ════════════════════════════════════════════════════════════════════
// FusionProgress — Fusion 순차 실행 진행률 + 단계별 결과 (Phase 31)
//   실행 중 1/5, 2/5 진행률과 각 단계 결과(모델/소요/비용/대체여부)를 보여준다.
//   ⚠️ 표시 전용(additive) · 기존 화면/로직 무변경.
// ════════════════════════════════════════════════════════════════════

import { C, R, S } from "../constants";

export default function FusionProgress({ progress = null, result = null }) {
  if (!progress && !result) return null;
  const total = result?.steps?.length || progress?.total || 0;
  const doneCount = result ? result.steps.length : (progress?.phase === "done" || progress?.phase === "failed" ? progress.index : (progress?.index || 1) - 1);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const steps = result ? result.steps : [];

  return (
    <div style={{ background: "#111827", borderRadius: R.lg, padding: "12px 14px", marginTop: S.md, color: "#e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>🧩 Fusion 실행</span>
        {progress && !result && (
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{progress.index}/{progress.total} · {progress.stage?.staff} ({progress.stage?.role}) {progress.phase === "running" ? "작업중…" : progress.phase === "done" ? "완료" : "실패"}</span>
        )}
        {result && <span style={{ fontSize: 11, color: result.ok ? "#6ee7b7" : "#fca5a5" }}>{result.ok ? "완료" : "실패"} · {result.mode} · {(result.totalMs / 1000).toFixed(1)}s · ₩{result.totalCostKRW}</span>}
      </div>
      {/* 진행률 바 */}
      <div style={{ height: 6, background: "#374151", borderRadius: 999, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: `${result ? 100 : pct}%`, height: "100%", background: result?.ok === false ? "#ef4444" : "#10b981", transition: "width .3s" }} />
      </div>
      {/* 단계별 결과 */}
      {steps.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, background: "#1f2937", borderRadius: R.md, padding: "5px 9px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, color: s.ok ? "#a7f3d0" : "#fca5a5", minWidth: 20 }}>{i + 1}</span>
              <span style={{ fontWeight: 700, minWidth: 90 }}>{s.staff}</span>
              <span style={{ color: "#9ca3af" }}>{s.role}</span>
              <span style={{ marginLeft: "auto", color: "#9ca3af" }}>
                {s.ok ? "✓" : "✕"} {(s.usedModel || s.model)?.split("/").pop()}{s.fallbackUsed ? " ↩대체" : ""} · {(s.latencyMs / 1000).toFixed(1)}s · ₩{s.costKRW} · {s.textLen}자
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
