import { useState, useRef, useEffect } from "react";
import { C, R, S } from "../constants";
import { fmtMoney, calculateCustomerTotal, calculateStagePayments } from "../utils/calculations";
import { uploadFile, updateTransactionStatus, logActivity, updateDisputeStatus, holdAllPayoutsForEscrow, approveEscrowPayoutByStage, createNotification, updateCompanyTemp, getContractTimeline, getPaymentOrderByRequest, getBidById, getCompanyByOwnerId, getEscrowByRequest, getBidsForRequest, getEscrowPayouts, getPhasePhotos, addPhasePhotos, advanceContractStep, markEscrowPhaseStarted, setEscrowPayoutReady, getReviewByContract, createEscrowRecord, createEscrowPayoutsForContract } from "../lib/supabase";
import EscrowCalculator from "../components/EscrowCalculator";

// Stage status values:
// 'done'           — payment released
// 'company_todo'   — waiting for company to act
// 'pending_customer' — company acted, waiting for customer confirmation
// 'locked'         — not yet reachable

function CountdownTimer({ deadlineMs }) {
  const [remaining, setRemaining] = useState(() => deadlineMs ? Math.max(0, deadlineMs - Date.now()) : 0);
  useState(() => {
    if (!deadlineMs || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining(prev => { const n = Math.max(0, deadlineMs - Date.now()); if (n <= 0) clearInterval(id); return n; });
    }, 1000);
    return () => clearInterval(id);
  });
  if (!deadlineMs) return null;
  const total = Math.floor(remaining / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pct = Math.min(100, ((72 * 3600 * 1000 - remaining) / (72 * 3600 * 1000)) * 100);
  const pad = n => String(n).padStart(2, "0");
  return (
    <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.brandM}`, marginBottom: S.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.sm }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.brand }}>⏰ 자동 승인까지</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: C.brand, fontVariantNumeric: "tabular-nums" }}>
          {pad(h)}:{pad(m)}:{pad(s)}
        </span>
      </div>
      <div style={{ background: `${C.brand}22`, borderRadius: R.full, height: 6 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: C.brand, borderRadius: R.full, transition: "width 1s linear" }} />
      </div>
      <div style={{ fontSize: 11, color: C.text3, marginTop: S.xs }}>72시간 내 미확인 시 자동 승인됩니다</div>
    </div>
  );
}

const fmtTs = (ts) => {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
};

// 에스크로는 플랫폼 수익 구조가 아닌 신뢰 인프라입니다.
// 플랫폼은 법적 중재자가 아닌 구조적 신뢰 제공자입니다.
// 신뢰는 아래 구조로 해결됩니다:
// - 단계별 승인 / 업로드 기록 / 에스크로 보관 / 지급 조건 / 진행 기록
const STAGE_META = [
  { id: 1, label: "전액 예치",    sub: "고객이 총 금액을 공간마켓에 예치",              icon: "🔒", pct: 0,  confirmLabel: null, autoRelease: false },
  { id: 2, label: "자재비 선지급", sub: "계약 완료 즉시 자동 지급 · 고객 확인 불필요",  icon: "💰", pct: 10, confirmLabel: null, autoRelease: true  },
  { id: 3, label: "착공 확인",    sub: "착공 사진을 확인하고 승인하면 업체에 20% 지급",    icon: "🏗", pct: 20, confirmLabel: "착공 확인하기",    timelineLabel: "착공 확인 완료" },
  { id: 4, label: "중간 점검",    sub: "중간 점검 사진을 확인하고 승인하면 40% 지급",       icon: "🔍", pct: 40, confirmLabel: "중간점검 확인하기", timelineLabel: "중간점검 확인 완료" },
  { id: 5, label: "완료 확인",    sub: "완료 사진을 확인하고 승인하면 잔금 30% 지급",      icon: "✅", pct: 30, confirmLabel: "완료 확인하기",    timelineLabel: "완료 확인 · 정산 완료" },
];

const TIMELINE_ICONS = {
  contract: "📝",
  photo:    "📸",
  confirm:  "✅",
  dispute:  "⚠️",
};

export default function EscrowScreen({ onBack, activeRole, selectedBid, contractId, userId, request, onReview }) {
  const IS_DEBUG = true;
  const [resolvedBid, setResolvedBid] = useState(selectedBid ?? null);
  const [resolvedContractId, setResolvedContractId] = useState(contractId ?? null);
  const [escrowDebug, setEscrowDebug] = useState(null);

  // Self-fetch: restore selectedBid via 3-level fallback
  // 1. payment_orders → bid_id → bids
  // 2. escrow_payments → bids (selected) — for cases where payment_order missing
  // 3. bids (selected) only — minimal restore when neither escrow table has data
  useEffect(() => {
    if (resolvedBid || !request?.id) return;
    const fetchContract = async () => {
      const buildRestored = (bid) => ({
        id: bid.id, requestId: bid.request_id, companyId: bid.company_id,
        company: { id: bid.company_id, name: "업체", temp: 70 },
        price: bid.price, period: bid.period_days,
        material: bid.material_note ?? "", comment: bid.comment ?? "",
        createdAt: bid.created_at, status: bid.selected ? "selected" : "pending",
      });

      // ── Level 1: payment_orders ──────────────────────────────
      const { data: order } = await getPaymentOrderByRequest(request.id);
      if (order) {
        if (order.contract_id) setResolvedContractId(order.contract_id);
        if (order.bid_id) {
          const { data: bid, error: bidErr } = await getBidById(order.bid_id);
          if (bid) {
            setResolvedBid(buildRestored(bid));
            setEscrowDebug({ src: "payment_order", restored: true, bidId: bid.id, orderId: order.id, contractId: order.contract_id });
            return;
          }
          setEscrowDebug({ src: "payment_order", err: bidErr?.message ?? "bid not found" });
        }
        return;
      }

      // ── Level 2: escrow_payments → bids ─────────────────────
      const { data: escrow } = await getEscrowByRequest(request.id);
      if (escrow) {
        setResolvedContractId(escrow.id);
        const { data: bidsData } = await getBidsForRequest(request.id);
        const row = bidsData?.find(b => b.selected) ?? bidsData?.[0] ?? null;
        if (row) {
          setResolvedBid(buildRestored(row));
          setEscrowDebug({ src: "escrow_fallback", restored: true, escrowId: escrow.id, bidId: row.id });
        } else {
          setEscrowDebug({ src: "escrow_fallback", err: "no bids", escrowId: escrow.id });
        }
        return;
      }

      // ── Level 3: bids only (no escrow row yet) ───────────────
      const { data: bidsData } = await getBidsForRequest(request.id);
      const row = bidsData?.find(b => b.selected) ?? bidsData?.[0] ?? null;
      if (row) {
        setResolvedBid(buildRestored(row));
        setEscrowDebug({ src: "bids_only_fallback", restored: true, bidId: row.id, note: "no escrow row" });
        return;
      }

      setEscrowDebug({ src: "self_fetch", err: "no order, no escrow, no bids", requestId: request.id });
    };
    fetchContract();
  }, [request?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Company fetch: always run when companyId is known but name is missing/default
  // bids.company_id → users.id; companies.owner_id → users.id
  useEffect(() => {
    const companyId = resolvedBid?.companyId;
    if (!companyId) return;
    const existingName = resolvedBid?.company?.name;
    if (existingName && existingName !== "—" && existingName !== "업체") return;
    getCompanyByOwnerId(companyId).then(({ data, error }) => {
      setEscrowDebug(prev => ({
        ...prev,
        companyLookup: {
          ownerId: companyId,
          err:     error?.message ?? null,
          found:   !!data,
          id:      data?.id ?? null,
          name:    data?.name ?? null,
        },
      }));
      if (!data) return;
      setResolvedBid(prev => prev ? {
        ...prev,
        company: { id: data.id, ownerId: data.owner_id, name: data.name ?? "업체", temp: data.temp ?? 70 },
      } : prev);
    }).catch(() => {});
  }, [resolvedBid?.companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Contract ID fetch: if resolvedBid is known but contractId is still missing
  useEffect(() => {
    if (resolvedContractId) return;
    const reqId = request?.id ?? resolvedBid?.requestId;
    if (!reqId) return;
    const resolve = async () => {
      const { data: order } = await getPaymentOrderByRequest(reqId);
      if (order?.contract_id) { setResolvedContractId(order.contract_id); return; }
      // Fallback: try escrow_payments directly
      const { data: escrow } = await getEscrowByRequest(reqId);
      if (escrow?.id) setResolvedContractId(escrow.id);
    };
    resolve().catch(() => {});
  }, [resolvedBid?.requestId, request?.id, resolvedContractId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isConsumer = activeRole === "consumer";
  const bidAmount   = resolvedBid?.price ?? 0;
  const customerTotal = bidAmount > 0 ? calculateCustomerTotal(bidAmount) : 0;
  const stages      = bidAmount > 0 ? calculateStagePayments(bidAmount) : [];

  // Dynamic stage flow
  const [stageStatus, setStageStatus] = useState({
    1: "done",
    2: "done",
    3: "company_todo",
    4: "locked",
    5: "locked",
  });

  // Per-stage photo upload
  const [stagePhotos, setStagePhotos] = useState({ 3: [], 4: [], 5: [] });
  const [uploadingStage, setUploadingStage] = useState(null);
  const [reportingStage, setReportingStage] = useState(null);
  const [reportError, setReportError] = useState(null);
  const [stageDeadlines, setStageDeadlines] = useState({});

  // DB-loaded contract state
  const [contractData, setContractData] = useState(null);
  const [dbPayoutMap, setDbPayoutMap] = useState({});  // { [stage]: payout row }
  const [dbPhotos, setDbPhotos]     = useState({});    // { [dbStep]: string[] }
  const [dbLoaded, setDbLoaded]     = useState(false);
  const [dbRefreshKey, setDbRefreshKey] = useState(0); // increment to force re-fetch
  const [companyReportDebug, setCompanyReportDebug] = useState(null);
  const [approvalLog, setApprovalLog] = useState(null);
  const [reviewedForContract, setReviewedForContract] = useState(false);

  const fileInputRef3 = useRef(null);
  const fileInputRef4 = useRef(null);
  const fileInputRef5 = useRef(null);
  const fileInputRefs = { 3: fileInputRef3, 4: fileInputRef4, 5: fileInputRef5 };

  // Timeline — start with local entry; DB entries loaded when contractId present
  const [timeline, setTimeline] = useState([
    { id: 1, type: "contract", label: "계약 완료 · 공사비 안전 예치 · 자재비 선지급 (10%)", ts: Date.now() - 2 * 24 * 3600 * 1000 },
  ]);

  const addTimeline = (type, label) => {
    setTimeline(prev => [...prev, { id: Date.now(), type, label, ts: Date.now() }]);
  };

  // Load review status for this contract (consumer only)
  useEffect(() => {
    if (!resolvedContractId || !isConsumer) return;
    getReviewByContract(resolvedContractId).then(({ data }) => {
      if (data?.id) setReviewedForContract(true);
    }).catch(() => {});
  }, [resolvedContractId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load DB timeline when resolvedContractId is available
  useEffect(() => {
    if (!resolvedContractId) return;
    getContractTimeline(resolvedContractId).then(({ data }) => {
      if (!data || data.length === 0) return;
      const mapped = data.map(row => {
        const a = row.action ?? "";
        const type = a.includes("DISPUTE") ? "dispute" : a.includes("PHOTO") ? "photo" : a.includes("STEP") ? "confirm" : "contract";
        const label = (row.metadata?.label) ?? a.replace(/_/g, " ");
        return { id: row.id, type, label, ts: new Date(row.created_at).getTime() };
      });
      setTimeline(mapped);
    }).catch(() => {});
  }, [resolvedContractId]);

  // Load escrow_payments + escrow_payouts + phase_photos from DB
  useEffect(() => {
    if (!resolvedContractId) return;
    const load = async () => {
      // escrow_payments (need current txStatus / current_step)
      const reqId = request?.id ?? resolvedBid?.requestId;
      if (reqId) {
        const { data: ep } = await getEscrowByRequest(reqId);
        if (ep) setContractData(ep);
      }
      // payouts
      const { data: payouts } = await getEscrowPayouts(resolvedContractId);
      const pm = {};
      (payouts ?? []).forEach(p => { pm[p.stage] = p; });
      setDbPayoutMap(pm);
      // phase photos { dbStep → [url,...] }
      const { data: photos } = await getPhasePhotos(resolvedContractId);
      const ph = {};
      (photos ?? []).forEach(p => {
        const urls = Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : []);
        ph[p.step] = [...(ph[p.step] ?? []), ...urls];
      });
      setDbPhotos(ph);
      setDbLoaded(true);
    };
    load().catch(() => {});
  }, [resolvedContractId, dbRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive stageStatus + populate customer photo previews from DB state
  // Priority: payout.APPROVED > phase_photos presence > transaction_status
  useEffect(() => {
    if (!dbLoaded) return;
    const txStatus = contractData?.transaction_status ?? "CONTRACTED";
    const p2 = dbPayoutMap[2]; // 착공 payout
    const p3 = dbPayoutMap[3]; // 중간점검 payout
    const p4 = dbPayoutMap[4]; // 완료 payout

    const ns = { 1: "done", 2: "done", 3: "company_todo", 4: "locked", 5: "locked" };

    // Stage 3: 착공
    if (p2?.status === "APPROVED") {
      ns[3] = "done";
    } else if (
      txStatus === "STARTED" ||
      (contractData?.current_step ?? 0) >= 2 ||
      (dbPhotos[1]?.length ?? 0) > 0
    ) {
      ns[3] = "pending_customer";
    }

    // Stage 4: 중간점검
    if (ns[3] === "done") {
      if (p3?.status === "APPROVED") {
        ns[4] = "done";
      } else if ((dbPhotos[2]?.length ?? 0) > 0) {
        ns[4] = "pending_customer";
      } else {
        ns[4] = "company_todo";
      }
    }

    // Stage 5: 완료
    if (ns[4] === "done") {
      if (p4?.status === "APPROVED" || txStatus === "SETTLED") {
        ns[5] = "done";
      } else if ((dbPhotos[3]?.length ?? 0) > 0) {
        ns[5] = "pending_customer";
      } else {
        ns[5] = "company_todo";
      }
    }

    if (txStatus === "SETTLED") { ns[3] = "done"; ns[4] = "done"; ns[5] = "done"; }

    setStageStatus(ns);

    // Populate stagePhotos from DB so customer sees company's uploaded photos
    setStagePhotos(prev => ({
      ...prev,
      ...(dbPhotos[1]?.length > 0 ? { 3: dbPhotos[1] } : {}),
      ...(dbPhotos[2]?.length > 0 ? { 4: dbPhotos[2] } : {}),
      ...(dbPhotos[3]?.length > 0 ? { 5: dbPhotos[3] } : {}),
    }));
  }, [dbLoaded, contractData, dbPayoutMap, dbPhotos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Modals
  const [confirmStage, setConfirmStage] = useState(null);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);

  const advanceStage = async (stageId) => {
    const s = STAGE_META.find(x => x.id === stageId);
    // Optimistic UI
    setStageStatus(prev => ({
      ...prev,
      [stageId]: "done",
      ...(stageId < 5 ? { [stageId + 1]: "company_todo" } : {}),
    }));
    setConfirmStage(null);
    if (s?.confirmLabel) addTimeline("confirm", s.timelineLabel ?? s.confirmLabel);

    if (resolvedContractId) {
      const log = { stageId, contractId: resolvedContractId.slice(0, 8) };

      // 1. Approve payout: UI stage 3→DB payout 2, 4→3, 5→4
      const uiToPayoutStage = { 3: 2, 4: 3, 5: 4 };
      const payoutStage = uiToPayoutStage[stageId];
      if (payoutStage) {
        const { error: pe } = await approveEscrowPayoutByStage(resolvedContractId, payoutStage, userId ?? null);
        log.payout = pe?.message ?? "ok";
      }

      // 2. Advance escrow_payments: stepN_approved_at + current_step + txStatus
      const stepConfig = {
        3: { dbStep: 2, nextStep: 3, txStatus: "MID_INSPECTION" },
        4: { dbStep: 3, nextStep: 4, txStatus: null },
        5: { dbStep: 4, nextStep: 5, txStatus: "SETTLED" },
      }[stageId];
      if (stepConfig) {
        const { error: se } = await advanceContractStep(
          resolvedContractId,
          stepConfig.dbStep,
          stepConfig.nextStep,
          stepConfig.txStatus
        );
        log.step = se?.message ?? "ok";
      }

      setApprovalLog(log);
      setDbRefreshKey(k => k + 1);

      if (stageId === 5 && resolvedBid?.companyId) {
        updateCompanyTemp(resolvedBid.companyId, 2.5).catch(() => {});
      }

      logActivity({
        userId:     userId ?? null,
        role:       "consumer",
        action:     "STEP_APPROVED",
        targetType: "contract",
        targetId:   resolvedContractId,
        metadata:   { stage: stageId, label: s?.label },
      }).catch(() => {});
    }
  };

  const reportComplete = async (stageId) => {
    const s = STAGE_META.find(x => x.id === stageId);
    setReportingStage(stageId);
    setReportError(null);

    const phaseConfig = {
      3: { dbStep: 1, txStatus: "STARTED",       currentStep: 2, payoutStage: 2 },
      4: { dbStep: 2, txStatus: "MID_INSPECTION", currentStep: 3, payoutStage: 3 },
      5: { dbStep: 3, txStatus: "COMPLETED",      currentStep: 4, payoutStage: 4 },
    }[stageId];

    if (!phaseConfig) { setReportingStage(null); return; }

    const { dbStep, txStatus, currentStep, payoutStage } = phaseConfig;
    const photos = stagePhotos[stageId] ?? [];
    const reqId = request?.id ?? resolvedBid?.requestId ?? null;
    let cid = resolvedContractId;

    const debug = {
      contract_id:          cid ?? "NULL",
      escrow_id:            cid ?? "NULL",
      request_id:           reqId ?? "NULL",
      company_id:           resolvedBid?.companyId ?? userId ?? "NULL",
      current_status:       contractData?.transaction_status ?? "—",
      current_phase:        stageId,
      uploaded_photo_url:   photos[0] ?? null,
      send_clicked:         true,
      send_ok:              null,
      send_err:             null,
      status_update_table:  "escrow_payments",
      customer_visible_status: txStatus,
      upload_ok:            null,
      upload_err:           null,
      status_update_ok:     null,
      status_update_err:    null,
      payout_update_ok:     null,
      payout_update_err:    null,
      contract_reload_ok:   null,
      contract_reload_err:  null,
      caught_err:           null,
    };

    try {
      // ── 0. contract_id(=escrow_payments.id) 확보 ────────────────────────────
      // contract 정보가 없다고 전송을 막지 않습니다.
      // 고객 화면은 request_id 기준으로 동일 row를 읽으므로 request_id 연결이 핵심입니다.
      // 순서: ① resolvedContractId → ② request_id로 escrow 조회 → ③ 없으면 생성
      // TODO: 추후 service role Edge Function으로 이전 (RLS 우회 / 원자적 생성)
      if (!cid && reqId) {
        const { data: existing, error: exErr } = await getEscrowByRequest(reqId);
        if (existing?.id) {
          cid = existing.id;
          debug.status_update_table = "escrow_payments(existing)";
          debug.contract_reload_ok = true;
        } else {
          if (exErr) debug.contract_reload_err = exErr.message;
          const total     = resolvedBid?.price ?? 0;
          const companyId = resolvedBid?.companyId ?? userId ?? null;
          const { data: created, error: createErr } = await createEscrowRecord({
            requestId:   reqId,
            companyId,
            totalAmount: total,
          });
          if (created?.id) {
            cid = created.id;
            debug.status_update_table = "escrow_payments(created)";
            debug.contract_reload_ok = true;
            // 단계별 payout 4건 생성 (setEscrowPayoutReady가 동작하도록)
            await createEscrowPayoutsForContract(cid, companyId, total, 0.04, 0.1).catch(() => {});
          } else {
            debug.contract_reload_err = createErr?.message ?? "create failed";
          }
        }
        if (cid) setResolvedContractId(cid);
        debug.contract_id = cid ?? "NULL";
        debug.escrow_id   = cid ?? "NULL";
      }

      if (!cid) {
        debug.send_ok  = false;
        debug.send_err = reqId
          ? "계약(escrow) 생성 실패 — 잠시 후 다시 시도해주세요"
          : "request_id가 없어 전송할 수 없습니다";
        setReportError(debug.send_err);
        return; // finally에서 버튼/로딩 원복
      }

      // 1. Insert phase_photos
      if (photos.length > 0) {
        const { error: photoErr } = await addPhasePhotos({
          contractId:   cid,
          step:         dbStep,
          photos,
          uploadedBy:   userId ?? null,
          uploaderRole: "company",
          caption:      s?.label ?? null,
        });
        debug.upload_ok  = !photoErr;
        debug.upload_err = photoErr?.message ?? null;
        debug.uploaded_photo_url = photos[0];
      } else {
        debug.upload_err = "no photos in state";
      }

      // 2. Update escrow_payments: txStatus + current_step + photos_uploaded_at
      const { error: escrowErr } = await markEscrowPhaseStarted(cid, txStatus, currentStep);
      debug.status_update_ok  = !escrowErr;
      debug.status_update_err = escrowErr?.message ?? null;

      // 3. Update escrow_payouts stage to READY (customer approval pending)
      const { error: payoutErr } = await setEscrowPayoutReady(cid, payoutStage);
      debug.payout_update_ok  = !payoutErr;
      debug.payout_update_err = payoutErr?.message ?? null;

      // 전송 성공 판정: 단계 상태 업데이트(escrow_payments)가 핵심
      debug.send_ok  = !escrowErr;
      debug.send_err = escrowErr?.message ?? null;

      // Optimistic UI update (DB will confirm on re-fetch)
      if (!escrowErr) {
        setStageStatus(prev => ({ ...prev, [stageId]: "pending_customer" }));
        setStageDeadlines(prev => ({ ...prev, [stageId]: Date.now() + 71 * 3600 * 1000 + 59 * 60 * 1000 }));
        if (s?.label) addTimeline("photo", s.label);
      } else {
        setReportError(`단계 상태 업데이트 실패: ${escrowErr.message}`);
      }

      logActivity({
        userId:     userId ?? null,
        role:       "company",
        action:     "PHOTO_UPLOADED",
        targetType: "contract",
        targetId:   cid,
        metadata:   { stage: stageId, dbStep, photoCount: photos.length, label: s?.label,
                      escrowErr: debug.status_update_err, payoutErr: debug.payout_update_err },
      }).catch(() => {});

    } catch (err) {
      debug.caught_err = err?.message ?? String(err);
      debug.send_ok    = false;
      debug.send_err   = debug.caught_err;
      setReportError(`오류가 발생했습니다: ${debug.caught_err}`);
    } finally {
      setCompanyReportDebug(debug);
      setReportingStage(null);
      // Always re-fetch to sync DB state
      setDbRefreshKey(k => k + 1);
    }
  };

  const handleFileChange = async (e, stageId) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingStage(stageId);
    try {
      const urls = await Promise.all(
        files.map(async (file) => {
          const path = `escrow/${stageId}/${Date.now()}_${file.name.replace(/\s/g, "_")}`;
          try {
            return await uploadFile("documents", path, file);
          } catch {
            return URL.createObjectURL(file);
          }
        })
      );
      setStagePhotos(prev => ({
        ...prev,
        [stageId]: [...(prev[stageId] || []), ...urls].slice(0, 6),
      }));
    } finally {
      setUploadingStage(null);
      e.target.value = "";
    }
  };

  const removePhoto = (stageId, photoIdx) => {
    setStagePhotos(prev => ({
      ...prev,
      [stageId]: prev[stageId].filter((_, i) => i !== photoIdx),
    }));
  };

  const paid = STAGE_META.filter(s => stageStatus[s.id] === "done" && s.pct > 0).reduce((a, s) => a + s.pct, 0);

  const headerSub = resolvedBid
    ? `${resolvedBid.company?.name ?? "—"} · ${bidAmount > 0 ? fmtMoney(isConsumer ? customerTotal : bidAmount) : "금액 미정"}`
    : "에스크로 안전 정산";

  const statusColor = (sid) => {
    const st = stageStatus[sid];
    if (st === "done") return C.green;
    if (st === "company_todo" || st === "pending_customer") return C.brand;
    return C.text4;
  };

  const statusIcon = (sid) => {
    const st = stageStatus[sid];
    if (st === "done") return "✓";
    const meta = STAGE_META.find(s => s.id === sid);
    return meta?.icon ?? "○";
  };

  const isActive = (sid) => stageStatus[sid] === "company_todo" || stageStatus[sid] === "pending_customer";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

      {/* Header */}
      <div style={{ background: C.surface, padding: "14px 20px", borderBottom: `1px solid ${C.bgWarm}`, position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: S.md }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>에스크로 안전 정산</div>
          <div style={{ fontSize: 12, color: C.text3 }}>{headerSub}</div>
        </div>
        <div style={{ marginLeft: "auto", background: C.navyL, borderRadius: R.full, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: C.navy }}>🛡 보호중</div>
      </div>

      <div style={{ padding: `${S.xl}px ${S.xl}px 40px` }}>

        {IS_DEBUG && (() => {
          const approveVisible = stageStatus[3] === "pending_customer";
          const approvalRequired = approveVisible || stageStatus[4] === "pending_customer" || stageStatus[5] === "pending_customer";
          return (
            <div style={{ margin:"0 0 12px", background:"rgba(0,0,0,0.92)", color:"#0f0", borderRadius:8, padding:"8px 12px", fontSize:11, lineHeight:2, fontFamily:"monospace", maxHeight:480, overflowY:"auto" }}>
              [DEV:escrow | {activeRole}]<br/>
              request.id: {request?.id?.slice(0,8) ?? "null ⚠️"}<br/>
              resolvedBid.id: {resolvedBid?.id?.slice(0,8) ?? "null ⚠️"}<br/>
              resolvedBid.price: {resolvedBid?.price ?? "—"}<br/>
              <span style={{color: resolvedContractId ? "#0f0" : "#f66"}}>
                resolvedContractId: {resolvedContractId?.slice(0,8) ?? "null ⚠️"}
              </span><br/>
              dbLoaded: {String(dbLoaded)} | dbRefreshKey: {dbRefreshKey}<br/>
              <span style={{color:"#ff0"}}>── contract DB state ──</span><br/>
              <span style={{color: contractData?.transaction_status === "STARTED" || contractData?.transaction_status === "MID_INSPECTION" ? "#0f0" : "#f66"}}>
                transaction_status: {contractData?.transaction_status ?? "—"}
              </span><br/>
              current_step: {contractData?.current_step ?? "—"}<br/>
              stage2_status(착공 payout): {dbPayoutMap[2]?.status ?? "—"}<br/>
              <span style={{color: (dbPhotos[1]?.length ?? 0) > 0 ? "#0f0" : "#f66"}}>
                phase_photo_step1_count: {dbPhotos[1]?.length ?? 0}
              </span><br/>
              {(dbPhotos[1]?.length ?? 0) > 0 && (
                <span style={{color:"#4ff"}}>
                  phase_photo_step1_urls: {(dbPhotos[1] ?? []).slice(0,2).map(u => "…" + u.slice(-18)).join(", ")}<br/>
                </span>
              )}
              <span style={{color: approvalRequired ? "#ff0" : "#888"}}>
                customer_approval_required: {String(approvalRequired)}
              </span><br/>
              <span style={{color: approveVisible ? "#0f0" : "#f66"}}>
                approve_button_visible(착공): {String(approveVisible)}
              </span><br/>
              stageStatus: {JSON.stringify(stageStatus)}<br/>
              {!isConsumer && companyReportDebug && (<>
                <span style={{color:"#ff0"}}>── company report result ──</span><br/>
                <span style={{color: companyReportDebug.send_ok ? "#0f0" : companyReportDebug.send_err ? "#f66" : "#888"}}>
                  send_clicked: {String(companyReportDebug.send_clicked ?? "—")} | send_ok: {String(companyReportDebug.send_ok ?? "—")}
                </span><br/>
                {companyReportDebug.send_err && (
                  <span style={{color:"#f66"}}>send_err: {companyReportDebug.send_err}<br/></span>
                )}
                <span style={{color:"#aaa"}}>
                  status_update_table: {companyReportDebug.status_update_table ?? "—"} | customer_visible_status: {companyReportDebug.customer_visible_status ?? "—"}
                </span><br/>
                <span style={{color: companyReportDebug.contract_id && companyReportDebug.contract_id !== "NULL" ? "#0f0" : "#f66"}}>
                  contract_id/escrow_id: {companyReportDebug.contract_id?.slice?.(0,8) ?? companyReportDebug.contract_id}
                </span><br/>
                <span style={{color:"#aaa"}}>
                  request_id: {companyReportDebug.request_id?.slice?.(0,8) ?? companyReportDebug.request_id} | company_id: {companyReportDebug.company_id?.slice?.(0,8) ?? companyReportDebug.company_id}
                </span><br/>
                current_status: {companyReportDebug.current_status} | phase: {companyReportDebug.current_phase}<br/>
                <span style={{color: companyReportDebug.uploaded_photo_url ? "#4ff" : "#888"}}>
                  uploaded_photo_url: {companyReportDebug.uploaded_photo_url ? "…" + String(companyReportDebug.uploaded_photo_url).slice(-24) : "none"}
                </span><br/>
                <span style={{color: companyReportDebug.upload_ok ? "#0f0" : companyReportDebug.upload_err ? "#f66" : "#888"}}>
                  upload_ok: {String(companyReportDebug.upload_ok ?? "—")} | upload_err: {companyReportDebug.upload_err ?? "none"}
                </span><br/>
                <span style={{color: companyReportDebug.status_update_ok ? "#0f0" : companyReportDebug.status_update_err ? "#f66" : "#888"}}>
                  status_update_ok: {String(companyReportDebug.status_update_ok ?? "—")} | err: {companyReportDebug.status_update_err ?? "none"}
                </span><br/>
                <span style={{color: companyReportDebug.payout_update_ok ? "#0f0" : companyReportDebug.payout_update_err ? "#f66" : "#888"}}>
                  payout_update_ok: {String(companyReportDebug.payout_update_ok ?? "—")} | err: {companyReportDebug.payout_update_err ?? "none"}
                </span><br/>
                <span style={{color: companyReportDebug.contract_reload_ok ? "#0f0" : companyReportDebug.contract_reload_err ? "#f66" : "#888"}}>
                  contract_reload_ok: {String(companyReportDebug.contract_reload_ok ?? "—")} | err: {companyReportDebug.contract_reload_err ?? "none"}
                </span><br/>
                {companyReportDebug.caught_err && (
                  <span style={{color:"#f66"}}>caught_err: {companyReportDebug.caught_err}<br/></span>
                )}
              </>)}
              {isConsumer && (() => {
                const waiting = stageStatus[3] === "pending_customer" || stageStatus[4] === "pending_customer" || stageStatus[5] === "pending_customer";
                const ctaVisible = waiting && !disputeSubmitted;
                const startU = (stagePhotos[3] ?? [])[0];
                const midU   = (stagePhotos[4] ?? [])[0];
                const compU  = (stagePhotos[5] ?? [])[0];
                return (<>
                  <span style={{color:"#ff0"}}>── customer escrow view ──</span><br/>
                  contract_id/escrow_id: {resolvedContractId?.slice(0,8) ?? "null"}<br/>
                  <span style={{color: startU ? "#4ff" : "#888"}}>start_photo_url: {startU ? "…"+String(startU).slice(-18) : "none"}</span><br/>
                  <span style={{color: midU ? "#4ff" : "#888"}}>mid_photo_url: {midU ? "…"+String(midU).slice(-18) : "none"}</span><br/>
                  <span style={{color: compU ? "#4ff" : "#888"}}>completion_photo_url: {compU ? "…"+String(compU).slice(-18) : "none"}</span><br/>
                  <span style={{color: waiting ? "#ff0" : "#888"}}>waiting_customer_confirm: {String(waiting)}</span><br/>
                  <span style={{color: ctaVisible ? "#0f0" : "#f66"}}>approve_cta_visible: {String(ctaVisible)}</span><br/>
                </>);
              })()}
              {isConsumer && approvalLog && (<>
                <span style={{color:"#ff0"}}>── customer approval result ──</span><br/>
                stage: {approvalLog.stageId} | cid: {approvalLog.contractId}<br/>
                <span style={{color: approvalLog.payout === "ok" ? "#0f0" : "#f66"}}>
                  payout: {approvalLog.payout ?? "—"}
                </span><br/>
                <span style={{color: approvalLog.step === "ok" ? "#0f0" : "#f66"}}>
                  step: {approvalLog.step ?? "—"}
                </span><br/>
              </>)}
              {escrowDebug && (
                <span style={{color: escrowDebug.restored ? "#0f0" : "#f66"}}>
                  self_fetch: src={escrowDebug.src} {escrowDebug.err ? `err=${escrowDebug.err}` : "ok"}
                </span>
              )}
            </div>
          );
        })()}

        {/* STEP J — Dispute freeze banner */}
        {disputeSubmitted && (
          <div style={{ background: "#FFF0F0", border: `2px solid ${C.red}44`, borderRadius: R.lg,
            padding: S.lg, marginBottom: S.lg, display: "flex", alignItems: "flex-start", gap: S.sm }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.red, marginBottom: 3 }}>분쟁 접수 — 계약 일시 동결</div>
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6 }}>
                이의 신청이 접수되어 모든 단계 승인 및 지급이 동결됩니다.<br />
                공간마켓 중재팀이 검토 후 연락드립니다 (영업일 1~2일).
              </div>
            </div>
          </div>
        )}

        {/* Role banner */}
        <div style={{
          background: isConsumer ? C.brandL : C.surface2,
          border: `1px solid ${isConsumer ? C.brandM : C.bgWarm}`,
          borderRadius: R.lg, padding: `${S.sm}px ${S.lg}px`,
          marginBottom: S.lg, display: "flex", alignItems: "center", gap: S.sm,
        }}>
          <span style={{ fontSize: 16 }}>{isConsumer ? "👤" : "🏗"}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: isConsumer ? C.brand : C.text2 }}>
            {isConsumer
              ? "🔒 각 단계 사진을 확인한 후 승인해야 업체에 지급됩니다"
              : "단계별로 완료 신고 후 고객 확인 시 입금됩니다"}
          </span>
        </div>

        {/* Amount card */}
        <div style={{ background: `linear-gradient(135deg,${C.navy},${C.navyM})`, borderRadius: R.xl, padding: S.xxl, marginBottom: S.xl, color: "#fff" }}>
          {isConsumer ? (
            <>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>총 예치 금액 (시공비 + 안전거래 수수료 3%, VAT 별도)</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>{fmtMoney(customerTotal)}</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginBottom: S.xl }}>고객 예치 완료 · 단계별로 업체에 지급됩니다</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>총 계약 금액 (공간마켓 보관중)</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>{fmtMoney(bidAmount)}</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginBottom: S.xl }}>고객 예치 완료 · 단계별 완료 신고 후 입금됩니다</div>
            </>
          )}
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: R.full, height: 8, marginBottom: 6 }}>
            <div style={{ width: `${paid}%`, height: "100%", background: C.brand, borderRadius: R.full, transition: "width 0.6s ease", boxShadow: `0 0 8px ${C.brand}88` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.7 }}>
            <span>업체 지급 완료 {paid}%</span>
            {bidAmount > 0 && <span>보관 중 {fmtMoney(Math.round(bidAmount * (100 - paid) / 100))}</span>}
          </div>
        </div>

        {/* Stage steps */}
        <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.xl, border: `1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.xl }}>정산 단계</div>
          {STAGE_META.map((s, i) => {
            const status = stageStatus[s.id];
            // stages[0..3] correspond to STAGE_META ids 2..5 (id 1 is deposit, no payment)
            const stage = s.id >= 2 ? stages[s.id - 2] : null;
            const active = isActive(s.id);
            const done = status === "done";
            const col = statusColor(s.id);
            const photos = stagePhotos[s.id] || [];
            const isUploadingThis = uploadingStage === s.id;
            const deadline = stageDeadlines[s.id];

            return (
              <div key={s.id} style={{ display: "flex", gap: S.md, marginBottom: i < STAGE_META.length - 1 ? S.xl : 0 }}>
                {/* Timeline dot */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: R.full,
                    background: done ? C.green : active ? C.brand : C.bgWarm,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                    boxShadow: active ? `0 0 0 4px ${C.brand}33` : "none",
                    border: active ? `2px solid ${C.brand}` : "none",
                    color: (done || active) ? "#fff" : C.text4,
                  }}>
                    {statusIcon(s.id)}
                  </div>
                  {i < STAGE_META.length - 1 && (
                    <div style={{ width: 2, flex: 1, minHeight: 20, marginTop: 4, background: done ? C.green : C.bgWarm }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: done ? C.green : active ? C.brand : C.text3 }}>{s.label}</div>
                    {stage && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: done ? C.green : active ? C.brand : C.text4 }}>
                          {isConsumer
                            ? fmtMoney(stage.amount)
                            : <>{fmtMoney(stage.amount)}<span style={{ fontSize: 11, marginLeft: 4 }}>→실수령 {fmtMoney(stage.companyReceiveAmount)}</span></>
                          }
                        </div>
                        {!isConsumer && (
                          <div style={{ fontSize: 11, color: col }}>
                            {done ? "✓ 입금완료" : status === "pending_customer" ? "⏳ 고객 확인 대기" : active ? "● 신고 대기" : "미지급"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.5, marginBottom: active ? S.md : 0 }}>{s.sub}</div>

                  {/* ── Company action buttons (stages 2, 3, 4) ── */}
                  {!isConsumer && status === "company_todo" && s.id >= 2 && (
                    <div style={{ marginTop: S.sm }}>
                      <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.bgWarm}` }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📸 사진 업로드</div>
                        <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6, marginBottom: S.md }}>
                          고객이 사진을 확인하면 {stage ? fmtMoney(stage.amount) : `${s.pct}%`} 지급 승인이 진행됩니다.
                        </div>
                        {photos.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: S.sm, marginBottom: S.md }}>
                            {photos.map((src, pi) => (
                              <div key={pi} style={{ position: "relative", aspectRatio: "1", borderRadius: R.md, overflow: "hidden", border: `1px solid ${C.bgWarm}` }}>
                                <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.background = C.bgWarm; }} />
                                <button onClick={() => removePhoto(s.id, pi)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", borderRadius: R.full, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                              </div>
                            ))}
                            {photos.length < 6 && (
                              <button onClick={() => fileInputRefs[s.id]?.current?.click()} style={{ aspectRatio: "1", background: C.bg, border: `2px dashed ${C.bgWarm}`, borderRadius: R.md, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                <span style={{ fontSize: 20, color: C.text4 }}>+</span>
                              </button>
                            )}
                          </div>
                        )}
                        {photos.length === 0 && (
                          <button onClick={() => fileInputRefs[s.id]?.current?.click()} disabled={isUploadingThis}
                            style={{ width: "100%", padding: "18px", background: C.bg, border: `2px dashed ${C.bgWarm}`, borderRadius: R.lg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: S.sm, cursor: "pointer", marginBottom: S.md }}>
                            <span style={{ fontSize: 28 }}>{isUploadingThis ? "⏳" : "📷"}</span>
                            <span style={{ fontSize: 13, color: C.text3, fontWeight: 600 }}>{isUploadingThis ? "처리 중..." : "사진을 선택하세요"}</span>
                            <span style={{ fontSize: 11, color: C.text4 }}>JPG, PNG · 최대 6장</span>
                          </button>
                        )}
                        <div style={{ display: "flex", gap: S.sm }}>
                          <button onClick={() => fileInputRefs[s.id]?.current?.click()} disabled={isUploadingThis}
                            style={{ flex: 1, padding: "11px", background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                            📁 사진 선택
                          </button>
                          <button
                            onClick={() => !disputeSubmitted && !reportingStage && reportComplete(s.id)}
                            disabled={isUploadingThis || reportingStage === s.id || photos.length === 0 || disputeSubmitted}
                            style={{ flex: 2, padding: "11px", borderRadius: R.lg, fontWeight: 800, fontSize: 14,
                              cursor: photos.length > 0 && !disputeSubmitted && !reportingStage ? "pointer" : "not-allowed",
                              border: "none",
                              background: photos.length > 0 && !disputeSubmitted ? C.brand : C.bgWarm,
                              color:      photos.length > 0 && !disputeSubmitted ? "#fff" : C.text4,
                              boxShadow:  photos.length > 0 && !disputeSubmitted ? `0 4px 14px ${C.brand}44` : "none" }}>
                            {disputeSubmitted ? "🔒 분쟁 동결 중"
                              : reportingStage === s.id ? "전송 중..."
                              : isUploadingThis ? "업로드 중..."
                              : "고객에게 전송하기"}
                          </button>
                        </div>
                        {reportError && (
                          <div style={{ marginTop: S.sm, padding: "8px 12px", background: "#FFF0F0", border: `1px solid ${C.red}33`, borderRadius: R.md, fontSize: 12, color: C.red }}>
                            {reportError}
                          </div>
                        )}
                        <input ref={fileInputRefs[s.id]} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFileChange(e, s.id)} />
                      </div>
                    </div>
                  )}

                  {/* Company: uploaded photos shown in pending_customer */}
                  {!isConsumer && status === "pending_customer" && (
                    <div style={{ marginTop: S.sm }}>
                      {photos.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: S.sm, marginBottom: S.sm }}>
                          {photos.map((src, pi) => (
                            <div key={pi} style={{ borderRadius: R.md, overflow: "hidden", border: `1px solid ${C.bgWarm}`, aspectRatio: "1" }}>
                              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.background = C.bgWarm; }} />
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.md, display: "flex", alignItems: "center", gap: S.sm }}>
                        <span style={{ fontSize: 16 }}>⏳</span>
                        <span style={{ fontSize: 13, color: C.brand, fontWeight: 700 }}>고객 확인 대기중 · 72시간 내 자동 승인</span>
                      </div>
                    </div>
                  )}

                  {/* Company: done */}
                  {!isConsumer && status === "done" && s.pct > 0 && (
                    <div style={{ background: C.greenL, borderRadius: R.lg, padding: S.md, display: "flex", alignItems: "center", gap: S.sm, marginTop: S.sm }}>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>입금 완료 · {fmtMoney(stage?.companyReceiveAmount ?? 0)}</span>
                    </div>
                  )}

                  {/* ── Customer confirmation UI ── */}
                  {isConsumer && status === "pending_customer" && (
                    <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.brandM}`, marginTop: S.sm }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.brand, marginBottom: S.sm }}>
                        {s.id === 3 && "🏗 업체가 착공을 시작했습니다"}
                        {s.id === 4 && "📸 중간 점검 사진을 확인하고 승인해주세요"}
                        {s.id === 5 && "🏁 업체가 시공 완료를 신고했습니다"}
                      </div>
                      {deadline && <CountdownTimer deadlineMs={deadline} />}
                      {photos.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.md }}>
                          {photos.map((src, pi) => (
                            <div key={pi} style={{ borderRadius: R.md, overflow: "hidden", border: `1px solid ${C.brandM}`, aspectRatio: "4/3" }}>
                              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.background = C.bgWarm; }} />
                            </div>
                          ))}
                        </div>
                      )}
                      {s.id !== 4 && (
                        <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: S.md }}>
                          {s.id === 3 && <>착공금 <b>{stage ? fmtMoney(stage.amount) : "20%"}</b>을 업체에 지급하시겠습니까?</>}
                          {s.id === 5 && <>잔금 <b>{stage ? fmtMoney(stage.amount) : "30%"}</b>을 업체에 지급하시겠습니까?</>}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: S.sm }}>
                        {!disputeSubmitted && (
                          <button onClick={() => setShowDispute(true)} style={{ flex: 1, padding: "11px", background: C.surface, color: C.red, border: `1px solid ${C.red}33`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>⚠️ 이의 신청</button>
                        )}
                        <button
                          onClick={() => !disputeSubmitted && setConfirmStage(s.id)}
                          disabled={disputeSubmitted}
                          style={{ flex: 2, padding: "11px", background: disputeSubmitted ? C.bgWarm : C.brand, color: disputeSubmitted ? C.text4 : "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 13, cursor: disputeSubmitted ? "not-allowed" : "pointer", boxShadow: disputeSubmitted ? "none" : `0 4px 14px ${C.brand}44` }}>
                          {disputeSubmitted ? "🔒 분쟁 동결 중" : `✅ ${s.confirmLabel}`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Customer: done state for payable stages */}
                  {isConsumer && status === "done" && s.pct > 0 && (
                    <div style={{ background: C.greenL, borderRadius: R.lg, padding: S.md, display: "flex", alignItems: "center", gap: S.sm, marginTop: S.sm }}>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>확정 완료 · {fmtMoney(stage?.amount ?? 0)} 지급됨</span>
                    </div>
                  )}

                  {/* Customer: dispute submitted */}
                  {isConsumer && disputeSubmitted && status === "pending_customer" && (
                    <div style={{ background: "#FFF0F0", borderRadius: R.lg, padding: S.md, display: "flex", alignItems: "center", gap: S.sm, border: `1px solid ${C.red}22`, marginTop: S.sm }}>
                      <span style={{ fontSize: 16 }}>⚠️</span>
                      <div>
                        <div style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>이의 신청 접수됨</div>
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>공간마켓 중재팀이 검토 후 연락드립니다 (영업일 1~2일)</div>
                      </div>
                    </div>
                  )}

                  {/* Locked stage */}
                  {status === "locked" && (
                    <div style={{ fontSize: 12, color: C.text4, marginTop: 4 }}>이전 단계 완료 후 활성화됩니다</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Shared Construction Timeline ── */}
        <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.xl, border: `1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>🗓 공사 타임라인</div>
          {timeline.map((item, idx) => (
            <div key={item.id} style={{ display: "flex", gap: S.md, marginBottom: idx < timeline.length - 1 ? S.lg : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: R.full, background: item.type === "confirm" ? C.greenL : item.type === "dispute" ? "#FFF0F0" : C.brandL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                  {TIMELINE_ICONS[item.type] ?? "●"}
                </div>
                {idx < timeline.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 16, marginTop: 4, background: C.bgWarm }} />
                )}
              </div>
              <div style={{ flex: 1, paddingTop: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.type === "confirm" ? C.green : item.type === "dispute" ? C.red : C.text1 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: C.text4, marginTop: 2 }}>{fmtTs(item.ts)}</div>
              </div>
            </div>
          ))}
        </div>

        <EscrowCalculator />

        {/* Warranty info */}
        <div style={{ background: C.navyL, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.trustM}`, display: "flex", gap: S.md, alignItems: "flex-start", marginBottom: S.lg }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>🛡</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 4 }}>하자보수 보증 안내</div>
            <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7 }}>완료 확인 후 <b style={{ color: C.navy }}>1년간 무상 AS</b> 보장</div>
          </div>
        </div>

        {/* Review CTA — shown to consumer when SETTLED/completed */}
        {isConsumer && (stageStatus[5] === "done" || contractData?.transaction_status === "SETTLED") && (
          <div style={{ background: reviewedForContract ? C.brandL : "#FFF8EC",
            borderRadius: R.xl, padding: S.xl, marginBottom: S.lg,
            border: `1px solid ${reviewedForContract ? C.brandM : "#F5D97A"}` }}>
            {reviewedForContract ? (
              <div style={{ display:"flex", alignItems:"center", gap:S.md }}>
                <div style={{ fontSize:28, flexShrink:0 }}>✅</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.brand, marginBottom:2 }}>리뷰 작성 완료</div>
                  <div style={{ fontSize:12, color:C.text3 }}>소중한 후기 감사합니다. 커피쿠폰 발송 예정입니다.</div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:S.md, marginBottom:S.md }}>
                  <div style={{ fontSize:28, flexShrink:0 }}>☕</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color:"#8A5C00", marginBottom:2 }}>공사 완료 — 후기를 남겨보세요</div>
                    <div style={{ fontSize:12, color:"#A06B00", lineHeight:1.6 }}>포토리뷰 작성 시 커피쿠폰을 드립니다.</div>
                  </div>
                </div>
                <button onClick={() => onReview && onReview(resolvedBid?.company)}
                  style={{ width:"100%", padding:S.lg, background:"#8A5C00", color:"#fff",
                    border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14,
                    cursor:"pointer", boxShadow:"0 4px 16px rgba(138,92,0,0.25)" }}>
                  ⭐ 포토리뷰 작성하고 커피쿠폰 받기
                </button>
              </div>
            )}
          </div>
        )}

        {/* Deposit info */}
        <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>🏦 예치금 보관 안내</div>
          {[["보관", "공간마켓 법인 신탁 계좌"], ["환급", "탈퇴 7일 내 전액"], ["분쟁", "중재 후 판정 지급"], ["향후", "은행 신탁 연계 예정"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: `${S.xs}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize: 12, color: C.text3 }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text1 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Consumer confirm modal ── */}
      {confirmStage && isConsumer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 40px" }}>
            <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />
            <div style={{ textAlign: "center", marginBottom: S.xxl }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>💸</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 6 }}>
                {confirmStage === 3 && "업체에게 착공금을 지급할까요?"}
                {confirmStage === 4 && "업체에게 중도금을 지급할까요?"}
                {confirmStage === 5 && "업체에게 잔금을 지급할까요?"}
              </div>
              <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6 }}>
                공간마켓이 보관 중인 금액에서<br />
                <b style={{ color: C.text1 }}>{fmtMoney(stages[confirmStage - 2]?.amount ?? 0)}</b>을 업체에 지급합니다
              </div>
            </div>
            {stages.length > 0 && (
              <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg, marginBottom: S.xl }}>
                {stages.map(({ name, percent, amount }, idx) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: `${S.sm}px 0`, borderBottom: idx < stages.length - 1 ? `1px solid ${C.bgWarm}` : "none" }}>
                    <span style={{ fontSize: 13, color: idx === 0 ? C.text3 : C.text2, fontWeight: 600 }}>{name} ({percent}%)</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: idx === 0 ? C.text4 : C.text1, textDecoration: idx === 0 ? "line-through" : "none" }}>{fmtMoney(amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: S.sm }}>
              <button onClick={() => setConfirmStage(null)} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>취소</button>
              <button onClick={() => advanceStage(confirmStage)} style={{ flex: 2, padding: S.xl, background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 4px 16px ${C.brand}44` }}>
                ✅ {STAGE_META.find(x => x.id === confirmStage)?.confirmLabel ?? "승인하고 지급"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dispute sheet ── */}
      {showDispute && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }}
          onClick={e => { if (e.target === e.currentTarget) setShowDispute(false); }}>
          <div style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 40px" }}>
            <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 6 }}>⚠️ 이의 신청</div>
            <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: S.xl }}>시공 상태가 계약 내용과 다를 경우 이의를 신청하세요.<br />공간마켓 중재팀이 검토 후 연락드립니다.</div>
            <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
              placeholder="이의 사유를 입력하세요 (예: 타일 줄눈 마감이 계약서 기준 미달)"
              style={{ width: "100%", padding: S.lg, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`, background: C.surface2, fontSize: 13, color: C.text1, resize: "none", height: 100, boxSizing: "border-box", marginBottom: S.xl, outline: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
            <div style={{ display: "flex", gap: S.sm }}>
              <button onClick={() => setShowDispute(false)} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>취소</button>
              <button
                onClick={async () => {
                  if (!disputeReason.trim()) return;
                  addTimeline("dispute", "이의 신청");
                  setShowDispute(false);
                  setDisputeSubmitted(true);
                  if (resolvedContractId) {
                    holdAllPayoutsForEscrow(resolvedContractId).catch(() => {});
                    updateTransactionStatus(resolvedContractId, "DISPUTE").catch(() => {});
                    updateDisputeStatus(resolvedContractId, "DISPUTE_OPEN").catch(() => {});
                    logActivity({
                      userId:     userId ?? null,
                      role:       "consumer",
                      action:     "DISPUTE_FILED",
                      targetType: "contract",
                      targetId:   resolvedContractId,
                      metadata:   { reason: disputeReason },
                    }).catch(() => {});
                    // STEP R: notify admin with CRITICAL priority
                    createNotification({
                      userId:      null,
                      type:        "DISPUTE_FILED",
                      title:       "분쟁 접수",
                      message:     `계약 ${resolvedContractId} 에서 분쟁이 접수되었습니다.`,
                      relatedId:   resolvedContractId,
                      relatedType: "contract",
                      priority:    "CRITICAL",
                    }).catch(() => {});
                  }
                }}
                style={{ flex: 2, padding: S.xl, background: disputeReason.trim() ? C.red : C.bgWarm, color: disputeReason.trim() ? "#fff" : C.text4, border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: disputeReason.trim() ? "pointer" : "not-allowed" }}>
                이의 신청하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
