// Phase 13 — 성장 통계(분석 화면). 철학 설명 없이 수치/추이만 보여준다.
//   기존 데이터(레벨/누적 XP/임계값/완료/온도/연속활동)에서 파생 — 계산 로직 변경 없음.
import { C, R, S } from "../../constants";
import { LEVEL_THRESHOLDS, MAX_LEVEL } from "../../constants/growth";
import XpProgressBar from "./XpProgressBar";

export default function GrowthStatsPanel({ growth, streak, completedCount = 0, temp = 36.5 }) {
  const { level = 1, totalXp = 0, xpToNext = 0, filledBlocks = 0, isMax = false } = growth || {};
  const cur = streak?.current ?? 0;
  const longest = streak?.longest ?? 0;

  const Box = ({ label, value }) => (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center", background: C.bg, borderRadius: R.lg, padding: "12px 6px", border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: C.text1, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.text3, marginTop: 4, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text2, marginBottom: S.lg }}>성장 분석</div>

      {/* 요약 + 경험치 바 */}
      <div style={{ display: "flex", gap: S.sm, marginBottom: S.lg }}>
        <Box label="성장레벨" value={`LV.${level}`} />
        <Box label="누적 XP" value={Number(totalXp).toLocaleString()} />
        <Box label={isMax ? "최고 레벨" : "다음 LV까지"} value={isMax ? "MAX" : `${Number(xpToNext).toLocaleString()}`} />
      </div>
      <div style={{ marginBottom: S.xl }}>
        <XpProgressBar filled={filledBlocks} color={C.brand} track={C.bgWarm} height={14} />
      </div>

      {/* 레벨 로드맵 — 임계값 기반(레벨업 히스토리/성장 단계) */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>레벨 로드맵</div>
      <div style={{ marginBottom: S.xl }}>
        {LEVEL_THRESHOLDS.map((th, i) => {
          const lv = i + 1;
          const reached = totalXp >= th;
          const isCurrent = lv === level;
          return (
            <div key={lv} style={{
              display: "flex", alignItems: "center", gap: S.md, padding: "7px 0",
              borderBottom: i < MAX_LEVEL - 1 ? `1px solid ${C.bgWarm}` : "none",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800,
                background: isCurrent ? C.brand : reached ? C.brandL : C.bg,
                color: isCurrent ? "#fff" : reached ? C.brand : C.text4,
                border: `1px solid ${isCurrent ? C.brand : reached ? C.brandM : C.bgWarm}`,
              }}>{lv}</div>
              <div style={{ flex: 1, fontSize: 12.5, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? C.text1 : reached ? C.text2 : C.text4 }}>
                LV.{lv}{isCurrent ? " · 현재" : ""}
              </div>
              <div style={{ fontSize: 11.5, color: C.text4 }}>{Number(th).toLocaleString()} XP</div>
            </div>
          );
        })}
      </div>

      {/* 보조 지표 — 완료·공간온도·연속활동 */}
      <div style={{ display: "flex", gap: S.sm }}>
        <Box label="완료 프로젝트" value={`${completedCount}건`} />
        <Box label="공간온도" value={`${Math.round(temp)}°`} />
        <Box label="연속 활동" value={`${cur}일`} />
      </div>
      {longest > 0 && (
        <div style={{ fontSize: 11, color: C.text4, marginTop: S.md, textAlign: "right" }}>최장 연속 활동 {longest}일</div>
      )}
    </div>
  );
}
