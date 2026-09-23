// 업체 성장 카드 (대시보드 상단) — Dark Navy Glass / Premium.
//   숫자 레벨만 보여 주지 않는다: 지금이 어느 «단계»인지(씨앗→뿌리→줄기→나무→숲) 그림과 이름으로,
//   다음 레벨까지는 XP 대신 «공사 몇 건»이라는 행동으로 말한다.
//   XP·레벨 계산은 constants/growth.js 그대로(표시 전용). 카드 클릭 시 성장 안내 모달.
import XpProgressBar from "./XpProgressBar";
import { stageFor, nextStage, nextLevelHint } from "../../lib/growthStage";

export default function GrowthCard({ level = 1, filledBlocks = 0, totalXp = 0, xpToNext = 0, isMax = false, onClick }) {
  const stage = stageFor(level);
  const next = nextStage(level);

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

      {/* 상단: 단계 그림 + 단계 이름 · LV */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, flexShrink: 0, overflow: "hidden",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <img src={stage.art} alt="" width={56} height={56}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{stage.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#7FA8E0", letterSpacing: "0.06em" }}>LV.{level}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginTop: 3, lineHeight: 1.5 }}>{stage.line}</div>
        </div>
        <span style={{
          fontSize: 11, color: "rgba(255,255,255,0.5)", flexShrink: 0, alignSelf: "flex-start",
          border: "1px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "4px 10px",
        }}>
          성장 안내 ›
        </span>
      </div>

      {/* 진행도 — SVG 블록 10칸 */}
      <XpProgressBar filled={filledBlocks} />

      {/* 하단: 지금까지 쌓인 것 · 다음까지 무엇을 하면 되는지 */}
      <div style={{ marginTop: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>쌓인 기록</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{Number(totalXp).toLocaleString()} XP</div>
        </div>
        <div style={{ textAlign: "right", minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>
            {isMax ? "최고 단계" : next ? `다음 단계 · ${next.name}` : "다음 레벨"}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", lineHeight: 1.4 }}>
            {nextLevelHint({ xpToNext, isMax })}
          </div>
        </div>
      </div>

      {/* Space OS 한 줄 — 기록은 결국 나를 지켜준다 */}
      <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,0.08)",
        fontSize: 11.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
        기록은 신뢰가 되고, 신뢰는 다음 만남을 만듭니다.
      </div>
    </div>
  );
}
