import { useState } from "react";
import { C, R, S } from "../constants";

export default function PortfolioCard({ work, onExpand }) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);

  return (
    <div onClick={() => onExpand(work)}
      style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
        border:`1px solid ${C.bgWarm}`, cursor:"pointer",
        boxShadow:"0 2px 10px rgba(28,23,18,0.07)", marginBottom:S.md }}>

      <div style={{ position:"relative", height:210, background:C.bgWarm }}>
        {!err ? (
          <img src={work.after} alt={work.title}
            onLoad={() => setLoaded(true)}
            onError={() => setErr(true)}
            style={{ width:"100%", height:"100%", objectFit:"cover",
              opacity:loaded?1:0, transition:"opacity 0.4s" }} />
        ) : (
          <div style={{ width:"100%", height:"100%",
            background:`linear-gradient(135deg,${C.bgWarm},${C.brandL})`,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:8 }}>🏠</div>
              <div style={{ fontSize:13, color:C.text3 }}>시공 완료 사진</div>
            </div>
          </div>
        )}

        <div style={{ position:"absolute", inset:0,
          background:"linear-gradient(to bottom, transparent 45%, rgba(28,23,18,0.72))" }} />

        <div style={{ position:"absolute", top:S.md, right:S.md,
          background:C.brand, color:"#fff", borderRadius:R.full,
          padding:"3px 10px", fontSize:10, fontWeight:800, letterSpacing:"0.5px" }}>
          AFTER
        </div>

        {work.escrow && (
          <div style={{ position:"absolute", top:S.md, left:S.md,
            background:C.navy, color:"#fff", borderRadius:R.full,
            padding:"3px 10px", fontSize:10, fontWeight:700,
            display:"flex", alignItems:"center", gap:4 }}>
            🛡 에스크로 완료
          </div>
        )}

        <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:S.lg }}>
          <div style={{ fontSize:15, fontWeight:800, color:"#fff", marginBottom:6,
            textShadow:"0 1px 4px rgba(0,0,0,0.4)" }}>
            {work.title}
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {work.tags.map(t => (
              <span key={t} style={{ background:"rgba(255,255,255,0.18)",
                color:"#fff", borderRadius:R.full, padding:"2px 9px",
                fontSize:11, fontWeight:600, backdropFilter:"blur(6px)" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding:S.lg, display:"flex", gap:S.md, alignItems:"center" }}>
        <div style={{ width:70, height:54, borderRadius:R.sm, overflow:"hidden",
          flexShrink:0, position:"relative", border:`1px solid ${C.bgWarm}` }}>
          <img src={work.before} alt="before"
            style={{ width:"100%", height:"100%", objectFit:"cover",
              filter:"grayscale(50%) brightness(0.88)" }}
            onError={e => { e.target.style.background=C.bgWarm; }} />
          <div style={{ position:"absolute", inset:0, display:"flex",
            alignItems:"center", justifyContent:"center",
            background:"rgba(28,23,18,0.28)" }}>
            <span style={{ fontSize:9, color:"#fff", fontWeight:800, letterSpacing:"0.5px" }}>BEFORE</span>
          </div>
        </div>

        <div style={{ flex:1 }}>
          <div style={{ display:"flex", gap:S.md, marginBottom:4 }}>
            <span style={{ fontSize:13, color:C.text2, fontWeight:600 }}>💰 {work.budget}</span>
            <span style={{ fontSize:13, color:C.text2 }}>📅 {work.period}</span>
          </div>
          <span style={{ background:C.bgWarm, color:C.text3, borderRadius:R.full,
            padding:"2px 9px", fontSize:11, fontWeight:600 }}>{work.type}</span>
        </div>

        <div style={{ background:C.brandL, color:C.brand, borderRadius:R.full,
          padding:"5px 10px", fontSize:12, fontWeight:700 }}>
          전후 비교 →
        </div>
      </div>
    </div>
  );
}
