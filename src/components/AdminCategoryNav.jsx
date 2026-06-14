import { useState, useEffect } from "react";
import { C } from "../constants";

// ── 관리자 IA 네비게이션 — 상단 대분류(5) + 하단 소분류 ──────────────────────
// categories: [{ key, label, icon, tabs: [{ key, label }] }] (권한 필터링 완료본)
// mainTab: 현재 선택된 소분류 key / onSelect: 소분류 클릭 핸들러
export default function AdminCategoryNav({ categories, mainTab, onSelect }) {
  // 현재 mainTab 이 속한 대분류를 활성화. 없으면 첫 대분류.
  const catOf = (tabKey) => categories.find(c => c.tabs.some(t => t.key === tabKey))?.key;
  const [activeCat, setActiveCat] = useState(catOf(mainTab) || categories[0]?.key);

  useEffect(() => {
    const c = catOf(mainTab);
    if (c && c !== activeCat) setActiveCat(c);
    // eslint-disable-next-line
  }, [mainTab]);

  const cat = categories.find(c => c.key === activeCat) || categories[0];

  const pickCategory = (catKey) => {
    setActiveCat(catKey);
    const target = categories.find(c => c.key === catKey);
    // 대분류 전환 시, 현재 소분류가 그 안에 없으면 첫 소분류로 이동.
    if (target && !target.tabs.some(t => t.key === mainTab) && target.tabs[0]) {
      onSelect(target.tabs[0].key);
    }
  };

  return (
    <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}` }}>
      {/* 대분류 */}
      <div style={{ display: "flex", overflowX: "auto", padding: "0 12px", gap: 2 }}>
        {categories.map(c => {
          const on = c.key === activeCat;
          return (
            <button key={c.key} onClick={() => pickCategory(c.key)}
              style={{ padding: "12px 14px", border: "none", background: "transparent",
                fontWeight: on ? 900 : 600, fontSize: 13.5, whiteSpace: "nowrap",
                color: on ? C.brand : C.text3,
                borderBottom: `3px solid ${on ? C.brand : "transparent"}`, cursor: "pointer" }}>
              {c.icon ? `${c.icon} ` : ""}{c.label}
            </button>
          );
        })}
      </div>
      {/* 소분류 */}
      <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: "9px 14px", background: C.bg }}>
        {(cat?.tabs || []).map(t => {
          const on = t.key === mainTab;
          return (
            <button key={t.key} onClick={() => onSelect(t.key)}
              style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                border: `1px solid ${on ? C.brand : C.bgWarm}`, cursor: "pointer",
                background: on ? C.brand : C.surface, color: on ? "#fff" : C.text2 }}>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
