import { C, R, S, SHADOW } from "../../constants";

// PartnerTodoSummary — 파트너센터 '오늘 할 일' 요약 카드 (표시 전용).
//   items: [{ key, icon, label, value, unit?, accent?, onClick? }]
//   파트너센터가 이미 보유한 집계를 props(items)로 받아 카드 그리드로만 렌더한다.
//   신규 DB/API/조회 없음 · 계산 없음(값은 호출부에서 전달). 향후 고객관리/정산/A/S/
//   일정/직원관리 지표를 items 에 '추가'만 하면 확장되는 운영툴 요약 슬롯이다.
export default function PartnerTodoSummary({ items = [] }) {
  const list = items.filter(Boolean);
  if (list.length === 0) return null;
  return (
    <div style={{ background: C.surface, borderRadius: R.xl, border: `1px solid ${C.bgWarm}`,
      boxShadow: SHADOW.soft, padding: `${S.lg}px ${S.lg}px ${S.md}px`, marginBottom: S.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: S.md }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>오늘 할 일</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text3 }}>파트너센터 운영 요약</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: S.sm }}>
        {list.map((it) => (
          <button key={it.key} onClick={it.onClick} disabled={!it.onClick}
            style={{ textAlign: "left", background: C.surface2, border: `1px solid ${C.bgWarm}`,
              borderRadius: R.lg, padding: "12px 13px", cursor: it.onClick ? "pointer" : "default",
              fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text3,
              display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 13 }}>{it.icon}</span>{it.label}
            </span>
            <span style={{ fontSize: 18, fontWeight: 900, color: it.accent ?? C.text1, lineHeight: 1.1 }}>
              {it.value}
              {it.unit && (
                <span style={{ fontSize: 11, fontWeight: 700, color: C.text3, marginLeft: 2 }}>{it.unit}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
