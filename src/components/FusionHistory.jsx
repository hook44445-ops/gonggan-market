// ════════════════════════════════════════════════════════════════════
// FusionHistory — Fusion 실행 이력 패널 (Phase 31)
//   저장 시각·주제·모드·단계·소요·비용·성공여부를 목록으로 보여준다.
//   ⚠️ 표시 전용(additive · getFusionHistory 호출만) · 기존 로직 무변경.
// ════════════════════════════════════════════════════════════════════

import { C, R, S } from "../constants";
import { getFusionHistory, fusionStats } from "../lib/fusionHistory";

export default function FusionHistory({ tick = 0 }) {
  void tick; // 부모 상태 변경 시 재조회 트리거용.
  const hist = getFusionHistory();
  const stats = fusionStats();
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: S.sm }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>📜 Fusion History</div>
        <div style={{ fontSize: 11, color: C.text3 }}>
          오늘 {stats.todayRuns}회 · ₩{stats.todayCostKRW.toLocaleString()} · 성공률 {stats.successRate != null ? stats.successRate + "%" : "-"} · 평균 {stats.avgMs != null ? (stats.avgMs / 1000).toFixed(1) + "s" : "-"}
        </div>
      </div>
      {hist.length === 0 ? (
        <div style={{ fontSize: 12, color: C.text3, padding: "8px 0" }}>아직 Fusion 실행 이력이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {hist.slice(0, 15).map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, padding: "4px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
              <span style={{ color: C.text4, minWidth: 88 }}>{new Date(r.at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <span style={{ padding: "1px 6px", borderRadius: R.full, fontSize: 9, fontWeight: 800, background: r.ok ? "#05966922" : "#dc262622", color: r.ok ? "#059669" : "#dc2626" }}>{r.ok ? "성공" : "실패"}</span>
              <span style={{ color: C.text1, fontWeight: 600, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.topic || "(무제)"}</span>
              <span style={{ color: C.text3 }}>{r.mode} · {r.steps?.length || 0}단계 · {((r.totalMs || 0) / 1000).toFixed(1)}s · ₩{r.totalCostKRW || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
