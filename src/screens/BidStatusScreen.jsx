import { useState, useEffect, useRef } from "react";
import { C, R, S } from "../constants";
import { SHOW_DEBUG_UI } from "../constants/release";
import { TempBadge } from "../components/common";
import ProtectionNotice from "../components/ProtectionNotice";
import DisputeNotice from "../components/DisputeNotice";
import SpaceProtectionBadge from "../components/SpaceProtectionBadge";
import { fmtMoney, calculateStagePayments } from "../utils/calculations";
import { supabase, getBidsForRequest, createPaymentOrder, getPaymentOrderByBid, updatePaymentOrderStatus, createPaymentTransaction, setRequestInProgress, getOrCreateEscrow, createEscrowPayoutsForContract, deleteEscrowRecord, createNotification, logActivity, getPaymentOrderByRequest, requestSiteVisit, resolveCompanyId, approveFinalQuote, getEstimateForRequest } from "../lib/supabase";
import {
  PAYMENT_METHODS, COMING_SOON_MESSAGE, ACTIVE_PROVIDER, getMethodMeta,
  loadFeeRules, feeRateFromRules, computeFeeWithRate, getProvider,
} from "../services/payment";

const SAFE_MODE = import.meta.env.VITE_SAFE_MODE === "true";

const DEFAULT_COMPANY = { id: null, name: "선택된 파트너", temp: 36.5, verified: false, badge: "basic", completedJobs: 0, recontractRate: 0, asRate: 0, region: "", online: false };

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


export default function BidStatusScreen({ onBack, onChat, onEscrow, onReview, bids: propBids, submittedBids, request, selectedBid, setSelectedBid, setEscrowContracts, userId }) {
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
  const siteVisitRef = useRef(false); // 현장방문 요청 동기 가드
  // 현장방문 견적 흐름 단계: open(최초 선택) → site_visit → final_quote_submitted → escrow_pending
  // final_quote_submitted/escrow_pending 에서만 에스크로 결제로 진행한다.
  const reqStatus = request?.status ?? "open";
  const isQuotePhase = reqStatus === "final_quote_submitted" || reqStatus === "escrow_pending";
  // 이미 업체가 선정된(또는 계약 진행) 상태인가 — 선정 후에는 '현장견적 요청' 대신
  // 곧바로 에스크로 결제/예약 확정 단계로 진입한다(중복 site_visit 생성 방지).
  const isAwarded =
    reqStatus === "in_progress" || reqStatus === "selected" ||
    !!request?.selected_bid_id || !!request?.selected_company_id;
  // 선정 후 → 에스크로 결제 및 예약 확정 단계로 이동(reserved → payment).
  const handleEscrowPaymentStart = () => setStep("reserved");

  // 최종 견적서(현장방문 후 업체 제출) — 의뢰인 확인용. 견적 단계에서만 조회.
  const [finalEstimate, setFinalEstimate] = useState(null);
  useEffect(() => {
    if (!isQuotePhase || !request?.id) { setFinalEstimate(null); return; }
    let alive = true;
    getEstimateForRequest(request.id)
      .then(({ data }) => { if (alive) setFinalEstimate(data ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isQuotePhase, request?.id]);

  // 최종견적 단계 진입 시 선택된 업체로 바로 견적 확인(confirm) 단계로 이동.
  useEffect(() => {
    if (!isQuotePhase || selBid || step !== "list") return;
    const chosen = bids.find(b => b.status === "selected") ?? (bids.length === 1 ? bids[0] : null);
    if (chosen) { setSelBid(chosen); setStep("confirm"); }
  }, [isQuotePhase, bids, selBid, step]);

  // 업체 선택 → 현장견적 요청: site_visits(status='requested') 실제 생성 + 요청 전이/입찰 선택.
  // 성공(실제 row 생성) 시에만 완료 화면으로 전환. 실패 시 토스트로 에러 노출(성공처럼 표시 X).
  const handleRequestSiteVisit = async () => {
    if (siteVisitRef.current || !selBid) return;
    if (!request?.id) { showLocalToast("요청 정보를 찾을 수 없어요"); return; }
    siteVisitRef.current = true;
    try {
      // bid.company_id 가 ownerId(users.id)로 저장된 기존 데이터 호환 — companies.id 로 resolve.
      // site_visit_request/respond RPC 는 companies.id 기준으로 동작하므로 반드시 변환 필요.
      const resolvedCompanyId = await resolveCompanyId(selBid.companyId);
      const { data, error } = await requestSiteVisit({
        requestId: request.id, bidId: selBid.id, companyId: resolvedCompanyId, actorId: userId,
      });

      // [진단·개발 전용] 현장견적요청 클릭 시 site_visits 생성/요청 전이 결과 확인.
      if (SHOW_DEBUG_UI) {
        const { data: after } = await supabase
          .from("requests").select("status, selected_company_id, selected_bid_id")
          .eq("id", request.id).maybeSingle();
        const diag = {
          action: "site_visit_request",
          sent_request_id: request.id, sent_bid_id: selBid.id,
          raw_company_id: selBid.companyId, resolved_company_id: resolvedCompanyId,
          sent_actor_id: userId,
          created_site_visit_id: data?.id ?? null, created_status: data?.status ?? null,
          rpc_error: error?.message ?? null,
          after_status: after?.status ?? null,
          after_selected_company_id: after?.selected_company_id ?? null,
          after_selected_bid_id: after?.selected_bid_id ?? null,
        };
        console.log("[GONGGAN_DEBUG][siteVisitRequest]", diag);
        setDbWriteLog(diag);
      }

      // 실패: site_visits row 미생성 → 성공 화면으로 넘어가지 않음.
      if (error || !data?.id) {
        showLocalToast("현장견적 요청 실패: " + (error?.message ?? "잠시 후 다시 시도해 주세요"));
        return;
      }

      const ownerId = selBid.company?.ownerId ?? null;
      if (ownerId) {
        createNotification({
          userId: ownerId, type: "SITE_VISIT_REQUESTED", title: "현장견적 요청 도착",
          message: `${request?.space_type ?? request?.type ?? "시공"} 요청에서 선택되었어요. 현장견적 요청을 확인해 주세요.`,
          relatedId: request?.id ?? null, relatedType: "request", priority: "HIGH",
        }).catch(() => {});
      }
      setStep("siteVisitDone");
    } catch (e) {
      showLocalToast("현장견적 요청 오류: " + (e?.message ?? String(e)));
    } finally {
      siteVisitRef.current = false;
    }
  };
  const [bidScreenDebug, setBidScreenDebug] = useState(null);
  const [dbWriteLog, setDbWriteLog] = useState(null);
  const [localToast, setLocalToast] = useState(null);
  const showLocalToast = (msg) => { setLocalToast(msg); setTimeout(() => setLocalToast(null), 3000); };

  // 수수료 규칙(payment_fee_rules) — 3.7% 하드코딩 대신 DB 규칙에서 요율 조회.
  // 미조회 시 service 의 폴백 요율 사용(시드값과 동일 → 동작 보존).
  const [feeRules, setFeeRules] = useState(null);
  useEffect(() => { loadFeeRules().then(setFeeRules).catch(() => {}); }, []);
  // 결제수단별 요율(만원 단위 금액 기준). 수단 미선택 시 CARD 기준으로 미리보기.
  const rateFor = (method) => feeRateFromRules(feeRules, method ?? "CARD", ACTIVE_PROVIDER);

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

  if (step==="siteVisitDone") return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <BidScreenHeader title="현장방문 견적 요청" onBack={onBack} />
      <div style={{ padding:`${S.xxl}px ${S.xl}px`, textAlign:"center" }}>
        <div style={{ fontSize:44, marginBottom:14 }}>📍</div>
        <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:10 }}>현장방문 견적을 요청했어요</div>
        <div style={{ fontSize:14, color:C.text3, lineHeight:1.8, marginBottom:28 }}>
          선택하신 업체가 현장을 방문해 확인한 뒤<br/>최종 견적서를 보내드립니다.<br/>
          최종 견적서가 도착하면 확인 후 안전결제로 진행할 수 있어요.
        </div>
        <button onClick={onBack} style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer" }}>
          확인
        </button>
      </div>
    </div>
  );

  if (step==="confirm" && selBid) {
    const stages = calculateStagePayments(selBid.price);
    const { feeAmount: escrowFee, total: customerTotal } = computeFeeWithRate(selBid.price, rateFor(selectedMethod));
    return (
      <div style={{ minHeight:"100vh", background:C.bg }}>
        <BidScreenHeader title={isQuotePhase ? "최종 견적서 확인" : "예약 확인"} onBack={goBack} />
        <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
          {isQuotePhase && finalEstimate && (
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.brandM}` }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.brand, marginBottom:S.md }}>📋 업체가 보낸 최종 견적서</div>
              {Array.isArray(finalEstimate.items) && finalEstimate.items.length > 0 && (
                <div style={{ marginBottom:S.md }}>
                  {finalEstimate.items.map((it, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
                      <div style={{ flex:1, paddingRight:S.sm }}>
                        <div style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{it.name || "공정"}</div>
                        <div style={{ fontSize:11, color:C.text3 }}>{[it.material, (it.qty != null ? `${it.qty}개` : null)].filter(Boolean).join(" · ")}</div>
                      </div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text2, whiteSpace:"nowrap" }}>{fmtMoney(it.amount ?? (Number(it.qty)||0)*(Number(it.unit_price)||0))}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.brandL, borderRadius:R.md, padding:S.md, marginBottom:finalEstimate.note || finalEstimate.warranty_note || finalEstimate.duration_days ? S.md : 0 }}>
                <span style={{ fontSize:13, fontWeight:800, color:C.brand }}>총 견적 금액</span>
                <span style={{ fontSize:18, fontWeight:900, color:C.brand }}>{fmtMoney(finalEstimate.total_price ?? 0)}</span>
              </div>
              {finalEstimate.duration_days != null && (
                <div style={{ fontSize:12, color:C.text2, marginBottom:S.xs }}>⏱ 예상 공사기간 <b>{finalEstimate.duration_days}일</b></div>
              )}
              {finalEstimate.note && (
                <div style={{ fontSize:12, color:C.text2, lineHeight:1.7, marginTop:S.xs }}><b>견적 메모</b><br/>{finalEstimate.note}</div>
              )}
              {finalEstimate.warranty_note && (
                <div style={{ fontSize:12, color:C.text2, lineHeight:1.7, marginTop:S.sm }}><b>하자보수 조건</b><br/>{finalEstimate.warranty_note}</div>
              )}
            </div>
          )}
          <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.lg }}>
              <div style={{ width:48, height:48, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:C.brand }}>{(selBid.company?.name ?? "?")[0]}</div>
              <div style={{ flex:1 }}><div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{selBid.company?.name ?? "선택된 파트너"}</div><TempBadge temp={selBid.company?.temp ?? 36.5} /></div>
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
          <button
            onClick={isQuotePhase
              ? () => { if (reqStatus === "final_quote_submitted" && request?.id) approveFinalQuote(request.id, userId).catch(() => {}); setStep("reserved"); }
              : isAwarded
              ? handleEscrowPaymentStart
              : handleRequestSiteVisit}
            style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand}44` }}>
            {isQuotePhase
              ? "예약 확정하고 결제 진행 ✅"
              : isAwarded
              ? "위 내용으로 에스크로 결제 및 예약 확정하기 →"
              : "현장방문 견적 요청하기 →"}
          </button>
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
            <div><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{selBid.company?.name ?? "선택된 파트너"}</div><div style={{ fontSize:13, color:C.text3 }}>{fmtMoney(selBid.price)} · {selBid.period}일</div></div>
          </div>
          <div style={{ background:C.brandL, borderRadius:R.lg, padding:`${S.sm}px ${S.md}px`, fontSize:13, color:C.brand, fontWeight:700, textAlign:"center" }}>🎉 예약 확정 완료</div>
        </div>
        <div style={{ marginBottom:S.md }}>
          <SpaceProtectionBadge variant="list" />
        </div>
        <div style={{ marginBottom:S.md }}>
          <ProtectionNotice variant="short" />
        </div>
        <div style={{ marginBottom:S.md }}>
          <DisputeNotice variant="short" />
        </div>
        {/* 직거래 경고 — 계약 화면 */}
        <div style={{ marginBottom:S.xl, fontSize:12, color:C.text3, lineHeight:1.7, textAlign:"center" }}>
          직거래 시 에스크로 보호, 분쟁지원, 공간보증이 모두 사라집니다.
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
    const feeRate = rateFor(selectedMethod);
    const { feeAmount: fee, total: customerTotal } = computeFeeWithRate(selBid.price, feeRate);
    const stages = calculateStagePayments(selBid.price);

    const handlePay = async () => {
      if (!selectedMethod && !SAFE_MODE) return;
      if (payingRef.current) return; // H-1: 이미 처리 중이면 재진입 차단 (이중 결제/계약 방지)
      payingRef.current = true;
      setPaymentLoading(true);
      const feeSnapshot = { provider: ACTIVE_PROVIDER, paymentMethod: selectedMethod, customerFeeRate: feeRate, companyFeeRate: 0.044, vatRate: 0.1, snapshotAt: new Date().toISOString() };

      const runDBWrites = async (pgPaymentKey = null) => {
        let contractId = null;
        const log = {};
        try {
          const guardOk = selBid.id && !String(selBid.id).startsWith("tmp-") && selBid.companyId && request?.id;
          log.guard = guardOk ? "ok" : `SKIP bid=${selBid.id} co=${selBid.companyId} req=${request?.id}`;
          if (!guardOk) { setDbWriteLog(log); return; }

          // ── 1. escrow_payments (멱등 — 중복 생성 방지) ──────────
          const { data: escrowData, created: escrowCreated, error: escrowErr } = await getOrCreateEscrow({
            requestId:   request.id,
            companyId:   selBid.companyId,
            totalAmount: selBid.price,
          });
          log.escrow = escrowData ? `${escrowData.id.slice(0, 8)}${escrowCreated ? "" : "(reuse)"}` : (escrowErr?.message ?? "null");
          setDbWriteLog({ ...log });

          if (!escrowData) { setDbWriteLog(log); return; }
          contractId = escrowData.id;

          // ── 2. escrow_payouts (10/20/40/30%) — 신규 에스크로에만 생성 ──
          // 기존 에스크로 재사용 시 payout 이 이미 존재하므로 중복 생성하지 않는다.
          if (escrowCreated) {
            const { error: payoutsErr } = await createEscrowPayoutsForContract(
              escrowData.id, selBid.companyId, selBid.price, 0.04, 0.1
            );
            // H-6: payout 생성 실패 시 방금 만든 escrow를 롤백하고 중단.
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
          } else {
            log.payouts = "reuse(existing escrow)";
          }
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
              provider:       ACTIVE_PROVIDER,
              amount:         selBid.price,
              fee_amount:     fee,
              net_amount:     selBid.price,
              customer_fee:   fee,
              vat:            Math.round(fee * 0.1),
              total_amount:   customerTotal,
              payment_method: selectedMethod ?? "CARD",
              payment_source: "original",
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
              provider:         ACTIVE_PROVIDER,
              payment_method:   selectedMethod ?? "CARD",
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
          // H-E: SDK 로드 타임아웃(15초)은 provider(tossProvider) 내부에서 처리 →
          // onload가 영원히 오지 않아도 payingRef 영구 잠금 방지. 타임아웃/오류 시
          // catch로 fallback → runDBWrites 시뮬레이션 실행 → payingRef 해제.
          const tossMethod = getMethodMeta(selectedMethod)?.tossMethod ?? "카드";
          // This will redirect to Toss — return value is never reached
          await getProvider(ACTIVE_PROVIDER).requestPayment({
            clientKey,
            tossMethod,
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
                  onClick={() => m.available ? setSelectedMethod(m.id) : showLocalToast(COMING_SOON_MESSAGE)}
                  style={{
                    display:"flex", alignItems:"center", gap:S.md, padding:S.xl,
                    borderBottom: idx < PAYMENT_METHODS.length - 1 ? `1px solid ${C.bgWarm}` : "none",
                    cursor: "pointer",
                    background: isSelected ? C.brandL : C.surface,
                    opacity: m.available ? 1 : 0.5,
                  }}>
                  <span style={{ fontSize:22, width:32, textAlign:"center" }}>{m.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text1 }}>
                      {m.label}
                      {!m.available && <span style={{ marginLeft:6, fontSize:10, fontWeight:700, color:C.red, background:C.bgWarm, borderRadius:R.full, padding:"1px 7px" }}>준비중</span>}
                    </div>
                    <div style={{ fontSize:11, color: m.available ? C.text3 : C.red }}>
                      {m.available ? m.desc : "준비중 · 가맹 승인 후 제공"}
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
                  <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{bid.company?.name ?? "파트너"}</div><TempBadge temp={bid.company?.temp ?? 36.5} /></div>
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
