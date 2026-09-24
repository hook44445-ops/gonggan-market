// 파트너 계단 — 지금 어디에 있고, 증빙을 하나 더 내면 받을 수 있는 공사가 얼마로 커지는지.
// 가입 완료 화면과 업체 화면(내 한도)이 같이 쓴다. 금액은 lib/partnerTier.js 의 bidLimit 에서 온다.
import { C } from "../../constants";
import { LADDER, limitText, bidLimit, nextUnlock, ladderKeyOf, maxedText } from "../../lib/partnerTier";

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
        const premium = r.key === "premium";
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

// 가볍게 보여 줄 때(가입 직후) — 「지금 얼마까지 → 다음 한 가지만 내면 얼마」 한 줄.
// 대표: 「가입은 쉬워 보이게」. 전체 계단·비율은 업체 화면(내 한도)에서 보여 준다.
export function PartnerNextStep({ state = {}, style }) {
  const now = bidLimit(state);
  const next = nextUnlock(state);
  const at = Math.max(0, LADDER.findIndex(r => r.key === ladderKeyOf(state)));
  return (
    <div style={{ background: "#FFFDF8", border: "1px solid #EDE3CF", borderRadius: 18, padding: "18px 18px 16px", ...style }}>
      <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>지금 공사 1건</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: INK, letterSpacing: "-0.02em", marginTop: 2 }}>
        {now > 0 ? <>{limitText(now)}<span style={{ fontSize: 15, fontWeight: 700, color: MUTED }}>까지</span></> : <span style={{ fontSize: 20 }}>카드 보기 · 입찰 잠김</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "14px 0 12px" }} aria-hidden="true">
        {LADDER.map((r, i) => (
          <span key={r.key} style={{ flex: 1, height: 4, borderRadius: 2,
            background: i <= at ? C.brand : (r.key === "premium" || r.key === "license") ? "rgba(176,138,62,0.35)" : "#E8E1D3" }} />
        ))}
      </div>
      {next ? (
        <div style={{ fontSize: 13.5, color: INK, lineHeight: 1.6 }}>
          <b style={{ fontWeight: 800 }}>{next.ask.replace(/\(.*\)/, "")}</b>을 내면 {next.contract
            ? <><b style={{ fontWeight: 800, color: GOLD }}>계약(결제)</b>이 열려요 — 선택되면 바로 계약</>
            : <><b style={{ fontWeight: 800, color: GOLD }}>{limitText(next.to)}</b>까지</>}
        </div>
      ) : (
        <div style={{ fontSize: 13.5, color: INK }}>{maxedText(state)}</div>
      )}
      <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>서류는 원할 때, 하나씩 — 최대 1억원까지 커져요</div>
    </div>
  );
}
