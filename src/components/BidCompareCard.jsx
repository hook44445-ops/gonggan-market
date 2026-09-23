// BidCompareCard — 업체를 고르는 순간의 카드.
//   ⚠️ 표현 전용. 선택/상담 동작은 onSelect/onChat 콜백으로 그대로 위임(입찰·선택·계약 로직 무수정).
//   순서: 사진 → 업체 → 전문분야 → 금액 → 왜 이 업체 → 지표(CompanyMetrics 재사용) → 버튼.
//   사진은 업체가 올린 진짜 시공 사례가 있으면 그것, 없으면 자재 이미지에 「분위기 이미지」라고 밝힌다.
import { C, R, S } from "../constants";
import { TempBadge } from "./common";
import { fmtMoney } from "../utils/calculations";
import { CompanyMiniBadges, responseValue, deriveLevel } from "./company/CompanyMetrics";
import { FoldText } from "./v3/ui";
import { cardVisual, whyThisCompany, specialtyChips } from "../lib/companyLook";

export default function BidCompareCard({ bid, onChat, onSelect, onOpenCompany, selected = false, tags = [], id, photos = [], requestText = "" }) {
  const company = bid.company ?? {};
  const visual = cardVisual(company, photos);
  const why = whyThisCompany(company);
  const { chips, matchedCount } = specialtyChips(company, requestText);
  const level = deriveLevel(company).level;
  const isWork = visual.kind === "work";

  return (
    <div id={id} className="gg-rise" style={{
      background: C.surface, borderRadius: R.xl, scrollMarginTop: 80,
      marginBottom: S.md, border: `1px solid ${selected ? C.brand : C.bgWarm}`,
      boxShadow: selected ? `0 0 0 1px ${C.brand}` : "0 1px 2px rgba(31,42,36,0.04)", overflow: "hidden",
    }}>
      {/* 사진 — 카드에서 가장 먼저 눈에 들어오는 자리 */}
      <div onClick={isWork && onOpenCompany ? onOpenCompany : undefined}
        style={{ position: "relative", background: C.bgWarm, cursor: isWork && onOpenCompany ? "pointer" : "default" }}>
        {/* 사진이 제 크기대로 버텨 칸을 밀어내지 않게(minHeight:0 + overflow) */}
        <div style={{ display: "grid", gridTemplateColumns: visual.photos.length > 1 ? "2fr 1fr" : "1fr", gap: 2, height: 150, overflow: "hidden" }}>
          <img src={visual.photos[0]} alt="" loading="lazy"
            style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0, objectFit: "cover", display: "block" }} />
          {visual.photos.length > 1 && (
            <div style={{ display: "grid", gridTemplateRows: `repeat(${Math.min(2, visual.photos.length - 1)}, 1fr)`, gap: 2, minHeight: 0, overflow: "hidden" }}>
              {visual.photos.slice(1, 3).map((u) => (
                <img key={u} src={u} alt="" loading="lazy"
                  style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0, objectFit: "cover", display: "block" }} />
              ))}
            </div>
          )}
        </div>
        {/* 아래쪽만 살짝 어둡게 — 글자가 사진 위에서도 읽히게(테두리 없는 절제된 표기) */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(to top, rgba(31,42,36,0.55) 0%, rgba(31,42,36,0.12) 34%, rgba(31,42,36,0) 62%)" }} />
        {/* 비교 표시(최저가·가장 빨라요·평판 최고) — 둘까지만, 얇은 테두리 */}
        {tags.length > 0 && (
          <div style={{ position: "absolute", top: 10, left: 12, display: "flex", gap: 5 }}>
            {tags.slice(0, 2).map((t) => (
              <span key={t} style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", letterSpacing: "0.02em",
                background: "rgba(31,42,36,0.46)", border: "1px solid rgba(255,255,255,0.34)", backdropFilter: "blur(4px)",
                borderRadius: R.full, padding: "3px 10px", whiteSpace: "nowrap" }}>{t}</span>
            ))}
          </div>
        )}
        {/* 이 사진이 무엇인지 분명히 — 없는 사례를 있는 척하지 않는다 */}
        <span style={{ position: "absolute", left: 13, bottom: 11, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
          color: "rgba(255,255,255,0.92)", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>
          {visual.caption}{isWork && onOpenCompany ? " ›" : ""}
        </span>
      </div>

      <div style={{ padding: "18px 20px 20px" }}>
        {/* 업체 — 이름 한 줄, 온도는 오른쪽에 조용히 */}
        <div style={{ display: "flex", gap: S.sm, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: C.text1, lineHeight: 1.35, letterSpacing: "-0.01em", wordBreak: "break-word" }}>
                {company.name ?? "파트너"}
              </span>
              <span style={{ fontSize: 11, color: C.text4, fontWeight: 600, letterSpacing: "0.04em" }}>Lv.{level}</span>
            </div>
            {/* 전문분야 — 칩을 늘어놓지 않고 한 줄 글로. 내가 요청한 공사만 진하게. */}
            {chips.length > 0 && (
              <div style={{ fontSize: 12.5, color: C.text3, marginTop: 3, lineHeight: 1.6, wordBreak: "keep-all" }}>
                {chips.map((s, i) => (
                  <span key={s}>
                    {i > 0 && <span style={{ color: C.bgWarm, margin: "0 5px" }}>·</span>}
                    <span style={i < matchedCount ? { color: C.brand, fontWeight: 700 } : undefined}>{s}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <TempBadge temp={company.temp ?? 36.5} info />
        </div>

        <div style={{ marginTop: 6 }}><CompanyMiniBadges company={company} /></div>

        {/* 금액 — 카드에서 가장 큰 글자 하나 */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: S.md, marginTop: 14 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: C.text1, lineHeight: 1.05, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
            {fmtMoney(bid.price)}
          </span>
          <span style={{ fontSize: 12.5, color: C.text3, whiteSpace: "nowrap" }}>공사 {bid.period}일</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.text4, marginTop: 4 }}>현장 확인 뒤 최종 견적서로 확정돼요</div>

        {/* 왜 이 업체 — 실제 기록이 있을 때만, 얇은 선 아래 한 줄 */}
        {why.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.bgWarm}`, marginTop: 14, paddingTop: 10, fontSize: 12, color: C.text2, lineHeight: 1.6 }}>
            {why.map((w, i) => (
              <span key={w}>{i > 0 && <span style={{ color: C.bgWarm, margin: "0 6px" }}>·</span>}{w}</span>
            ))}
          </div>
        )}

        {/* 비교 지표 — 모든 카드에서 같은 자리·같은 크기. 타일·XP 막대 대신 숫자만 조용히. */}
        <div style={{ display: "flex", marginTop: 14, borderTop: `1px solid ${C.bgWarm}`, paddingTop: 12 }}>
          {[
            { v: company.rating > 0 ? company.rating.toFixed(1) : "—", k: "후기" },
            { v: `${company.completedJobs ?? 0}`, k: "시공" },
            { v: responseValue(company), k: "응답" },
          ].map((t, i) => (
            <div key={t.k} style={{ flex: "1 1 0", minWidth: 0, textAlign: "center",
              borderLeft: i === 0 ? "none" : `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text1, lineHeight: 1.2, letterSpacing: "-0.01em",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 4px" }}>{t.v}</div>
              <div style={{ fontSize: 10.5, color: C.text4, marginTop: 4, letterSpacing: "0.04em" }}>{t.k}</div>
            </div>
          ))}
        </div>

        {/* 업체 한마디 — 최대 2줄 */}
        {bid.comment && (
          <div style={{ marginTop: S.md }}>
            <FoldText text={`“${bid.comment}”`} lines={2} minChars={70}
              style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.7 }} />
          </div>
        )}

        {/* 버튼 — 모든 카드 동일 위치. 선택 시 ✔ 선택됨 */}
        <div style={{ display: "flex", gap: S.sm, marginTop: 18 }}>
          <button onClick={onChat} style={{
            flex: "0 0 92px", padding: "12px", background: "none", color: C.text2,
            border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 600, fontSize: 13.5,
            minHeight: 46, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em",
          }}>상담</button>
          <button onClick={onSelect} style={{
            flex: 1, padding: "12px", borderRadius: R.lg, fontWeight: 700, fontSize: 14.5, minHeight: 46,
            cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em",
            background: selected ? C.brandL : C.brand,
            color: selected ? C.brand : "#fff",
            border: selected ? `1px solid ${C.brand}` : "1px solid transparent",
            boxShadow: "none",
          }}>{selected ? "선택한 업체" : "이 업체로 선택"}</button>
        </div>
      </div>
    </div>
  );
}
