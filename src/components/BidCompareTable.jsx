// 견적 나란히 비교 — 표 하나로 «금액 말고 무엇이 다른가»를 본다.
//
// 왜(2026-09-30 본질 점검 ①): 입찰 카드는 «금액 + 공사 N일» 만 크게 보였다.
// 업체가 입찰할 때 이미 적어 낸 주요 자재(bids.material_note)와 한마디(bids.comment)가
// 화면에 없어서, 고객은 덜 아는 상태에서 금액으로 골랐다.
//
//   ⚠️ 표현 전용. 선택·상담은 콜백으로 그대로 위임한다(입찰·선택·계약 로직 무수정).
//   값은 전부 src/lib/bidTable.js 가 만든다. 이 파일은 그리기만 한다.
//   빈 칸을 흐리게 «안 적음»으로 보여 주는 것이 이 화면의 핵심이다 — 가려 주면 비교가 아니라 광고가 된다.
import { C, R, S } from "../constants";
import { compareBids, MAX_COMPARE } from "../lib/bidTable";

// 긴 글(자재·한마디)이 표 높이를 밀어내지 않게 3줄에서 자른다. 전체 글은 카드에서 본다.
const clamp3 = {
  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
  overflow: "hidden", overflowWrap: "anywhere",
};

function Cell({ c, wrap }) {
  if (c.missing) return <span style={{ color: C.text4, fontSize: 12.5, fontStyle: "italic" }}>{c.text}</span>;
  return (
    <span>
      <span style={{ color: c.best ? C.brand : C.text1, fontWeight: c.best ? 800 : 700, fontSize: 13.5,
        ...(wrap ? clamp3 : null) }}>{c.text}</span>
      {c.best && c.bestText && <span style={{ display: "block", fontSize: 10.5, color: C.brand, fontWeight: 800, marginTop: 2 }}>{c.bestText}</span>}
      {c.sub && <span style={{ display: "block", fontSize: 10.5, color: C.text3, marginTop: 2 }}>{c.sub}</span>}
    </span>
  );
}

export default function BidCompareTable({ bids = [], onChat, onSelect, onOpenBid }) {
  const { cols, rows, notes } = compareBids(bids);
  if (cols.length < 2) return null;   // 한 곳은 «비교»가 아니다

  const grid = `84px repeat(${cols.length}, minmax(0, 1fr))`;
  const line = `1px solid ${C.bgWarm}`;

  return (
    <div style={{ background: C.surface, border: line, borderRadius: R.lg, overflow: "hidden", marginBottom: S.md }}>
      <div style={{ padding: "11px 14px", borderBottom: line, background: C.brandL }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.brandD }}>먼저 누구를 부를까 · {cols.length}곳</div>
        <div style={{ fontSize: 11.5, color: C.brand, marginTop: 2 }}>자재 · 기간 · 증빙을 보고 2~3곳만 고르세요</div>
      </div>

      {/* 업체 이름 줄 */}
      <div style={{ display: "grid", gridTemplateColumns: grid, background: C.surface2, borderBottom: line }}>
        <div style={{ padding: "9px 10px" }} />
        {cols.map(c => (
          <button key={c.id} onClick={() => onOpenBid?.(c.id)}
            style={{ padding: "9px 8px", borderLeft: line, minWidth: 0, background: "none", border: "none",
              borderLeftWidth: 1, borderLeftStyle: "solid", cursor: onOpenBid ? "pointer" : "default",
              fontFamily: "inherit", textAlign: "left" }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: C.text1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
            {c.rating && <span style={{ display: "block", fontSize: 10.5, color: C.gold, fontWeight: 700, marginTop: 1 }}>★ {c.rating.toFixed(1)}</span>}
          </button>
        ))}
      </div>

      {rows.map(r => (
        <div key={r.key} style={{ display: "grid", gridTemplateColumns: grid, borderBottom: line }}>
          <div style={{ padding: "10px", background: C.surface2, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text2 }}>{r.label}</div>
            {r.hint && <div style={{ fontSize: 10, color: C.text4, marginTop: 2 }}>{r.hint}</div>}
          </div>
          {r.cells.map((c, i) => (
            <div key={cols[i].id} style={{ padding: "10px 8px", borderLeft: line, minWidth: 0,
              wordBreak: r.wrap ? "keep-all" : "normal", lineHeight: r.wrap ? 1.5 : 1.3 }}>
              <Cell c={c} wrap={r.wrap} />
            </div>
          ))}
        </div>
      ))}

      {/* 안내 — 없는 숫자를 지어내지 않고, 다음에 할 일만 */}
      <div style={{ padding: "12px 14px 4px" }}>
        {notes.map((n, i) => (
          <div key={i} style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.6, marginBottom: 4 }}>· {n}</div>
        ))}
      </div>

      {/* 표를 보다 바로 상담·선택으로 */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`, gap: S.sm, padding: "8px 14px 16px" }}>
        {cols.map(c => {
          const bid = bids.find(b => b.id === c.id);
          return (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <button onClick={() => onChat?.(bid)}
                style={{ padding: "9px 4px", background: C.surface, color: C.text2, border: `1.5px solid ${C.bgWarm}`,
                  borderRadius: R.lg, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>상담</button>
              <button onClick={() => onSelect?.(bid)}
                style={{ padding: "9px 4px", background: C.brand, color: "#fff", border: "none",
                  borderRadius: R.lg, fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>이 업체</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { MAX_COMPARE };
