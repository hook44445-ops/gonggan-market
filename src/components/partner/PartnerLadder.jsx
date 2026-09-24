// 파트너 계단 — 지금 어디에 있고, 증빙을 하나 더 내면 받을 수 있는 공사가 얼마로 커지는지.
// 가입 완료 화면과 업체 화면(내 한도)이 같이 쓴다. 금액은 lib/partnerTier.js 의 bidLimit 에서 온다.
import { C } from "../../constants";
import { LADDER, limitText } from "../../lib/partnerTier";

const INK = "#1F2A24";
const MUTED = "#8C8577";
const GOLD = "#B08A3E";

export default function PartnerLadder({ current = "none", style }) {
  const at = Math.max(0, LADDER.findIndex(r => r.key === current));
  return (
    <div style={{ background: "#FFFDF8", border: "1px solid #EDE3CF", borderRadius: 18, padding: "6px 16px", ...style }}>
      {LADDER.map((r, i) => {
        const done = i < at;
        const now = i === at;
        const premium = r.key === "deposit";
        return (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
            borderTop: i === 0 ? "none" : "1px solid rgba(176,138,62,0.16)", opacity: done ? 0.55 : 1 }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800,
              background: now || done ? C.brand : "transparent", color: now || done ? "#fff" : GOLD,
              border: now || done ? "none" : `1px solid ${premium ? GOLD : "rgba(176,138,62,0.45)"}` }}>
              {now || done ? "✓" : i}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: now || premium ? 800 : 600, color: now ? C.brand : INK }}>
                {now ? `지금 · ${r.label.replace(/^\+ /, "")}` : r.label}
              </div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 1 }}>{r.note}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: now ? C.brand : INK, whiteSpace: "nowrap" }}>
              {i === LADDER.length - 1 ? `최대 ${limitText(r.limit)}` : limitText(r.limit)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
