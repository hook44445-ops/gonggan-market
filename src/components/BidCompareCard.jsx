// BidCompareCard — UX 편의성 고도화 Beta (입찰 비교 카드).
//   ⚠️ 표현 전용. 선택/상담 동작은 onSelect/onChat 콜백으로 그대로 위임(입찰·선택·계약 로직 무수정).
//   업체카드와 동일한 디자인 언어 + 공유 지표 컴포넌트(CompanyMetrics) 재사용 → 중복 UI 없음.
//   구성: 예상금액(최상단·최대 강조) → 업체 → KPI → Lv/XP → 배지 → 선택 버튼.
import { C, R, S, GRADE, SHADOW } from "../constants";
import { TempBadge } from "./common";
import { fmtMoney } from "../utils/calculations";
import { CompanyKpiTiles, CompanyLevelBar, CompanyMiniBadges } from "./company/CompanyMetrics";

export default function BidCompareCard({ bid, onChat, onSelect, selected = false }) {
  const company = bid.company ?? {};
  const g = GRADE(company.temp ?? 0);

  return (
    <div style={{
      display: "flex", background: C.surface, borderRadius: R.xl,
      marginBottom: S.md, border: `1px solid ${selected ? C.brand : C.bgWarm}`,
      boxShadow: SHADOW.card, overflow: "hidden",
    }}>
      {/* Grade accent */}
      <div style={{ width: 4, background: g.bar, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: `${S.xl}px ${S.xl}px ${S.lg}px` }}>
        {/* 예상금액 — 최우선(가장 먼저·가장 크게) */}
        <div style={{ fontSize: 12, color: C.text3, fontWeight: 700, marginBottom: 2 }}>예상금액</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.brand, lineHeight: 1.1 }}>{fmtMoney(bid.price)}</div>
        <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>예상 공사기간 {bid.period}일</div>

        <div style={{ height: 1, background: C.bgWarm, margin: `${S.lg}px 0` }} />

        {/* 업체 — 아바타 + 이름(2줄) + 온도 */}
        <div style={{ display: "flex", gap: S.md, alignItems: "flex-start" }}>
          <div style={{
            width: 46, height: 46, borderRadius: R.lg, flexShrink: 0,
            background: C.brandL, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 19, fontWeight: 800, color: C.brand,
          }}>{(company.name ?? "?")[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 800, color: C.text1, lineHeight: 1.3,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden", wordBreak: "break-word",
            }}>{company.name ?? "파트너"}</div>
            <CompanyMiniBadges company={company} />
          </div>
          <TempBadge temp={company.temp ?? 36.5} info />
        </div>

        {/* 비교 핵심 지표 (공유 · 모든 카드 동일 위치/크기) */}
        <CompanyKpiTiles company={company} />

        {/* 성장 — Lv + XP (공유) */}
        <CompanyLevelBar company={company} />

        {/* 업체 한마디 — 최대 2줄 */}
        {bid.comment && (
          <div style={{
            marginTop: S.md, fontSize: 12.5, color: C.text2, lineHeight: 1.6, fontStyle: "italic",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>“{bid.comment}”</div>
        )}

        {/* 버튼 — 모든 카드 동일 위치. 선택 시 ✔ 선택됨 */}
        <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
          <button onClick={onChat} style={{
            flex: "0 0 96px", padding: "13px", background: C.surface, color: C.text2,
            border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14,
            minHeight: 48, cursor: "pointer",
          }}>💬 상담</button>
          <button onClick={onSelect} style={{
            flex: 1, padding: "13px", borderRadius: R.lg, fontWeight: 800, fontSize: 15, minHeight: 48,
            cursor: "pointer",
            background: selected ? C.brandL : C.brand,
            color: selected ? C.brand : "#fff",
            border: selected ? `1.5px solid ${C.brand}` : "none",
            boxShadow: selected ? "none" : `0 3px 12px ${C.brand}44`,
          }}>{selected ? "✔ 선택됨" : "이 업체로 선택하기"}</button>
        </div>
      </div>
    </div>
  );
}
