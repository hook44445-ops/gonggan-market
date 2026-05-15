import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { TempBadge } from "../components/common";
import { fmtMoney, calculateCustomerTotal, calculateStagePayments } from "../utils/calculations";
import { supabase, getBidsForRequest } from "../lib/supabase";

const normalizeCompany = (row) => ({
  id: row.id, name: row.name ?? "업체", temp: row.temp ?? 70,
  verified: row.verified ?? false, badge: row.badge ?? "basic",
  completedJobs: row.completed_jobs ?? 0, recontractRate: row.recontract_rate ?? 0,
  asRate: row.as_rate ?? 0, region: row.region ?? "", online: row.online ?? false,
});
const normalizeBid = (row) => ({
  id: row.id, requestId: row.request_id, companyId: row.company_id,
  company: row.companies ? normalizeCompany(row.companies) : null,
  price: row.price, period: row.period_days,
  material: row.material_note ?? "", comment: row.comment ?? "",
  createdAt: row.created_at, status: row.selected ? "selected" : "pending",
});

export default function BidStatusScreen({ onBack, onChat, onEscrow, bids: propBids, submittedBids, request, selectedBid, setSelectedBid, setEscrowContracts }) {
  console.log("render BidStatusScreen", { request: request?.id, selectedBid: selectedBid?.id });
  const [localBids, setLocalBids] = useState(propBids ?? []);
  const bids = localBids.length > 0 ? localBids : (propBids ?? []);
  const [step, setStep] = useState("list");
  const [selBid, setSelBid] = useState(null);

  // SELECT bids when screen loads (or request changes)
  useEffect(() => {
    if (!request?.id) { setLocalBids(propBids ?? []); return; }
    getBidsForRequest(request.id).then(({ data, error }) => {
      if (error) { console.error("[BidStatusScreen] fetch failed:", error.message); return; }
      if (data) setLocalBids(data.map(normalizeBid));
    });
  }, [request?.id]);

  // Keep localBids in sync when propBids updates (e.g. optimistic from MainApp)
  useEffect(() => {
    if (propBids && propBids.length > localBids.length) setLocalBids(propBids);
  }, [propBids]);

  // Realtime: subscribe to new bid inserts for this request
  useEffect(() => {
    if (!request?.id) return;
    const channel = supabase
      .channel(`bidscreen:${request.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "bids",
        filter: `request_id=eq.${request.id}`,
      }, async () => {
        const { data } = await getBidsForRequest(request.id);
        if (data) setLocalBids(data.map(normalizeBid));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [request?.id]);

  const selectBid = (bid) => {
    console.log("[BidStatusScreen] customer selected bid:", bid.id, "company:", bid.company?.name, "price:", bid.price);
    setSelBid(bid);
    if (setSelectedBid) setSelectedBid(bid);
    setStep("confirm");
  };

  const H = ({ title, sub }) => (
    <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`, display:"flex", alignItems:"center", gap:S.md }}>
      <button onClick={() => step==="list" ? onBack() : setStep("list")} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
      <div><div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{title}</div>{sub && <div style={{ fontSize:12, color:C.text3 }}>{sub}</div>}</div>
    </div>
  );

  if (step==="confirm" && selBid) {
    const stages = calculateStagePayments(selBid.price);
    const customerTotal = calculateCustomerTotal(selBid.price);
    const escrowFee = Math.round((customerTotal - selBid.price) * 10) / 10;
    return (
      <div style={{ minHeight:"100vh", background:C.bg }}>
        <H title="예약 확인" />
        <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
          <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.lg }}>
              <div style={{ width:48, height:48, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:C.brand }}>{(selBid.company?.name ?? "?")[0]}</div>
              <div style={{ flex:1 }}><div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{selBid.company?.name ?? "—"}</div><TempBadge temp={selBid.company?.temp ?? 0} /></div>
              <div style={{ textAlign:"right" }}><div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{fmtMoney(selBid.price)}</div><div style={{ fontSize:12, color:C.text3 }}>{selBid.period}일</div></div>
            </div>
            <div style={{ fontSize:13, color:C.text2, marginBottom:S.md }}>{selBid.material}</div>
            <div style={{ background:C.brandL, borderRadius:R.md, padding:S.md, border:`1px solid ${C.brandM}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.brand, marginBottom:S.xs }}>💰 에스크로 이용료 안내 (고객 부담)</div>
              {[["시공비", fmtMoney(selBid.price)], ["에스크로 이용료 3%", `+${fmtMoney(escrowFee)}`]].map(([k, v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.text2, marginBottom:2 }}>
                  <span>{k}</span><span style={{ fontWeight:700 }}>{v}</span>
                </div>
              ))}
              <div style={{ height:1, background:C.brandM, margin:`${S.xs}px 0` }} />
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:13, fontWeight:800, color:C.text1 }}>총 예치 금액</span>
                <span style={{ fontSize:14, fontWeight:900, color:C.brand }}>{fmtMoney(customerTotal)}</span>
              </div>
            </div>
          </div>
          <div style={{ background:C.navyL, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`1px solid ${C.trustM}` }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.navy, marginBottom:S.md }}>🛡 에스크로 안전 정산</div>
            {stages.map(({ name, percent, amount }) => (
              <div key={name} style={{ display:"flex", justifyContent:"space-between", padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.trustM}` }}>
                <div><div style={{ fontSize:12, fontWeight:700, color:C.navy }}>{name} {percent}%</div><div style={{ fontSize:11, color:C.text3 }}>{name} 확인</div></div>
                <div style={{ fontSize:13, fontWeight:800, color:C.brand }}>{fmtMoney(amount)}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setStep("reserved")} style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand}44` }}>예약 확정하기 ✅</button>
        </div>
      </div>
    );
  }

  if (step==="reserved" && selBid) return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <H title="결제 방식 선택" />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:C.brand }}>{(selBid.company?.name ?? "?")[0]}</div>
            <div><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{selBid.company?.name ?? "—"}</div><div style={{ fontSize:13, color:C.text3 }}>{fmtMoney(selBid.price)} · {selBid.period}일</div></div>
          </div>
          <div style={{ background:C.brandL, borderRadius:R.lg, padding:`${S.sm}px ${S.md}px`, fontSize:13, color:C.brand, fontWeight:700, textAlign:"center" }}>🎉 예약 확정 완료 · 결제 방식 선택</div>
        </div>
        <div onClick={() => setStep("done_direct")} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.md, border:`1.5px solid ${C.bgWarm}`, cursor:"pointer" }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:4 }}>직거래</div>
          <div style={{ fontSize:12, color:C.text3, marginBottom:S.sm }}>업체와 직접 결제 · 공간마켓 보호 없음</div>
          <div style={{ background:"#FBF5E8", borderRadius:R.sm, padding:"6px 10px", fontSize:11, color:"#B08040" }}>⚠️ 분쟁 발생 시 공간마켓 개입 없음</div>
        </div>
        <div onClick={() => setStep("payment")} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`2px solid ${C.brand}`, cursor:"pointer" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>에스크로 안전 거래</div>
            <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>🛡 추천</span>
          </div>
          <div style={{ fontSize:12, color:C.text3 }}>공간마켓 보관 · 단계별 지급 · 분쟁 중재</div>
        </div>
        <button onClick={() => onChat(selBid.company ?? { id: selBid.companyId, name: "업체" })} style={{ width:"100%", padding:S.lg, background:"none", color:C.text3, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:600, fontSize:14, cursor:"pointer" }}>💬 먼저 업체와 상담하기</button>
      </div>
    </div>
  );

  if (step==="payment" && selBid) {
    const customerTotal = calculateCustomerTotal(selBid.price);
    const fee = Math.round((customerTotal - selBid.price) * 10) / 10;
    const stages = calculateStagePayments(selBid.price);
    return (
      <div style={{ minHeight:"100vh", background:C.bg }}>
        <H title="에스크로 전액 예치" />
        <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
          <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize:13, color:C.text3, marginBottom:4 }}>예치 금액 (에스크로 수수료 3% 포함)</div>
            <div style={{ fontSize:32, fontWeight:900, color:C.text1, marginBottom:4 }}>{fmtMoney(customerTotal)}</div>
            <div style={{ fontSize:11, color:C.text4, marginBottom:S.md }}>시공비 {fmtMoney(selBid.price)} + 수수료 {fmtMoney(fee)}</div>
            {stages.map(({ name, percent, amount }) => (
              <div key={name} style={{ display:"flex", justifyContent:"space-between", padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
                <div><div style={{ fontSize:12, fontWeight:700, color:C.text2 }}>{name} {percent}%</div></div>
                <div style={{ fontSize:13, fontWeight:800, color:C.brand }}>{fmtMoney(amount)}</div>
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
          <button onClick={() => {
            const contract = {
              id: Date.now(),
              requestId: selBid.requestId,
              bidId: selBid.id,
              totalAmount: customerTotal,
              customerFee: fee,
              platformFeeRate: 4,
              stages: calculateStagePayments(selBid.price),
              status: "active",
              createdAt: new Date().toISOString(),
            };
            if (setEscrowContracts) setEscrowContracts(prev => [...prev, contract]);
            if (setSelectedBid) setSelectedBid(selBid);
            if (onEscrow) { onEscrow(selBid); } else { setStep("done"); }
          }} style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand}44` }}>🔒 {fmtMoney(customerTotal)} 에스크로 예치하기</button>
        </div>
      </div>
    );
  }

  if ((step==="done" || step==="done_direct") && selBid) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:S.xxl }}>
      <div style={{ width:"100%", maxWidth:390, textAlign:"center" }}>
        <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:22, fontWeight:900, color:C.text1, marginBottom:8 }}>예약 완료!</div>
        <div style={{ fontSize:14, color:C.text3, lineHeight:1.8, marginBottom:S.xxl }}>{step==="done" ? "에스크로 예치 완료. 착공 확인 후 업체에 지급됩니다." : "직거래로 예약됐어요. 업체와 채팅으로 결제 조율하세요."}</div>
        <button onClick={() => onChat(selBid.company ?? { id: selBid.companyId, name: "업체" })} style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand}44`, marginBottom:S.sm }}>💬 {selBid.company?.name ?? "업체"}와 채팅하기</button>
        <button onClick={onBack} style={{ width:"100%", padding:S.lg, background:"none", color:C.text3, border:"none", fontWeight:600, fontSize:14, cursor:"pointer" }}>홈으로</button>
      </div>
    </div>
  );

  // Bid list — empty state maintains container layout
  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <H title="입찰 현황" sub={request ? `${request.type} · 업체 ${bids.length}곳 입찰` : `업체 ${bids.length}곳이 입찰했어요`} />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl, border:`1px solid ${C.brandM}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.brand }}>💡 업체 금액은 선택 전까지 서로 모릅니다</div>
        </div>

        {bids.length === 0 ? (
          <div style={{
            background:C.surface, borderRadius:R.xl, border:`1px solid ${C.bgWarm}`,
            minHeight:200, display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <div style={{ textAlign:"center", padding:S.xxl }}>
              <div style={{ fontSize:36, marginBottom:12 }}>💬</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.text3 }}>아직 입찰이 없습니다</div>
              <div style={{ fontSize:12, color:C.text4, marginTop:6 }}>인근 업체들이 견적을 검토하고 있어요</div>
            </div>
          </div>
        ) : (
          bids.map(bid => (
            <div key={bid.id} style={{ background:C.surface, borderRadius:R.xl, marginBottom:S.md, border:`1px solid ${C.bgWarm}`, overflow:"hidden" }}>
              <div style={{ padding:S.xl }}>
                <div style={{ display:"flex", gap:S.md, alignItems:"flex-start", marginBottom:S.lg }}>
                  <div style={{ width:44, height:44, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:C.brand }}>{(bid.company?.name ?? "?")[0]}</div>
                  <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{bid.company?.name ?? "—"}</div><TempBadge temp={bid.company?.temp ?? 0} /></div>
                  <div style={{ textAlign:"right" }}><div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{fmtMoney(bid.price)}</div><div style={{ fontSize:11, color:C.text3 }}>{bid.period}일</div></div>
                </div>
                <div style={{ fontSize:13, color:C.text2, marginBottom:S.md, fontStyle:"italic" }}>{bid.comment}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:S.sm }}>
                  <button onClick={() => onChat(bid.company ?? { id: bid.companyId, name: "업체" })} style={{ width:"100%", padding:"11px", background:C.surface, color:C.text2, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer" }}>💬 상담하기</button>
                  <button onClick={() => selectBid(bid)} style={{ width:"100%", padding:"11px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 3px 12px ${C.brand}44` }}>✅ 이 업체로 선택하기</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
