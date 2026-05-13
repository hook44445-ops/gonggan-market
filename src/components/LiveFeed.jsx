import { useState, useEffect } from "react";
import { C, R, S, FEED_BASE, FEED_META } from "../constants";

export default function LiveFeed() {
  const [feed, setFeed] = useState(FEED_BASE);
  const [newId, setNewId] = useState(null);

  useEffect(() => {
    const pool = [
      { type:"bid",      co:"홍익시공",    area:"합정동", msg:"새 입찰 제출" },
      { type:"complete", co:"공간설계소",  area:"연남동", msg:"시공 완료" },
      { type:"review",   co:"우리집시공단",area:"망원동", msg:"후기 등록 ★★★★" },
    ];
    const t = setInterval(() => {
      const item = { ...pool[Math.floor(Math.random()*pool.length)], id:Date.now(), t:0 };
      setNewId(item.id);
      setFeed(f => [item, ...f.slice(0,4)].map(x => ({ ...x, t: x.id===item.id?0:x.t+7 })));
      setTimeout(() => setNewId(null), 1800);
    }, 7000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
      marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.text2 }}>동네 시공 현황</div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:C.green,
            animation:"gPulse 2s infinite" }} />
          <span style={{ fontSize:11, color:C.green, fontWeight:700 }}>LIVE</span>
        </div>
      </div>
      {feed.slice(0,4).map(item => {
        const m = FEED_META[item.type];
        return (
          <div key={item.id} style={{ display:"flex", alignItems:"center", gap:S.sm,
            padding:`${S.xs}px ${S.sm}px`, borderRadius:R.md,
            background: item.id===newId ? `${m.color}10` : "transparent",
            transition:"background 0.6s",
            animation: item.id===newId ? "slideIn 0.35s ease" : "none",
            marginBottom:2 }}>
            <div style={{ width:28, height:28, borderRadius:R.sm, flexShrink:0,
              background:`${m.color}15`, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:13 }}>{m.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.text1,
                overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                <span style={{ color:m.color }}>{item.co}</span> · {item.area}
              </div>
              <div style={{ fontSize:11, color:C.text3 }}>{item.msg}</div>
            </div>
            <div style={{ fontSize:10, color:C.text4, flexShrink:0 }}>
              {item.t===0?"방금":`${item.t}분 전`}
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes gPulse{0%,100%{box-shadow:0 0 0 0 ${C.green}44}50%{box-shadow:0 0 0 5px ${C.green}00}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
      `}</style>
    </div>
  );
}
