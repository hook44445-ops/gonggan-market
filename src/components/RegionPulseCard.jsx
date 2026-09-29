import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { getRegionPulse } from "../lib/supabase";
import { pulseView } from "../lib/regionPulse";

// 홈 «📍 우리 동네 이번 주»(163) — 최근 7일 새 요청·들어온 견적·많이 찾은 공사. 숫자만(누가·어디·얼마는 없음).
//   요청이 0건이거나 SQL 전·실패면 안 보인다. 누르면 고객은 견적 요청, 업체는 새 요청 목록.
export default function RegionPulseCard({ region, isCompany = false, onAction }) {
  const [view, setView] = useState(null);
  useEffect(() => {
    const r = String(region ?? "").trim();
    if (!r) return;
    let alive = true;
    getRegionPulse(r).then(({ data, error }) => { if (alive && !error) setView(pulseView(data, { isCompany })); }).catch(() => {});
    return () => { alive = false; };
  }, [region, isCompany]);
  if (!view) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.brand }}>{view.title}</div>
      <div style={{ display: "flex", gap: S.sm, marginTop: 8 }}>
        {view.stats.map((s) => (
          <div key={s} style={{ flex: 1, background: C.bg, borderRadius: R.md, padding: "9px 10px", fontSize: 13, fontWeight: 800, color: C.text1, textAlign: "center" }}>{s}</div>
        ))}
      </div>
      {view.topLine && <div style={{ fontSize: 12.5, color: C.text2, marginTop: 8 }}>{view.topLine}</div>}
      {onAction && (
        <button onClick={onAction}
          style={{ marginTop: 8, background: "none", border: "none", padding: 0, color: C.brand, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
          {view.cta} →
        </button>
      )}
    </div>
  );
}
