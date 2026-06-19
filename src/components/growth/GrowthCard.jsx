// 업체 성장 카드 (대시보드 상단) — Dark Navy Glass / Premium.
//   LV 표시 + 현재 레벨 진행도(10칸) + 다음 LV까지 남은 XP.
//   카드 클릭 시 성장 안내 모달(onClick)을 연다.
import XpProgressBar from "./XpProgressBar";

export default function GrowthCard({ level = 1, filledBlocks = 0, xpToNext = 0, isMax = false, onClick }) {
  return (
    <div
      onClick={onClick}
      role="button"
      aria-label="성장 안내 열기"
      style={{
        position: "relative", overflow: "hidden", cursor: "pointer",
        background: "linear-gradient(135deg,#0C1526 0%,#13203A 55%,#0B1A2E 100%)",
        borderRadius: 20, padding: "20px 22px", marginBottom: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 10px 30px rgba(7,14,28,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* 코너 글로우 */}
      <div style={{
        position: "absolute", top: -40, right: -30, width: 160, height: 160, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(91,157,249,0.22), transparent 70%)", pointerEvents: "none",
      }} />

      {/* 상단: LV + 안내 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "1.5px", color: "#7FA8E0" }}>LV.</span>
          <span style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: "#fff", letterSpacing: "-0.5px" }}>{level}</span>
        </div>
        <span style={{
          fontSize: 11, color: "rgba(255,255,255,0.5)",
          border: "1px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "4px 10px",
        }}>
          성장 안내 ›
        </span>
      </div>

      {/* 진행도 — SVG 블록 10칸 */}
      <XpProgressBar filled={filledBlocks} />

      {/* 하단: 다음 LV까지 남은 XP */}
      <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{isMax ? "최고 레벨" : "다음 LV까지"}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
          {isMax ? "MAX" : `${Number(xpToNext).toLocaleString()} XP`}
        </span>
      </div>
    </div>
  );
}
