import { C, R, S } from "../constants";
import { regionKey } from "../constants/regions";

// ─────────────────────────────────────────────────────
// 지도 상단 지역 선택 바 (당근 방식)
//   [ 강서구 ▾ ] [ 마포구 ] [ + 지역 추가 ]
//   - 저장된 활동지역 탭 표시 → 클릭 시 해당 지역으로 지도 이동
//   - "+ 지역 추가" → RegionSelectSheet 오픈
// ─────────────────────────────────────────────────────

export default function RegionSelectorBar({ regions = [], activeKey, onSelect, onAdd }) {
  return (
    <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:S.md, scrollbarWidth:"none" }}>
      {regions.map((r, i) => {
        const key = regionKey(r.city, r.district);
        const active = activeKey ? activeKey === key : i === 0;
        const label = r.district || r.city;
        return (
          <button key={key || i} onClick={() => onSelect?.(r)}
            style={{ flexShrink:0, padding:"7px 14px", borderRadius:R.full, cursor:"pointer",
              border: active ? "none" : `1px solid ${C.bgWarm}`,
              background: active ? C.brand : C.surface,
              color: active ? "#fff" : C.text2, fontSize:13, fontWeight:800,
              display:"flex", alignItems:"center", gap:4 }}>
            📍 {label}{active ? " ▾" : ""}
          </button>
        );
      })}
      <button onClick={onAdd}
        style={{ flexShrink:0, padding:"7px 14px", borderRadius:R.full, cursor:"pointer",
          border:`1px dashed ${C.brandM}`, background:C.brandL, color:C.brand, fontSize:13, fontWeight:800 }}>
        + 지역 {regions.length ? "추가" : "설정"}
      </button>
    </div>
  );
}
