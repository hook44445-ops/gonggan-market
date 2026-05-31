import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { getLiveRequests } from "../lib/supabase";

const STAGE_MAP = {
  in_progress:    { label:"착공 진행중", pct:60 },
  contracting:    { label:"계약 단계",   pct:20 },
  escrow_pending: { label:"결제 준비중", pct:30 },
};

const TOTAL = 5;

export default function LiveFeed() {
  const [realItems, setRealItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getLiveRequests({ limit: 5 }).then(({ data }) => {
      if (data && data.length > 0) setRealItems(data);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  // 실데이터만 노출 — 샘플/테스트 항목(is_sample/is_test/상태 "샘플") 제외, 더미 미표시
  const items = realItems
    .filter(r => !r.is_sample && !r.is_test && r.status !== "샘플")
    .slice(0, TOTAL)
    .map(r => ({ ...r, _real: true }));

  return (
    <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
      marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>

      {/* Header — 항상 LIVE */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.text2 }}>동네 시공 현황</div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:C.green,
            animation:"gPulse 2s infinite" }} />
          <span style={{ fontSize:11, color:C.green, fontWeight:700 }}>LIVE</span>
        </div>
      </div>

      {/* 실데이터 0건 — 빈 상태 */}
      {loaded && items.length === 0 && (
        <div style={{ textAlign:"center", padding:"16px 0", color:C.text3, fontSize:13 }}>
          아직 이 지역 시공 현황이 없어요
        </div>
      )}

      {/* Items (실데이터만) */}
      {items.map((item, i) => {
        const isLast = i === items.length - 1;

        if (item._real) {
          const stage = STAGE_MAP[item.status] ?? { label:"진행중", pct:50 };
          return (
            <div key={item.id}
              style={{ display:"flex", alignItems:"center", gap:S.sm,
                paddingBottom: isLast ? 0 : S.sm, marginBottom: isLast ? 0 : S.sm,
                borderBottom: isLast ? "none" : `1px solid ${C.bgWarm}` }}>
              <div style={{ width:28, height:28, borderRadius:R.sm, flexShrink:0,
                background:`${C.green}15`, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:13 }}>
                🔨
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text1, marginBottom:2,
                  overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                  <span style={{ color:C.brand }}>{item.area ?? "—"}</span>
                  {" · "}{item.space_type ?? "인테리어"}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:10, color:C.text3, flexShrink:0 }}>{stage.label}</span>
                  <div style={{ flex:1, height:3, background:C.bgWarm,
                    borderRadius:R.full, overflow:"hidden", maxWidth:56 }}>
                    <div style={{ width:`${stage.pct}%`, height:"100%",
                      background:C.green, borderRadius:R.full }} />
                  </div>
                  <span style={{ fontSize:9, color:C.text4, flexShrink:0 }}>{stage.pct}%</span>
                </div>
              </div>
              <span style={{ fontSize:9, fontWeight:800, color:C.green,
                flexShrink:0, letterSpacing:"0.03em" }}>LIVE</span>
            </div>
          );
        }

        return (
          <div key={item.id}
            style={{ display:"flex", alignItems:"center", gap:S.sm,
              paddingBottom: isLast ? 0 : S.sm, marginBottom: isLast ? 0 : S.sm,
              borderBottom: isLast ? "none" : `1px solid ${C.bgWarm}` }}>
            <div style={{ width:28, height:28, borderRadius:R.sm, flexShrink:0,
              background:"#F0EDE8", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:13 }}>
              🏠
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.text3, marginBottom:2,
                overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                {item.area}{" · "}{item.spaceType}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:10, color:C.text4, flexShrink:0 }}>{item.stage}</span>
                <div style={{ flex:1, height:3, background:C.bgWarm,
                  borderRadius:R.full, overflow:"hidden", maxWidth:56 }}>
                  <div style={{ width:`${item.pct}%`, height:"100%",
                    background:"#C8C4BA", borderRadius:R.full }} />
                </div>
                <span style={{ fontSize:9, color:C.text4, flexShrink:0 }}>{item.pct}%</span>
              </div>
            </div>
            <span style={{ fontSize:9, fontWeight:700, color:C.text4,
              background:C.bgWarm, borderRadius:R.full, padding:"1px 5px",
              flexShrink:0 }}>샘플</span>
          </div>
        );
      })}

      <style>{`
        @keyframes gPulse{
          0%,100%{box-shadow:0 0 0 0 ${C.green}44}
          50%{box-shadow:0 0 0 5px transparent}
        }
      `}</style>
    </div>
  );
}
