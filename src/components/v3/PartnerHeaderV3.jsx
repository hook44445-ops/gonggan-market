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
import { LevelEmblem } from "../TrustEmblems";
import { stageFor } from "../../lib/growthStage";

// 「내 한도 · 서류」 가족(힉스필드 3-6) — 역할 색(남색)과 상관없이 깊은 초록 · 아이보리 · 금 선
const INK = "#F4EFE4";
const GOLD = "#D6A756";
const DEEP = "#0E2B1D";
const GOLD_LINE = "rgba(214,167,86,0.35)";

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
      {/* 상태 카드 — 레벨 엠블럼 · XP · 공간온도 · 연속활동을 한 면에 */}
      <div
        onClick={onGrowth}
        style={{ position: "relative", overflow: "hidden", borderRadius: R.xl, cursor: onGrowth ? "pointer" : "default",
          background: `${DEEP} url(/images/limit/hero.webp) right center / cover no-repeat`, color: INK,
          padding: `${S.lg}px ${S.xl}px ${S.lg}px`, boxShadow: "0 8px 22px rgba(14,43,29,0.22)" }}
      >
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none",
          background: `linear-gradient(90deg, ${DEEP} 0%, rgba(14,43,29,0.88) 55%, rgba(14,43,29,0.35) 100%)` }} />

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.md }}>
            <LevelEmblem level={level} size={44} large />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: GOLD, fontWeight: 700, letterSpacing: "0.06em" }}>{stageFor(level).name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>LV.</span>
                <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{level}</span>
              </div>
            </div>
            <span style={{ marginLeft: "auto", fontSize: 11.5, color: "rgba(244,239,228,0.78)", alignSelf: "flex-end" }}>
              {isMax ? "최고 레벨" : `다음 LV까지 ${Number(xpToNext).toLocaleString()} XP`}
            </span>
          </div>

          {/* XP 진행 — 금색 */}
          <div style={{ height: 6, borderRadius: R.full, background: "rgba(244,239,228,0.16)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: R.full,
              background: GOLD, transition: "width .4s ease" }} />
          </div>

          {/* 상태 칩 — 온도 / 연속활동 */}
          <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
            {[`공간온도 ${Number(temp).toFixed(1)}°`, streak > 0 ? `${streak}일 연속 활동` : "오늘 첫 활동 시작"].map(t => (
              <span key={t} style={{ background: "rgba(214,167,86,0.10)", border: `1px solid ${GOLD_LINE}`,
                borderRadius: R.full, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, color: INK }}>
                {t}
              </span>
            ))}
          </div>
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
