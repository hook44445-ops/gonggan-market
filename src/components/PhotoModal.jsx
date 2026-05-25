import { useState } from "react";
import { C, R, S } from "../constants";

export default function PhotoModal({ work, onClose }) {
  const [view,   setView]   = useState("after");
  const [aIdx,   setAIdx]   = useState(0);
  const [bIdx,   setBIdx]   = useState(0);

  const afterPhotos  = work.afterPhotos  ?? (work.after  ? [work.after]  : []);
  const beforePhotos = work.beforePhotos ?? (work.before ? [work.before] : []);

  const afterUrl  = afterPhotos[aIdx]  ?? null;
  const beforeUrl = beforePhotos[bIdx] ?? null;

  const Dots = ({ total, idx, setIdx, light }) => (
    total > 1 ? (
      <div style={{ display:"flex", gap:5, justifyContent:"center", padding:"6px 0" }}>
        {Array.from({ length: total }).map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            style={{ width:i===idx?18:7, height:7, borderRadius:R.full, border:"none",
              background: i===idx ? (light ? "#fff" : C.brand) : (light ? "rgba(255,255,255,0.4)" : C.bgWarm),
              padding:0, cursor:"pointer", transition:"width 0.2s" }} />
        ))}
      </div>
    ) : null
  );

  const NavArrow = ({ dir, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ position:"absolute", top:"50%", transform:"translateY(-50%)",
        [dir==="left"?"left":"right"]: 8,
        width:32, height:32, borderRadius:"50%",
        background: disabled ? "transparent" : "rgba(28,23,18,0.55)",
        color:"#fff", border:"none", fontSize:18, cursor:disabled?"default":"pointer",
        display:"flex", alignItems:"center", justifyContent:"center",
        opacity: disabled ? 0 : 1, transition:"opacity 0.2s" }}>
      {dir==="left" ? "‹" : "›"}
    </button>
  );

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.92)",
      zIndex:300, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:S.xl }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
          width:"100%", maxWidth:440 }}>

        {/* ── Tab bar ── */}
        <div style={{ display:"flex", background:C.bg }}>
          {[
            ["after",   `AFTER${afterPhotos.length > 1 ? ` (${afterPhotos.length})` : ""}`],
            ["before",  `BEFORE${beforePhotos.length > 1 ? ` (${beforePhotos.length})` : ""}`],
            ["compare", "비교"],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ flex:1, padding:"12px 0", border:"none",
                background:view===v?C.surface:"transparent",
                color:view===v?C.brand:C.text3,
                fontWeight:view===v?800:500, fontSize:12, cursor:"pointer",
                borderBottom:view===v?`2px solid ${C.brand}`:"2px solid transparent" }}>{l}</button>
          ))}
        </div>

        {/* ── AFTER gallery ── */}
        {view === "after" && (
          <div>
            <div style={{ height:280, position:"relative", background:C.bgWarm }}>
              {afterUrl ? (
                <img src={afterUrl} alt="after"
                  style={{ width:"100%", height:"100%", objectFit:"cover" }}
                  onError={e => { e.target.style.background = C.bgWarm; }} />
              ) : (
                <div style={{ width:"100%", height:"100%", display:"flex",
                  alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🏠</div>
                  <div style={{ fontSize:13, color:C.text3 }}>시공 후 사진 없음</div>
                </div>
              )}
              {afterUrl && (
                <div style={{ position:"absolute", top:S.md, right:S.md,
                  background:C.brand, color:"#fff",
                  borderRadius:R.full, padding:"3px 12px", fontSize:11, fontWeight:800 }}>
                  AFTER ✨
                </div>
              )}
              <NavArrow dir="left"  onClick={() => setAIdx(i => i-1)} disabled={aIdx === 0} />
              <NavArrow dir="right" onClick={() => setAIdx(i => i+1)} disabled={aIdx >= afterPhotos.length-1} />
            </div>
            <Dots total={afterPhotos.length} idx={aIdx} setIdx={setAIdx} />
          </div>
        )}

        {/* ── BEFORE gallery ── */}
        {view === "before" && (
          <div>
            <div style={{ height:280, position:"relative", background:C.bgWarm }}>
              {beforeUrl ? (
                <img src={beforeUrl} alt="before"
                  style={{ width:"100%", height:"100%", objectFit:"cover", filter:"grayscale(20%)" }}
                  onError={e => { e.target.style.background = C.bgWarm; }} />
              ) : (
                <div style={{ width:"100%", height:"100%", display:"flex",
                  alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>📷</div>
                  <div style={{ fontSize:13, color:C.text3 }}>시공 전 사진 없음</div>
                </div>
              )}
              {beforeUrl && (
                <div style={{ position:"absolute", top:S.md, right:S.md,
                  background:C.text2, color:"#fff",
                  borderRadius:R.full, padding:"3px 12px", fontSize:11, fontWeight:800 }}>
                  BEFORE
                </div>
              )}
              <NavArrow dir="left"  onClick={() => setBIdx(i => i-1)} disabled={bIdx === 0} />
              <NavArrow dir="right" onClick={() => setBIdx(i => i+1)} disabled={bIdx >= beforePhotos.length-1} />
            </div>
            <Dots total={beforePhotos.length} idx={bIdx} setIdx={setBIdx} />
          </div>
        )}

        {/* ── 비교 (side-by-side, first of each) ── */}
        {view === "compare" && (
          <div style={{ display:"flex", height:280 }}>
            <div style={{ flex:1, position:"relative", background:C.bgWarm }}>
              {beforePhotos[0] ? (
                <img src={beforePhotos[0]} alt="before"
                  style={{ width:"100%", height:"100%", objectFit:"cover", filter:"grayscale(30%)" }}
                  onError={e => { e.target.style.background = C.bgWarm; }} />
              ) : (
                <div style={{ width:"100%", height:"100%", display:"flex",
                  alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:11, color:C.text4 }}>사진 없음</span>
                </div>
              )}
              <div style={{ position:"absolute", bottom:S.sm, left:S.sm,
                background:"rgba(31,42,36,0.7)", color:"#fff",
                borderRadius:R.full, padding:"2px 8px", fontSize:10, fontWeight:800 }}>BEFORE</div>
            </div>
            <div style={{ width:2, background:C.brand, flexShrink:0 }} />
            <div style={{ flex:1, position:"relative", background:C.bgWarm }}>
              {afterPhotos[0] ? (
                <img src={afterPhotos[0]} alt="after"
                  style={{ width:"100%", height:"100%", objectFit:"cover" }}
                  onError={e => { e.target.style.background = C.bgWarm; }} />
              ) : (
                <div style={{ width:"100%", height:"100%", display:"flex",
                  alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:11, color:C.text4 }}>사진 없음</span>
                </div>
              )}
              <div style={{ position:"absolute", bottom:S.sm, right:S.sm,
                background:C.brand, color:"#fff",
                borderRadius:R.full, padding:"2px 8px", fontSize:10, fontWeight:800 }}>AFTER</div>
            </div>
          </div>
        )}

        {/* ── Meta info ── */}
        <div style={{ padding:S.xl }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.sm }}>{work.title}</div>
          {work.desc && (
            <div style={{ fontSize:13, color:C.text2, lineHeight:1.6, marginBottom:S.lg }}>{work.desc}</div>
          )}
          {(work.budget || work.type || work.size) && (
            <div style={{ display:"flex", gap:S.lg, marginBottom:S.lg, flexWrap:"wrap" }}>
              {work.budget && (
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:12, color:C.text3 }}>💰</div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginTop:2 }}>{work.budget}</div>
                </div>
              )}
              {work.type && (
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:12, color:C.text3 }}>🏠</div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginTop:2 }}>{work.type}</div>
                </div>
              )}
              {work.size && (
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:12, color:C.text3 }}>📐</div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginTop:2 }}>{work.size}</div>
                </div>
              )}
            </div>
          )}
          <button onClick={onClose}
            style={{ width:"100%", padding:"13px", background:C.bg,
              color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
              fontWeight:700, fontSize:14, cursor:"pointer" }}>닫기</button>
        </div>
      </div>
    </div>
  );
}
