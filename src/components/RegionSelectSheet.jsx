import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { REGION_CITIES, districtsOf, regionKey, makeRegionEntry } from "../constants/regions";

// ─────────────────────────────────────────────────────
// 지역 선택 바텀시트 — 지도 화면에서 활동지역 직접 설정 (당근 방식)
//   - 시/도 탭(서울/경기/인천) + 구/시 목록
//   - 최대 maxCount(기본 2)개 선택
//   - 저장 시 RegionEntry[] 반환 (첫 번째가 is_primary)
// ─────────────────────────────────────────────────────

export default function RegionSelectSheet({
  open, onClose, selectedRegions = [], maxCount = 2, onSave,
  title = "내 활동지역 설정",
  subtitle,
}) {
  const [activeCity, setActiveCity] = useState(REGION_CITIES[0] ?? "서울");
  // 작업용 선택 목록: [{ city, district }] (순서 = 우선순위)
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  // 열릴 때마다 현재 저장값으로 초기화
  useEffect(() => {
    if (!open) return;
    const init = (Array.isArray(selectedRegions) ? selectedRegions : [])
      .filter((r) => r?.city)
      .map((r) => ({ city: r.city, district: r.district ?? "" }));
    setPicked(init);
    setActiveCity(init[0]?.city ?? REGION_CITIES[0] ?? "서울");
    setSaving(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const isPicked = (city, district) =>
    picked.some((p) => p.city === city && p.district === district);

  const toggle = (city, district) => {
    setPicked((prev) => {
      const exists = prev.some((p) => p.city === city && p.district === district);
      if (exists) return prev.filter((p) => !(p.city === city && p.district === district));
      if (prev.length >= maxCount) return prev; // 최대 개수 초과 무시
      return [...prev, { city, district }];
    });
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const entries = picked.map((p, i) => makeRegionEntry(p.city, p.district, i === 0));
    try {
      await onSave?.(entries);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000,
        display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width:"100%", maxWidth:480, background:C.surface, borderTopLeftRadius:R.xl, borderTopRightRadius:R.xl,
          padding:S.xl, maxHeight:"80vh", display:"flex", flexDirection:"column", boxShadow:"0 -8px 30px rgba(0,0,0,0.18)" }}>
        {/* 핸들 */}
        <div style={{ width:40, height:4, borderRadius:R.full, background:C.bgWarm, margin:"0 auto 14px" }} />

        <div style={{ fontSize:17, fontWeight:900, color:C.text1, marginBottom:4 }}>{title}</div>
        <div style={{ fontSize:12, color:C.text3, marginBottom:S.lg }}>{subtitle ?? `최대 ${maxCount}곳까지 설정할 수 있어요`}</div>

        {/* 시/도 탭 */}
        <div style={{ display:"flex", gap:6, marginBottom:S.md }}>
          {REGION_CITIES.map((city) => (
            <button key={city} onClick={() => setActiveCity(city)}
              style={{ flex:1, padding:"8px 0", borderRadius:R.full, border:"none", cursor:"pointer",
                fontSize:13, fontWeight:800,
                background: activeCity===city ? C.brand : C.brandL,
                color: activeCity===city ? "#fff" : C.brand }}>
              {city}
            </button>
          ))}
        </div>

        {/* 구/시 목록 */}
        <div style={{ flex:1, overflowY:"auto", margin:`0 -${S.xl}px`, padding:`0 ${S.xl}px` }}>
          {districtsOf(activeCity).map((district) => {
            const on = isPicked(activeCity, district);
            const full = picked.length >= maxCount && !on;
            return (
              <button key={district} onClick={() => toggle(activeCity, district)} disabled={full}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"12px 4px",
                  border:"none", borderBottom:`1px solid ${C.bgWarm}`, background:"none",
                  cursor: full ? "not-allowed" : "pointer", textAlign:"left",
                  color: full ? C.text4 : C.text1, fontSize:14, fontWeight: on ? 800 : 500 }}>
                <span style={{ width:18, color:C.brand, fontWeight:900 }}>{on ? "✓" : ""}</span>
                {district}
              </button>
            );
          })}
        </div>

        {/* 선택 요약 + 저장 */}
        <div style={{ paddingTop:S.md, borderTop:`1px solid ${C.bgWarm}`, marginTop:S.sm }}>
          <div style={{ fontSize:12, color:C.text2, marginBottom:S.md, minHeight:18 }}>
            {picked.length
              ? <>선택됨: <b style={{ color:C.text1 }}>{picked.map((p) => regionKey(p.city, p.district)).join(" · ")}</b> ({picked.length}/{maxCount})</>
              : <span style={{ color:C.text4 }}>지역을 선택해주세요</span>}
          </div>
          <button onClick={handleSave} disabled={saving || !picked.length}
            style={{ width:"100%", padding:"14px 0", borderRadius:R.lg, border:"none",
              background: picked.length ? C.brand : C.bgWarm, color: picked.length ? "#fff" : C.text4,
              fontSize:15, fontWeight:800, cursor: picked.length && !saving ? "pointer" : "not-allowed" }}>
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
