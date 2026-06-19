// Phase 10 — 연속 활동(Streak) 카드. 🔥 N일 연속 + 다음 보상 안내(표시 전용).
//   '매일 로그인'이 아니라 의미 있는 활동(견적·현장기록·계약·완료 등) 기준.
import { C, R, S } from "../../constants";
import { nextStreakTier, streakMessage } from "../../constants/growthPlus";

export default function StreakCard({ streak = 0, longest = 0 }) {
  const next = nextStreakTier(streak);
  const lit = streak > 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: S.lg,
      background: lit ? "linear-gradient(135deg,#FFF3E6,#FFEAD6)" : C.surface,
      border: `1px solid ${lit ? "#FFD9B0" : C.bgWarm}`,
      borderRadius: R.xl, padding: `${S.lg}px ${S.xl}px`, marginBottom: 16,
    }}>
      <div style={{ fontSize: 30, lineHeight: 1, filter: lit ? "none" : "grayscale(1) opacity(0.5)" }}>🔥</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: C.text3, fontWeight: 600, marginBottom: 2 }}>연속 활동</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, lineHeight: 1.15 }}>
          {streak}일 <span style={{ fontSize: 13, fontWeight: 700, color: lit ? "#C9761E" : C.text3 }}>연속</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.text3, marginTop: 3 }}>{streakMessage(streak)}</div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {next ? (
          <>
            <div style={{ fontSize: 10.5, color: C.text4, marginBottom: 2 }}>다음 보상 {next.days}일</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.brand }}>+{next.xp} XP</div>
          </>
        ) : (
          <div style={{ fontSize: 12, fontWeight: 800, color: C.brand }}>최고 단계</div>
        )}
        {longest > 0 && (
          <div style={{ fontSize: 10.5, color: C.text4, marginTop: 4 }}>최장 {longest}일</div>
        )}
      </div>
    </div>
  );
}
