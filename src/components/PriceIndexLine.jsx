import { useEffect, useState } from "react";
import { C, R } from "../constants";
import { requestPriceFields } from "../lib/priceData";
import { priceIndexSummary } from "../lib/priceIndex";
import { getPriceIndex } from "../lib/supabase";

// 견적 비교 화면 한 줄 — «우리 동네 비슷한 공사 평균 평당 약 N만원 · 완공 M건 기준». 표본 5건 미만·표 없음이면 안 보인다.
export default function PriceIndexLine({ spaceType, area }) {
  const [sum, setSum] = useState(null);
  useEffect(() => {
    const f = requestPriceFields({ spaceType, area });
    if (!f.region_code || !spaceType) return;
    let alive = true;
    getPriceIndex({ regionCode: f.region_code, spaceType, buildingType: f.building_type })
      .then(({ data, error }) => { if (alive && !error) setSum(priceIndexSummary(data ?? [])); })
      .catch(() => {});
    return () => { alive = false; };
  }, [spaceType, area]);
  if (!sum) return null;
  return (
    <div style={{ background: C.bg, border: `1px dashed ${C.bgWarm}`, borderRadius: R.md, padding: "8px 11px", marginBottom: 8, fontSize: 12.5, color: C.text2 }}>
      📊 우리 동네 {sum.line}
    </div>
  );
}
