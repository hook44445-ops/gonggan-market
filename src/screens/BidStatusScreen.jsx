import { useState, useEffect, useRef } from "react";
import { C, R, S } from "../constants";
import { SHOW_DEBUG_UI } from "../constants/release";
import { TempBadge } from "../components/common";
import ProtectionNotice from "../components/ProtectionNotice";
import DisputeNotice from "../components/DisputeNotice";
import { fmtMoney, calculateCustomerTotal, calculateStagePayments } from "../utils/calculations";
import { supabase, getBidsForRequest, createPaymentOrder, getPaymentOrderByBid, updatePaymentOrderStatus, createPaymentTransaction, setRequestInProgress, createEscrowRecord, createEscrowPayoutsForContract, deleteEscrowRecord, createNotification, logActivity, getPaymentOrderByRequest } from "../lib/supabase";

const SAFE_MODE = import.meta.env.VITE_SAFE_MODE === "true";
import { calcCustomerFee } from "../utils/calculations";

const PAYMENT_METHODS = [
  { id: "CARD",            icon: "💳", label: "신용/체크카드",  desc: "TossPayments 안전결제",  available: true  },
  { id: "TRANSFER",        icon: "🏦", label: "계좌이체",       desc: "실시간 계좌이체",         available: true  },
  { id: "VIRTUAL_ACCOUNT", icon: "📋", label: "가상계좌",       desc: "24시간 무통장입금",       available: true  },
  { id: "KAKAO_PAY",       icon: "💛", label: "카카오페이",     desc: "심사 후 제공 예정",       available: false },
  { id: "NAVER_PAY",       icon: "💚", label: "네이버페이",     desc: "심사 후 제공 예정",       available: false },
];

const TOSS_METHOD_MAP = { CARD: "카드", TRANSFER: "계좌이체", VIRTUAL_ACCOUNT: "가상계좌" };

const DEFAULT_COMPANY = { id: null, name: "—", temp: 0, verified: false, badge: "basic", completedJobs: 0, recontractRate: 0, asRate: 0, region: "", online: false };

const normalizeCompany = (row) => ({
  id: row.id, name: row.name ?? "업체", temp: row.temp ?? 36.5,
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


export default function BidStatusScreen({ onBack, onChat, onEscrow, onReview, bids: propBids, submittedBids, request, selectedBid, setSelectedBid, setEscrowContracts }) {
  const [localBids, setLocalBids] = useState(propBids ?? []);
  // 한 업체당 1입찰 정책 — 혹시 중복 입찰이 남아 있어도 업체별 최신 1건만 노출
  const rawBids = localBids.length > 0 ? localBids : (propBids ?? []);
  const bids = Object.values(
    rawBids.reduce((acc, b) => {
      const key = b.companyId ?? b.id;
      const prev = acc[key];
      if (!prev || new Date(b.createdAt ?? 0) > new Date(prev.createdAt ?? 0)) acc[key] = b;
      return acc;
    }, {})
  );
  const [step, setStep] = useState("list");
  const [selBid, setSelBid] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const payingRef = useRef(false); // H-1: 동기 더블서브밋 가드 (setState는 비동기라 즉시 차단 불가)
  const selectBidRef = useRef(false); // C-3: selectBid 동기 더블클릭 가드
  const [bidScreenDebug, setBidScreenDebug] = useState(null);
  const [dbWriteLog, setDbWriteLog] = useState(null);
  const [localToast, setLocalToast] = useState(null);
  const showLocalToast = (msg) => { setLocalToast(msg); setTimeout(() => setLocalToast(null), 3000); };

  // SELECT bids when screen loads (or request changes)
  useEffect(() => {
    if (!request?.id) { setLocalBids(propBids ?? []); return; }
    getBidsForRequest(request.id).then(({ data, error }) => {
      if (SHOW_DEBUG_UI) setBidScreenDebug({ src: "bidscreen_effect", req_id: request.id, count: data?.length ?? 0, err: error?.message ?? null, req_ids: (data ?? []).map(b => b.request_id) });
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
    // C-3: 빠른 연속 클릭 시 selBid 중복 설정 방지 (list로 돌아오면 해제)
    if (selectBidRef.current) return;
    selectBidRef.current = true;
    const safeBid = { ...bid, company: bid.company ?? { ...DEFAULT_COMPANY, id: bid.companyId } };
    setSelBid(safeBid);
    if (setSelectedBid) setSelectedBid(safeBid);
    setStep("confirm");
  };

  // C-3: list 단계로 돌아오면 selectBid 가드 해제 (다른 업체 재선택 허용)
  useEffect(() => {
    if (step === "list") selectBidRef.current = false;
  }, [step]);

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
              <div style={{ fontSize:11, fontWeight:700, color:C.brand, marginBottom:S.xs }}>💰 공간안전결제 에스크로 수수료 안내 (고객 부담)</div>
              {[["시공비", fmtMoney(selBid.price)], ["공간안전결제 에스크로 수수료 3.7% (VAT 포함)", `+${fmtMoney(escrowFee)}`]].map(([k, v]) => (
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
      <BidScreenHeader title="안전결제로 시작하기" onBack={goBack} />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:C.brand }}>{(selBid.company?.name ?? "?")[0]}</div>
            <div><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{selBid.company?.name ?? "—"}</div><div style={{ fontSize:13, color:C.text3 }}>{fmtMoney(selBid.price)} · {selBid.period}일</div></div>
          </div>
          <div style={{ background:C.brandL, borderRadius:R.lg, padding:`${S.sm}px ${S.md}px`, fontSize:13, color:C.brand, fontWeight:700, textAlign:"center" }}>🎉 예약 확정 완료</div>
        </div>
        <div style={{ marginBottom:S.md }}>
          <ProtectionNotice variant="short" />
        </div>
        <div style={{ marginBottom:S.xl }}>
          <DisputeNotice variant="short" />
        </div>
        <div onClick={() => setStep("payment")} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`2px solid ${C.brand}`, cursor:"pointer" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>공간안전결제로 진행</div>
            <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>🛡 보호</span>
          </div>
          <div style={{ fontSize:14, color:C.text3, lineHeight:1.8 }}>토스페이먼츠 보관 · 단계별 지급 · 분쟁 중재 지원</div>
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
      if (!selectedMethod && !SAFE_MODE) return;
      if (payingRef.current) return; // H-1: 이미 처리 중이면 재진입 차단 (이중 결제/계약 방지)
      payingRef.current = true;
      setPaymentLoading(true);
      const feeSnapshot = { customerFeeRate: 0.037, companyFeeRate: 0.044, vatRate: 0.1, snapshotAt: new Date().toISOString() };

      const runDBWrites = async (pgPaymentKey = null) => {
        let contractId = null;
        const log = {};
        try {
          const guardOk = selBid.id && !String(selBid.id).startsWith("tmp-") && selBid.companyId && request?.id;
          log.guard = guardOk ? "ok" : `SKIP bid=${selBid.id} co=${selBid.companyId} req=${request?.id}`;
          if (!guardOk) { setDbWriteLog(log); return; }

          // ── 1. escrow_payments ──────────────────────────────────
          const { data: escrowData, error: escrowErr } = await createEscrowRecord({
            requestId:   request.id,
            companyId:   selBid.companyId,
            totalAmount: selBid.price,
          });
          log.escrow = escrowData ? escrowData.id.slice(0, 8) : (escrowErr?.message ?? "null");
          setDbWriteLog({ ...log });

          if (!escrowData) { setDbWriteLog(log); return; }
          contractId = escrowData.id;

          // ── 2. escrow_payouts (10/20/40/30%) ────────────────────
          const { error: payoutsErr } = await createEscrowPayoutsForContract(
            escrowData.id, selBid.companyId, selBid.price, 0.04, 0.1
          );
          // H-6: payout 생성 실패 시 escrow를 롤백하고 중단.
          // payout 없는 escrow로 결제/계약을 진행하면 단계 표시가 깨지고
          // 업체에게 잘못된 계약 알림이 가므로, 여기서 멈추고 사용자에게 재시도를 유도.
          if (payoutsErr) {
            log.payouts = `FAILED:${payoutsErr.message} → 롤백`;
            await deleteEscrowRecord(escrowData.id).catch(() => {});
            setDbWriteLog({ ...log });
            showLocalToast("결제 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
            return; // payment_orders/알림 등 후속 단계 진행 금지
          }
          log.payouts = "ok(4 rows)";
          setDbWriteLog({ ...log });

          // ── 3. payment_orders ───────────────────────────────────
          const { data: existingOrder } = await getPaymentOrderByBid(selBid.id);
          let paymentOrderId = existingOrder?.id ?? null;
          if (!existingOrder) {
            const { data: newOrder, error: orderErr } = await createPaymentOrder({
              user_id:        request.user_id ?? null,
              bid_id:         selBid.id,
              request_id:     request.id,
              contract_id:    escrowData.id,
              amount:         selBid.price,
              customer_fee:   fee,
              vat:            Math.round(fee * 0.1),
              total_amount:   customerTotal,
              payment_method: selectedMethod ?? "CARD",
              fee_snapshot:   feeSnapshot,
              status:         "PAID",
            });
            log.payment_order = newOrder ? newOrder.id.slice(0, 8) : (orderErr?.message ?? "null");
            paymentOrderId = newOrder?.id ?? null;
          } else {
            log.payment_order = "existing:" + existingOrder.id.slice(0, 8);
            await updatePaymentOrderStatus(paymentOrderId, "PAID");
          }
          setDbWriteLog({ ...log });

          // ── 4. payment_transactions ─────────────────────────────
          if (paymentOrderId) {
            const { error: txErr } = await createPaymentTransaction({
              payment_order_id: paymentOrderId,
              pg_provider:      "toss",
              pg_payment_key:   pgPaymentKey ?? `test_${Date.now()}`,
              method:           selectedMethod ?? "CARD",
              amount:           customerTotal,
              status:           "DONE",
              approved_at:      new Date().toISOString(),
              raw_response:     { test_mode: !pgPaymentKey, method: selectedMethod },
            });
            log.tx = txErr ? txErr.message : "ok";
            setDbWriteLog({ ...log });
          }

          // ── 5. request → in_progress ────────────────────────────
          const { error: statusErr } = await setRequestInProgress(request.id);
          log.req_status = statusErr ? statusErr.message : "in_progress";
          setDbWriteLog({ ...log });

          // ── 6. notification + activity (fire-and-forget) ────────
          const companyOwnerId = selBid.company?.ownerId ?? null;
          if (companyOwnerId) {
            createNotification({
              userId:      companyOwnerId,
              type:        "COMPANY_SELECTED",
              title:       "계약 체결!",
              message:     `${request?.type ?? "시공"} 요청에서 선택되었습니다.`,
              relatedId:   escrowData.id,
              relatedType: "contract",
              priority:    "HIGH",
            }).catch(() => {});
          }
          logActivity({
            userId:     request.user_id ?? null,
            role:       "consumer",
            action:     "CONTRACT_CREATED",
            targetType: "contract",
            targetId:   escrowData.id,
            metadata:   { bidId: selBid.id, companyId: selBid.companyId, amount: selBid.price, paymentMethod: selectedMethod, feeSnapshot, pgPaymentKey },
          }).catch(() => {});

          if (setEscrowContracts) setEscrowContracts(prev => [...prev, { id: contractId, requestId: selBid.requestId, bidId: selBid.id, totalAmount: customerTotal, status: "active", createdAt: new Date().toISOString() }]);
          if (setSelectedBid) setSelectedBid(selBid);
          if (onEscrow) onEscrow({ ...selBid, contractId }); else setStep("done");
        } finally {
          setPaymentLoading(false);
          payingRef.current = false; // H-1: 가드 해제 (성공/실패/abort 모두)
        }
      };

      if (SAFE_MODE) { await runDBWrites(); return; }

      // Test mode: show toast
      showLocalToast("🧪 테스트 모드입니다. 실제 결제는 발생하지 않습니다.");

      const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
      if (clientKey && selectedMethod) {
        // Save pending payment info for recovery after Toss redirect
        try {
          localStorage.setItem("pg_pending", JSON.stringify({
            requestId: request?.id,
            requestUserId: request?.user_id,
            requestType: request?.type,
            bidId: selBid.id,
            bidPrice: selBid.price,
            companyId: selBid.companyId,
            companyOwnerId: selBid.company?.ownerId ?? null,
            companyName: selBid.company?.name ?? "업체",
            customerTotal,
            fee,
            paymentMethod: selectedMethod,
            savedAt: Date.now(),
          }));
        } catch {}

        const tossOrderId = `order_${Date.now()}`;
        try {
          // H-E: SDK 로드 타임아웃(15초) — onload가 영원히 오지 않을 때 payingRef 영구 잠금 방지.
          // 타임아웃/오류 시 catch로 fallback → runDBWrites 시뮬레이션 실행 → payingRef 해제.
          await Promise.race([
            new Promise((resolve, reject) => {
              if (window.TossPayments) { resolve(); return; }
              const s = document.createElement("script");
              s.src = "https://js.tosspayments.com/v1/payment";
              s.onload = resolve;
              s.onerror = () => reject(new Error("Toss SDK load failed"));
              document.head.appendChild(s);
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Toss SDK load timeout (15s)")), 15000)
            ),
          ]);
          const tossPayments = window.TossPayments(clientKey);
          const tossMethod = TOSS_METHOD_MAP[selectedMethod] ?? "카드";
          // This will redirect to Toss — return value is never reached
          await tossPayments.requestPayment(tossMethod, {
            amount: customerTotal,
            orderId: tossOrderId,
            orderName: `공간마켓 시공비 에스크로 (${request?.type ?? "시공"})`,
            customerName: "고객",
            successUrl: window.location.origin + "/?pg_success=1",
            failUrl:    window.location.origin + "/?pg_fail=1",
          });
          // If requestPayment didn't redirect (e.g. popup mode), fall through to DB writes
          await runDBWrites();
        } catch (err) {
          // H-E: SDK 로드 타임아웃·오류 → 사용자에게 알리고 시뮬레이션으로 fallback
          // payingRef는 runDBWrites의 finally 블록에서 해제된다.
          if (err?.message?.includes("timeout")) {
            showLocalToast("결제 서버 연결이 지연됩니다. 잠시 후 재시도해주세요.");
          }
          await runDBWrites();
        }
      } else {
        // No Toss key — simulate
        await runDBWrites();
      }
    };

    return (
      <div style={{ minHeight:"100vh", background:C.bg }}>
        <BidScreenHeader title="결제 수단 선택" onBack={goBack} />
        <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
          {/* Amount summary */}
          <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize:13, color:C.text3, marginBottom:4 }}>예치 금액 (시공비 + 공간안전결제 에스크로 수수료 3.7%, VAT 포함)</div>
            <div style={{ fontSize:32, fontWeight:900, color:C.text1, marginBottom:4 }}>{fmtMoney(customerTotal)}</div>
            <div style={{ fontSize:11, color:C.text4, marginBottom:S.md }}>시공비 {fmtMoney(selBid.price)} + 수수료 {fmtMoney(fee)}</div>
            {stages.map(({ name, percent, amount }) => (
              <div key={name} style={{ display:"flex", justifyContent:"space-between", padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text2 }}>{name} {percent}%</div>
                <div style={{ fontSize:13, fontWeight:800, color:C.brand }}>{fmtMoney(amount)}</div>
              </div>
            ))}
          </div>

          {/* 보호 범위 안내 (강제 체크박스 없음) */}
          <div style={{ marginBottom:S.lg }}>
            <ProtectionNotice variant="full" />
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

          {SHOW_DEBUG_UI && SAFE_MODE && (
            <div style={{ background:"#FBF5E8", borderRadius:R.lg, padding:`${S.sm}px ${S.md}px`, marginBottom:S.md, fontSize:12, color:"#B08040", fontWeight:700, textAlign:"center" }}>
              🔧 SAFE_MODE: 실제 결제 비활성 (테스트 모드)
            </div>
          )}

          {!SAFE_MODE && SHOW_DEBUG_UI && (
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
        {localToast && (
          <div style={{ position:"fixed", bottom:100, left:"50%", transform:"translateX(-50%)", background:"rgba(0,0,0,0.82)", color:"#fff", borderRadius:20, padding:"10px 20px", fontSize:13, fontWeight:600, zIndex:500, whiteSpace:"nowrap", pointerEvents:"none" }}>
            {localToast}
          </div>
        )}
      </div>
    );
  }

  if ((step==="done" || step==="done_direct") && selBid) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:S.xxl }}>
      <div style={{ width:"100%", maxWidth:390, textAlign:"center" }}>
        {SHOW_DEBUG_UI && dbWriteLog && (
          <div style={{ marginBottom:16, background:"rgba(0,0,0,0.92)", color:"#0f0", borderRadius:8, padding:"8px 12px", fontSize:11, lineHeight:2, fontFamily:"monospace", textAlign:"left" }}>
            [DEV:db_writes]<br/>
            {Object.entries(dbWriteLog).map(([k,v]) => (
              <span key={k} style={{display:"block", color: String(v).startsWith("ok") || String(v).match(/^[0-9a-f]{8}/) ? "#0f0" : "#f66"}}>
                {k}: {String(v)}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:22, fontWeight:900, color:C.text1, marginBottom:8 }}>예약 완료!</div>
        <div style={{ fontSize:14, color:C.text3, lineHeight:1.8, marginBottom:S.xxl }}>에스크로 예치 완료. 착공 확인 후 업체에 지급됩니다.</div>
        <button onClick={() => onChat(selBid.company ?? { id: selBid.companyId, name: "업체" })} style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand}44`, marginBottom:S.sm }}>💬 {selBid.company?.name ?? "업체"}와 채팅하기</button>
        {/* H-B: 레거시 done_direct 경로 안전장치(현재 도달 안 함). 에스크로 리뷰는 EscrowScreen.onReview에서 처리. */}
        {step === "done_direct" && onReview && selBid.company && (
          <button onClick={() => onReview(selBid.company)} style={{ width:"100%", padding:S.lg, background:"none", color:C.brand, border:`1px solid ${C.brand}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:S.sm }}>⭐ 시공 후기 작성하기</button>
        )}
        <button onClick={onBack} style={{ width:"100%", padding:S.lg, background:"none", color:C.text3, border:"none", fontWeight:600, fontSize:14, cursor:"pointer" }}>홈으로</button>
      </div>
    </div>
  );

  // Bid list — empty state maintains container layout
  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <BidScreenHeader title="업체 비교하기" sub={request ? `${request.type} · 업체 ${bids.length}곳 입찰` : `업체 ${bids.length}곳이 입찰했어요`} onBack={goBack} />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        {SHOW_DEBUG_UI && (
          <div style={{ marginBottom:12, background:"rgba(0,0,0,0.92)", color:"#0f0", borderRadius:8, padding:"8px 12px", fontSize:11, lineHeight:2, fontFamily:"monospace", maxHeight:400, overflowY:"auto" }}>
            [DEV:bidscreen]<br/>
            <span style={{color:"#4ff"}}>request.id (full): {request?.id ?? "null ⚠️"}</span><br/>
            request.type: {request?.type ?? "—"} | request.bidCount: {request?.bidCount ?? "—"}<br/>
            propBids.length: {(propBids ?? []).length} | localBids.length: {localBids.length}<br/>
            <span style={{color:"#4ff"}}>bids(displayed): {bids.length}</span><br/>
            fetch_src: {bidScreenDebug?.src ?? "—"}<br/>
            <span style={{color:"#4ff"}}>fetch_req_id (full): {bidScreenDebug?.req_id ?? "—"}</span><br/>
            fetched_count: {bidScreenDebug?.count ?? "—"}<br/>
            <span style={{color: bidScreenDebug?.err ? "#f66" : "#0f0"}}>fetch_err: {bidScreenDebug?.err ?? "none"}</span><br/>
            {dbWriteLog && (<>
              <span style={{color:"#ff0"}}>── DB write results ──</span><br/>
              {Object.entries(dbWriteLog).map(([k,v]) => (
                <span key={k} style={{display:"block", color: String(v).startsWith("ok") || String(v).match(/^[0-9a-f]{8}/) ? "#0f0" : "#f66"}}>
                  {k}: {String(v)}
                </span>
              ))}
            </>)}
            <span style={{color:"#ff0"}}>── bids_req_ids (full) ──</span><br/>
            {(bidScreenDebug?.req_ids ?? []).map((id, i) => <span key={i} style={{display:"block", color:"#8ff", paddingLeft:8}}>[{i}] {id}</span>)}
            {(bidScreenDebug?.req_ids ?? []).length === 0 && <span style={{color:"#f88"}}>bids_req_ids: [] (fetch 결과 없음)<br/></span>}
            <span style={{color:"#ff0"}}>── each bid ──</span><br/>
            {bids.map((b, i) => (
              <span key={b.id} style={{display:"block", color: b.requestId === request?.id ? "#0f0" : "#f66"}}>
                [{i}] bid:{b.id} req:{b.requestId} {b.requestId === request?.id ? "✅match" : "❌MISMATCH"}
              </span>
            ))}
          </div>
        )}
        <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.md, border:`1px solid ${C.brandM}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.brand }}>💡 업체 금액은 선택 전까지 서로 모릅니다</div>
          <div style={{ fontSize:12, color:C.brand, marginTop:4, opacity:0.8 }}>기록과 리뷰를 보고 안심하고 선택하세요</div>
        </div>
        <div style={{ marginBottom:S.xl }}>
          <ProtectionNotice variant="short" />
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
