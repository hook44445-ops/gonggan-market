import { useState } from "react";
import { C, R, S, MOCK_BIDS } from "../constants";
import { TempBadge } from "./common";

export default function BidStatusScreen({ onBack, onChat }) {
  const [bids] = useState(MOCK_BIDS);
  const [step, setStep] = useState("list");
  const [selBid, setSelBid] = useState(null);

  const H = ({ title, sub }) => (
    <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`, display:"flex", alignItems:"center", gap:S.md }}>
      <button onClick={() => step==="list"?onBack():setStep("list")} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
      <div><div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{title}</div>{sub&&<div style={{ fontSize:12, color:C.text3 }}>{sub}</div>}</div>
    </div>
  );

  if(step==="confirm"&&selBid) return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <H title="예약 확인" />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.lg }}>
            <div style={{ width:48, height:48, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:C.brand }}>{selBid.company.name[0]}</div>
            <div style={{ flex:1 }}><div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{selBid.company.name}</div><TempBadge temp={selBid.company.temp} /></div>
            <div style={{ textAlign:"right" }}><div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{selBid.price.toLocaleString()}만원</div><div style={{ fontSize:12, color:C.text3 }}>{selBid.period}일</div></div>
          </div>
          <div style={{ fontSize:13, color:C.text2 }}>{selBid.material}</div>
        </div>
        <div style={{ background:C.navyL, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`1px solid ${C.trustM}` }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.navy, marginBottom:S.md }}>🛡 에스크로 안전 정산</div>
          {[["착공 확인","선금 30%",Math.round(selBid.price*0.3)],["중간점검","중도금 40%",Math.round(selBid.price*0.4)],["완료 확인","잔금 30%",Math.round(selBid.price*0.3)]].map(([when,label,amt]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.trustM}` }}>
              <div><div style={{ fontSize:12, fontWeight:700, color:C.navy }}>{label}</div><div style={{ fontSize:11, color:C.text3 }}>{when}</div></div>
              <div style={{ fontSize:13, fontWeight:800, color:C.brand }}>{amt.toLocaleString()}만원</div>
            </div>
          ))}
        </div>
        <button onClick={() => setStep("reserved")} style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand}44` }}>예약 확정하기 ✅</button>
      </div>
    </div>
  );

  if(step==="reserved"&&selBid) return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <H title="결제 방식 선택" />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:C.brand }}>{selBid.company.name[0]}</div>
            <div><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{selBid.company.name}</div><div style={{ fontSize:13, color:C.text3 }}>{selBid.price.toLocaleString()}만원 · {selBid.period}일</div></div>
          </div>
          <div style={{ background:C.brandL, borderRadius:R.lg, padding:`${S.sm}px ${S.md}px`, fontSize:13, color:C.brand, fontWeight:700, textAlign:"center" }}>🎉 예약 확정 완료 · 결제 방식 선택</div>
        </div>
        <div onClick={() => setStep("done_direct")} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.md, border:`1.5px solid ${C.bgWarm}`, cursor:"pointer" }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:4 }}>직거래</div>
          <div style={{ fontSize:12, color:C.text3, marginBottom:S.sm }}>업체와 직접 결제 · 공간마켓 보호 없음</div>
          <div style={{ background:"#FFF8E8", borderRadius:R.sm, padding:"6px 10px", fontSize:11, color:"#C08000" }}>⚠️ 분쟁 발생 시 공간마켓 개입 없음</div>
        </div>
        <div onClick={() => setStep("payment")} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`2px solid ${C.brand}`, cursor:"pointer" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>에스크로 안전 거래</div>
            <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>🛡 추천</span>
          </div>
          <div style={{ fontSize:12, color:C.text3 }}>공간마켓 보관 · 단계별 지급 · 분쟁 중재</div>
        </div>
        <button onClick={() => onChat(selBid.company)} style={{ width:"100%", padding:S.lg, background:"none", color:C.text3, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:600, fontSize:14, cursor:"pointer" }}>💬 먼저 업체와 상담하기</button>
      </div>
    </div>
  );

  if(step==="payment"&&selBid) return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <H title="에스크로 전액 예치" />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize:13, color:C.text3, marginBottom:4 }}>예치 금액</div>
          <div style={{ fontSize:32, fontWeight:900, color:C.text1, marginBottom:S.md }}>{selBid.price.toLocaleString()}만원</div>
          {[["착공","선금 30%",Math.round(selBid.price*0.3)],["중간점검","중도금 40%",Math.round(selBid.price*0.4)],["완료","잔금 30%",Math.round(selBid.price*0.3)]].map(([w,l,a]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
              <div><div style={{ fontSize:12, fontWeight:700, color:C.text2 }}>{l}</div><div style={{ fontSize:11, color:C.text3 }}>{w}</div></div>
              <div style={{ fontSize:13, fontWeight:800, color:C.brand }}>{a.toLocaleString()}만원</div>
            </div>
          ))}
        </div>
        {[["💳","신용/체크카드"],["📱","카카오페이"],["🏦","계좌이체"]].map(([i,l]) => (
          <div key={l} style={{ display:"flex", alignItems:"center", gap:S.md, padding:`${S.md}px 0`, borderBottom:`1px solid ${C.bgWarm}`, cursor:"pointer" }}>
            <span style={{ fontSize:20 }}>{i}</span><span style={{ fontSize:14, fontWeight:600, color:C.text1 }}>{l}</span><span style={{ marginLeft:"auto", color:C.text4 }}>›</span>
          </div>
        ))}
        <div style={{ background:C.navyL, borderRadius:R.lg, padding:S.md, margin:`${S.xl}px 0`, fontSize:12, color:C.navy, display:"flex", gap:S.sm }}>
          <span>🛡</span><span>예치금은 공간마켓이 보관하며 단계별 확인 후 업체에 지급됩니다</span>
        </div>
        <button onClick={() => setStep("done")} style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand}44` }}>🔒 {selBid.price.toLocaleString()}만원 에스크로 예치하기</button>
      </div>
    </div>
  );

  if((step==="done"||step==="done_direct")&&selBid) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:S.xxl }}>
      <div style={{ width:"100%", maxWidth:390, textAlign:"center" }}>
        <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:22, fontWeight:900, color:C.text1, marginBottom:8 }}>예약 완료!</div>
        <div style={{ fontSize:14, color:C.text3, lineHeight:1.8, marginBottom:S.xxl }}>{step==="done"?"에스크로 예치 완료. 착공 확인 후 업체에 지급됩니다.":"직거래로 예약됐어요. 업체와 채팅으로 결제 조율하세요."}</div>
        <button onClick={() => onChat(selBid.company)} style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand}44`, marginBottom:S.sm }}>💬 {selBid.company.name}와 채팅하기</button>
        <button onClick={onBack} style={{ width:"100%", padding:S.lg, background:"none", color:C.text3, border:"none", fontWeight:600, fontSize:14, cursor:"pointer" }}>홈으로</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <H title="입찰 현황" sub={`업체 ${bids.length}곳이 입찰했어요`} />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl, border:`1px solid ${C.brandM}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.brand }}>💡 업체 금액은 선택 전까지 서로 모릅니다</div>
        </div>
        {bids.map(bid => (
          <div key={bid.id} style={{ background:C.surface, borderRadius:R.xl, marginBottom:S.md, border:`1px solid ${C.bgWarm}`, overflow:"hidden" }}>
            <div style={{ padding:S.xl }}>
              <div style={{ display:"flex", gap:S.md, alignItems:"flex-start", marginBottom:S.lg }}>
                <div style={{ width:44, height:44, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:C.brand }}>{bid.company.name[0]}</div>
                <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{bid.company.name}</div><TempBadge temp={bid.company.temp} /></div>
                <div style={{ textAlign:"right" }}><div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{bid.price.toLocaleString()}만원</div><div style={{ fontSize:11, color:C.text3 }}>{bid.period}일</div></div>
              </div>
              <div style={{ fontSize:13, color:C.text2, marginBottom:S.md, fontStyle:"italic" }}>{bid.comment}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:S.sm }}>
                <button onClick={() => onChat(bid.company)} style={{ width:"100%", padding:"11px", background:C.surface, color:C.text2, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer" }}>💬 상담하기</button>
                <button onClick={() => { setSelBid(bid); setStep("confirm"); }} style={{ width:"100%", padding:"11px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 3px 12px ${C.brand}44` }}>✅ 이 업체로 선택하기</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
