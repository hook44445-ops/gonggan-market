// 업체 성장 안내 모달 — 성장 카드 클릭 시 표시.
//   Phase 9: 한 화면 = 하나의 메시지. 이 모달은 '성장'만 설명한다.
//   (기록/추천업체/A·S/About 철학은 각자 어울리는 화면에서 별도로 노출 — SPACE_OS_PHILOSOPHY)
//   경험치 바: 레벨 아래에 항상 표시. 현재 레벨→다음 레벨 진행률(filledBlocks)을 게임처럼
//             고정 칸으로 보여 "조금만 더 하면 레벨업"을 한눈에 느끼게 한다(표시 전용).
import XpProgressBar from "./XpProgressBar";

export default function GrowthModal({ open, onClose, level = 1, totalXp = 0, xpToNext = 0, filledBlocks = 0, isMax = false }) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        background: "rgba(6,11,22,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 360,
          background: "linear-gradient(135deg,#0C1526,#13203A)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: "28px 24px",
          boxShadow: "0 20px 60px rgba(5,10,22,0.6)",
        }}
      >
        <div style={{ fontSize: 38, textAlign: "center", marginBottom: 14 }}>🌱</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", textAlign: "center", marginBottom: 14 }}>
          성장은 경쟁이 아닙니다
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.9, color: "rgba(255,255,255,0.72)", textAlign: "center", marginBottom: 22 }}>
          프로젝트를 성실하게 수행할수록<br />Space OS가<br />여러분의 노력을 XP로 인정합니다.<br /><br />
          XP는 감소하지 않는<br />업체의 성장 기록입니다.
        </div>

        {/* LV + 경험치 바 — 레벨 아래 항상 표시 · 다음 레벨까지의 진행률 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, marginBottom: 13 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "1.5px", color: "#7FA8E0" }}>LV.</span>
            <span style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: "#fff", letterSpacing: "-0.5px" }}>{level}</span>
          </div>

          <XpProgressBar filled={filledBlocks} />

          {/* 경험치 바 아래 — 현재 XP / 다음 LV까지 만 표시 */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>현재 XP</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>{Number(totalXp).toLocaleString()} XP</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>{isMax ? "최고 레벨" : "다음 LV까지"}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>{isMax ? "MAX" : `${Number(xpToNext).toLocaleString()} XP`}</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.7, marginBottom: 22 }}>
          성실한 기록일수록<br />더 많은 XP를 받을 수 있습니다.
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "14px", border: "none", borderRadius: 14,
            background: "linear-gradient(135deg,#5B9DF9,#3D7FE0)", color: "#fff",
            fontSize: 15, fontWeight: 800, cursor: "pointer",
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}
