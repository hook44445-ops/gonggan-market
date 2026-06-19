// Space OS · AI 코치 (견적 작성 중 라이브 제안)
//   AI 는 평가자가 아니라, 더 좋은 견적을 작성하도록 돕는 코치다.
//   현재 폼 상태를 분석해 보완하면 좋은 항목을 "제안형"으로 안내한다(강요 문구 없음).
import { C, R, S } from "../../constants";
import { analyzeEstimate } from "../../constants/spaceOs";

export default function EstimateCoachPanel({ form }) {
  const { score, gainedXp, tier, improveItems } = analyzeEstimate(form);
  const tips = improveItems.slice(0, 3);

  return (
    <div style={{
      borderRadius: 16, padding: "16px 18px", marginBottom: S.xl,
      background: "linear-gradient(135deg,#0C1526,#13203A)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 15 }}>🧭</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Space OS · 성실견적 코치</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{tier}</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: "#5B9DF9" }}>+{gainedXp} XP</span>
        </div>
      </div>

      {/* 성실도 진행 바 */}
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 12 }}>
        <div style={{
          width: `${score}%`, height: "100%", borderRadius: 999,
          background: "linear-gradient(90deg,#5B9DF9,#7FD0A8)", transition: "width 0.4s ease",
        }} />
      </div>

      {tips.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
          충분히 성실하게 작성하고 계세요. 고객이 이해하기 쉬운 좋은 견적이에요 ✨
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {tips.map((t) => (
            <div key={t.key} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#7FD0A8", fontSize: 12, marginTop: 2 }}>›</span>
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.6 }}>
                {t.coach}
                <span style={{ color: "#5B9DF9", fontWeight: 700 }}>{` (+${t.potentialXp} XP 가능)`}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
