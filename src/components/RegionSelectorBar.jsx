import { C, R, S } from "../constants";
import { regionKey } from "../constants/regions";

// ─────────────────────────────────────────────────────
// 지도 상단 지역 선택 바 (당근 방식)
//   [ 강서구 ▾ ] [ 마포구 ]
//   - 저장된 활동지역 칩 표시
//   - 칩 클릭 → 지역 선택 모달(둘러보기 / 현재위치 추가 / 관심지역 저장) 오픈
//     ("+ 지역 추가" 버튼은 제거 — 칩 자체가 지역 관리/변경 진입점)
// ─────────────────────────────────────────────────────

export default function RegionSelectorBar({ regions = [], activeKey, onSelect }) {
  // 저장된 활동지역이 없으면 "지역 설정" 진입 칩 1개를 노출
  if (!regions.length) {
    return (
      <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:S.md, scrollbarWidth:"none" }}>
        <button onClick={() => onSelect?.(null)}
          style={{ flexShrink:0, padding:"7px 14px", borderRadius:R.full, cursor:"pointer",
            border:`1px dashed ${C.brandM}`, background:C.brandL, color:C.brand, fontSize:13, fontWeight:800 }}>
          📍 지역 설정
        </button>
      </div>
    );
  }

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
            📍 {label} ▾
          </button>
        );
      })}
    </div>
  );
}
