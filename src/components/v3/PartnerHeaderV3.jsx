// ─────────────────────────────────────────────────────
// 파트너센터 헤더 v3 — 기존 3개 카드를 하나로 합친 조밀 버전.
//
// v2 는 탭 내용 위에 GrowthCard(레벨/XP) · PartnerTodoSummary(오늘 할 일 4칸) ·
// StreakCard(연속 활동)가 세로로 쌓여, 정작 일하는 영역(진행중 목록)이
// 한 화면 아래로 밀려 있었다.
//
// v3 는 같은 정보를 유지하되
//  · 레벨/XP/연속활동을 한 카드 안의 '상태 줄'로 압축하고
//  · 오늘 할 일 4개는 탭 가능한 타일 한 줄로 내려 바로 이동하게 한다.
// 정보는 하나도 버리지 않고 높이만 줄이는 것이 목적.
// ─────────────────────────────────────────────────────
import { C, R, S, SHADOW } from "../../constants";
import Icon from "../common/Icon";
import { Progress } from "./ui";

export default function PartnerHeaderV3({
  level = 1,
  totalXp = 0,
  xpToNext = 0,
  isMax = false,
  streak = 0,
  temp = 36.5,
  todos = [],
  onGrowth,
}) {
  const pct = isMax ? 100 : (totalXp + xpToNext > 0 ? Math.round((totalXp / (totalXp + xpToNext)) * 100) : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: S.md }}>
      {/* 상태 카드 — 레벨 · XP · 공간온도 · 연속활동을 한 면에 */}
      <div
        onClick={onGrowth}
        style={{ position: "relative", overflow: "hidden", borderRadius: R.xl, cursor: onGrowth ? "pointer" : "default",
          background: `linear-gradient(135deg, ${C.brand}, ${C.brandD})`, color: "#fff",
          padding: `${S.xl}px ${S.xl}px ${S.lg}px`, boxShadow: SHADOW.brand }}
      >
        <div aria-hidden style={{ position: "absolute", right: -50, top: -60, width: 160, height: 160,
          borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "baseline", gap: S.sm, marginBottom: S.md }}>
          <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>LV.</span>
          <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{level}</span>
          <span style={{ marginLeft: "auto", fontSize: 11.5, opacity: 0.8 }}>
            {isMax ? "최고 레벨" : `다음 LV까지 ${Number(xpToNext).toLocaleString()} XP`}
          </span>
        </div>

        {/* XP 진행 — 흰 계열로 그라데이션 위에서도 읽히게 */}
        <div style={{ height: 6, borderRadius: R.full, background: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: R.full,
            background: "rgba(255,255,255,0.92)", transition: "width .4s ease" }} />
        </div>

        {/* 상태 칩 — 온도 / 연속활동 */}
        <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
          <span style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: R.full, padding: "5px 11px", fontSize: 11.5, fontWeight: 700 }}>
            공간온도 {Number(temp).toFixed(1)}°
          </span>
          <span style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: R.full, padding: "5px 11px", fontSize: 11.5, fontWeight: 700 }}>
            {streak > 0 ? `${streak}일 연속 활동` : "오늘 첫 활동 시작"}
          </span>
        </div>
      </div>

      {/* 오늘 할 일 — 탭하면 해당 탭으로. 4칸 한 줄로 압축 */}
      {todos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${todos.length}, 1fr)`, gap: S.sm }}>
          {todos.map((t) => (
            <div key={t.key} onClick={t.onClick}
              style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg,
                padding: `${S.md}px ${S.xs}px`, textAlign: "center", cursor: "pointer", boxShadow: SHADOW.soft }}>
              <div style={{ marginBottom: 4 }}>
                <Icon emoji={t.icon} size={15} color={C.text3} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.1,
                color: Number(String(t.value).replace(/[^0-9]/g, "")) > 0 ? C.brand : C.text4 }}>
                {t.value}
              </div>
              <div style={{ fontSize: 10.5, color: C.text3, marginTop: 3, whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
