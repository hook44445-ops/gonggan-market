import { useState } from "react";
import { C, R, S } from "../constants";
import { TempBadge, Stars, Divider } from "./common";
import ReviewModal from "./ReviewModal";

export default function ReviewScreen({ company, onBack }) {
  const [reviews, setReviews] = useState(company.reviewList);
  const [showModal, setShowModal] = useState(false);
  const [newId, setNewId] = useState(null);
  const avg = reviews.length > 0
    ? (reviews.reduce((s,r) => s+r.rating, 0)/reviews.length).toFixed(1) : "0.0";

  const handleSubmit = data => {
    const now = new Date();
    const nr = { id:Date.now(), user:"나", region:"마포구", rating:data.rating,
      date:`${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")}`,
      amount:"진행중", type:"시공 완료", content:data.content, tags:data.tags, reply:null };
    setReviews(r => [nr,...r]);
    setNewId(nr.id);
    setTimeout(() => setNewId(null), 3000);
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>시공 후기</div>
          <div style={{ fontSize:12, color:C.text3 }}>{company.name} · {reviews.length}개</div>
        </div>
      </div>
      <div style={{ padding:`${S.xl}px ${S.xl}px 100px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.xxl, alignItems:"center", marginBottom:S.xl }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:52, fontWeight:900, color:C.text1, lineHeight:1 }}>{avg}</div>
              <Stars rating={Math.round(parseFloat(avg))} size={18} />
              <div style={{ fontSize:12, color:C.text3, marginTop:6 }}>{reviews.length}개</div>
            </div>
            <div style={{ flex:1 }}>
              {[5,4,3,2,1].map(star => {
                const cnt = reviews.filter(r => r.rating===star).length;
                const pct = reviews.length > 0 ? (cnt/reviews.length)*100 : 0;
                return (
                  <div key={star} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:11, color:C.text3, width:16, textAlign:"right" }}>{star}</span>
                    <div style={{ flex:1, height:6, background:C.bgWarm, borderRadius:R.full, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:C.gold, borderRadius:R.full }} />
                    </div>
                    <span style={{ fontSize:11, color:C.text3, width:20 }}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <Divider />
          <div style={{ marginTop:S.lg, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.text2 }}>🌡 공간온도</div>
            <TempBadge temp={company.temp} lg />
          </div>
        </div>

        {reviews.map(rv => (
          <div key={rv.id} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.md,
            border:`1.5px solid ${rv.id===newId?C.brand:C.bgWarm}`,
            animation:rv.id===newId?"fadeUp 0.4s ease":"none" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.md }}>
              <div style={{ display:"flex", gap:S.md, alignItems:"center" }}>
                <div style={{ width:40, height:40, borderRadius:"50%",
                  background:`hsl(${rv.id*55},40%,88%)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:15, fontWeight:900, color:C.text2 }}>{rv.user[0]}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>{rv.user}</div>
                  <div style={{ fontSize:12, color:C.text3 }}>📍 {rv.region} · {rv.date}</div>
                </div>
              </div>
              <Stars rating={rv.rating} size={13} />
            </div>
            <div style={{ background:C.surface2, borderRadius:R.md, padding:"8px 12px", marginBottom:S.md, display:"flex", gap:S.lg }}>
              <span style={{ fontSize:12, color:C.text3 }}>🏠 {rv.type}</span>
              <span style={{ fontSize:12, color:C.text3 }}>💰 {rv.amount}</span>
            </div>
            {rv.tags?.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:S.md }}>
                {rv.tags.map(t => (
                  <span key={t} style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>✓ {t}</span>
                ))}
              </div>
            )}
            <div style={{ fontSize:14, color:C.text2, lineHeight:1.7 }}>{rv.content}</div>
            {rv.reply && (
              <div style={{ background:C.surface2, borderRadius:R.md, padding:S.md, marginTop:S.md, borderLeft:`3px solid ${C.brand}` }}>
                <div style={{ fontSize:11, fontWeight:800, color:C.brand, marginBottom:4 }}>🏠 업체 답글</div>
                <div style={{ fontSize:13, color:C.text2, lineHeight:1.6 }}>{rv.reply}</div>
              </div>
            )}
          </div>
        ))}

        {reviews.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📝</div>
            <div style={{ fontSize:13, color:C.text3 }}>아직 후기가 없어요</div>
          </div>
        )}
      </div>

      <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)",
        width:"calc(100% - 40px)", maxWidth:440, zIndex:10 }}>
        <button onClick={() => setShowModal(true)}
          style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff",
            border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15,
            cursor:"pointer", boxShadow:`0 8px 24px ${C.brand}44` }}>
          ✏️ 시공 후기 작성하기
        </button>
      </div>

      {showModal && <ReviewModal onClose={() => setShowModal(false)} onSubmit={handleSubmit} />}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
