// Space OS · 성실견적 분석 결과 (견적 제출 후 표시)
//   점수 + 획득 XP + 잘 작성한 항목(✔) + 보완하면 좋은 항목(□ +XP 가능).
//   결과는 "인정"의 언어로 전달한다(평가·질책 아님).
import { C } from "../../constants";

export default function EstimateAnalysisResult({ result, onClose }) {
  if (!result) return null;
  const { score, gainedXp, tier, strongItems = [], improveItems = [] } = result;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 620,
        background: "rgba(6,11,22,0.62)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px",
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
        {/* 점수 + XP */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7FA8E0", marginBottom: 8 }}>성실견적 분석</div>
          <div style={{ fontSize: 46, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
            {score}<span style={{ fontSize: 18, color: "rgba(255,255,255,0.5)" }}> 점</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>{tier}</div>
          <div style={{
            display: "inline-block", marginTop: 14, padding: "8px 18px", borderRadius: 999,
            background: "linear-gradient(135deg,#5B9DF9,#3D7FE0)", color: "#fff", fontSize: 16, fontWeight: 900,
          }}>
            기록 인정 +{gainedXp} XP
          </div>
        </div>

        {/* 인정받은 기록 — 왜 XP가 지급되었는지 행동 단위로 표시 */}
        {strongItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>인정받은 기록</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {strongItems.map((it) => (
                <div key={it.key} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 900, color: "#7FD0A8", minWidth: 56 }}>
                    +{it.earnedXp} XP
                  </span>
                  <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.55 }}>
                    {it.reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 보완하면 좋은 항목 */}
        {improveItems.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.55)", marginBottom: 9 }}>보완하면 좋은 항목</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {improveItems.slice(0, 4).map((it) => (
                <div key={it.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.78)" }}>□ {it.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#5B9DF9" }}>+{it.potentialXp} XP 가능</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, textAlign: "center", marginBottom: 16 }}>
          기록은 성실한 사람을 보호하기 위해 존재합니다.<br />좋은 기록은 좋은 평판보다 오래갑니다.
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
