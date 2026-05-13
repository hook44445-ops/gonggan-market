import { useState } from "react";
import { C, R, S } from "../constants";

export default function PhotoModal({ work, onClose }) {
  const [view, setView] = useState("after");

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.92)",
      zIndex:300, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:S.xl }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
          width:"100%", maxWidth:440 }}>

        <div style={{ display:"flex", background:C.bg }}>
          {[["after","AFTER"],["before","BEFORE"],["compare","비교"]].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ flex:1, padding:"12px 0", border:"none",
                background:view===v?C.surface:"transparent",
                color:view===v?C.brand:C.text3,
                fontWeight:view===v?800:500, fontSize:13, cursor:"pointer",
                borderBottom:view===v?`2px solid ${C.brand}`:"2px solid transparent" }}>{l}</button>
          ))}
        </div>

        {view !== "compare" ? (
          <div style={{ height:280, position:"relative" }}>
            <img src={view==="after"?work.after:work.before} alt={view}
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={e => { e.target.style.background=C.bgWarm; }} />
            <div style={{ position:"absolute", top:S.md, right:S.md,
              background:view==="after"?C.brand:C.text2, color:"#fff",
              borderRadius:R.full, padding:"3px 12px", fontSize:11, fontWeight:800 }}>
              {view==="after"?"AFTER ✨":"BEFORE"}
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", height:280 }}>
            <div style={{ flex:1, position:"relative" }}>
              <img src={work.before} alt="before"
                style={{ width:"100%", height:"100%", objectFit:"cover", filter:"grayscale(30%)" }}
                onError={e => { e.target.style.background=C.bgWarm; }} />
              <div style={{ position:"absolute", bottom:S.sm, left:S.sm,
                background:"rgba(31,42,36,0.7)", color:"#fff",
                borderRadius:R.full, padding:"2px 8px", fontSize:10, fontWeight:800 }}>BEFORE</div>
            </div>
            <div style={{ width:2, background:C.brand }} />
            <div style={{ flex:1, position:"relative" }}>
              <img src={work.after} alt="after"
                style={{ width:"100%", height:"100%", objectFit:"cover" }}
                onError={e => { e.target.style.background=C.bgWarm; }} />
              <div style={{ position:"absolute", bottom:S.sm, right:S.sm,
                background:C.brand, color:"#fff",
                borderRadius:R.full, padding:"2px 8px", fontSize:10, fontWeight:800 }}>AFTER</div>
            </div>
          </div>
        )}

        <div style={{ padding:S.xl }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.sm }}>{work.title}</div>
          <div style={{ fontSize:13, color:C.text2, lineHeight:1.6, marginBottom:S.lg }}>{work.desc}</div>
          <div style={{ display:"flex", gap:S.xl, marginBottom:S.lg }}>
            {[["💰",work.budget],["📅",work.period],["🏠",work.type]].map(([i,v]) => (
              <div key={v} style={{ textAlign:"center" }}>
                <div style={{ fontSize:12, color:C.text3 }}>{i}</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
          {work.escrow && (
            <div style={{ background:C.navyL, borderRadius:R.md,
              padding:"10px 14px", display:"flex", gap:S.sm, alignItems:"center" }}>
              <span style={{ fontSize:16 }}>🛡</span>
              <span style={{ fontSize:12, color:C.navy, fontWeight:700 }}>에스크로 안전거래 완료 시공</span>
            </div>
          )}
          <button onClick={onClose}
            style={{ width:"100%", marginTop:S.lg, padding:"13px", background:C.bg,
              color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
              fontWeight:700, fontSize:14, cursor:"pointer" }}>닫기</button>
        </div>
      </div>
    </div>
  );
}
