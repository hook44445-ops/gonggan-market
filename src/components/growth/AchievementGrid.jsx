// Phase 12 — 업적 현황 그리드. 달성/미달성 뱃지를 평생 보관 형태로 표시(읽기 전용).
import { C, R, S } from "../../constants";
import { ACHIEVEMENTS } from "../../constants/growthPlus";

export default function AchievementGrid({ earnedIds }) {
  const earned = earnedIds instanceof Set ? earnedIds : new Set(earnedIds || []);
  const count = ACHIEVEMENTS.filter((a) => earned.has(a.id)).length;

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: S.lg }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text2 }}>업적 현황</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.brand }}>{count} / {ACHIEVEMENTS.length}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: S.sm }}>
        {ACHIEVEMENTS.map((a) => {
          const got = earned.has(a.id);
          return (
            <div key={a.id} title={a.desc} style={{
              textAlign: "center", borderRadius: R.lg, padding: "12px 6px",
              background: got ? C.brandL : C.bg,
              border: `1px solid ${got ? C.brandM : C.bgWarm}`,
              opacity: got ? 1 : 0.55,
            }}>
              <div style={{ fontSize: 22, lineHeight: 1, filter: got ? "none" : "grayscale(1)" }}>{got ? a.icon : "🔒"}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: got ? C.text1 : C.text4, marginTop: 6, lineHeight: 1.3 }}>{a.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: C.text4, marginTop: S.md }}>획득한 업적은 삭제되지 않고 평생 보관됩니다.</div>
    </div>
  );
}
