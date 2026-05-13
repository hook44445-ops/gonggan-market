import { useState } from "react";
import { C, R, S } from "../constants";
import { TempBadge } from "./common";

export default function BidCard({ r }) {
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [bidForm, setBidForm] = useState({ price:"", period:"", material:"", comment:"" });
  const setBF = (k,v) => setBidForm(f=>({...f,[k]:v}));
  const iS = { width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box",
    marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface };

  return (
    <div>
      <div style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
        marginBottom:S.md, border:`1px solid ${submitted?C.green:C.bgWarm}` }}>
        {submitted && <div style={{ height:3, background:C.green }} />}
        <div style={{ padding:S.xl }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:S.sm }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{r.type} · {r.size}</div>
            <div style={{ display:"flex", gap:6 }}>
              {r.urgent && <span style={{ background:"#FFF0F0", color:C.red, borderRadius:R.full, padding:"2px 8px", fontSize:11, fontWeight:700 }}>급구</span>}
              {submitted
                ? <span style={{ background:C.greenL, color:C.green, borderRadius:R.full, padding:"2px 10px", fontSize:11, fontWeight:700 }}>✓ 입찰완료</span>
                : <span style={{ fontSize:11, color:C.text3 }}>{r.time}</span>}
            </div>
          </div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:6 }}>📍 {r.area} · {r.distance||"인근"}</div>
          <div style={{ fontSize:13, color:C.text2, marginBottom:S.lg, lineHeight:1.5 }}>{r.desc}</div>
          {submitted ? (
            <div style={{ background:C.greenL, borderRadius:R.lg, padding:S.md,
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.green }}>입찰 금액: {bidForm.price}만원</div>
                <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>예상 {bidForm.period}일 · 의뢰인 확인 대기중</div>
              </div>
              <span style={{ fontSize:20 }}>✅</span>
            </div>
          ) : (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:12, color:C.text3 }}>💰 {r.budget}</div>
                <div style={{ fontSize:11, color:C.text4, marginTop:2 }}>경쟁 입찰 {r.bids}개</div>
              </div>
              <button onClick={() => setShowForm(true)}
                style={{ background:C.brand, color:"#fff", border:"none",
                  borderRadius:R.full, padding:"10px 20px", fontWeight:800, fontSize:13, cursor:"pointer",
                  boxShadow:`0 3px 12px ${C.brand}44` }}>
                견적 제출하기
              </button>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(28,23,18,0.6)",
          display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
            width:"100%", maxWidth:480, padding:"24px 24px 40px", maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 16px" }} />
            <div style={{ fontSize:17, fontWeight:800, color:C.text1, marginBottom:4 }}>견적 입찰 작성</div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>{r.type} · {r.size} · {r.area}</div>

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>견적 금액 (만원)</div>
            <input value={bidForm.price} onChange={e=>setBF("price",e.target.value)}
              placeholder="예: 2800" type="number" style={iS} />

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>예상 시공 기간 (일)</div>
            <input value={bidForm.period} onChange={e=>setBF("period",e.target.value)}
              placeholder="예: 30" type="number" style={iS} />

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>주요 자재 설명</div>
            <input value={bidForm.material} onChange={e=>setBF("material",e.target.value)}
              placeholder="예: LX하우시스 바닥재, 대림 욕실" style={iS} />

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>의뢰인에게 한마디</div>
            <textarea value={bidForm.comment} onChange={e=>setBF("comment",e.target.value)}
              placeholder="예: 12년 경력, 에스크로 156건 완료. 중간 점검 사진 매번 공유해드립니다."
              rows={3} style={{ ...iS, resize:"none", lineHeight:1.7 }} />

            <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.md,
              marginBottom:S.xl, display:"flex", gap:S.md, alignItems:"center" }}>
              <TempBadge temp={97} lg />
              <div style={{ fontSize:12, color:C.text2 }}>재계약률 68% · AS 98% · 완료 156건</div>
            </div>

            <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.md,
              marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:12, color:C.text3, lineHeight:1.8 }}>
                💡 낙찰 시 플랫폼 수수료 안내<br/>
                • 직거래 낙찰 → 견적금액의 <b style={{color:C.text2}}>5%</b><br/>
                • 에스크로 낙찰 → 견적금액의 <b style={{color:C.text2}}>4%</b><br/>
                <span style={{color:C.text4}}>* 고객 부담 없음. 업체 수령액에서 자동 차감</span>
              </div>
            </div>

            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2,
                  border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                취소
              </button>
              <button onClick={() => { if(bidForm.price&&bidForm.period){ setShowForm(false); setSubmitted(true); }}}
                style={{ flex:2, padding:S.xl,
                  background:bidForm.price&&bidForm.period?C.brand:"#E8E4DC",
                  color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer",
                  boxShadow:bidForm.price&&bidForm.period?`0 4px 16px ${C.brand}44`:"none" }}>
                🚀 입찰 제출하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
