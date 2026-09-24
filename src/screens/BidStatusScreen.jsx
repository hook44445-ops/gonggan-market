import { RESPECT_FOR_CUSTOMER } from "../constants/mutualRespect";
import { useState, useEffect, useRef } from "react";
import { C, R, S } from "../constants";
import { SHOW_DEBUG_UI, UX_BETA, SHOW_BETA_UI } from "../constants/release";
import { dlog } from "../utils/devLog"; // 프로덕션 무출력 진단 로거(운영 콘솔 정리)
import { TempBadge, Icon, splitLeadingEmoji } from "../components/common";
import { getEscrowWithPayouts } from "../lib/supabase";
import NotificationBell from "../components/NotificationBell";
import BidCompareCard from "../components/BidCompareCard"; // UX Beta 입찰 비교 카드(Add Only)
import ProtectionNotice from "../components/ProtectionNotice";
import DisputeNotice from "../components/DisputeNotice";
import SpaceProtectionBadge from "../components/SpaceProtectionBadge";
import { fmtMoney, calculateStagePayments } from "../utils/calculations";
import { supabase, getBidsForRequest, createPaymentOrder, getPaymentOrderByBid, updatePaymentOrderStatus, createPaymentTransaction, setRequestInProgress, getOrCreateEscrow, createEscrowPayoutsForContract, deleteEscrowRecord, createNotification, logActivity, getPaymentOrderByRequest, requestSiteVisit, resolveCompanyId, approveFinalQuote, contractDirect, getEstimateForRequest, getPortfolios, postProjectEvent, getStagePlanPreview } from "../lib/supabase";
import QuoteDocument from "../components/QuoteDocument"; // 최종 견적서 미리보기·인쇄
import { SORT_KEYS, sortBids, bidSummary, bidTags as calcBidTags } from "../lib/bidCompare"; // 입찰 비교(정렬·요약·표)
import {
  PAYMENT_METHODS, COMING_SOON_MESSAGE, ACTIVE_PROVIDER, getMethodMeta,
  loadFeeRules, feeRateFromRules, computeFeeWithRate, getProvider,
} from "../services/payment";

import { BIZ_GRACE_HOURS } from "../lib/contractGate";

const SAFE_MODE = import.meta.env.VITE_SAFE_MODE === "true";

// 업체 정보를 못 불러왔을 때만 쓰는 자리 — 확인 안 된 칩이 켜지지 않게 badge 등 신뢰 칸은 비워 둔다(C1).
const DEFAULT_COMPANY = { id: null, name: "업체", temp: 36.5, verified: false, badge: null, completedJobs: 0, recontractRate: 0, asRate: 0, region: "", online: false };

const normalizeCompany = (row) => ({
  id: row.id, name: row.name ?? "업체", temp: row.temp ?? 36.5,
  verified: row.verified ?? false, badge: row.badge ?? "basic",
  completedJobs: row.completed_jobs ?? 0, recontractRate: row.recontract_rate ?? 0,
  asRate: row.as_rate ?? 0, region: row.region ?? "", online: row.online ?? false,
  ownerId: row.owner_id ?? null,
  companyStatus: row.company_status ?? "PENDING",
  // 신뢰 칸 — 관리자가 확인한 값만(카드 칩·엠블럼·레벨이 쓴다)
  hasInsurance: row.has_insurance ?? false,
  license_verified: row.license_verified ?? false,
  guarantee_status: row.guarantee_status ?? null,
  guarantee_grade: row.guarantee_grade ?? null,
  guarantee_amount: row.guarantee_amount ?? null,
  guarantee_badge_visible: row.guarantee_badge_visible ?? false,
  reviews: row.review_count ?? row.reviews ?? 0,
  level: row.level ?? row.growth_level ?? null,
});
const normalizeBid = (row) => ({
  id: row.id, requestId: row.request_id, companyId: row.company_id,
  company: row.companies ? normalizeCompany(row.companies) : { ...DEFAULT_COMPANY, id: row.company_id },
  price: row.price, period: row.period_days,
  material: row.material_note ?? "", comment: row.comment ?? "",
  createdAt: row.created_at, status: row.selected ? "selected" : "pending",
});

// Hoisted outside the component so it is never in a TDZ when used in early returns
function BidScreenHeader({ title, sub, onBack, userId }) {
  return (
    <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`, display:"flex", alignItems:"center", gap:S.md }}>
      <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{title}</div>
        {sub && <div style={{ fontSize:12, color:C.text3 }}>{sub}</div>}
      </div>
      {userId && <NotificationBell user={{ id: userId }} />}
    </div>
  );
}


export default function BidStatusScreen({ onBack, onChat, onEscrow, onReview, bids: propBids, submittedBids, request, selectedBid, setSelectedBid, setEscrowContracts, userId, onRefresh }) {
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
  const [siteVisitLoading, setSiteVisitLoading] = useState(false);
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
  const [showQuoteDoc, setShowQuoteDoc] = useState(false); // 최종 견적서 미리보기·인쇄
  const [sortKey, setSortKey] = useState("recommended"); // 입찰 정렬(표시 전용)
  const [tableView, setTableView] = useState(false);     // 한눈에 보는 표
  const [coPhotos, setCoPhotos] = useState({});          // { [companyId]: [사진 url] } — 업체가 올린 시공 사례
  useEffect(() => {
    if (!isQuotePhase || !request?.id) { setFinalEstimate(null); return; }
    let alive = true;
    getEstimateForRequest(request.id)
      .then(({ data }) => { if (alive) setFinalEstimate(data ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isQuotePhase, request?.id]);

  // 결제·에스크로 금액 기준: 최종 견적서가 제출된 견적 단계면 입찰가가 아니라 최종 견적 금액
  // (finalEstimate.total_price, 단위 만원 — 입찰가와 동일)을 따른다. 없으면 입찰가로 폴백.
  // → 비-견적 단계(일반 선택/에스크로 직행)는 항상 effectivePrice 와 동일하게 동작(회귀 없음).
  const effectivePrice = (isQuotePhase && Number(finalEstimate?.total_price) > 0)
    ? Number(finalEstimate.total_price)
    : (selBid?.price ?? 0);

  // 지급 계획(A3) 미리보기 — 업체 서류(사업자등록)와 금액으로 서버가 고른다. 계약 때 같은 값이 저장된다.
  const [stagePlan, setStagePlan] = useState("4STEP");
  const planCompanyRef = selBid?.companyId ?? selBid?.company?.id ?? null;
  useEffect(() => {
    let alive = true;
    if (!planCompanyRef || !(effectivePrice > 0)) return;
    getStagePlanPreview(planCompanyRef, effectivePrice).then(p => { if (alive) setStagePlan(p); }).catch(() => {});
    return () => { alive = false; };
  }, [planCompanyRef, effectivePrice]);
  // 계약은 사업자부터(A안) — 서버가 1STEP 을 준다 = 이 업체의 사업자등록이 아직 확인 전. 결제를 열지 않는다.
  //   화면에 온 업체 행이 «확인 안 됨»이라고 말해도 같다(행을 못 불러온 기본값 업체는 id 가 없어 여기 안 걸린다).
  //   결제 승인 서버(api/confirm-payment)도 같은 규칙으로 한 번 더 막는다.
  const bizPending = stagePlan === "1STEP" || (!!selBid?.company?.id && selBid.company.verified === false);
  const planNotice = bizPending
    ? { title: "업체의 사업자 확인을 기다리고 있어요", body: `공간마켓은 사업자등록을 마친 업체와만 계약해요. 업체에 사업자등록증 제출을 안내했고(홈택스에서 당일 발급), 확인되면 알림으로 알려 드릴게요. 선택 후 ${BIZ_GRACE_HOURS}시간이 지나도 확인이 안 되면 다른 업체를 골라도 공간온도에 영향이 없어요.` }
    : stagePlan === "2STEP"
      ? { title: "대금은 두 번에 나눠서", body: "500만원 미만 공사는 착공을 확인할 때 30%, 완료를 확인할 때 70%가 지급돼요." }
      : stagePlan === "3STEP"
      ? { title: "대금은 세 번에 나눠서", body: "착공을 확인할 때 30%(자재비 포함), 중간 점검을 확인할 때 40%, 완료를 확인할 때 30%가 지급돼요. 결제 직후 먼저 나가는 돈은 없어요." }
      : { title: "자재비 10% 선지급 안내", body: "이 업체는 공간보증(보증금)을 걸어 둬서 결제 완료 후 자재비 10%가 먼저 지급되고, 나머지는 착공·중간 점검·완료를 확인할 때마다 단계별로 지급돼요." };

  // 최종견적 단계 진입 시 선택된 업체로 바로 견적 확인(confirm) 단계로 이동.
  // [결제 진입 validation 완화] request.status 가 final_quote_submitted/escrow_pending(isQuotePhase)
  // 이면 입찰 status 가 stale(site_visiting 등)이어도 결제 진입을 막지 않는다.
  // 우선순위: request.selected_bid_id 매칭 → status==='selected' → 단일 입찰.
  // (bids/status DB 전이·estimates RPC/RLS·렌더링 로직은 미변경 — 선택 게이트만 status-tolerant.)
  useEffect(() => {
    if (!isQuotePhase || selBid || step !== "list" || paidEscrow) return;   // 계약된 공사는 결제 전 화면으로 넘기지 않는다(C17)
    // request 는 정규화(myRequests=selectedBidId) 또는 raw(selected_bid_id) 둘 다 올 수 있어 양쪽 매칭.
    const selBidId = request?.selected_bid_id ?? request?.selectedBidId ?? null;
    const chosen =
      (selBidId ? bids.find(b => b.id === selBidId) : null) ??
      bids.find(b => b.status === "selected") ??
      (bids[0] ?? null); // #5: 견적단계(isQuotePhase)에선 selected_bid_id 미매칭이어도 첫 입찰로 진입 — 결제 무반응 방지
    // 예약 확정과 결제를 한 화면에서(대표 09-24) — 최종 견적서 카드가 결제 화면 위에 붙는다.
    if (chosen) { setSelBid(chosen); setStep("payment"); }
  }, [isQuotePhase, bids, selBid, step]);

  // 업체 선택 → 현장견적 요청: site_visits(status='requested') 생성 + 요청 상태 전이.
  // 직접 UPDATE + .select().maybeSingle() 검증 — RLS 우회를 위해 SECURITY DEFINER RPC 시도 후 fallback.
  // DB 업데이트 성공 확인 후에만 siteVisitDone으로 전환 (낙관적 UI 업데이트 금지).
  // 현장방문 없이 입찰 금액 그대로 계약(대표 09-24 「현장방문 없이 계약 시행 버튼」, SQL 119).
  //   서버가 요청 주인·계약 전 여부를 확인하고 요청을 결제 대기로 바꾼다 → 곧장 결제 화면.
  const [directLoading, setDirectLoading] = useState(false);
  const handleContractDirect = async () => {
    if (!selBid?.id || !request?.id || directLoading) return;
    if (!window.confirm(`현장방문 없이 ${fmtMoney(selBid.price ?? 0)}(입찰 금액) 그대로 계약할까요?\n현장 확인이 필요 없는 작은 공사에 알맞아요.`)) return;
    setDirectLoading(true);
    try {
      const { data, error } = await contractDirect(request.id, selBid.id, userId);
      if (error || !data?.ok) {
        const m = error?.message ?? "";
        showLocalToast(/ALREADY_CONTRACTED/.test(m) ? "이미 계약된 공사예요."
          : /NOT_CONTRACTABLE/.test(m) ? "지금 단계에서는 바로 계약할 수 없어요."
          : "계약을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const companyOwnerId = selBid.company?.ownerId ?? null;
      if (companyOwnerId) {
        createNotification({
          userId: companyOwnerId, type: "DIRECT_CONTRACT", title: "현장방문 없이 계약 요청",
          message: `${request?.space_type ?? request?.type ?? "시공"} 요청에서 선택됐어요. 의뢰인이 입찰 금액 그대로 계약을 시작했어요 — 결제되면 알려 드릴게요.`,
          relatedId: request.id, relatedType: "request", priority: "HIGH",
        }).catch(() => {});
      }
      postProjectEvent(request.user_id, data.company_id,
        `${request?.space_type ?? request?.type ?? "이번"} 공사를 ${selBid.company?.name ?? "이 업체"}에 입찰 금액(${fmtMoney(selBid.price ?? 0)}) 그대로 맡기기로 했어요. 현장방문 없이 진행해요.`);
      onRefresh?.();
      setStep("payment");
    } catch {
      showLocalToast("계약을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDirectLoading(false);
    }
  };

  const handleRequestSiteVisit = async () => {
    // 1. 버튼 클릭 로그 — 가드 이전 맨 첫 줄에서 실행(클릭 실제 발생 확인용)
    dlog('[SITE_VISIT_BUTTON_CLICK]', {
      requestId: request?.id,
      bidId: selBid?.id,
      bidCompanyId: selBid?.companyId,
    });
    if (siteVisitRef.current || !selBid) return;
    if (!request?.id) { showLocalToast("요청 정보를 찾을 수 없어요"); return; }
    siteVisitRef.current = true;
    setSiteVisitLoading(true);

    dlog('[SITE_VISIT_START]', {
      requestId: request?.id,
      bidId: selBid?.id,
      bidCompanyId: selBid?.companyId,
      currentUserId: userId,
    });

    try {
      // 2. bid.company_id(owner_id/user_id) → companies.id resolve (id/owner_id 양쪽 허용)
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, owner_id, name')
        .or(`id.eq.${selBid.companyId},owner_id.eq.${selBid.companyId}`)
        .maybeSingle();

      if (companyError || !company?.id) {
        console.error('[SITE_VISIT_COMPANY_RESOLVE_FAILED]', companyError, selBid);
        alert('업체 정보를 찾을 수 없습니다.');
        return;
      }

      const resolvedCompanyId = company.id;

      // 3. 상태 전이는 RPC(SECURITY DEFINER)로 일괄 처리 — 프론트 직접 update 는
      //    OTP 커스텀 인증(auth.uid()=null)으로 RLS 에 막힘. RPC 가 RLS 우회.
      //    requests.update + bids.update + site_visits.insert 를 서버에서 원자적으로 수행.
      const { data: rpcData, error: rpcError } = await supabase.rpc('request_site_visit', {
        p_request_id: request.id,
        p_bid_id: selBid.id,
        p_company_id: resolvedCompanyId,
      });

      if (rpcError || !rpcData?.ok) {
        console.error('[SITE_VISIT_RPC_FAILED]', rpcError, rpcData);
        alert('요청 상태 변경 실패');
        return;
      }

      dlog('[SITE_VISIT_RPC_SUCCESS]', rpcData);

      // 6. 알림 (fire-and-forget)
      const companyOwnerId = company?.owner_id ?? selBid.company?.ownerId ?? null;
      if (companyOwnerId) {
        createNotification({
          userId: companyOwnerId, type: "SITE_VISIT_REQUESTED", title: "현장견적 요청 도착",
          message: `${request?.space_type ?? request?.type ?? "시공"} 요청에서 선택되었어요. 현장견적 요청을 확인해 주세요.`,
          relatedId: request?.id ?? null, relatedType: "request", priority: "HIGH",
        }).catch(() => {});
      }

      // 공사 대화방 열기 — 선택한 순간부터 이 방에서 현장방문 일정·연락을 이어간다.
      postProjectEvent(request.user_id, resolvedCompanyId,
        `${request?.space_type ?? request?.type ?? "이번"} 공사를 ${company?.name ?? selBid.company?.name ?? "이 업체"}에 맡기기로 했어요. 이 방에서 현장방문 일정을 정하고, 위의 「전화하기」로 바로 연락할 수 있어요.`);

      dlog('[SITE_VISIT_FLOW_SUCCESS]', {
        requestId: request.id,
        bidId: selBid.id,
        resolvedCompanyId,
      });

      // 7. RPC 성공 후에만: getUserRequests refetch(기존 트리거 재사용) + 화면 이동
      onRefresh?.();
      setStep("siteVisitDone");
    } catch (e) {
      console.error('[SITE_VISIT_ERROR]', e);
      showLocalToast("현장견적 요청 오류: " + (e?.message ?? String(e)));
    } finally {
      siteVisitRef.current = false;
      setSiteVisitLoading(false);
    }
  };
  // selBid 회사 정보 enrichment — getBidsForRequest 가 companies join을 못 했을 때 보정
  useEffect(() => {
    if (!selBid?.companyId) return;
    const hasRealName = selBid.company?.name &&
      selBid.company.name !== "선택된 파트너" &&
      selBid.company.name !== "—" &&
      selBid.company.name !== "업체";
    if (hasRealName) return;
    let alive = true;
    supabase.from('companies').select('*').or(`id.eq.${selBid.companyId},owner_id.eq.${selBid.companyId}`).maybeSingle().then(({ data }) => {
      if (!alive || !data) return;
      setSelBid(prev => prev ? {
        ...prev,
        company: {
          id: data.id, ownerId: data.owner_id,
          name: data.name ?? "선택된 파트너",
          temp: data.temp ?? 36.5,
          verified: data.verified ?? false,
          badge: data.badge ?? "basic",
          completedJobs: data.completed_jobs ?? 0,
          recontractRate: data.recontract_rate ?? 0,
          asRate: data.as_rate ?? 0,
          region: data.region ?? "",
          online: data.online ?? false,
        },
      } : prev);
    }).catch(() => {});
    return () => { alive = false; };
  }, [selBid?.companyId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // 빈 배열이면 propBids 초기값을 덮어쓰지 않음 — RLS 차단(0건 반환)으로 기존 데이터 소실 방지.
      if (data && data.length > 0) setLocalBids(data.map(normalizeBid));
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

  // ⚠ 훅은 반드시 단계별 return(아래 if (step===…) return) «위»에 둔다. 예전엔 이 사진 조회 훅이 맨 아래 목록 화면 앞에
  //   있어서, 업체를 골라 confirm 단계로 넘어가는 순간 훅 수가 줄어 React #300 으로 화면이 통째로 멈췄다(2026-09-24 점검).
  // 입찰한 업체가 올린 시공 사례 사진 — 카드 맨 위에 세운다. 읽기 전용이라 실패해도 화면엔 영향 없다.
  const bidCompanyIds = bids.map(b => b.company?.id ?? b.companyId).filter(Boolean).join(",");
  useEffect(() => {
    const ids = bidCompanyIds ? bidCompanyIds.split(",") : [];
    const todo = ids.filter(id => coPhotos[id] === undefined);
    if (todo.length === 0) return;
    let cancelled = false;
    Promise.all(todo.map(id =>
      getPortfolios(id)
        .then(({ data }) => [id, (data ?? []).flatMap(r => [...(r.after_photos ?? []), ...(r.before_photos ?? [])]).filter(Boolean).slice(0, 3)])
        .catch(() => [id, []])
    )).then(pairs => {
      if (!cancelled) setCoPhotos(prev => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => { cancelled = true; };
  }, [bidCompanyIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // 이미 계약(결제)된 공사인가 — 결제 뒤 ← 로 돌아오면 이 화면은 결제 전 상태(escrow_pending)를 들고 있어
  // 곧장 결제 전 화면으로 넘기고, 뒤로 가도 다시 넘겨 빠져나올 수 없었다(C17 · 이중 결제 위험).
  // 서버에 계약이 있는지 물어 있으면 결제 전 화면 대신 «공사 화면으로» 안내한다.
  // ⚠ 훅은 아래 단계별 return 위에 둔다(React #300).
  const [paidEscrow, setPaidEscrow] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!request?.id) return;
    getEscrowWithPayouts(request.id)
      .then(({ data }) => { if (alive && data?.escrow) setPaidEscrow(data.escrow); })
      .catch(() => {});
    return () => { alive = false; };
  }, [request?.id]);

  const goBack = () => step === "list" ? onBack() : setStep("list");

  if (paidEscrow && step !== "list") {
    const chosen = selBid
      ?? bids.find(b => b.id === (request?.selected_bid_id ?? request?.selectedBidId))
      ?? bids.find(b => b.status === "selected")
      ?? null;
    const paidAt = paidEscrow.created_at ? new Date(paidEscrow.created_at).toLocaleDateString("ko-KR") : null;
    return (
      <div style={{ minHeight:"100vh", background:C.bg }}>
        <BidScreenHeader title="이미 결제된 공사" onBack={() => { setStep("list"); onBack(); }} userId={userId} />
        <div style={{ padding:`${S.xxl}px ${S.xl}px 40px`, textAlign:"center" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:S.md }}><Icon emoji="✅" size={44} color={C.brand} /></div>
          <div style={{ fontSize:18, fontWeight:900, color:C.text1, marginBottom:8 }}>이 공사는 결제가 끝났어요</div>
          <div style={{ fontSize:14, color:C.text3, lineHeight:1.8, marginBottom:S.xxl }}>
            {paidAt ? `${paidAt}에 계약됐어요. ` : ""}같은 공사를 다시 결제할 수 없어요.<br/>진행 상황은 공사 화면에서 확인해 주세요.
          </div>
          <button onClick={() => onEscrow?.({ ...(chosen ?? {}), contractId: paidEscrow.id })}
            style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", marginBottom:S.sm }}>
            공사 화면 보기 →
          </button>
          <button onClick={() => { setStep("list"); onBack(); }}
            style={{ width:"100%", padding:S.lg, background:"none", color:C.text3, border:"none", fontWeight:600, fontSize:14, cursor:"pointer" }}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  if (step==="siteVisitDone") return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <BidScreenHeader title="현장방문 견적 요청" onBack={onBack} userId={userId} />
      <div style={{ padding:`${S.xxl}px ${S.xl}px`, textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}><Icon emoji="📍" size={44} color={C.brand} /></div>
        <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:10 }}>현장방문 견적을 요청했어요</div>
        <div style={{ fontSize:14, color:C.text3, lineHeight:1.8, marginBottom:28 }}>
          선택하신 업체가 현장을 방문해 확인한 뒤<br/>최종 견적서를 보내드립니다.<br/>
          최종 견적서가 도착하면 확인 후 안전결제로 진행할 수 있어요.
        </div>
        {/* 선택한 순간 공사 대화방이 열린다 — 현장방문 일정은 이 방에서(전화하기 포함). */}
        {selBid && onChat && (
          <button onClick={() => onChat(selBid.company ?? { id: selBid.companyId, name: "업체" })}
            style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", marginBottom:S.sm }}>
            업체와 대화하기 · 현장방문 일정 정하기
          </button>
        )}
        <button onClick={onBack} style={{ width:"100%", padding:S.xl, background:selBid && onChat ? C.surface : C.brand, color:selBid && onChat ? C.text2 : "#fff", border:selBid && onChat ? `1px solid ${C.bgWarm}` : "none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer" }}>
          확인
        </button>
      </div>
    </div>
  );

  // 최종 견적서 카드 — 확인 화면과 결제 화면이 같이 쓴다.
  const renderQuoteCard = () => !finalEstimate ? null : (
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.brandM}` }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.brand, marginBottom:S.md, display:"flex", alignItems:"center", gap:6 }}><Icon emoji="📋" size={14} color={C.brand} /> <span style={{ flex:1 }}>업체가 보낸 최종 견적서</span>
                <button onClick={() => setShowQuoteDoc(true)} style={{ background:"none", border:`1px solid ${C.brandM}`, borderRadius:R.full, padding:"5px 10px", fontSize:12, fontWeight:700, color:C.brand, cursor:"pointer", fontFamily:"inherit" }}>견적서 보기·인쇄</button></div>
              {showQuoteDoc && <QuoteDocument estimate={finalEstimate} companyName={selBid.company?.name} request={request ?? {}} docNo={(finalEstimate.id ?? "").toString().slice(0, 8).toUpperCase() || null} onClose={() => setShowQuoteDoc(false)} />}
              {Array.isArray(finalEstimate.items) && finalEstimate.items.length > 0 && (
                <div style={{ marginBottom:S.md }}>
                  {finalEstimate.items.map((it, i) => (
                    <div key={it.name ?? i} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
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
              {/* 업체가 첨부한 현장 실측 사진 — 있을 때만 그리드 표시(없으면 기존 화면 유지). */}
              {Array.isArray(finalEstimate.final_quote_photo_urls) && finalEstimate.final_quote_photo_urls.length > 0 && (
                <div style={{ marginTop:S.md }}>
                  <div style={{ fontSize:12, fontWeight:800, color:C.text2, marginBottom:S.xs, display:"flex", alignItems:"center", gap:5 }}><Icon emoji="📷" size={12} color={C.text2} /> 현장 실측 사진</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:S.sm }}>
                    {finalEstimate.final_quote_photo_urls.map((url, i) => (
                      <a key={url + i} href={url} target="_blank" rel="noreferrer"
                        style={{ position:"relative", paddingTop:"100%", borderRadius:R.md, overflow:"hidden", border:`1px solid ${C.bgWarm}`, display:"block" }}>
                        <img src={url} alt={`현장 실측 사진 ${i+1}`} loading="lazy"
                          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
  );

  if (step==="confirm" && selBid) {
    const stages = calculateStagePayments(effectivePrice, undefined, stagePlan).filter(st => st.percent > 0);
    const { feeAmount: escrowFee, total: customerTotal } = computeFeeWithRate(effectivePrice, rateFor(selectedMethod));
    return (
      <div style={{ minHeight:"100vh", background:C.bg }}>
        <BidScreenHeader title={isQuotePhase ? "최종 견적서 확인" : "예약 확인"} onBack={goBack} userId={userId} />
        <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
          {isQuotePhase && renderQuoteCard()}
          <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.lg }}>
              <div style={{ width:48, height:48, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:C.brand }}>{(selBid.company?.name ?? "?")[0]}</div>
              <div style={{ flex:1 }}><div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{selBid.company?.name ?? "선택된 파트너"}</div><TempBadge temp={selBid.company?.temp ?? 36.5} /></div>
              <div style={{ textAlign:"right" }}><div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{fmtMoney(effectivePrice)}</div><div style={{ fontSize:12, color:C.text3 }}>{selBid.period}일</div></div>
            </div>
            <div style={{ fontSize:13, color:C.text2, marginBottom:S.md }}>{selBid.material}</div>
            <div style={{ background:C.brandL, borderRadius:R.md, padding:S.md, border:`1px solid ${C.brandM}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.brand, marginBottom:S.xs, display:"flex", alignItems:"center", gap:5 }}><Icon emoji="🔒" size={11} color={C.brand} /> {SHOW_BETA_UI ? "대금은 계약서에 적은 단계대로 업체와 직접 주고받아요" : "공간안전결제 — 토스페이먼츠가 공사대금을 안전하게 보호합니다"}</div>
              {/* 결제수단 미선택(현장방문 요청 등 결제 전 단계)에서는 수수료를 확정 금액처럼 표시하지 않는다. */}
              {/* 베타: 이용료·예치 총액을 보이지 않는다(앱이 돈을 받지 않는다). 공사 금액 한 줄만. */}
              {(SHOW_BETA_UI ? [["공사 금액", fmtMoney(effectivePrice)]] : [
                ["시공비", fmtMoney(effectivePrice)],
                ["공간안전결제 이용료", selectedMethod ? `+${fmtMoney(escrowFee)}` : "결제수단에 따라 달라집니다"],
              ]).map(([k, v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.text2, marginBottom:2 }}>
                  <span>{k}</span>
                  <span style={{ fontWeight:700, color: (k === "공간안전결제 이용료" && !selectedMethod) ? C.text3 : C.text2 }}>{v}</span>
                </div>
              ))}
              {!SHOW_BETA_UI && (<>
              <div style={{ height:1, background:C.brandM, margin:`${S.xs}px 0` }} />
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:13, fontWeight:800, color:C.text1 }}>총 예치 금액</span>
                <span style={{ fontSize:14, fontWeight:900, color:C.brand }}>{selectedMethod ? fmtMoney(customerTotal) : "결제수단 선택 시 확정"}</span>
              </div>
              </>)}
            </div>
          </div>
          <div style={{ background:C.navyL, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`1px solid ${C.trustM}` }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.navy, marginBottom:S.md, display:"flex", alignItems:"center", gap:6 }}><Icon emoji="🛡" size={14} color={C.navy} /> {SHOW_BETA_UI ? "대금은 이렇게 나눠 주세요" : "에스크로 안전 정산"}</div>
            {SHOW_BETA_UI && <div style={{ fontSize:12, color:C.text3, lineHeight:1.7, marginTop:-6, marginBottom:S.sm }}>계약서에 이 비율을 적어 두면 단계마다 확인하고 주고받기 쉬워요.</div>}
            {stages.map(({ name, percent, amount }) => (
              <div key={name} style={{ display:"flex", justifyContent:"space-between", padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.trustM}` }}>
                <div><div style={{ fontSize:12, fontWeight:700, color:C.navy }}>{name} {percent}%</div><div style={{ fontSize:11, color:C.text3 }}>{name.endsWith("확인") ? name : `${name} 확인`}</div></div>
                <div style={{ fontSize:13, fontWeight:800, color:C.brand }}>{fmtMoney(amount)}</div>
              </div>
            ))}
          </div>
          {/* 서로 존중의 약속 — 선택 뒤 약속이 양쪽 평판에 남는다(서버 규칙과 같은 문구). */}
          <div style={{ background:C.surface, borderRadius:R.lg, padding:`${S.md}px ${S.lg}px`, marginBottom:S.xl, border:`1px solid ${C.bgWarm}`, fontSize:12.5, color:C.text2, lineHeight:1.7 }}>
            {RESPECT_FOR_CUSTOMER}
          </div>
          <button
            type="button"
            onClick={() => {
              // ⚠️ 무조건 첫 줄(가드/분기 이전): 버튼 클릭이 실제로 발생했는지 확정.
              // 결제 가능 판단은 bid.status 가 아니라 request.status(isQuotePhase) 기준.
              dlog("[GONGGAN_DIAG][payClick]", {
                isQuotePhase, isAwarded, reqStatus, requestStatus: request?.status ?? null, step,
                selectedBidId: request?.selected_bid_id ?? request?.selectedBidId ?? null,
                chosenBidId: selBid?.id ?? null, bidStatus: selBid?.status ?? null,
                finalQuote: finalEstimate?.total_price ?? null, effectivePrice, customerTotal,
              });
              if (isQuotePhase) {
                dlog("[GONGGAN_DIAG][confirmBtn]", { branch: "isQuotePhase", willApprove: reqStatus === "final_quote_submitted" && !!request?.id, next: "payment" });
                // 예약확정 RPC(기존 함수) 호출 — 실패 시 원인을 handlePay:error 로 노출(이전엔 무음 swallow).
                if (reqStatus === "final_quote_submitted" && request?.id) {
                  approveFinalQuote(request.id, userId)
                    .then(({ error } = {}) => { if (error) dlog("[GONGGAN_DIAG][handlePay:error]", { stage: "approveFinalQuote", msg: error.message ?? String(error) }); })
                    .catch((e) => dlog("[GONGGAN_DIAG][handlePay:error]", { stage: "approveFinalQuote", msg: e?.message ?? String(e) }));
                }
                // 중간 'reserved' 카드(추가 탭 필요)를 건너뛰고 결제 화면으로 직접 연결 →
                // confirmBtn → payment(결제수단 선택) → handlePay:enter 체인이 끊기지 않게 한다.
                dlog("[GONGGAN_DIAG][confirmBtn:nav]", { from: "confirm", to: "payment" });
                setStep("payment");
              } else if (isAwarded) {
                dlog("[GONGGAN_DIAG][confirmBtn]", { branch: "isAwarded", next: "reserved" });
                handleEscrowPaymentStart();
              } else {
                dlog("[GONGGAN_DIAG][confirmBtn]", { branch: "else(siteVisit)" });
                handleRequestSiteVisit();
              }
            }}
            disabled={isQuotePhase || isAwarded ? false : (!selBid?.id || siteVisitLoading)}
            style={{ width:"100%", padding:S.xxl,
              background: (!isQuotePhase && !isAwarded && siteVisitLoading) ? C.bgWarm : C.brand,
              color: (!isQuotePhase && !isAwarded && siteVisitLoading) ? C.text4 : "#fff",
              border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
              cursor: (!isQuotePhase && !isAwarded && siteVisitLoading) ? "not-allowed" : "pointer",
              boxShadow: (!isQuotePhase && !isAwarded && siteVisitLoading) ? "none" : `0 6px 20px ${C.brand44}` }}>
            {isQuotePhase
              ? <>예약 확정하고 결제 진행 <Icon emoji="✅" size={15} color="#fff" /></>
              : isAwarded
              ? (SHOW_BETA_UI ? "위 내용으로 예약 확정하기 →" : "위 내용으로 에스크로 결제 및 예약 확정하기 →")
              : siteVisitLoading
              ? "처리 중..."
              : "현장방문 견적 요청하기 →"}
          </button>
          {!isQuotePhase && !isAwarded && (
            <>
              <button type="button" onClick={handleContractDirect} disabled={directLoading || siteVisitLoading || !selBid?.id}
                style={{ width:"100%", marginTop:S.sm, padding:S.lg, background:C.surface, color:C.brand,
                  border:`1.5px solid ${C.brandM}`, borderRadius:R.lg, fontWeight:800, fontSize:15,
                  cursor: directLoading ? "not-allowed" : "pointer" }}>
                {directLoading ? "처리 중..." : `현장방문 없이 ${fmtMoney(selBid.price ?? 0)}로 계약하기`}
              </button>
              <div style={{ fontSize:11.5, color:C.text3, textAlign:"center", marginTop:6, lineHeight:1.6 }}>
                도배·부분 수리처럼 현장 확인이 필요 없는 공사는 입찰 금액 그대로 바로 계약할 수 있어요.
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (step==="reserved" && selBid) return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <BidScreenHeader title={SHOW_BETA_UI ? "계약 진행하기" : "안전결제로 시작하기"} onBack={goBack} userId={userId} />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:C.brand }}>{(selBid.company?.name ?? "?")[0]}</div>
            <div><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{selBid.company?.name ?? "선택된 파트너"}</div><div style={{ fontSize:13, color:C.text3 }}>{fmtMoney(effectivePrice)} · {selBid.period}일</div></div>
          </div>
          <div style={{ background:C.brandL, borderRadius:R.lg, padding:`${S.sm}px ${S.md}px`, fontSize:13, color:C.brand, fontWeight:700, textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Icon emoji="🎉" size={13} color={C.brand} /> 예약 확정 완료</div>
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
        {!SHOW_BETA_UI && (
        <div style={{ marginBottom:S.xl, fontSize:12, color:C.text3, lineHeight:1.7, textAlign:"center" }}>
          직거래 시 에스크로 보호, 분쟁지원, 공간보증이 모두 사라집니다.
        </div>
        )}
        <div onClick={() => { dlog("[GONGGAN_DIAG][reservedCard]", { selBidId: selBid?.id ?? null, selBidStatus: selBid?.status ?? null, requestStatus: request?.status ?? null, next: "payment" }); setStep("payment"); }} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`2px solid ${C.brand}`, cursor:"pointer" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{SHOW_BETA_UI ? "계약 기록 시작하기" : "공간안전결제로 진행"}</div>
            <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700, display:"inline-flex", alignItems:"center", gap:4 }}><Icon emoji="🛡" size={11} color={C.brand} /> {SHOW_BETA_UI ? "기록" : "보호"}</span>
          </div>
          <div style={{ fontSize:14, color:C.text3, lineHeight:1.8 }}>{SHOW_BETA_UI ? "계약서 단계대로 직접 지급 · 단계·사진 기록 · 분쟁 시 기록 제공" : "토스페이먼츠 보관 · 단계별 지급 · 분쟁 중재 지원"}</div>
        </div>
        <button onClick={() => onChat(selBid.company ?? { id: selBid.companyId, name: "업체" })} style={{ width:"100%", padding:S.lg, background:"none", color:C.text3, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:600, fontSize:14, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Icon emoji="💬" size={13} color={C.text3} /> 먼저 업체와 상담하기</button>
      </div>
    </div>
  );

  if (step==="payment" && selBid) {
    const feeRate = rateFor(selectedMethod);
    const { feeAmount: fee, total: customerTotal } = computeFeeWithRate(effectivePrice, feeRate);
    const stages = calculateStagePayments(effectivePrice, undefined, stagePlan).filter(st => st.percent > 0);

    const handlePay = async () => {
      dlog("[GONGGAN_DIAG][handlePay:enter]", {
        requestStatus: request?.status ?? null, reqStatus,
        selectedBidId: request?.selected_bid_id ?? request?.selectedBidId ?? null,
        chosenBidId: selBid?.id ?? null, bidStatus: selBid?.status ?? null,
        finalQuote: finalEstimate?.total_price ?? null, effectivePrice, customerTotal,
        selectedMethod: selectedMethod ?? null, SAFE_MODE, paying: payingRef.current,
      });
      if (bizPending) { dlog("[GONGGAN_DIAG][payChain:handlePay:return]", { reason: "biz_required" }); return; }
      if (!selectedMethod && !SAFE_MODE) { dlog("[GONGGAN_DIAG][payChain:handlePay:return]", { reason: "no_method_and_not_safe_mode" }); return; }
      if (payingRef.current) { dlog("[GONGGAN_DIAG][payChain:handlePay:return]", { reason: "already_paying(payingRef)" }); return; }
      payingRef.current = true;
      setPaymentLoading(true);
      // 이미 계약(결제)된 공사면 멈춘다 — 결제 뒤 ← 로 돌아와 다시 누르는 경우(C17).
      if (request?.id) {
        const { data: ex } = await getEscrowWithPayouts(request.id).catch(() => ({ data: null }));
        if (ex?.escrow) {
          setPaidEscrow(ex.escrow);
          payingRef.current = false;
          setPaymentLoading(false);
          showLocalToast("이미 결제된 공사예요. 공사 화면에서 진행 상황을 확인해 주세요.");
          return;
        }
      }
      // 예약 확정 = 결제 시작(한 화면). 최종 견적서가 온 상태면 여기서 승인한다 — 실패하면 결제로 넘어가지 않는다.
      if (reqStatus === "final_quote_submitted" && request?.id) {
        const { error: apErr } = await approveFinalQuote(request.id, userId).catch((e) => ({ error: e }));
        if (apErr) {
          payingRef.current = false;
          setPaymentLoading(false);
          showLocalToast("예약 확정에 실패했어요. 잠시 후 다시 시도해 주세요.");
          return;
        }
      }
      const feeSnapshot = { provider: ACTIVE_PROVIDER, paymentMethod: selectedMethod, customerFeeRate: feeRate, companyFeeRate: 0.044, vatRate: 0.1, snapshotAt: new Date().toISOString() };

      const runDBWrites = async (pgPaymentKey = null) => {
        let contractId = null;
        const log = {};
        try {
          const guardOk = selBid.id && !String(selBid.id).startsWith("tmp-") && selBid.companyId && request?.id;
          log.guard = guardOk ? "ok" : `SKIP bid=${selBid.id} co=${selBid.companyId} req=${request?.id}`;
          dlog("[GONGGAN_DIAG][payChain:runDBWrites:guard]", { guardOk, selBidId: selBid?.id ?? null, companyId: selBid?.companyId ?? null, requestId: request?.id ?? null });
          if (!guardOk) { dlog("[GONGGAN_DIAG][payChain:runDBWrites:return]", { reason: "guard_failed" }); setDbWriteLog(log); return; }

          // ── 1. escrow_payments (멱등 — 중복 생성 방지) ──────────
          const { data: escrowData, created: escrowCreated, error: escrowErr } = await getOrCreateEscrow({
            requestId:   request.id,
            companyId:   selBid.companyId,
            totalAmount: effectivePrice,
          });
          log.escrow = escrowData ? `${escrowData.id.slice(0, 8)}${escrowCreated ? "" : "(reuse)"}` : (escrowErr?.message ?? "null");
          setDbWriteLog({ ...log });

          if (!escrowData) { setDbWriteLog(log); return; }
          contractId = escrowData.id;

          // ── 2. escrow_payouts (10/20/40/30%) — 신규 에스크로에만 생성 ──
          // 기존 에스크로 재사용 시 payout 이 이미 존재하므로 중복 생성하지 않는다.
          if (escrowCreated) {
            const { error: payoutsErr } = await createEscrowPayoutsForContract(
              escrowData.id, selBid.companyId, effectivePrice, 0.04, 0.1
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
              amount:         effectivePrice,
              fee_amount:     fee,
              net_amount:     effectivePrice,
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
          postProjectEvent(request.user_id, selBid.companyId,
            `결제가 끝나 계약이 확정됐어요 · 공사 금액 ${effectivePrice}만원. 착공·중간·완료 사진과 확인이 이 방에도 기록돼요.`);
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
            metadata:   { bidId: selBid.id, companyId: selBid.companyId, amount: effectivePrice, paymentMethod: selectedMethod, feeSnapshot, pgPaymentKey },
          }).catch(() => {});

          if (setEscrowContracts) setEscrowContracts(prev => [...prev, { id: contractId, requestId: selBid.requestId, bidId: selBid.id, totalAmount: customerTotal, status: "active", createdAt: new Date().toISOString() }]);
          if (setSelectedBid) setSelectedBid(selBid);
          if (onEscrow) onEscrow({ ...selBid, contractId }); else setStep("done");
        } finally {
          setPaymentLoading(false);
          payingRef.current = false; // H-1: 가드 해제 (성공/실패/abort 모두)
        }
      };

      if (SAFE_MODE) { dlog("[GONGGAN_DIAG][payChain:branch]", { path: "SAFE_MODE→runDBWrites(simulate)" }); await runDBWrites(); return; }

      const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
      // P0: 라이브 키(live_*) 환경에서는 결제 실패/취소/리다이렉트 미발생 시
      // 토스 승인 검증 없이 PAID 주문이 생성되지 않도록 시뮬레이션 fallback 을 차단한다.
      // (정상 성공 경로는 successUrl 리다이렉트 → MainApp processTossReturn 이라 무관)
      const isLiveKey = String(clientKey ?? "").startsWith("live_");
      // 안내 문구: 라이브 키 환경(실제 결제)에서는 '테스트 모드' 토스트를 표시하지 않는다.
      if (!isLiveKey) showLocalToast("🧪 테스트 모드입니다. 실제 결제는 발생하지 않습니다.");
      dlog("[GONGGAN_DIAG][payChain:branch]", { hasClientKey: !!clientKey, isLiveKey, selectedMethod: selectedMethod ?? null, path: (clientKey && selectedMethod) ? "toss_requestPayment" : "no_key_or_method→runDBWrites(simulate)" });
      if (clientKey && selectedMethod) {
        // Save pending payment info for recovery after Toss redirect
        try {
          localStorage.setItem("pg_pending", JSON.stringify({
            requestId: request?.id,
            requestUserId: request?.user_id,
            requestType: request?.type,
            bidId: selBid.id,
            bidPrice: effectivePrice,
            companyId: selBid.companyId,
            companyOwnerId: selBid.company?.ownerId ?? null,
            companyName: selBid.company?.name ?? "업체",
            customerTotal,
            fee,
            paymentMethod: selectedMethod,
            savedAt: Date.now(),
          }));
        } catch {}

        // 공사 결제 주문번호에 요청 ID 를 넣는다 — 서버(api/confirm-payment)가 같은 공사의 두 번째 결제를 막는다(C17).
        // 요청 ID 가 없으면 결제하지 않는다 — 서버(api/confirm-payment)는 gm_ 주문만 공사 결제로 승인한다.
        if (!/^[0-9a-f-]{36}$/i.test(String(request?.id ?? ""))) {
          payingRef.current = false; setPaymentLoading(false);
          showLocalToast("요청 정보를 찾지 못해 결제할 수 없어요. 새로고침 뒤 다시 시도해 주세요.");
          return;
        }
        const tossOrderId = `gm_${request.id}_${Date.now()}`;
        try {
          // H-E: SDK 로드 타임아웃(15초)은 provider(tossProvider) 내부에서 처리 →
          // onload가 영원히 오지 않아도 payingRef 영구 잠금 방지. 타임아웃/오류 시
          // catch로 fallback → runDBWrites 시뮬레이션 실행 → payingRef 해제.
          const tossMethod = getMethodMeta(selectedMethod)?.tossMethod ?? "카드";
          dlog("[GONGGAN_DIAG][payChain:toss:beforeRequest]", { provider: ACTIVE_PROVIDER, tossMethod, amount: customerTotal, orderId: tossOrderId });
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
          // 리다이렉트가 안 된 경우(팝업 등) — 토스 승인 없이 결제 기록을 만들지 않는다(키 종류와 무관).
          setPaymentLoading(false); payingRef.current = false;
          return;
        } catch (err) {
          // H-E: SDK 로드 타임아웃·오류 → 사용자에게 알리고 시뮬레이션으로 fallback
          // payingRef는 runDBWrites의 finally 블록에서 해제된다.
          // 관리자 「신규 결제 중지」 — 시뮬레이션 대체 기록으로 넘어가지 않고 여기서 멈춘다.
          if (err?.code === "PAYMENTS_PAUSED") {
            showLocalToast(err.message);
            setPaymentLoading(false); payingRef.current = false;
            return;
          }
          dlog("[GONGGAN_DIAG][payChain:toss:catch]", { msg: err?.message ?? String(err) });
          dlog("[GONGGAN_DIAG][handlePay:error]", { stage: "toss", msg: err?.message ?? String(err) });
          // 결제창이 안 열리거나 실패하면 결제 기록을 만들지 않는다.
          // 예전엔 테스트 키(운영이 지금 쓰는 키)에서 «시뮬레이션»으로 결제 완료를 기록해,
          // 통신 오류 한 번에 돈 없이 「결제 완료」 계약이 생길 수 있었다. 시뮬레이션은 SAFE_MODE(개발용)에서만.
          try { localStorage.removeItem("pg_pending"); } catch { /* noop */ }
          showLocalToast(err?.message?.includes("timeout")
            ? "결제 서버 연결이 지연됩니다. 잠시 후 다시 시도해 주세요."
            : "결제가 완료되지 않았습니다. 다시 시도해 주세요.");
          setPaymentLoading(false);
          payingRef.current = false;
          return;
        }
      } else {
        // 결제 키·수단이 없으면 결제하지 않는다(예전엔 시뮬레이션으로 결제 완료를 기록했다).
        dlog("[GONGGAN_DIAG][payChain:branch]", { path: "else→blocked(no key or method)" });
        showLocalToast(clientKey ? "결제 수단을 골라 주세요." : "지금은 결제를 받을 수 없어요. 고객센터로 문의해 주세요.");
        setPaymentLoading(false);
        payingRef.current = false;
      }
    };

    return (
      <div style={{ minHeight:"100vh", background:C.bg }}>
        <BidScreenHeader title={isQuotePhase && finalEstimate ? "최종 견적 확인 · 결제" : "결제 수단 선택"} onBack={goBack} userId={userId} />
        <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
          {isQuotePhase && renderQuoteCard()}
          {/* Amount summary — 계산식(시공비 + 이용료 = 총액) + 단계별 안전 지급 */}
          <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize:13, color:C.text3, marginBottom:10, fontWeight:700 }}>{SHOW_BETA_UI ? "결제 금액" : "공간안전결제 예치 금액"}</div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", fontSize:13 }}>
              <span style={{ color:C.text2 }}>시공비</span>
              <span style={{ fontWeight:700, color:C.text1 }}>{fmtMoney(effectivePrice)}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"5px 0 9px", fontSize:13, borderBottom:`1px solid ${C.bgWarm}` }}>
              <span style={{ color:C.text2 }}>공간안전결제 이용료</span>
              <span style={{ fontWeight:700, color:C.text1 }}>{fmtMoney(fee)}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"10px 0 2px" }}>
              <span style={{ fontSize:14, fontWeight:800, color:C.text1 }}>총 결제금액</span>
              <span style={{ fontSize:26, fontWeight:900, color:C.brand }}>{fmtMoney(customerTotal)}</span>
            </div>

            <div style={{ marginTop:12, paddingTop:12, borderTop:`1px dashed ${C.bgWarm}` }}>
              <div style={{ fontSize:12, fontWeight:800, color:C.text2, marginBottom:6, display:"flex", alignItems:"center", gap:5 }}><Icon emoji="🔒" size={12} color={C.text2} /> 단계별 안전 지급</div>
              {stages.map(({ name, percent, amount }) => (
                <div key={name} style={{ display:"flex", justifyContent:"space-between", padding:`${S.xs}px 0` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text3 }}>{name} {percent}%</div>
                  <div style={{ fontSize:13, fontWeight:800, color:C.brand }}>{fmtMoney(amount)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 자재비 10% 선지급 안내 — 고객이 선지급 이유를 이해하도록 */}
          <div style={{ background:"#FBF7EC", borderRadius:R.lg, padding:S.lg, marginBottom:S.lg, border:`1px solid #EADFC4` }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#8A6D1E", marginBottom:6, display:"flex", alignItems:"center", gap:5 }}><Icon emoji="📦" size={13} color="#8A6D1E" /> {planNotice.title}</div>
            <div style={{ fontSize:12, color:C.text2, lineHeight:1.85 }}>{planNotice.body}</div>
          </div>

          {/* 결제 직전 — 에스크로 안전 보관 + 기록 저장 안내 */}
          <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg,
            marginBottom:S.lg, border:`1px solid ${C.brandM}` }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.brand, marginBottom:6, display:"flex", alignItems:"center", gap:5 }}><Icon emoji="🔒" size={13} color={C.brand} /> 업체에게 바로 돈이 지급되지 않습니다</div>
            <div style={{ fontSize:12, color:C.text2, lineHeight:1.8 }}>
              {SHOW_BETA_UI ? "대금은 계약서에 적은 단계대로 업체에 직접 지급하고, 단계마다 확인과 사진이 앱에 기록됩니다." : "결제금은 공간마켓이 안전하게 보관하며, 고객 확인 후 단계별로 지급됩니다."}<br/>
              <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}><Icon emoji="💬" size={11} color={C.text2} /> 채팅</span> · <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}><Icon emoji="📷" size={11} color={C.text2} /> 사진</span> · <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}><Icon emoji="📍" size={11} color={C.text2} /> GPS</span> 기록이 저장되며 분쟁 발생 시 기록을 기준으로 검토합니다.
            </div>
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
                      {m.badge && <span style={{ marginLeft:6, fontSize:10, fontWeight:700, color:"#b45309", background:"#fef3c7", borderRadius:R.full, padding:"1px 7px" }}>{m.badge}</span>}
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
            <Icon emoji="🛡" size={13} color={C.navy} /><span>{SHOW_BETA_UI ? "앱 안 안전결제(에스크로)는 정식 서비스에서 제공되며, 그 전까지는 계약서에 적은 단계대로 업체와 직접 진행합니다." : "예치금은 공간마켓이 안전하게 보관하며 단계별 확인 후 업체에 지급됩니다"}</span>
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

          {/* 자재비 10% 선지급 안내 — 결제 버튼 상단(문구만, 정책/지급비율/로직 무변경) */}
          <div style={{ background:C.brandL, border:`1px solid ${C.brandM}`, borderRadius:R.lg, padding:S.md, marginBottom:S.lg, fontSize:12, color:C.text2, lineHeight:1.7 }}>
            <div style={{ fontWeight:800, color:C.brand, marginBottom:4, display:"flex", alignItems:"center", gap:5 }}><Icon emoji="💡" size={12} color={C.brand} /> {planNotice.title}</div>
            {planNotice.body}
          </div>

          <button
            onClick={() => { try { Promise.resolve(handlePay()).catch((err) => dlog("[GONGGAN_DIAG][handlePay:error]", { msg: err?.message ?? String(err) })); } catch (err) { dlog("[GONGGAN_DIAG][handlePay:error]", { msg: err?.message ?? String(err) }); } }}
            disabled={bizPending || (!selectedMethod && !SAFE_MODE) || paymentLoading}
            style={{ width:"100%", padding:S.xxl, background: !bizPending && (selectedMethod || SAFE_MODE) && !paymentLoading ? C.brand : C.bgWarm,
              color: !bizPending && (selectedMethod || SAFE_MODE) && !paymentLoading ? "#fff" : C.text4, border:"none", borderRadius:R.lg,
              fontWeight:800, fontSize:16, cursor: !bizPending && (selectedMethod || SAFE_MODE) && !paymentLoading ? "pointer" : "not-allowed",
              boxShadow: !bizPending && (selectedMethod || SAFE_MODE) && !paymentLoading ? `0 6px 20px ${C.brand44}` : "none",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            {bizPending ? "업체 사업자 확인 대기 중"
              : paymentLoading ? "처리 중..."
              : SAFE_MODE ? <><Icon emoji="🔧" size={15} color="#fff" /> 테스트 예치 (SAFE_MODE)</>
              : selectedMethod ? <><Icon emoji="🔒" size={15} color="#fff" /> {fmtMoney(customerTotal)} 결제하기</>
              : "결제 수단을 선택하세요"}
          </button>
        </div>
        {localToast && (() => {
          const { emoji, rest } = splitLeadingEmoji(localToast);
          return (
            <div style={{ position:"fixed", bottom:100, left:"50%", transform:"translateX(-50%)", background:"rgba(0,0,0,0.82)", color:"#fff", borderRadius:20, padding:"10px 20px", fontSize:13, fontWeight:600, zIndex:500, whiteSpace:"nowrap", pointerEvents:"none",
              display:"flex", alignItems:"center", gap:6 }}>
              {emoji && <Icon emoji={emoji} size={13} color="#fff" />}{rest}
            </div>
          );
        })()}
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
        <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}><Icon emoji="✅" size={64} color={C.brand} /></div>
        <div style={{ fontSize:22, fontWeight:900, color:C.text1, marginBottom:8 }}>예약 완료!</div>
        <div style={{ fontSize:14, color:C.text3, lineHeight:1.8, marginBottom:S.xxl }}>{SHOW_BETA_UI ? "계약이 기록됐어요. 착공하면 단계마다 확인해 주세요." : "에스크로 예치 완료. 착공 확인 후 업체에 지급됩니다."}</div>
        <button onClick={() => onChat(selBid.company ?? { id: selBid.companyId, name: "업체" })} style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand44}`, marginBottom:S.sm,
          display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Icon emoji="💬" size={15} color="#fff" /> {selBid.company?.name ?? "업체"}와 채팅하기</button>
        {/* H-B: 레거시 done_direct 경로 안전장치(현재 도달 안 함). 에스크로 리뷰는 EscrowScreen.onReview에서 처리. */}
        {step === "done_direct" && onReview && selBid.company && (
          <button onClick={() => onReview(selBid.company)} style={{ width:"100%", padding:S.lg, background:"none", color:C.brand, border:`1px solid ${C.brand}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:S.sm,
            display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Icon emoji="⭐" size={13} color={C.brand} /> 시공 후기 작성하기</button>
        )}
        <button onClick={onBack} style={{ width:"100%", padding:S.lg, background:"none", color:C.text3, border:"none", fontWeight:600, fontSize:14, cursor:"pointer" }}>홈으로</button>
      </div>
    </div>
  );

  // Bid list — empty state maintains container layout
  // 비교 표시(최저가·빠름·평판)와 정렬은 src/lib/bidCompare.js 에서 — 화면은 그리기만.
  const bidTags = (bid) => calcBidTags(bids, bid);
  const sortedBids = sortBids(bids, sortKey);
  const summary = bidSummary(bids);

  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <BidScreenHeader title="업체 비교하기" sub={request ? `${request.type} · 업체 ${bids.length}곳 입찰` : `업체 ${bids.length}곳이 입찰했어요`} onBack={goBack} userId={userId} />
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
          <div style={{ fontSize:13, fontWeight:700, color:C.brand, display:"flex", alignItems:"center", gap:5 }}><Icon emoji="💡" size={13} color={C.brand} /> 업체 금액은 선택 전까지 서로 모릅니다</div>
          <div style={{ fontSize:12, color:C.brand, marginTop:4, opacity:0.8 }}>기록과 리뷰를 보고 안심하고 선택하세요</div>
        </div>
        <div style={{ marginBottom:S.xl }}>
          <ProtectionNotice variant="short" />
        </div>

        {/* 견적 요약 + 정렬 + 표 보기 — 카드가 길어 두세 곳을 견주기 어려웠다(표시 전용) */}
        {bids.length > 1 && (
          <div style={{ marginBottom:S.md }}>
            <div style={{ background:C.surface, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, padding:`${S.md}px ${S.lg}px`, marginBottom:S.sm, display:"flex", alignItems:"center", gap:S.sm }}>
              <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:800, color:C.text1 }}>
                {summary.count}곳 · {fmtMoney(summary.min)} ~ {fmtMoney(summary.max)}
              </div>
              <div style={{ fontSize:12, color:C.text3, marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                가장 싼 곳과 {fmtMoney(summary.gap)} 차이{summary.minPeriod ? ` · 공사 ${summary.minPeriod}~${summary.maxPeriod}일` : ""}
              </div>
              </div>
              <button onClick={() => setTableView(v => !v)}
                style={{ marginLeft:"auto", flex:"0 0 auto", padding:"7px 12px", borderRadius:R.full, fontSize:12.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                  border:`1.5px solid ${tableView ? C.brand : C.bgWarm}`, background: tableView ? C.brandL : C.surface, color: tableView ? C.brand : C.text2, whiteSpace:"nowrap" }}>
                {tableView ? "카드로 보기" : "표로 한눈에"}
              </button>
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center", overflowX:"auto", paddingBottom:2 }}>
              {SORT_KEYS.map(s => (
                <button key={s.id} onClick={() => setSortKey(s.id)}
                  style={{ flex:"0 0 auto", padding:"7px 12px", borderRadius:R.full, fontSize:12.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                    border:`1.5px solid ${sortKey === s.id ? C.brand : C.bgWarm}`, background: sortKey === s.id ? C.brandL : C.surface, color: sortKey === s.id ? C.brand : C.text2, whiteSpace:"nowrap" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 표 보기 — 금액·기간·공간온도만 나란히. 누르면 그 업체 카드로 간다. */}
        {tableView && bids.length > 1 && (
          <div style={{ background:C.surface, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, overflow:"hidden", marginBottom:S.md }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 86px 56px 56px", fontSize:11.5, fontWeight:700, color:C.text3, padding:"9px 12px", borderBottom:`1px solid ${C.bgWarm}`, background:C.bg }}>
              <span>업체</span><span style={{ textAlign:"right" }}>금액</span><span style={{ textAlign:"right" }}>기간</span><span style={{ textAlign:"right" }}>온도</span>
            </div>
            {sortedBids.map(b => {
              const best = calcBidTags(bids, b);
              return (
                <button key={b.id} onClick={() => { setTableView(false); setTimeout(() => document.getElementById(`bid-${b.id}`)?.scrollIntoView({ behavior:"smooth", block:"center" }), 60); }}
                  style={{ width:"100%", display:"grid", gridTemplateColumns:"1fr 86px 56px 56px", alignItems:"center", padding:"11px 12px",
                    background:"none", border:"none", borderBottom:`1px solid ${C.bgWarm}`, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                  <span style={{ minWidth:0 }}>
                    <span style={{ display:"block", fontSize:13, fontWeight:700, color:C.text1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.company?.name ?? "파트너"}</span>
                    {best.length > 0 && <span style={{ display:"block", fontSize:10.5, color:C.brand, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{best.join(" · ")}</span>}
                  </span>
                  <span style={{ textAlign:"right", fontSize:13, fontWeight:800, color:C.brand }}>{fmtMoney(b.price)}</span>
                  <span style={{ textAlign:"right", fontSize:12, color:C.text2 }}>{b.period ? `${b.period}일` : "—"}</span>
                  <span style={{ textAlign:"right", fontSize:12, color:C.text2 }}>{b.company?.temp ? `${Number(b.company.temp).toFixed(1)}°` : "—"}</span>
                </button>
              );
            })}
          </div>
        )}
        {bids.length === 0 ? (
          <div style={{
            background:C.surface, borderRadius:R.xl, border:`1px solid ${C.bgWarm}`,
            minHeight:200, display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <div style={{ textAlign:"center", padding:S.xxl }}>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}><Icon emoji="💬" size={36} color={C.text3} /></div>
              <div style={{ fontSize:14, fontWeight:700, color:C.text3 }}>인근 업체들이 견적을 검토 중입니다</div>
              <div style={{ fontSize:12, color:C.text4, marginTop:6 }}>보통 24시간 내 입찰이 시작됩니다</div>
            </div>
          </div>
        ) : (
          sortedBids.map(bid => UX_BETA ? (
            <BidCompareCard
              key={bid.id}
              id={`bid-${bid.id}`}
              photos={coPhotos[bid.company?.id ?? bid.companyId] ?? []}
              requestText={[request?.type, request?.description, request?.desc].filter(Boolean).join(" ")}
              bid={bid}
              tags={bidTags(bid)}
              selected={bid.status === "selected" || selectedBid?.id === bid.id}
              onChat={() => onChat(bid.company ?? { id: bid.companyId, name: "업체" })}
              onSelect={() => selectBid(bid)}
            />
          ) : (
            <div key={bid.id} style={{ background:C.surface, borderRadius:R.xl, marginBottom:S.md, border:`1px solid ${C.bgWarm}`, overflow:"hidden" }}>
              <div style={{ padding:S.xl }}>
                <div style={{ display:"flex", gap:S.md, alignItems:"flex-start", marginBottom:S.lg }}>
                  <div style={{ width:44, height:44, borderRadius:R.lg, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:C.brand }}>{(bid.company?.name ?? "?")[0]}</div>
                  <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{bid.company?.name ?? "파트너"}</div><TempBadge temp={bid.company?.temp ?? 36.5} /></div>
                  <div style={{ textAlign:"right" }}><div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{fmtMoney(bid.price)}</div><div style={{ fontSize:11, color:C.text3 }}>{bid.period}일</div></div>
                </div>
                <div style={{ fontSize:13, color:C.text2, marginBottom:S.md, fontStyle:"italic" }}>{bid.comment}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:S.sm }}>
                  <button onClick={() => onChat(bid.company ?? { id: bid.companyId, name: "업체" })} style={{ width:"100%", padding:"11px", background:C.surface, color:C.text2, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Icon emoji="💬" size={13} color={C.text2} /> 상담하기</button>
                  <button onClick={() => selectBid(bid)} style={{ width:"100%", padding:"11px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 3px 12px ${C.brand44}`,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Icon emoji="✅" size={13} color="#fff" /> 이 업체로 선택하기</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
