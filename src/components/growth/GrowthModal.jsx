// 업체 성장 안내 모달 — 성장 카드 클릭 시 표시.
//   한 화면 = 하나의 메시지. 이 모달은 '성장'만 설명한다.
//   구조: 지금 단계(그림) → 다섯 단계 여정 → 무엇이 기록으로 쌓이는지(XP 상수에서 뽑음).
//   XP·레벨 계산은 constants/growth.js 그대로(표시 전용). 없는 보상은 약속하지 않는다.
import XpProgressBar from "./XpProgressBar";
import { GROWTH_STAGES, stageFor, stageIndex, nextLevelHint, xpSources } from "../../lib/growthStage";

export default function GrowthModal({ open, onClose, level = 1, totalXp = 0, xpToNext = 0, filledBlocks = 0, isMax = false }) {
  if (!open) return null;

  const stage = stageFor(level);
  const cur = stageIndex(level);
  const sources = xpSources();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        background: "rgba(6,11,22,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380, maxHeight: "86vh", overflowY: "auto",
          background: "linear-gradient(135deg,#0C1526,#13203A)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: "26px 22px",
          boxShadow: "0 20px 60px rgba(5,10,22,0.6)",
        }}
      >
        {/* 지금 단계 — 그림 하나 */}
        <img src={stage.art} alt="" width={96} height={96}
          style={{ width: 96, height: 96, borderRadius: 24, objectFit: "cover", display: "block", margin: "0 auto 12px",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#7FA8E0", letterSpacing: "0.1em", marginBottom: 5 }}>LV.{level}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{stage.name}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 6, lineHeight: 1.7 }}>{stage.line}</div>
        </div>

        {/* 진행도 + 다음까지 */}
        <XpProgressBar filled={filledBlocks} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>쌓인 기록 {Number(totalXp).toLocaleString()} XP</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{nextLevelHint({ xpToNext, isMax })}</span>
        </div>

        {/* 다섯 단계 여정 — 지나온 단계는 밝게, 남은 단계는 흐리게 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {GROWTH_STAGES.map((s, i) => (
            <div key={s.id} style={{ flex: 1, textAlign: "center", opacity: i <= cur ? 1 : 0.38 }}>
              <img src={s.art} alt="" width={44} height={44}
                style={{ width: "100%", maxWidth: 44, height: "auto", aspectRatio: "1", borderRadius: 12, objectFit: "cover",
                  display: "block", margin: "0 auto 5px",
                  border: i === cur ? "1.5px solid #7FA8E0" : "1px solid rgba(255,255,255,0.08)" }} />
              <div style={{ fontSize: 10.5, fontWeight: i === cur ? 800 : 600, color: i === cur ? "#fff" : "rgba(255,255,255,0.55)" }}>{s.name}</div>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>LV.{s.levels[0]}–{s.levels[1]}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", textAlign: "center", lineHeight: 1.7, marginBottom: 20 }}>
          XP는 줄지 않습니다. 단계도 내려가지 않습니다.
        </div>

        {/* 무엇이 기록으로 쌓이는지 — 숫자는 상수에서 그대로 */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", marginBottom: 10 }}>무엇이 기록이 되나요</div>
          {sources.map(s => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0",
              fontSize: 12.5, color: "rgba(255,255,255,0.72)" }}>
              <span>{s.label}</span>
              <span style={{ fontWeight: 700, color: "#7FA8E0" }}>+{s.xp} XP</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8, lineHeight: 1.6 }}>
            견적서는 성실하게 쓸수록 더 받습니다. 공사 한 건을 끝까지 기록하면 280 XP입니다.
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "14px", border: "none", borderRadius: 14,
            background: "linear-gradient(135deg,#5B9DF9,#3D7FE0)", color: "#fff",
            fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}
