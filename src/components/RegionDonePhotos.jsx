import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { getRegionDonePhotos } from "../lib/supabase";
import { donePhotosView } from "../lib/regionPhotos";

// 홈 «📸 우리 동네 최근 완공»(177) — 이미 공개된 좋은 후기의 공사 후 사진. 2장 미만·SQL 전이면 안 보인다.
//   누르면 그 업체 페이지(/p/…). 고객 이름·주소는 없다(동네·공간·업체 이름만).
export default function RegionDonePhotos({ region }) {
  const [view, setView] = useState(null);
  useEffect(() => {
    const r = String(region ?? "").trim();
    if (!r) return;
    let alive = true;
    getRegionDonePhotos(r).then(({ data, error }) => { if (alive && !error) setView(donePhotosView(data)); }).catch(() => {});
    return () => { alive = false; };
  }, [region]);
  if (!view) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "14px 0 14px 16px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.brand, marginBottom: 8 }}>{view.title}</div>
      <div style={{ display: "flex", gap: S.sm, overflowX: "auto", paddingRight: 16, scrollbarWidth: "none" }}>
        {view.items.map((x) => (
          <a key={x.id} href={x.href ?? undefined} style={{ flex: "0 0 auto", width: 128, textDecoration: "none" }}>
            <div style={{ width: 128, height: 128, borderRadius: R.md, overflow: "hidden", background: C.bg }}>
              <img src={x.photo} alt={x.caption || "완공 사진"} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
            {x.caption && <div style={{ fontSize: 11.5, color: C.text2, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.caption}</div>}
          </a>
        ))}
      </div>
    </div>
  );
}
