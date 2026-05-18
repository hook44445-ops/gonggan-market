import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { TempBadge } from "../components/common";
import { fmtMoney, calculateCustomerTotal, calculateStagePayments } from "../utils/calculations";
import { supabase, getBidsForRequest, createPaymentOrder, getPaymentOrderByBid, updatePaymentOrderStatus, createPaymentTransaction, setRequestInProgress, createEscrowRecord, createEscrowPayoutsForContract, createNotification, logActivity } from "../lib/supabase";

const SAFE_MODE = import.meta.env.VITE_SAFE_MODE === "true";
import { calcCustomerFee } from "../utils/calculations";

const PAYMENT_METHODS = [
  { id: "CARD",            icon: "💳", label: "신용/체크카드",  desc: "TossPayments 안전결제",  available: true  },
  { id: "TRANSFER",        icon: "🏦", label: "계좌이체",       desc: "실시간 계좌이체",         available: true  },
  { id: "VIRTUAL_ACCOUNT", icon: "📋", label: "가상계좌",       desc: "24시간 무통장입금",       available: true  },
  { id: "KAKAO_PAY",       icon: "💛", label: "카카오페이",     desc: "심사 후 제공 예정",       available: false },
  { id: "NAVER_PAY",       icon: "💚", label: "네이버페이",     desc: "심사 후 제공 예정",       available: false },
];

const DEFAULT_COMPANY = { id: null, name: "—", temp: 0, verified: false, badge: "basic", completedJobs: 0, recontractRate: 0, asRate: 0, region: "", online: false };

const normalizeCompany = (row) => ({
  id: row.id, name: row.name ?? "업체", temp: row.temp ?? 70,
  verified: row.verified ?? false, badge: row.badge ?? "basic",
  completedJobs: row.completed_jobs ?? 0, recontractRate: row.recontract_rate ?? 0,
  asRate: row.as_rate ?? 0, region: row.region ?? "", online: row.online ?? false,
  ownerId: row.owner_id ?? null,
  companyStatus: row.company_status ?? "PENDING",
});
const normalizeBid = (row) => ({
  id: row.id, requestId: row.request_id, companyId: row.company_id,
  company: row.companies ? normalizeCompany(row.companies) : { ...DEFAULT_COMPANY, id: row.company_id },
  price: row.price, period: row.period_days,
  material: row.material_note ?? "", comment: row.comment ?? "",
  createdAt: row.created_at, status: row.selected ? "selected" : "pending",
});

// Hoisted outside the component so it is never in a TDZ when used in early returns
function BidScreenHeader({ title, sub, onBack }) {
  return (
    <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`, display:"flex", alignItems:"center", gap:S.md }}>
      <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
      <div>
        <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{title}</div>
        {sub && <div style={{ fontSize:12, color:C.text3 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function BidStatusScreen({ onBack, onChat, onEscrow, bids: propBids, submittedBids, request, selectedBid, setSelectedBid, setEscrowContracts }) {
  const [localBids, setLocalBids] = useState(propBids ?? []);
  const bids = localBids.length > 0 ? localBids : (propBids ?? []);
  const [step, setStep] = useState("list");
  const [selBid, setSelBid] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // SELECT bids when screen loads (or request changes)
  useEffect(() => {
    if (!request?.id) { setLocalBids(propBids ?? []); return; }
    getBidsForRequest(request.id).then(({ data, error }) => {
      if (error) return;
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
    const safeBid = { ...bid, company: bid.company ?? { ...DEFAULT_COMPANY, id: bid.companyId } };
    setSelBid(safeBid);
    if (setSelectedBid) setSelectedBid(safeBid);
    setStep("confirm");
  };

  const goBack = () => step === "list" ? onBack() : setStep("list");

  if (step==="confirm" && selBid) {
    const stages = calculateStagePayments(selBid.price);
    const customerTotal = calculateCustomerTotal(selBid.price);
    const escrowFee = Math.round((customerTotal - selBid.price) * 10) / 10;
    return (
      <div style={{ minHeight:"100vh", background:C.bg }}>
        <BidScreenHeader title="예약 확인" onBack={goBack} />
        <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
          <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.lg }}>
              <div style={{ width:48, height:48, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:C.brand }}>{(selBid.company?.name ?? "?")[0]}</div>
              <div style={{ flex:1 }}><div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{selBid.company?.name ?? "—"}</div><TempBadge temp={selBid.company?.temp ?? 0} /></div>
              <div style={{ textAlign:"right" }}><div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{fmtMoney(selBid.price)}</div><div style={{ fontSize:12, color:C.text3 }}>{selBid.period}일</div></div>
            </div>
            <div style={{ fontSize:13, color:C.text2, marginBottom:S.md }}>{selBid.material}</div>
            <div style={{ background:C.brandL, borderRadius:R.md, padding:S.md, border:`1px solid ${C.brandM}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.brand, marginBottom:S.xs }}>💰 안전거래 수수료 안내 (고객 부담)</div>
              {[["시공비", fmtMoney(selBid.price)], ["안전거래 수수료 3% (VAT 별도)", `+${fmtMoney(escrowFee)}`]].map(([k, v]) => (
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
      <BidScreenHeader title="결제 방식 선택" onBack={goBack} />
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

    const handlePay = async () => {
      const feeSnapshot = { customerFeeRate: 0.03, companyFeeRate: 0.04, vatRate: 0.1, snapshotAt: new Date().toISOString() };

      if (SAFE_MODE) {
        const contractId = `safe-${Date.now()}`;
        if (setEscrowContracts) setEscrowContracts(prev => [...prev, { id: contractId, requestId: selBid.requestId, bidId: selBid.id, totalAmount: customerTotal, status: "active", createdAt: new Date().toISOString() }]);
        if (setSelectedBid) setSelectedBid(selBid);
        if (onEscrow) { onEscrow({ ...selBid, contractId }); } else { setStep("done"); }
        return;
      }

      if (!selectedMethod) return;
      setPaymentLoading(true);
      let contractId = null;
      let orderId = null;

      try {
        if (selBid.id && !selBid.id.toString().startsWith("tmp-") && selBid.companyId && request?.id) {
          // 1. Create escrow record
          const { data: escrowData } = await createEscrowRecord({
            requestId:   request.id,
            companyId:   selBid.companyId,
            totalAmount: selBid.price,
          });
          if (escrowData) {
            contractId = escrowData.id;
            await createEscrowPayoutsForContract(escrowData.id, selBid.companyId, selBid.price, 0.04, 0.1);

            // 2. Create payment_order (PENDING → PAID flow)
            const { data: existingOrder } = await getPaymentOrderByBid(selBid.id);
            let paymentOrderId = existingOrder?.id ?? null;
            if (!existingOrder) {
              const { data: newOrder } = await createPaymentOrder({
                user_id:        request.user_id ?? null,
                bid_id:         selBid.id,
                request_id:     request.id,
                contract_id:    escrowData.id,
                amount:         selBid.price,
                customer_fee:   fee,
                vat:            Math.round(fee * 0.1),
                total_amount:   customerTotal,
                payment_method: selectedMethod,
                fee_snapshot:   feeSnapshot,
                status:         "PENDING",
              });
              paymentOrderId = newOrder?.id ?? null;
            }

            // 3. Mark payment PAID and record transaction
            if (paymentOrderId) {
              orderId = paymentOrderId;
              await updatePaymentOrderStatus(paymentOrderId, "PAID");
              await createPaymentTransaction({
                payment_order_id: paymentOrderId,
                pg_provider:      "toss",
                pg_payment_key:   `test_${Date.now()}`,
                method:           selectedMethod,
                amount:           customerTotal,
                status:           "DONE",
                approved_at:      new Date().toISOString(),
                raw_response:     { test_mode: true, method: selectedMethod },
              });
            }

            // 4. Notify company
            const companyOwnerId = selBid.company?.ownerId ?? null;
            if (companyOwnerId) {
              await createNotification({
                userId:      companyOwnerId,
                type:        "COMPANY_SELECTED",
                title:       "계약 체결!",
                message:     `${request?.type ?? "시공"} 요청에서 선택되었습니다. 에스크로 계약이 시작됩니다.`,
                relatedId:   escrowData.id,
                relatedType: "contract",
                priority:    "HIGH",
              });
            }
            // 5. Log activity
            await logActivity({
              userId:     request.user_id ?? null,
              role:       "consumer",
              action:     "CONTRACT_CREATED",
              targetType: "contract",
              targetId:   escrowData.id,
              metadata:   { bidId: selBid.id, companyId: selBid.companyId, amount: selBid.price, paymentMethod: selectedMethod, feeSnapshot },
            });
          }
          await setRequestInProgress(request.id);
        }

        if (setEscrowContracts) setEscrowContracts(prev => [...prev, { id: contractId ?? Date.now(), requestId: selBid.requestId, bidId: selBid.id, totalAmount: customerTotal, status: "active", createdAt: new Date().toISOString() }]);
        if (setSelectedBid) setSelectedBid(selBid);
        if (onEscrow) { onEscrow({ ...selBid, contractId }); } else { setStep("done"); }
      } finally {
        setPaymentLoading(false);
      }
    };

    return (
      <div style={{ minHeight:"100vh", background:C.bg }}>
        <BidScreenHeader title="결제 수단 선택" onBack={goBack} />
        <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
          {/* Amount summary */}
          <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize:13, color:C.text3, marginBottom:4 }}>예치 금액 (시공비 + 에스크로 수수료 3%, VAT 별도)</div>
            <div style={{ fontSize:32, fontWeight:900, color:C.text1, marginBottom:4 }}>{fmtMoney(customerTotal)}</div>
            <div style={{ fontSize:11, color:C.text4, marginBottom:S.md }}>시공비 {fmtMoney(selBid.price)} + 수수료 {fmtMoney(fee)}</div>
            {stages.map(({ name, percent, amount }) => (
              <div key={name} style={{ display:"flex", justifyContent:"space-between", padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text2 }}>{name} {percent}%</div>
                <div style={{ fontSize:13, fontWeight:800, color:C.brand }}>{fmtMoney(amount)}</div>
              </div>
            ))}
          </div>

          {/* Payment method selection */}
          <div style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden", marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
            {PAYMENT_METHODS.map((m, idx) => {
              const isSelected = selectedMethod === m.id;
              return (
                <div key={m.id}
                  onClick={() => m.available && setSelectedMethod(m.id)}
                  style={{
                    display:"flex", alignItems:"center", gap:S.md, padding:S.xl,
                    borderBottom: idx < PAYMENT_METHODS.length - 1 ? `1px solid ${C.bgWarm}` : "none",
                    cursor: m.available ? "pointer" : "default",
                    background: isSelected ? C.brandL : C.surface,
                    opacity: m.available ? 1 : 0.5,
                  }}>
                  <span style={{ fontSize:22, width:32, textAlign:"center" }}>{m.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text1 }}>{m.label}</div>
                    <div style={{ fontSize:11, color: m.available ? C.text3 : C.red }}>
                      {m.available ? m.desc : "준비중 · 가맹점 심사 후 제공"}
                    </div>
                  </div>
                  <div style={{ width:20, height:20, borderRadius:"50%",
                    border: `2px solid ${isSelected ? C.brand : C.bgWarm}`,
                    background: isSelected ? C.brand : "transparent",
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {isSelected && <div style={{ width:8, height:8, borderRadius:"50%", background:"#fff" }} />}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background:C.navyL, borderRadius:R.lg, padding:S.md, marginBottom:S.xl, fontSize:12, color:C.navy, display:"flex", gap:S.sm }}>
            <span>🛡</span><span>예치금은 공간마켓이 안전하게 보관하며 단계별 확인 후 업체에 지급됩니다</span>
          </div>

          {SAFE_MODE && (
            <div style={{ background:"#FBF5E8", borderRadius:R.lg, padding:`${S.sm}px ${S.md}px`, marginBottom:S.md, fontSize:12, color:"#B08040", fontWeight:700, textAlign:"center" }}>
              🔧 SAFE_MODE: 실제 결제 비활성 (테스트 모드)
            </div>
          )}

          {!SAFE_MODE && import.meta.env.DEV && (
            <div style={{ background:"#F0F4FF", borderRadius:R.lg, padding:S.md, marginBottom:S.lg, fontSize:11, color:"#4466CC" }}>
              🧪 테스트 모드 · 실제 결제가 발생하지 않습니다
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={(!selectedMethod && !SAFE_MODE) || paymentLoading}
            style={{ width:"100%", padding:S.xxl, background: (selectedMethod || SAFE_MODE) && !paymentLoading ? C.brand : C.bgWarm,
              color: (selectedMethod || SAFE_MODE) && !paymentLoading ? "#fff" : C.text4, border:"none", borderRadius:R.lg,
              fontWeight:800, fontSize:16, cursor: (selectedMethod || SAFE_MODE) && !paymentLoading ? "pointer" : "not-allowed",
              boxShadow: (selectedMethod || SAFE_MODE) && !paymentLoading ? `0 6px 20px ${C.brand}44` : "none" }}>
            {paymentLoading ? "처리 중..." : SAFE_MODE ? "🔧 테스트 예치 (SAFE_MODE)" : selectedMethod ? `🔒 ${fmtMoney(customerTotal)} 결제하기` : "결제 수단을 선택하세요"}
          </button>
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
      <BidScreenHeader title="업체 비교하기" sub={request ? `${request.type} · 업체 ${bids.length}곳 입찰` : `업체 ${bids.length}곳이 입찰했어요`} onBack={goBack} />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl, border:`1px solid ${C.brandM}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.brand }}>💡 업체 금액은 선택 전까지 서로 모릅니다</div>
          <div style={{ fontSize:12, color:C.brand, marginTop:4, opacity:0.8 }}>기록과 리뷰를 보고 안심하고 선택하세요</div>
        </div>

        {bids.length === 0 ? (
          <div style={{
            background:C.surface, borderRadius:R.xl, border:`1px solid ${C.bgWarm}`,
            minHeight:200, display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <div style={{ textAlign:"center", padding:S.xxl }}>
              <div style={{ fontSize:36, marginBottom:12 }}>💬</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.text3 }}>인근 업체들이 견적을 검토 중입니다</div>
              <div style={{ fontSize:12, color:C.text4, marginTop:6 }}>보통 24시간 내 입찰이 시작됩니다</div>
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
