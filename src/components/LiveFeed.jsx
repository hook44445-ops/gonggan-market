import { useState, useEffect, useMemo } from "react";
import { C, R, S } from "../constants";
import { getLiveRequests } from "../lib/supabase";

const MOCK_POOL = [
  { id:"m1", area:"강남구",      spaceType:"오피스 인테리어", stage:"착공 진행중", pct:65 },
  { id:"m2", area:"마포구",      spaceType:"카페 리모델링",   stage:"마감 단계",   pct:80 },
  { id:"m3", area:"송파구",      spaceType:"욕실 리모델링",   stage:"착공 진행중", pct:40 },
  { id:"m4", area:"중구",        spaceType:"상가 인테리어",   stage:"중간 점검",   pct:55 },
  { id:"m5", area:"수원 영통",   spaceType:"주방 교체",       stage:"자재 반입",   pct:25 },
  { id:"m6", area:"인천 서구",   spaceType:"아파트 전체",     stage:"중간 점검",   pct:50 },
  { id:"m7", area:"부산 해운대", spaceType:"부분 도배",       stage:"착공 진행중", pct:70 },
  { id:"m8", area:"일산 서구",   spaceType:"거실 마루 교체",  stage:"마감 단계",   pct:90 },
];

const STAGE_MAP = {
  in_progress:    { label:"착공 진행중", pct:60 },
  contracting:    { label:"계약 단계",   pct:20 },
  escrow_pending: { label:"결제 준비중", pct:30 },
};

// Fisher-Yates with LCG seed (session-stable)
const SESSION_SEED = Date.now() & 0xffff;
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TOTAL = 5;

export default function LiveFeed() {
  const [realItems, setRealItems] = useState([]);

  useEffect(() => {
    getLiveRequests({ limit: 5 }).then(({ data }) => {
      if (data && data.length > 0) setRealItems(data);
    }).catch(() => {});
  }, []);

  const shuffledMock = useMemo(() => seededShuffle(MOCK_POOL, SESSION_SEED), []);

  const realCount  = realItems.length;
  // spec: real >= 3 → mock 숨김 가능. real < 3 → mock으로 채움
  const mockNeeded = realCount >= 3 ? 0 : TOTAL - realCount;
  const mockItems  = shuffledMock.slice(0, mockNeeded);

  const items = [
    ...realItems.slice(0, TOTAL).map(r => ({ ...r, _real: true })),
    ...mockItems.map(m => ({ ...m, _real: false })),
  ].slice(0, TOTAL);

  return (
    <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
      marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.lg }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.text2 }}>동네 시공 현황</div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{
            width:6, height:6, borderRadius:"50%",
            background: realCount > 0 ? C.green : C.text4,
            animation: realCount > 0 ? "gPulse 2s infinite" : "none",
          }} />
          <span style={{ fontSize:11, fontWeight:700,
            color: realCount > 0 ? C.green : C.text4 }}>
            {realCount > 0 ? "LIVE" : "준비중"}
          </span>
        </div>
      </div>

      {/* Items */}
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        if (item._real) {
          const stage = STAGE_MAP[item.status] ?? { label:"진행중", pct:50 };
          return (
            <div key={item.id}
              style={{ display:"flex", alignItems:"flex-start", gap:S.sm,
                paddingBottom: isLast ? 0 : S.md, marginBottom: isLast ? 0 : S.md,
                borderBottom: isLast ? "none" : `1px solid ${C.bgWarm}` }}>
              {/* icon */}
              <div style={{ width:32, height:32, borderRadius:R.sm, flexShrink:0,
                background:`${C.green}18`, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:14 }}>
                🔨
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  {/* LIVE badge */}
                  <span style={{ display:"inline-flex", alignItems:"center", gap:3,
                    background:C.green, color:"#fff",
                    borderRadius:R.full, padding:"2px 7px", fontSize:9, fontWeight:800,
                    flexShrink:0 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:"#fff",
                      display:"inline-block" }} />
                    LIVE
                  </span>
                  <span style={{ fontSize:12, fontWeight:700, color:C.text1,
                    overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                    {item.area ?? "—"} · {item.space_type ?? "인테리어"}
                  </span>
                </div>
                {/* stage + progress bar */}
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:11, color:C.text3, flexShrink:0 }}>{stage.label}</span>
                  <div style={{ flex:1, height:4, background:C.bgWarm,
                    borderRadius:R.full, overflow:"hidden", maxWidth:72 }}>
                    <div style={{ width:`${stage.pct}%`, height:"100%",
                      background:C.green, borderRadius:R.full,
                      transition:"width 0.6s ease" }} />
                  </div>
                  <span style={{ fontSize:10, color:C.text4, flexShrink:0 }}>{stage.pct}%</span>
                </div>
              </div>
            </div>
          );
        }

        /* Mock / Sample card */
        return (
          <div key={item.id}
            style={{ display:"flex", alignItems:"flex-start", gap:S.sm,
              paddingBottom: isLast ? 0 : S.md, marginBottom: isLast ? 0 : S.md,
              borderBottom: isLast ? "none" : `1px solid ${C.bgWarm}` }}>
            <div style={{ width:32, height:32, borderRadius:R.sm, flexShrink:0,
              background:C.surface2, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:14 }}>
              🏠
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                {/* 샘플 badge */}
                <span style={{ background:C.bgWarm, color:C.text4,
                  borderRadius:R.full, padding:"2px 7px", fontSize:9, fontWeight:700,
                  flexShrink:0 }}>
                  샘플
                </span>
                <span style={{ fontSize:12, fontWeight:600, color:C.text3,
                  overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                  {item.area} · {item.spaceType}
                </span>
              </div>
              {/* stage + progress bar */}
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:11, color:C.text4, flexShrink:0 }}>{item.stage}</span>
                <div style={{ flex:1, height:4, background:C.bgWarm,
                  borderRadius:R.full, overflow:"hidden", maxWidth:72 }}>
                  <div style={{ width:`${item.pct}%`, height:"100%",
                    background:"#C8C4BA", borderRadius:R.full }} />
                </div>
                <span style={{ fontSize:10, color:C.text4, flexShrink:0 }}>{item.pct}%</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* empty state */}
      {items.length === 0 && (
        <div style={{ textAlign:"center", padding:"20px 0", color:C.text4, fontSize:13 }}>
          시공 현황을 불러오는 중입니다
        </div>
      )}

      <style>{`
        @keyframes gPulse{
          0%,100%{box-shadow:0 0 0 0 ${C.green}44}
          50%{box-shadow:0 0 0 5px transparent}
        }
      `}</style>
    </div>
  );
}
