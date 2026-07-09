import { C, R, S, SHADOW } from "../../constants";

// PartnerTodoSummary — 파트너센터 '오늘의 운영 현황' 요약 카드 (표시 전용).
//   items: [{ key, icon, label, count, value, unit?, accent?, actionable?, onClick? }]
//     · count(숫자): 정렬·'처리 필요' 배지 판정용.   value: 화면 표시값(문자열 가능).
//     · actionable && count>0 → '처리 필요' 배지.    count>0 항목이 위로(표시 순서만).
//   신규 DB/API/조회/계산 없음(값은 호출부에서 전달). 확장은 items push 로만.
export default function PartnerTodoSummary({ items = [] }) {
  const list = items.filter(Boolean);
  if (list.length === 0) return null;

  // 표시 순서만: count>0 항목을 위로(원래 순서 보존, 안정 정렬). 데이터/값 변경 없음.
  const ordered = list
    .map((it, i) => ({ it, i, hot: Number(it.count) > 0 }))
    .sort((a, b) => (a.hot === b.hot ? a.i - b.i : a.hot ? -1 : 1))
    .map((x) => x.it);

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, border: `1px solid ${C.bgWarm}`,
      boxShadow: SHADOW.soft, padding: `${S.lg}px ${S.lg}px ${S.md}px`, marginBottom: S.lg }}>
      {/* 눌림/호버 UX — 새 CSS 파일 없이 컴포넌트 내 스코프 스타일(표시 전용). */}
      <style>{`
        .pcs-tile { transition: transform .08s ease, box-shadow .12s ease; -webkit-tap-highlight-color: transparent; }
        .pcs-tile:not(:disabled) { cursor: pointer; }
        .pcs-tile:not(:disabled):hover { box-shadow: ${SHADOW.soft}; }
        .pcs-tile:not(:disabled):active { transform: scale(0.97); }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: S.md }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>오늘의 운영 현황</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text3 }}>파트너센터 운영 요약</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: S.sm }}>
        {ordered.map((it) => {
          const n = Number(it.count);
          const isZero = !(n > 0);
          const alert = !!it.actionable && n > 0;
          return (
            <button key={it.key} className="pcs-tile" onClick={it.onClick} disabled={!it.onClick}
              style={{ textAlign: "left", background: C.surface2, border: `1px solid ${C.bgWarm}`,
                borderRadius: R.lg, padding: "12px 13px", fontFamily: "inherit",
                display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.text3,
                display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 13 }}>{it.icon}</span>{it.label}
                {alert && (
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3,
                    color: C.red, fontSize: 9.5, fontWeight: 800 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.red, display: "inline-block" }} />
                    처리 필요
                  </span>
                )}
              </span>
              <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1,
                color: isZero ? C.text4 : (it.accent ?? C.text1) }}>
                {it.value}
                {it.unit && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.text3, marginLeft: 2 }}>{it.unit}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
