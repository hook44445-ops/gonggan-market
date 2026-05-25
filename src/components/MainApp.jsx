import { useState, useEffect, useRef } from "react";
import { C, R, S, GRADE, calcCustomerGrade } from "../constants";
import { TempBadge, CertBadge, Divider } from "./common";
import LiveFeed from "./LiveFeed";
import CompanyCard from "./CompanyCard";
import PortfolioScreen from "../screens/PortfolioScreen";
import ReviewScreen from "../screens/ReviewScreen";
import ChatScreen from "../screens/ChatScreen";
import EscrowScreen from "../screens/EscrowScreen";
import DashboardScreen from "../screens/DashboardScreen";
import BidStatusScreen from "../screens/BidStatusScreen";
import AdminScreen from "../screens/AdminScreen";
import LoungeScreen from "../screens/LoungeScreen";
import LoungeWriteScreen from "../screens/LoungeWriteScreen";
import LoungePostDetailScreen from "../screens/LoungePostDetailScreen";
import LoungeStoryUploadScreen from "../screens/LoungeStoryUploadScreen";
import TokenStoreScreen from "../screens/TokenStoreScreen";
import TokenHistoryScreen from "../screens/TokenHistoryScreen";
import DocumentCenterScreen from "../screens/DocumentCenterScreen";
import BidCard from "./BidCard";
import CompanyDepositCard from "./CompanyDepositCard";
import RequestModal from "./RequestModal";
import LoungeMyPageSection from "./lounge/LoungeMyPageSection";
import { useSpaceToken } from "../hooks/useSpaceToken";
import { useSpaceTemperature } from "../hooks/useSpaceTemperature";
import {
  supabase,
  getRequests,
  getUserRequests,
  createRequest,
  closeRequest,
  updateRequest,
  repostRequest,
  createRequestRepost,
  expireRequest,
  archiveRequest,
  getLoungePosts,
  createBid,
  getBidsForRequest,
  getCompanyByOwnerId,
  upsertCompany,
  getBidById,
  getPaymentOrderByRequest,
  getEscrowByRequest,
  createEscrowRecord,
  createEscrowPayoutsForContract,
  createPaymentOrder,
  createPaymentTransaction,
  createNotification,
  setRequestInProgress,
  getCompanyBids,
  getEscrowWithPayouts,
  getActiveRequestByUser,
  archiveRequestAuto,
} from "../lib/supabase";
import { useCompanyList } from "../hooks/useCompanyList";
import KakaoMap from "./KakaoMap";

// ── normalizers: DB row → local shape ─────────────────────────────────────────

const normalizeCompany = (row) => ({
  id:            row.id,
  ownerId:       row.owner_id ?? null,
  name:          row.name ?? "업체",
  temp:          row.temp ?? 70,
  verified:      row.verified ?? false,
  badge:         row.badge ?? "basic",
  hasInsurance:  row.has_insurance ?? false,
  completedJobs: row.completed_jobs ?? 0,
  recontractRate: row.recontract_rate ?? 0,
  asRate:        row.as_rate ?? 0,
  region:        row.region ?? "",
  online:        row.online ?? false,
  specialties:   row.specialties ?? [],
  companyStatus: row.company_status ?? "PENDING",
});

const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const normalizeRequest = (row) => {
  const createdAt  = row.created_at ? new Date(row.created_at) : new Date();
  const expiresAt  = row.expires_at
    ? new Date(row.expires_at)
    : new Date(createdAt.getTime() + REQUEST_TTL_MS);
  const msLeft     = expiresAt.getTime() - Date.now();
  const daysLeft   = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const status     = row.status ?? "open";
  const isExpiredByTime = daysLeft <= 0;
  const isActive   = status === "open" && !isExpiredByTime;
  const isClosed   = status === "closed" || status === "cancelled" ||
                     status === "expired" ||
                     (status === "open" && isExpiredByTime);
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.space_type ?? "",
    size: row.size ?? "",
    budget: [row.budget_min, row.budget_max].filter(Boolean).map(n => `${n}만원`).join("~") || "협의",
    style: row.style ?? "",
    desc: row.description ?? row.desc ?? "",
    area: row.area ?? "",
    user: "의뢰인",
    bids: 0,
    bidCount: (row.bids ?? []).length,
    time: new Date(row.created_at).toLocaleString("ko-KR", { month:"numeric", day:"numeric", hour:"numeric", minute:"2-digit" }),
    status,
    urgent: row.urgent ?? false,
    createdAt: row.created_at,
    expiresAt: expiresAt.toISOString(),
    daysLeft: Math.max(0, daysLeft),
    isExpiredByTime,
    isActive,
    isClosed,
  };
};

const normalizeBid = (row) => ({
  id: row.id,
  requestId: row.request_id,
  companyId: row.company_id,
  company: row.companies ? normalizeCompany(row.companies) : null,
  price: row.price,
  period: row.period_days,
  material: row.material_note ?? "",
  comment: row.comment ?? "",
  createdAt: row.created_at,
  status: row.selected ? "selected" : "pending",
});

// Compute customer-facing stage from request + escrow/payout data
const computeCustomerStage = (r, escrowData) => {
  if (!r) return null;
  const { escrow = null, payouts = [] } = escrowData ?? {};

  if (!escrow) {
    if (r.status === "in_progress") return {
      badge: "계약중", badgeBg: C.brandL, badgeFg: C.brand,
      label: "계약 진행중", sub: "에스크로 정산 진행 중",
      action: "escrow", cta: "에스크로 확인하기",
    };
    if (r.bidCount > 0) return {
      badge: "입찰중", badgeBg: C.brandL, badgeFg: C.brand,
      label: "입찰중", sub: `업체 ${r.bidCount}곳이 입찰했어요`,
      action: "bids", cta: "견적 비교하고 업체 선택하기",
    };
    return {
      badge: "접수완료", badgeBg: C.bgWarm, badgeFg: C.text3,
      label: "접수완료", sub: "업체가 견적을 검토 중입니다",
      action: null, cta: null,
    };
  }

  const txStatus = escrow.transaction_status ?? "CONTRACTED";
  const payout2 = payouts.find(p => p.stage === 2); // 착공 확인
  const payout3 = payouts.find(p => p.stage === 3); // 중간 점검
  const payout4 = payouts.find(p => p.stage === 4); // 완료 확인

  if (txStatus === "SETTLED" || payout4?.status === "APPROVED") return {
    badge: "완료", badgeBg: "#E6F9EE", badgeFg: "#00b050",
    label: "시공 완료", sub: "정산 완료",
    action: "escrow", cta: "정산 내역 보기",
  };
  if (txStatus === "COMPLETED") return {
    badge: "확인 필요", badgeBg: "#FFF7E6", badgeFg: "#C07000",
    label: "완료 사진 확인 대기", sub: "완료 사진 확인 후 승인하면 30% 지급",
    action: "escrow", cta: "완료 사진 확인하기",
  };
  if (txStatus === "MID_INSPECTION") return {
    badge: "확인 필요", badgeBg: "#FFF7E6", badgeFg: "#C07000",
    label: "중간 점검 사진 확인 대기", sub: "사진 확인 후 승인하면 40% 지급",
    action: "escrow", cta: "중간 점검 확인하기",
  };
  if (txStatus === "STARTED" && payout2?.status !== "APPROVED") return {
    badge: "확인 필요", badgeBg: "#FFF7E6", badgeFg: "#C07000",
    label: "착공 사진 확인 대기", sub: "착공 사진 확인 후 승인하면 20% 지급",
    action: "escrow", cta: "착공 사진 확인하기",
  };
  return {
    badge: "시공중", badgeBg: C.brandL, badgeFg: C.brand,
    label: "시공 진행중", sub: "업체 진행 중 · 단계별 사진 확인 예정",
    action: "escrow", cta: "시공 진행 확인하기",
  };
};

export default function MainApp({ user, onLogout, onLogin, onStartOnboarding }) {
  const activeRole = user.activeRole ?? user.role ?? "consumer";
  const mode = activeRole === "company" ? "company" : activeRole === "admin" ? "admin" : "consumer";
  const [screen, setScreen] = useState(() => {
    if (activeRole === "admin") return "admin";
    if (activeRole === "company") return "dashboard";
    if (user.startAt) return user.startAt;
    return "home";
  });
  const [prevScreen, setPrevScreen] = useState("home");
  const [selCo, setSelCo] = useState(null);
  const [toast, setToast] = useState(null);
  const [showReq, setShowReq] = useState(false);
  const [reqBlock, setReqBlock] = useState(null);   // null | { type, activeReq, remainingMs }
  const [reqCheckDebug, setReqCheckDebug] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [bidAlert, setBidAlert] = useState(null);
  const [bidViewRequestId, setBidViewRequestId] = useState(null);
  const [chatLogs, setChatLogs] = useState({});
  const [customerRequests, setCustomerRequests] = useState([]);
  const [submittedBids, setSubmittedBids] = useState([]);
  const [selectedBid, setSelectedBid] = useState(null);
  const [escrowContracts, setEscrowContracts] = useState([]);
  const [contractId, setContractId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(null); // requestId being confirmed
  const bidRealtimeRef = useRef(null);

  // ── 관심 탭 ──────────────────────────────────────────────────────────────────
  const [favTab, setFavTab] = useState("received");

  // ── 라운지 상태 ──────────────────────────────────────────────────────────────
  const [loungePost, setLoungePost]             = useState(null);
  const [localLoungePosts, setLocalLoungePosts]   = useState([]);
  const [localLoungeStories, setLocalLoungeStories] = useState([]);
  const { balance: tokenBalance, logs: tokenLogs, spend: spendToken, earn: earnToken } = useSpaceToken(user?.id);
  const { temperature } = useSpaceTemperature(user?.id);

  // Admin hidden entry
  const [adminTapCount, setAdminTapCount] = useState(0);
  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState("");
  const [adminCodeError, setAdminCodeError] = useState("");

  const handleCloseRequest = async (requestId) => {
    const markClosed = r => r.id === requestId
      ? { ...r, status: "closed", isActive: false, isClosed: true, daysLeft: 0 }
      : r;
    setMyRequests(prev => prev.map(markClosed));
    setCustomerRequests(prev => prev.map(markClosed));
    await closeRequest(requestId);
  };

  const handleRepost = async (requestId) => {
    const originalReq = myRequests.find(r => r.id === requestId)
      ?? customerRequests.find(r => r.id === requestId);

    showToast("✅ 견적 요청이 재노출되었습니다");

    // UI: 기존 요청 즉시 만료 처리
    const markExpired = r => r.id === requestId
      ? { ...r, status: "expired", isActive: false, isClosed: true, daysLeft: 0 }
      : r;
    setMyRequests(prev => prev.map(markExpired));
    setCustomerRequests(prev => prev.map(markExpired));

    if (!requestId.startsWith("tmp-") && user.id && originalReq) {
      // DB: 기존 요청 expire
      expireRequest(requestId);

      // DB: 새 요청 생성 (새 UUID, bids 0건)
      const { data, error } = await createRequest({
        user_id:    user.id,
        status:     'open',
        area:        originalReq.area ?? user.region ?? "",
        space_type:  originalReq.type,
        size:        originalReq.size,
        style:       originalReq.style,
        description: originalReq.desc ?? "",
        budget_min:  0,
        budget_max:  0,
        expires_at:  new Date(Date.now() + REQUEST_TTL_MS).toISOString(),
      });

      setReqCreateDebug({
        id:          data?.id ?? null,
        status:      data?.status ?? null,
        expires_at:  data?.expires_at ?? null,
        space_type:  data?.space_type ?? null,
        user_id:     data?.user_id ?? null,
        insertError: error?.message ?? null,
        _note: "repost → new request",
      });

      if (error) {
        showToast(`재노출 실패: ${error.message}`);
      } else if (data) {
        const newReq = normalizeRequest(data);
        setMyRequests(prev => [newReq, ...prev]);
        setCustomerRequests(prev => [newReq, ...prev]);
      }
    } else {
      setReqCreateDebug({ _note: "repost guard blocked", requestId, hasTmpPrefix: requestId.startsWith("tmp-"), hasUserId: !!user.id, hasOriginalReq: !!originalReq });
    }
  };

  const [editRequest, setEditRequest] = useState(null);
  const [bidDebug, setBidDebug] = useState(null);
  const handleUpdateRequest = async (form, requestId) => {
    const markUpdated = r => r.id === requestId
      ? { ...r, type: form.type, size: form.size, style: form.style, desc: form.desc }
      : r;
    setMyRequests(prev => prev.map(markUpdated));
    setCustomerRequests(prev => prev.map(markUpdated));
    setEditRequest(null);
    showToast("✅ 견적 요청이 수정됐어요");
    if (!requestId.startsWith("tmp-")) {
      await updateRequest(requestId, {
        space_type:  form.type,
        size:        form.size,
        style:       form.style,
        description: form.desc ?? "",
      });
    }
  };

  const IS_DEBUG = true; // 디버깅 중 — 항상 표시
  const [reqDebug, setReqDebug] = useState(null);
  const [reqCreateDebug, setReqCreateDebug] = useState(null);
  const [bidFetchDebug, setBidFetchDebug] = useState(null);
  const [lastFetchAt, setLastFetchAt] = useState(null);
  const [companyJobs, setCompanyJobs] = useState([]);
  const [companyJobsDebug, setCompanyJobsDebug] = useState(null);
  const [myRequestsEscrow, setMyRequestsEscrow] = useState({}); // { [requestId]: { escrow, payouts } }
  const [escrowRefreshTrigger, setEscrowRefreshTrigger] = useState(0);

  const applyExpiry = (rows) => {
    const normalized = rows.map(normalizeRequest);
    normalized
      .filter(r => r.status === "open" && r.isExpiredByTime)
      .forEach(r => expireRequest(r.id));
    return normalized.map(r =>
      r.status === "open" && r.isExpiredByTime
        ? { ...r, status: "expired", isActive: false, isClosed: true }
        : r
    );
  };

  const loadCompanyRequests = async () => {
    const { data, error } = await getRequests();
    setReqDebug(d => ({ ...d, companyFetchError: error?.message ?? null, companyRows: data?.length ?? 0, companyData: data ?? [] }));
    setLastFetchAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    if (error) return;
    if (data) setCustomerRequests(applyExpiry(data));
  };

  // Load requests on mount
  // Consumer: server-side filter by userId; Company/Admin: load all open requests for bidding
  useEffect(() => {
    if (activeRole === "consumer" && user.id) {
      getUserRequests(user.id).then(({ data, error }) => {
        setReqDebug(d => ({ ...d, consumerFetchError: error?.message ?? null, consumerRows: data?.length ?? 0, consumerData: data ?? [] }));
        if (error) return;
        if (data) {
          const withExpiry = applyExpiry(data);
          const activeOwn = withExpiry.filter(r => r.isActive)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (activeOwn.length > 1) {
            activeOwn.slice(1).forEach(r => expireRequest(r.id));
            const keepId = activeOwn[0].id;
            setMyRequests(withExpiry.map(r =>
              r.isActive && r.id !== keepId
                ? { ...r, status: "expired", isActive: false, isClosed: true }
                : r
            ));
          } else {
            setMyRequests(withExpiry);
          }
        }
      });
    } else {
      loadCompanyRequests();
    }
  }, [activeRole, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load company profile from Supabase for authenticated company users
  // Auto-creates a row if none exists yet
  useEffect(() => {
    if (activeRole !== "company" || !user?.id) return;
    getCompanyByOwnerId(user.id).then(async ({ data }) => {
      if (data) {
        setCurrentUser(normalizeCompany(data));
      } else {
        const { data: created } = await upsertCompany({
          owner_id:       user.id,
          name:           user.name ?? "업체",
          region:         user.region ?? "",
          company_status: "ACTIVE",
          online:         true,
        });
        if (created) setCurrentUser(normalizeCompany(created));
      }
    }).catch(() => {});
  }, [user?.id, activeRole]);

  // Load company's own awarded/in-progress jobs
  useEffect(() => {
    if (activeRole !== "company" || !user?.id) return;
    getCompanyBids(user.id).then(({ data, error }) => {
      setCompanyJobsDebug(d => ({
        ...d,
        fetchError: error?.message ?? null,
        rawCount: data?.length ?? 0,
        statuses: (data ?? []).map(b => ({ id: b.id, req_status: b.requests?.status ?? "?" })),
      }));
      if (error || !data) return;
      const jobs = data
        .filter(b => b.requests?.status === "in_progress" || b.selected === true)
        .map(b => ({
          bid: {
            id: b.id,
            requestId: b.request_id,
            companyId: b.company_id,
            price: b.price,
            period: b.period_days,
            material: b.material_note ?? "",
            comment: b.comment ?? "",
            createdAt: b.created_at,
            status: "selected",
            company: { id: b.company_id, name: user.name ?? "업체", temp: 70, ownerId: user.id },
          },
          request: b.requests ? normalizeRequest(b.requests) : null,
        }));
      setCompanyJobs(jobs);
      setCompanyJobsDebug(d => ({ ...d, jobCount: jobs.length }));
    }).catch(() => {});
  }, [activeRole, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load escrow+payouts for consumer in_progress requests
  useEffect(() => {
    if (activeRole !== "consumer") return;
    const inProgress = myRequests.filter(r => r.status === "in_progress");
    if (inProgress.length === 0) return;
    inProgress.forEach(r => {
      getEscrowWithPayouts(r.id).then(({ data }) => {
        setMyRequestsEscrow(prev => ({ ...prev, [r.id]: data ?? null }));
      }).catch(() => {});
    });
  }, [myRequests, escrowRefreshTrigger, activeRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load recent lounge posts for home preview (consumer home section)
  useEffect(() => {
    getLoungePosts("all", 3).then(({ data }) => {
      if (data && data.length > 0) setLocalLoungePosts(data);
    }).catch(() => {});
  }, []);

  // Handle TossPayments redirect return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pg_success") !== "1") return;

    // Clean URL immediately
    window.history.replaceState({}, "", window.location.pathname);

    const paymentKey = params.get("paymentKey");
    const orderId    = params.get("orderId");
    const amount     = Number(params.get("amount")) || 0;

    let pending = null;
    try { pending = JSON.parse(localStorage.getItem("pg_pending") ?? "null"); } catch {}
    if (!pending || !pending.requestId) return;

    // Remove pending so we don't re-process
    try { localStorage.removeItem("pg_pending"); } catch {}

    const processTossReturn = async () => {
      // Optional: server-side confirm
      if (paymentKey && orderId && amount) {
        try {
          await fetch("/api/confirm-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentKey, orderId, amount }),
          });
        } catch {}
      }

      // DB writes
      const { data: escrowData } = await createEscrowRecord({
        requestId:   pending.requestId,
        companyId:   pending.companyId,
        totalAmount: pending.bidPrice,
      });
      let pgContractId = escrowData?.id ?? null;

      if (pgContractId) {
        await createEscrowPayoutsForContract(pgContractId, pending.companyId, pending.bidPrice, 0.04, 0.1);
        const { data: newOrder } = await createPaymentOrder({
          user_id:        pending.requestUserId ?? null,
          bid_id:         pending.bidId,
          request_id:     pending.requestId,
          contract_id:    pgContractId,
          amount:         pending.bidPrice,
          customer_fee:   pending.fee,
          vat:            Math.round((pending.fee ?? 0) * 0.1),
          total_amount:   pending.customerTotal,
          payment_method: pending.paymentMethod,
          fee_snapshot:   { customerFeeRate: 0.03, companyFeeRate: 0.04, vatRate: 0.1 },
          status:         "PAID",
        });
        if (newOrder) {
          await createPaymentTransaction({
            payment_order_id: newOrder.id,
            pg_provider:      "toss",
            pg_payment_key:   paymentKey ?? `toss_${Date.now()}`,
            method:           pending.paymentMethod ?? "CARD",
            amount:           pending.customerTotal,
            status:           "DONE",
            approved_at:      new Date().toISOString(),
            raw_response:     { paymentKey, orderId, amount, method: pending.paymentMethod },
          });
        }
        if (pending.companyOwnerId) {
          await createNotification({
            userId:      pending.companyOwnerId,
            type:        "COMPANY_SELECTED",
            title:       "계약 체결!",
            message:     `${pending.requestType ?? "시공"} 요청에서 선택되었습니다.`,
            relatedId:   pgContractId,
            relatedType: "contract",
            priority:    "HIGH",
          });
        }
        await setRequestInProgress(pending.requestId);
      }

      // Restore selBid from DB
      const { data: bid } = await getBidById(pending.bidId).catch(() => ({}));
      if (bid) {
        const restoredBid = {
          id: bid.id, requestId: bid.request_id, companyId: bid.company_id,
          company: { id: bid.company_id, name: pending.companyName ?? "업체", temp: 70, ownerId: pending.companyOwnerId },
          price: bid.price, period: bid.period_days,
          material: bid.material_note ?? "", comment: bid.comment ?? "",
          createdAt: bid.created_at, status: "selected",
          contractId: pgContractId,
        };
        setSelectedBid(restoredBid);
        if (pgContractId) setContractId(pgContractId);
        setBidViewRequestId(pending.requestId);
        setScreen("escrow");
        setPrevScreen("home");
      }
    };

    processTossReturn().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // One-time cleanup: archive known test requests (runs once on mount)
  useEffect(() => {
    const TEST_IDS = [
      "7c04f82e", "eac3b498", "ba6b29b6", "18d966b7",
    ];
    // supabase uuid starts with these prefixes — archive via prefix match using RPC isn't available,
    // so we archive by fetching then filtering
    supabase
      .from("requests")
      .select("id")
      .or(TEST_IDS.map(p => `id.ilike.${p}%`).join(","))
      .then(({ data }) => {
        if (data) data.forEach(r => archiveRequest(r.id));
      })
      .catch(() => {});
  }, []);

  // Load bids + subscribe to realtime when viewing a request's bid status
  useEffect(() => {
    if (!bidViewRequestId) return;

    getBidsForRequest(bidViewRequestId).then(({ data, error }) => {
      if (IS_DEBUG) setBidFetchDebug({ src: "mainapp_effect", req_id: bidViewRequestId, count: data?.length ?? 0, err: error?.message ?? null, req_ids: (data ?? []).map(b => b.request_id) });
      if (error) return;
      if (data) setSubmittedBids(data.map(normalizeBid));
    });

    // Realtime: append new bids as companies submit them
    const channel = supabase
      .channel(`bids:${bidViewRequestId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "bids",
        filter: `request_id=eq.${bidViewRequestId}`,
      }, async (payload) => {
        // Fetch the full row with company join so we have company data
        const { data } = await getBidsForRequest(bidViewRequestId);
        if (data) {
          const normalized = data.map(normalizeBid);
          setSubmittedBids(normalized);
          const request = customerRequests.find(r => r.id === bidViewRequestId) ?? myRequests.find(r => r.id === bidViewRequestId);
          setBidAlert({
            count: normalized.length,
            requestType: request?.type ?? "",
            requestId: bidViewRequestId,
            companies: normalized.map(b => b.company).filter(Boolean),
          });
        }
      })
      .subscribe();

    bidRealtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); bidRealtimeRef.current = null; };
  }, [bidViewRequestId]);

  const { companies } = useCompanyList();

  const updateChat = (companyId, msgs) =>
    setChatLogs(prev => ({ ...prev, [companyId]: msgs }));

  const [showLoginRequired, setShowLoginRequired] = useState(false);

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // 게스트 상태에서 로그인이 필요한 액션을 막는 헬퍼
  const requireAuth = (action) => {
    if (user.isGuest) { setShowLoginRequired(true); return; }
    action();
  };

  const ACTIVE_STATUSES = ["open", "in_progress", "contracting", "escrow_pending"];
  const ESCROW_STATUSES = ["in_progress", "contracting", "escrow_pending"];
  const COOLDOWN_MS = 6 * 24 * 60 * 60 * 1000; // 144h

  const fmtCooldown = (ms) => {
    const totalH = Math.floor(ms / (3600 * 1000));
    const d = Math.floor(totalH / 24);
    const h = totalH % 24;
    if (d > 0 && h > 0) return `${d}일 ${h}시간`;
    if (d > 0) return `${d}일`;
    return `${h}시간`;
  };

  const checkRequestBlock = async () => {
    let active = myRequests.find(r =>
      ACTIVE_STATUSES.includes(r.status) && !r.is_hidden && !r.is_deleted
    ) ?? null;
    if (!active && user?.id) {
      const { data } = await getActiveRequestByUser(user.id);
      active = data ?? null;
    }
    if (!active) {
      setReqCheckDebug({ active_count: 0, active_request_status: "none", cooldown_remaining_hours: 0, blocked_reason: "none" });
      return null;
    }
    const isEscrow = ESCROW_STATUSES.includes(active.status);
    const baseTs = active.last_activity_at ?? active.created_at ?? active.createdAt;
    const ageMs = Date.now() - new Date(baseTs).getTime();
    const remainingMs = Math.max(0, COOLDOWN_MS - ageMs);
    const canOverride = !isEscrow && ageMs >= COOLDOWN_MS;
    const blocked_reason = isEscrow ? "ESCROW_BLOCK" : canOverride ? "OPEN_ALLOW" : "COOLDOWN_BLOCK";
    setReqCheckDebug({
      active_count: 1,
      active_request_status: active.status,
      cooldown_remaining_hours: Math.ceil(remainingMs / (3600 * 1000)),
      blocked_reason,
    });
    if (canOverride) return { type: "OPEN_ALLOW", activeReq: active };
    return { type: blocked_reason, activeReq: active, remainingMs };
  };

  const handleOpenNewReq = async () => {
    const block = await checkRequestBlock();
    if (!block) { setShowReq(true); return; }
    if (block.type === "OPEN_ALLOW") {
      await archiveRequestAuto(block.activeReq.id, "auto_new_request_after_6days").catch(() => {});
      setMyRequests(prev => prev.filter(r => r.id !== block.activeReq.id));
      setShowReq(true);
      return;
    }
    setReqBlock(block);
  };

  const addBid = async (request, bidData) => {
    if (currentUser?.companyStatus && currentUser.companyStatus !== "ACTIVE") {
      showToast("현재 업체 상태에서는 입찰할 수 없습니다. 관리자 승인 후 이용 가능합니다.");
      return;
    }
    if (request.id?.startsWith("tmp-")) {
      showToast("견적 요청이 저장 중입니다. 잠시 후 다시 시도해주세요");
      return;
    }
    if (request.isClosed) {
      showToast("이미 마감된 견적 요청입니다");
      return;
    }
    // actor: display info only (name, temp, badge). DO NOT use actor.id for FK.
    const actor = currentUser ?? { id: null, ownerId: null, name: user.name ?? "업체", temp: 70 };
    // bids.company_id FK → users.id, so always use auth user.id
    const bidCompanyId = user.id;
    if (!bidCompanyId || typeof bidCompanyId !== "string" || !bidCompanyId.includes("-")) {
      setBidDebug({ request_id: request.id, payload_company_id: null, insertError: "user.id null — 로그인 필요" });
      showToast("로그인 정보를 확인할 수 없습니다");
      return;
    }
    const optimistic = {
      id: `tmp-${Date.now()}`,
      requestId: request.id,
      companyId: bidCompanyId,
      company: actor,
      price: bidData.price,
      period: bidData.period,
      material: bidData.material,
      comment: bidData.comment,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    // Optimistic update so the UI responds immediately
    setSubmittedBids(prev => [...prev, optimistic]);

    // INSERT to Supabase — company_id must be users.id (FK target)
    const { data, error } = await createBid({
      request_id:    request.id,
      company_id:    bidCompanyId,   // users.id ← FK
      price:         bidData.price,
      period_days:   bidData.period,
      material_note: bidData.material,
      comment:       bidData.comment,
    });
    if (error) {
      setBidDebug({
        payload_company_id: bidCompanyId,
        expected_fk_target: "users.id",
        companyProfile_id:  currentUser?.id ?? null,
        companyProfile_ownerId: currentUser?.ownerId ?? null,
        request_id:   request.id,
        insertResult: null,
        insertError:  error.message,
      });
      showToast(`입찰 저장 실패: ${error.message}`);
    } else if (data) {
      setSubmittedBids(prev =>
        prev.map(b => b.id === optimistic.id ? { ...normalizeBid(data), company: actor } : b)
      );
      // Post-insert verification: confirm bid is in DB with correct request_id
      const { data: verifyData } = await getBidsForRequest(request.id);
      setBidDebug({
        payload_company_id: bidCompanyId,
        expected_fk_target: "users.id",
        companyProfile_id:  currentUser?.id ?? null,
        companyProfile_ownerId: currentUser?.ownerId ?? null,
        request_id:   request.id,
        insertResult: { id: data.id, request_id: data.request_id },
        insertError:  null,
        verifyCount:  verifyData?.length ?? 0,
      });
    }

    setSubmittedBids(prev => {
      const forRequest = prev.filter(b => b.requestId === request.id);
      setBidAlert({
        count: forRequest.length,
        requestType: request.type,
        requestId: request.id,
        companies: forRequest.map(b => b.company).filter(Boolean),
      });
      return prev;
    });
  };
  const isGuestCompany = false;
  const go = (s, co=null) => {
    if (s === "admin" && activeRole !== "admin") return;
    if (s === "dashboard" && activeRole !== "company") return;
    setPrevScreen(screen);
    if (co) setSelCo(co);
    setScreen(s);
  };

  useEffect(() => {
    if (screen === "admin" && activeRole !== "admin") setScreen("home");
    if (screen === "dashboard" && activeRole !== "company") setScreen("home");
  }, [screen, activeRole]);

  const FULL = ["chat","portfolio","review","escrow","dashboard","bidstatus","admin","lounge-write","lounge-detail","lounge-story","token-store","token-history"].includes(screen);
  const NO_PAD = ["escrow","dashboard","timeline","lounge","lounge-write","lounge-detail","lounge-story","token-store","token-history"].includes(screen);
  const NAV = mode === "admin"
    ? [["📋","관리","admin"],["💬","라운지","lounge"],["👤","마이","my"]]
    : mode === "consumer"
    ? [["🏠","홈","home"],["💬","라운지","lounge"],["❤️","관심","favorites"],["🗨","대화","chatlist"],["👤","마이","my"]]
    : [["📋","요청","home"],["💬","라운지","lounge"],["❤️","관심","favorites"],["🗨","대화","chatlist"],["👤","내정보","my"]];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

      <div style={{ background:"#1a1a1a", color:"#00ff88", textAlign:"center", padding:"4px 0", fontSize:10, fontFamily:"monospace", letterSpacing:"0.5px", position:"sticky", top:0, zIndex:999 }}>
        ▶ DEPLOY CHECK 2026-05-24 sha:f688d6c ◀ &nbsp;|&nbsp; MODE:{import.meta.env.MODE} &nbsp;|&nbsp; VITE_DEBUG:{String(import.meta.env.VITE_DEBUG ?? "undefined")}
      </div>

      {(screen==="home"||screen==="map") && (
        <div style={{ background:C.surface, padding:"14px 20px 0", borderBottom:`1px solid ${C.bgWarm}`, position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:R.md, background:C.brand,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:15, boxShadow:`0 2px 8px ${C.brand}44` }}>🏠</div>
              <div style={{ fontSize:20, fontWeight:900, color:C.text1, letterSpacing:"-0.5px" }}>공간마켓</div>
            </div>
            <div style={{ display:"flex", gap:S.sm, alignItems:"center" }}>
              <button onClick={onLogout} style={{ fontSize:11, color:C.text4, background:"none", border:"none", cursor:"pointer" }}>로그아웃</button>
            </div>
          </div>
          <div style={{ display:"flex" }}>
            {[["home",mode==="consumer"?"홈":"요청 목록"],["map","지역 지도"]].map(([v,l]) => (
              <button key={v} onClick={() => setScreen(v)}
                style={{ flex:1, padding:"10px 0", border:"none", background:"transparent",
                  fontWeight:screen===v?800:500, fontSize:14,
                  color:screen===v?C.brand:C.text3,
                  borderBottom:`2.5px solid ${screen===v?C.brand:"transparent"}`,
                  cursor:"pointer" }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding:(FULL||NO_PAD)?0:`${S.xl}px ${S.xl}px 90px` }}>

        {/* 의뢰인 홈 */}
        {screen==="home" && mode==="consumer" && (
          <div>
            <div style={{ background:`linear-gradient(150deg,${C.brandL} 0%,${C.bgWarm} 100%)`,
              borderRadius:R.xl, padding:S.xxl, marginBottom:S.lg,
              border:`1.5px solid ${C.brandM}`,
              position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", right:-28, top:-28, width:110, height:110,
                borderRadius:"50%", background:`${C.brand}12` }} />
              <div style={{ position:"absolute", right:14, bottom:-18, width:64, height:64,
                borderRadius:"50%", background:`${C.brand}08` }} />
              <div style={{ fontSize:12, color:C.brand, fontWeight:700, marginBottom:6 }}>
                📍 {user.region} · {user.name}님 안녕하세요
              </div>
              <div style={{ fontSize:21, fontWeight:900, color:C.text1, marginBottom:8, lineHeight:1.4 }}>
                안심하고 맡기는 공사<br/>기록과 확인이 함께합니다
              </div>
              <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl, lineHeight:1.6 }}>
                검증된 인근 업체에게 견적을 받아보세요
              </div>
              {(() => {
                const hasActive = myRequests.some(r => r.isActive);
                return hasActive ? (
                  <div style={{ background:"rgba(255,255,255,0.18)", borderRadius:R.full,
                    padding:"12px 24px", fontSize:13, fontWeight:700, color:"#fff",
                    border:"1.5px solid rgba(255,255,255,0.4)", display:"inline-block" }}>
                    📋 진행 중인 견적이 있습니다
                  </div>
                ) : (
                  <button onClick={handleOpenNewReq}
                    style={{ background:C.brand, color:"#fff", border:"none",
                      borderRadius:R.full, padding:"12px 24px", fontWeight:800, fontSize:14, cursor:"pointer",
                      boxShadow:`0 4px 16px ${C.brand}44` }}>
                    안전하게 견적 시작하기
                  </button>
                );
              })()}
            </div>

            <LiveFeed />

            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:S.lg, textAlign:"center" }}>
                공간마켓은 이렇게 작동해요
              </div>
              {[
                { step:"1", icon:"📋", title:"견적 요청", sub:"공사 내용 입력하면\n인근 검증 업체에 자동 전달" },
                { step:"2", icon:"💰", title:"입찰 비교", sub:"업체들이 금액·기간 제출\n공간온도 보고 비교 선택" },
                { step:"3", icon:"🛡", title:"에스크로 정산", sub:"고객 돈은 공간마켓 보관\n단계 확인 후 업체에 지급" },
              ].map((item, i, arr) => (
                <div key={item.step} style={{ display:"flex", gap:S.md, alignItems:"flex-start",
                  marginBottom: i < arr.length-1 ? S.lg : 0 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                    <div style={{ width:36, height:36, borderRadius:R.full,
                      background:C.brandL, border:`1.5px solid ${C.brandM}`,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{item.icon}</div>
                    {i < arr.length-1 && (
                      <div style={{ width:1.5, height:24, background:C.bgWarm, marginTop:4 }} />
                    )}
                  </div>
                  <div style={{ paddingTop:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                      <span style={{ background:C.brand, color:"#fff", borderRadius:R.full,
                        width:18, height:18, display:"inline-flex", alignItems:"center",
                        justifyContent:"center", fontSize:10, fontWeight:900 }}>{item.step}</span>
                      <span style={{ fontSize:14, fontWeight:800, color:C.text1 }}>{item.title}</span>
                    </div>
                    <div style={{ fontSize:12, color:C.text3, lineHeight:1.7, whiteSpace:"pre-line" }}>{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {(() => {
              const activeReqs  = myRequests.filter(r => r.isActive || r.status === "in_progress");
              const historyReqs = myRequests.filter(r => r.isClosed || r.status === "completed");
              return myRequests.length > 0 ? (
                <div style={{ marginBottom:S.xl }}>
                  {/* ── Active requests ── */}
                  {activeReqs.length > 0 && (
                    <>
                      <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>
                        📋 내 견적 요청
                        <span style={{ fontSize:13, fontWeight:600, color:C.brand, marginLeft:6 }}>{activeReqs.length}건</span>
                      </div>
                      {activeReqs.map(r => {
                        const reqBids = submittedBids.filter(b => b.requestId === r.id);
                        const escrowData = myRequestsEscrow[r.id] ?? null;
                        const stage = computeCustomerStage(r, escrowData);
                        const hasEscrow = !!escrowData?.escrow;
                        const urgentDays = r.daysLeft <= 1;
                        const warningDays = r.daysLeft <= 3;
                        const borderColor = stage?.badge === "확인 필요" ? "#C07000" : hasEscrow ? C.brandM : r.bidCount > 0 ? C.brandM : C.bgWarm;
                        const topBarColor = stage?.badge === "확인 필요" ? "#C07000" : hasEscrow ? C.brand : r.bidCount > 0 ? C.brand : C.bgWarm;
                        return (
                          <div key={r.id} style={{ background:C.surface, borderRadius:R.xl,
                            marginBottom:S.md, border:`1.5px solid ${borderColor}`, overflow:"hidden" }}>
                            <div style={{ height:3, background: topBarColor }} />
                            <div style={{ padding:S.xl }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.sm }}>
                                <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{r.type} · {r.size}</div>
                                <div style={{ display:"flex", gap:5, flexWrap:"wrap", justifyContent:"flex-end" }}>
                                  {r.isActive && !hasEscrow && (
                                    <span style={{
                                      background: urgentDays ? "#FFF0F0" : warningDays ? "#FFF7E6" : C.brandL,
                                      color: urgentDays ? C.red : warningDays ? "#C07000" : C.brand,
                                      borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700,
                                    }}>
                                      마감 {r.daysLeft}일 전
                                    </span>
                                  )}
                                  {stage && (
                                    <span style={{ background: stage.badgeBg, color: stage.badgeFg, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                                      {stage.badge}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ fontSize:13, color:C.text3, marginBottom:S.sm }}>
                                📍 {r.area} · {r.style} · {r.time}
                              </div>

                              {/* ── Stage-aware action block ── */}
                              {stage?.action === "escrow" ? (
                                <div style={{ background: stage?.badge === "확인 필요" ? "#FFF7E6" : C.brandL,
                                  borderRadius:R.lg, padding:S.md, marginBottom:S.md,
                                  border:`1px solid ${stage?.badge === "확인 필요" ? "#C07000" : C.brandM}` }}>
                                  <div style={{ fontSize:13, fontWeight:800, color: stage?.badge === "확인 필요" ? "#C07000" : C.brand, marginBottom:S.sm }}>
                                    {stage?.badge === "확인 필요" ? "🔔" : "🏗"} {stage?.label ?? "시공 진행중"}
                                  </div>
                                  <div style={{ fontSize:12, color:C.text3, marginBottom:S.sm }}>{stage?.sub}</div>
                                  <button onClick={() => { setBidViewRequestId(r.id); go("escrow"); }}
                                    style={{ width:"100%", padding:"11px",
                                      background: stage?.badge === "확인 필요" ? "#C07000" : C.brand,
                                      color:"#fff", border:"none", borderRadius:R.lg,
                                      fontWeight:800, fontSize:14, cursor:"pointer",
                                      boxShadow:`0 3px 12px ${C.brand}44` }}>
                                    {stage?.cta ?? "에스크로 확인하기"} →
                                  </button>
                                </div>
                              ) : r.bidCount > 0 ? (
                                <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.md,
                                  marginBottom:S.md, border:`1px solid ${C.brandM}` }}>
                                  <div style={{ fontSize:13, fontWeight:800, color:C.brand, marginBottom:S.sm }}>
                                    🔔 업체 {r.bidCount}곳이 입찰했어요
                                  </div>
                                  {reqBids.length > 0 && (
                                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:S.md }}>
                                      {reqBids.map(b => (
                                        <div key={b.id}
                                          style={{ background:C.surface, borderRadius:R.md, padding:"6px 10px",
                                            fontSize:12, fontWeight:700, color:C.text1,
                                            border:`1px solid ${C.bgWarm}`, display:"flex", alignItems:"center", gap:4 }}>
                                          <TempBadge temp={b.company?.temp ?? 0} />
                                          <span>{b.company?.name ?? "—"}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <button onClick={() => { setBidViewRequestId(r.id); setScreen("bidstatus"); }}
                                    style={{ width:"100%", padding:"11px", background:C.brand, color:"#fff",
                                      border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer",
                                      boxShadow:`0 3px 12px ${C.brand}44` }}>
                                    💰 견적 비교하고 업체 선택하기 →
                                  </button>
                                </div>
                              ) : (
                                <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.md,
                                  marginBottom:S.md, border:`1px solid ${C.bgWarm}`,
                                  display:"flex", alignItems:"center", gap:S.sm }}>
                                  <span style={{ fontSize:18 }}>⏳</span>
                                  <div>
                                    <div style={{ fontSize:13, fontWeight:700, color:C.text2 }}>인근 검증 업체들이 검토 중입니다</div>
                                    <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>
                                      보통 24시간 내 견적이 도착해요
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div style={{ display:"flex", gap:S.sm, flexWrap:"wrap" }}>
                                <button onClick={() => setScreen("timeline")}
                                  style={{ flex:1, minWidth:"calc(50% - 4px)", padding:"10px", background:C.surface2,
                                    color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
                                    fontWeight:700, fontSize:13, cursor:"pointer" }}>
                                  📊 진행 현황
                                </button>
                                {stage?.action !== "escrow" && (
                                  <button onClick={() => setEditRequest(r)}
                                    style={{ flex:1, minWidth:"calc(50% - 4px)", padding:"10px", background:C.brandL,
                                      color:C.brand, border:`1px solid ${C.brandM}`, borderRadius:R.lg,
                                      fontWeight:700, fontSize:13, cursor:"pointer" }}>
                                    ✏️ 수정
                                  </button>
                                )}
                                {stage?.action === "escrow" ? (
                                  <button onClick={() => { setBidViewRequestId(r.id); go("escrow"); }}
                                    style={{ flex:1, padding:"10px", background:C.brand,
                                      color:"#fff", border:"none", borderRadius:R.lg,
                                      fontWeight:700, fontSize:13, cursor:"pointer" }}>
                                    🏗 에스크로 보기
                                  </button>
                                ) : r.bidCount > 0 ? (
                                  <button onClick={() => { setBidViewRequestId(r.id); setScreen("bidstatus"); }}
                                    style={{ flex:1, padding:"10px", background:C.brand,
                                      color:"#fff", border:"none", borderRadius:R.lg,
                                      fontWeight:700, fontSize:13, cursor:"pointer" }}>
                                    💰 견적 보기
                                  </button>
                                ) : (
                                  <button onClick={() => handleRepost(r.id)}
                                    style={{ flex:1, padding:"10px", background:C.brandL,
                                      color:C.brand, border:`1px solid ${C.brandM}`, borderRadius:R.lg,
                                      fontWeight:700, fontSize:13, cursor:"pointer" }}>
                                    🔄 재노출
                                  </button>
                                )}
                                {stage?.action !== "escrow" && (
                                  <button onClick={() => setShowCloseConfirm(r.id)}
                                    style={{ flex:1, padding:"10px", background:C.surface,
                                      color:C.text3, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
                                      fontWeight:700, fontSize:13, cursor:"pointer" }}>
                                    견적 마감
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    archiveRequest(r.id).catch(() => {});
                                    setMyRequests(prev => prev.filter(x => x.id !== r.id));
                                  }}
                                  style={{ flex:1, padding:"10px", background:C.surface,
                                    color:C.text4, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
                                    fontWeight:700, fontSize:13, cursor:"pointer" }}>
                                  숨기기
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* ── Closed / history ── */}
                  {historyReqs.length > 0 && (
                    <>
                      <div style={{ fontSize:14, fontWeight:800, color:C.text3, marginBottom:S.sm, marginTop: activeReqs.length > 0 ? S.lg : 0 }}>
                        마감된 요청 · {historyReqs.length}건
                      </div>
                      {historyReqs.map(r => (
                        <div key={r.id} style={{ background:C.surface, borderRadius:R.xl,
                          marginBottom:S.sm, border:`1px solid ${C.bgWarm}`, overflow:"hidden" }}>
                          <div style={{ padding:`${S.lg}px ${S.xl}px`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <div style={{ opacity:0.65 }}>
                              <div style={{ fontSize:14, fontWeight:700, color:C.text2 }}>{r.type} · {r.size}</div>
                              <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>📍 {r.area} · {r.time}</div>
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
                              <span style={{ background:C.bg, color:C.text4, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                                {r.status === "expired" || r.isExpiredByTime ? "기간만료" : "마감됨"}
                              </span>
                              {(r.status === "expired" || r.isExpiredByTime) && (
                                <button onClick={() => handleRepost(r.id)}
                                  style={{ background:C.brandL, color:C.brand, border:`1px solid ${C.brandM}`, borderRadius:R.full, padding:"4px 12px", fontSize:11, fontWeight:800, cursor:"pointer" }}>
                                  🔄 다시 올리기
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : null;
            })()}

            {IS_DEBUG && (
              <div style={{ marginBottom:S.xl, background:"rgba(0,0,0,0.92)", color:"#0f0", borderRadius:8, padding:"8px 12px", fontSize:11, lineHeight:2, fontFamily:"monospace", maxHeight:600, overflowY:"auto" }}>
                [DEV:consumer] screen:{screen}<br/>
                user.id: {(user?.id ?? "null").slice(0,8)} | activeRole: {activeRole}<br/>
                fetch_err: {reqDebug?.consumerFetchError ?? "none"} | db_rows: {reqDebug?.consumerRows ?? "?"}<br/>
                local_total: {myRequests.length} | active: {myRequests.filter(r=>r.isActive).length}<br/>
                <span style={{color:"#ff0"}}>── new-req block check ──</span><br/>
                <span style={{color: reqCheckDebug?.blocked_reason === "none" ? "#0f0" : reqCheckDebug?.blocked_reason === "OPEN_ALLOW" ? "#4ff" : "#f93"}}>
                  active_count: {reqCheckDebug?.active_count ?? "?"} | status: {reqCheckDebug?.active_request_status ?? "?"}<br/>
                  cooldown_remaining_hours: {reqCheckDebug?.cooldown_remaining_hours ?? "?"} | blocked_reason: {reqCheckDebug?.blocked_reason ?? "not_checked"}
                </span><br/>
                submittedBids_total: {submittedBids.length}<br/>
                <span style={{color:"#4ff"}}>selectedReqId: {bidViewRequestId?.slice(0,8) ?? "none"}</span><br/>
                submittedBids_for_req: {submittedBids.filter(b => b.requestId === bidViewRequestId).length}<br/>
                <span style={{color:"#ff0"}}>── DB raw (getUserRequests + bids join) ──</span><br/>
                {(reqDebug?.consumerData ?? []).map((r, i) => (
                  <span key={r.id} style={{display:"block"}}>
                    [{i}] id:{r.id.slice(0,8)} status:{r.status} type:{r.space_type} bids:{(r.bids ?? []).length} exp:{r.expires_at?.slice(0,10) ?? "NULL"}
                  </span>
                ))}
                {(reqDebug?.consumerData ?? []).length === 0 && reqDebug != null && <span style={{color:"#f88"}}>DB rows: 0 — 요청 없음<br/></span>}
                <span style={{color:"#ff0"}}>── normalized (bidCount/isActive) ──</span><br/>
                {myRequests.map(r => (
                  <span key={r.id} style={{display:"block", color: r.id.startsWith("tmp-") ? "#f66" : r.isActive ? "#0f0" : "#f88"}}>
                    {r.id.startsWith("tmp-") ? "⚠️tmp" : "✅uuid"} [{r.status}] {r.id.slice(0,8)} {r.type} bidCount:{r.bidCount ?? 0} act:{String(r.isActive)}
                  </span>
                ))}
                <span style={{color:"#ff0"}}>── escrow stage per request ──</span><br/>
                {myRequests.filter(r => r.status === "in_progress").map(r => {
                  const ed = myRequestsEscrow[r.id] ?? null;
                  const cs = computeCustomerStage(r, ed);
                  const txStatus = ed?.escrow?.transaction_status ?? "—";
                  const po = ed?.payouts ?? [];
                  const p2 = po.find(p => p.stage === 2);
                  const p3 = po.find(p => p.stage === 3);
                  return (
                    <span key={r.id} style={{display:"block", color: cs?.badge === "확인 필요" ? "#f93" : "#0f0"}}>
                      {r.id.slice(0,8)} status:{r.status} tx:{txStatus}<br/>
                      <span style={{paddingLeft:8, color:"#8ff"}}>
                        p2:{p2?.status ?? "?"} p3:{p3?.status ?? "?"} | badge:{cs?.badge} | cta:{cs?.cta ?? "—"}
                      </span>
                    </span>
                  );
                })}
                {myRequests.filter(r => r.status === "in_progress").length === 0 && (
                  <span style={{color:"#888"}}>in_progress 요청 없음<br/></span>
                )}
                {reqCreateDebug && (
                  <>
                    <span style={{color:"#ff0"}}>── 최근 repost 결과 ──</span><br/>
                    <span style={{color:"#8ff"}}>{reqCreateDebug._note}<br/></span>
                    {reqCreateDebug.id
                      ? <span style={{color:"#0f0"}}>✅ new_id:{reqCreateDebug.id.slice(0,8)} status:{reqCreateDebug.status} exp:{reqCreateDebug.expires_at?.slice(0,10)}<br/></span>
                      : reqCreateDebug.hasTmpPrefix !== undefined
                        ? <span style={{color:"#f88"}}>⚠️ guard: tmpPrefix:{String(reqCreateDebug.hasTmpPrefix)} userId:{String(reqCreateDebug.hasUserId)} origReq:{String(reqCreateDebug.hasOriginalReq)}<br/></span>
                        : <span style={{color:"#f66"}}>❌ insert_err: {reqCreateDebug.insertError}<br/></span>
                    }
                  </>
                )}
              </div>
            )}

            {(() => {
              const totalJobs = companies.reduce((s, c) => s + (c.completedJobs ?? 0), 0);
              const avgTemp = companies.length > 0
                ? Math.round(companies.reduce((s, c) => s + (c.temp ?? 70), 0) / companies.length)
                : 70;
              return (
            <div style={{ display:"flex", gap:S.sm, marginBottom:S.xl }}>
              {[["🏘","인근 업체",`${companies.length}곳`],["🌡","평균 공간온도",`${avgTemp}°`],["✅","누적 완료",`${totalJobs}건`]].map(([icon,label,val]) => (
                <div key={label} style={{ flex:1, background:C.surface, borderRadius:R.lg,
                  padding:`${S.lg}px ${S.sm}px`, textAlign:"center", border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ fontSize:18 }}>{icon}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginTop:S.xs }}>{val}</div>
                  <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
              ); })()}

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>인근 업체</div>
              <button onClick={() => setScreen("map")} style={{ fontSize:13, background:"none", border:"none", cursor:"pointer", color:C.brand, fontWeight:700 }}>지도로 보기 →</button>
            </div>
            {companies.map(c => <CompanyCard key={c.id} company={c} isLoggedIn={!!user?.id} onClick={() => go("portfolio",c)} />)}

            {/* 라운지 섹션 — 둘러보기 하단 */}
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginTop:S.xl, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.lg }}>라운지</div>
              {localLoungePosts.slice(0,3).length > 0 ? (
                <div style={{ display:"flex", flexDirection:"column", gap:S.sm, marginBottom:S.lg }}>
                  {localLoungePosts.slice(0,3).map(post => (
                    <div key={post.id} onClick={() => { setLoungePost(post); go("lounge-detail"); }}
                      style={{ background:C.bg, borderRadius:R.lg, padding:`${S.md}px ${S.lg}px`, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${C.bgWarm}` }}>
                      <div style={{ flex:1, minWidth:0, marginRight:S.md }}>
                        <div style={{ fontSize:13, fontWeight:700, color:C.text1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                          {post.title ?? post.content?.slice(0,30)}
                        </div>
                      </div>
                      <div style={{ fontSize:12, color:C.text3, flexShrink:0 }}>❤️ {post.like_count ?? 0}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:`${S.lg}px 0`, marginBottom:S.lg }}>
                  <div style={{ fontSize:13, color:C.text3 }}>공간 이야기를 나눠보세요</div>
                </div>
              )}
              <button onClick={() => setScreen("lounge")}
                style={{ width:"100%", padding:"13px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 4px 14px ${C.brand}44` }}>
                라운지 들어가기 →
              </button>
            </div>
          </div>
        )}

        {/* 업체 홈 */}
        {screen==="home" && mode==="company" && (
          <div>
            {isGuestCompany && (
              <div onClick={() => setShowRegisterPrompt(true)}
                style={{ background:C.brandL, borderRadius:R.xl, padding:S.xl,
                  marginBottom:S.lg, border:`1.5px solid ${C.brandM}`, cursor:"pointer",
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.brand, marginBottom:3 }}>
                    🔨 업체 등록하고 입찰하기
                  </div>
                  <div style={{ fontSize:12, color:C.text3 }}>등록하면 견적 입찰 + 채팅 가능</div>
                </div>
                <div style={{ background:C.brand, color:"#fff", borderRadius:R.full,
                  padding:"8px 14px", fontSize:13, fontWeight:800 }}>등록 →</div>
              </div>
            )}
            <div style={{ background:`linear-gradient(135deg,${C.brand},${C.brandD})`,
              borderRadius:R.xl, padding:S.xxl, marginBottom:S.xl, color:"#fff" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.xl }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:900, marginBottom:8 }}>{user.name}</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <TempBadge temp={97} lg />
                    <CertBadge type="platform" />
                  </div>
                </div>
                <div style={{ display:"flex", gap:S.sm }}>
                  {[["3","낙찰"],["84","후기"],["68%","재계약"]].map(([v,l]) => (
                    <div key={l} style={{ textAlign:"center", background:"rgba(255,255,255,0.15)", borderRadius:R.lg, padding:"10px 12px" }}>
                      <div style={{ fontSize:16, fontWeight:900 }}>{v}</div>
                      <div style={{ fontSize:10, opacity:0.7, marginTop:2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background:"rgba(255,255,255,0.12)", borderRadius:R.lg, padding:`${S.sm}px ${S.lg}px`, marginBottom:S.lg, display:"flex", alignItems:"center", gap:S.sm }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:C.green, boxShadow:"0 0 0 3px rgba(255,255,255,0.3)" }} />
                <span style={{ fontSize:13, opacity:0.9 }}>지금 활동중 · 평균 5분 내 응답</span>
              </div>
              <div style={{ display:"flex", gap:S.sm }}>
                <button onClick={() => go("dashboard")} style={{ background:"rgba(255,255,255,0.18)", color:"#fff", border:"1px solid rgba(255,255,255,0.3)", borderRadius:R.lg, padding:"9px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>📊 대시보드 →</button>
                <button onClick={() => go("portfolio",companies[0])} style={{ background:"rgba(255,255,255,0.18)", color:"#fff", border:"1px solid rgba(255,255,255,0.3)", borderRadius:R.lg, padding:"9px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>포트폴리오</button>
              </div>
            </div>

            {/* 업체 이용 절차 5단계 */}
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:S.lg }}>🗂 업체 이용 절차</div>
              {[
                { icon:"🔍", title:"프로젝트 매칭",     desc:"인근 견적 요청 확인 후 입찰 제출" },
                { icon:"📝", title:"계약 & 착공",        desc:"고객 선택 시 착공금 30% 즉시 수령" },
                { icon:"🏗",  title:"단계별 공사 진행",  desc:"중간 점검 사진 공유 · 에스크로 보호" },
                { icon:"💰", title:"단계별 정산",        desc:"고객 승인 후 중도금 40% 수령" },
                { icon:"⭐", title:"완료 & 리뷰",        desc:"잔금 30% 수령 · 공간온도 상승" },
              ].map(({ icon, title, desc }, i, arr) => (
                <div key={title} style={{ display:"flex", gap:S.md, marginBottom:i < arr.length - 1 ? S.lg : 0 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                    <div style={{ width:36, height:36, borderRadius:R.full, background:C.brandL,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{icon}</div>
                    {i < arr.length - 1 && (
                      <div style={{ width:2, flex:1, minHeight:12, marginTop:4, background:C.bgWarm }} />
                    )}
                  </div>
                  <div style={{ flex:1, paddingTop:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:S.sm, marginBottom:3 }}>
                      <span style={{ background:C.brand, color:"#fff", borderRadius:R.full,
                        width:18, height:18, fontSize:10, fontWeight:900,
                        display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize:14, fontWeight:800, color:C.text1 }}>{title}</span>
                    </div>
                    <div style={{ fontSize:12, color:C.text3 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <LiveFeed />

            {/* ── 진행중 작업 ─────────────────────────────────────────── */}
            {companyJobs.length > 0 && (
              <div style={{ marginBottom:S.xl }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>
                  🏗 내 시공 진행중
                  <span style={{ fontSize:13, fontWeight:600, color:C.brand, marginLeft:6 }}>
                    {companyJobs.length}건
                  </span>
                </div>
                {companyJobs.map(({ bid, request }) => (
                  <div key={bid.id} style={{
                    background:C.surface, borderRadius:R.xl, padding:S.xl,
                    marginBottom:S.md, border:`1.5px solid ${C.brandM}`,
                    boxShadow:`0 2px 12px ${C.brand}18`,
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.sm }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:4 }}>
                          {request?.type || "인테리어"} · {request?.size || ""}
                        </div>
                        <div style={{ fontSize:12, color:C.text3 }}>
                          📍 {request?.area || "지역 미정"}
                        </div>
                      </div>
                      <div style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"4px 10px", fontSize:11, fontWeight:800 }}>
                        진행중
                      </div>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontSize:15, fontWeight:900, color:C.brand }}>
                        {bid.price ? `${(bid.price / 10000).toLocaleString()}만원` : "금액 미정"}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedBid(bid);
                          setBidViewRequestId(bid.requestId);
                          go("escrow");
                        }}
                        style={{ background:C.brand, color:"#fff", border:"none", borderRadius:R.full, padding:"8px 16px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
                        계약 확인 →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>
                📋 새 견적 요청
                {customerRequests.filter(r => r.isActive).length > 0 && (
                  <span style={{ fontSize:13, fontWeight:600, color:C.brand, marginLeft:6 }}>
                    {customerRequests.filter(r => r.isActive).length}건
                  </span>
                )}
              </div>
              <button onClick={loadCompanyRequests} style={{ fontSize:13, background:C.brandL, border:`1px solid ${C.brandM}`, color:C.brand, borderRadius:R.full, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🔄 새로고침</button>
            </div>

            {customerRequests.filter(r => r.isActive).length === 0 ? (
              <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xxl, textAlign:"center", border:`1px solid ${C.bgWarm}`, marginBottom:S.xl }}>
                <div style={{ fontSize:32, marginBottom:12 }}>📭</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.text2, marginBottom:6 }}>활성 견적 요청이 없습니다</div>
                <div style={{ fontSize:12, color:C.text3, lineHeight:1.6 }}>
                  의뢰인이 요청을 등록하면 이곳에 표시됩니다<br/>
                  {`(db_rows: ${reqDebug?.companyRows ?? "?"}, fetch_err: ${reqDebug?.companyFetchError ?? "none"})`}
                </div>
              </div>
            ) : (
              customerRequests.filter(r => r.isActive).map(r => (
                <BidCard
                  key={r.id}
                  r={r}
                  currentUser={currentUser}
                  onBidSubmit={isGuestCompany ? null : data => addBid(r, data)}
                  onRequiresAuth={isGuestCompany ? () => setShowRegisterPrompt(true) : null}
                />
              ))
            )}

            {IS_DEBUG && (
              <div style={{ margin:"16px 0", background:"rgba(0,0,0,0.92)", color:"#0f0", borderRadius:8, padding:"8px 12px", fontSize:11, lineHeight:2, fontFamily:"monospace", maxHeight:600, overflowY:"auto" }}>
                [DEV:company] screen:{screen}<br/>
                user.id: {user?.id ?? "null"}<br/>
                currentUser.id: {currentUser?.id ?? "null ⚠️"}<br/>
                selectedBid.id: {selectedBid?.id ?? "null"} | requestId: {selectedBid?.requestId ?? "null"}<br/>
                contractId: {contractId ?? "null"}<br/>
                <span style={{color: reqDebug?.companyFetchError ? "#f66" : "#0f0"}}>fetch_err: {reqDebug?.companyFetchError ?? "none"}</span><br/>
                last_fetch: {lastFetchAt ?? "—"} | db_rows: {reqDebug?.companyRows ?? "?"} | active_displayed: {customerRequests.filter(r=>r.isActive).length}<br/>
                <span style={{color:"#ff0"}}>── DB open requests (full id) ──</span><br/>
                {(reqDebug?.companyData ?? []).map((r, i) => (
                  <span key={r.id} style={{display:"block", color:"#8ff"}}>
                    [{i}] {r.id} {r.space_type} status:{r.status} exp:{r.expires_at?.slice(0,10) ?? "NULL"}
                  </span>
                ))}
                {(reqDebug?.companyData ?? []).length === 0 && reqDebug != null && <span style={{color:"#f88"}}>⚠️ DB rows: 0 — fetch_err 확인<br/></span>}
                <span style={{color:"#ff0"}}>── displayed active (full id) ──</span><br/>
                {customerRequests.filter(r=>r.isActive).map(r=>(
                  <span key={r.id} style={{display:"block", color:"#8ff"}}>{r.id} {r.type} {r.size} status:{r.status}</span>
                ))}
                <span style={{color:"#ff0"}}>── companyJobs (in_progress) ──</span><br/>
                <span style={{color: companyJobsDebug?.fetchError ? "#f66" : "#0f0"}}>jobs_err:{companyJobsDebug?.fetchError ?? "none"}</span> raw:{companyJobsDebug?.rawCount ?? "?"} jobs:{companyJobsDebug?.jobCount ?? "?"}<br/>
                {(companyJobsDebug?.statuses ?? []).map((s, i) => (
                  <span key={s.id} style={{display:"block", color: s.req_status === "in_progress" ? "#0f0" : "#8ff"}}>
                    [{i}] bid:{s.id?.slice(0,8)} req_status:{s.req_status}
                  </span>
                ))}
                {companyJobs.map((j, i) => (
                  <span key={j.bid.id} style={{display:"block", color:"#aff"}}>
                    job[{i}] bid:{j.bid.id?.slice(0,8)} req:{j.request?.id?.slice(0,8)} {j.request?.type} {j.request?.status}
                  </span>
                ))}
                {bidDebug && (
                  <>
                    <span style={{color:"#ff0"}}>── LAST BID ATTEMPT ──</span><br/>
                    <span style={{color:"#4ff"}}>request_id={bidDebug.request_id}</span><br/>
                    <span style={{color:"#8ff"}}>payload.company_id={bidDebug.payload_company_id ?? "null ⚠️"}</span><br/>
                    expected_fk_target={bidDebug.expected_fk_target ?? "users.id"}<br/>
                    companyProfile.id={bidDebug.companyProfile_id ?? "null"}<br/>
                    companyProfile.ownerId={bidDebug.companyProfile_ownerId ?? "null"}<br/>
                    {bidDebug.insertResult
                      ? <span style={{color:"#0f0"}}>✅ inserted bid_id={bidDebug.insertResult.id}<br/>   bid.request_id={bidDebug.insertResult.request_id}<br/>   verify_count={bidDebug.verifyCount ?? "—"}<br/></span>
                      : <span style={{color:"#f66"}}>❌ insert_err: {bidDebug.insertError}<br/></span>
                    }
                  </>
                )}
              </div>
            )}
          </div>
        )}


        {/* 지도 — STEP 15: 카카오맵 SDK 연동 */}
        {screen==="map" && (
          <div>
            <div style={{ marginBottom:S.xl }}>
              <KakaoMap
                companies={companies}
                userRegion={user.region ?? ""}
                onPinClick={c => go("portfolio", c)}
              />
            </div>
            <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>인근 업체 <span style={{ color:C.brand }}>{companies.length}곳</span></div>
            {companies.map(c => <CompanyCard key={c.id} company={c} isLoggedIn={!!user?.id} onClick={() => go("portfolio",c)} />)}
          </div>
        )}

        {screen==="portfolio" && selCo && <PortfolioScreen company={selCo} onChat={c => isGuestCompany ? setShowRegisterPrompt(true) : go("chat",c)} onReview={() => go("review",selCo)} onBack={() => setScreen("home")} onEscrow={() => go("escrow")} />}
        {screen==="review" && selCo && <ReviewScreen company={selCo} onBack={() => setScreen("portfolio")} currentUser={currentUser} />}
        {screen==="chat" && selCo && <ChatScreen company={selCo} user={user} onBack={() => setScreen(prevScreen==="chatlist"?"chatlist":"portfolio")} />}
        {screen==="escrow" && <EscrowScreen onBack={() => { setEscrowRefreshTrigger(t => t+1); setScreen(prevScreen||"home"); }} activeRole={activeRole} selectedBid={selectedBid} currentUser={currentUser} contractId={contractId} userId={user?.id ?? null} request={[...myRequests, ...customerRequests].find(r => r.id === bidViewRequestId) ?? null} />}
        {screen==="dashboard" && <DashboardScreen onBack={() => setScreen("home")} onEscrow={() => go("escrow")} allRequests={customerRequests} currentUser={currentUser} submittedBids={submittedBids} />}
        {screen==="bidstatus" && (
          <BidStatusScreen
            onBack={() => setScreen("home")}
            onChat={c => go("chat",c)}
            onEscrow={(bid) => { setSelectedBid(bid); if (bid?.contractId) setContractId(bid.contractId); go("escrow"); }}
            bids={bidViewRequestId ? submittedBids.filter(b => b.requestId === bidViewRequestId) : []}
            submittedBids={submittedBids}
            request={[...myRequests, ...customerRequests].find(r => r.id === bidViewRequestId) ?? null}
            selectedBid={selectedBid}
            setSelectedBid={setSelectedBid}
            setEscrowContracts={setEscrowContracts}
          />
        )}
        {screen==="admin" && <AdminScreen onBack={() => setScreen("my")} onHome={() => setScreen("home")} user={user} />}
        {screen==="document-center" && <DocumentCenterScreen company={currentUser} user={user} onBack={() => setScreen("my")} />}

        {screen==="lounge" && (
          <LoungeScreen
            user={user}
            extraPosts={localLoungePosts}
            extraStories={localLoungeStories}
            onPostClick={(post) => { setLoungePost(post); go("lounge-detail"); }}
            onWrite={() => requireAuth(() => go("lounge-write"))}
            onStoryUpload={() => requireAuth(() => go("lounge-story"))}
            onRequireLogin={() => setShowLoginRequired(true)}
            onGoMyPage={() => setScreen("my")}
          />
        )}

        {screen==="lounge-write" && (
          <LoungeWriteScreen
            user={user}
            onBack={() => setScreen("lounge")}
            onPublish={(post) => { setLocalLoungePosts(prev => [post, ...prev]); showToast("✅ 글이 등록됐어요!"); earnToken("first_post"); setScreen("lounge"); }}
          />
        )}

        {screen==="lounge-detail" && loungePost && (
          <LoungePostDetailScreen
            postId={loungePost.id}
            initialPost={loungePost}
            user={user}
            tokenBalance={tokenBalance}
            onBack={() => setScreen("lounge")}
            onSpendToken={(action, amount, desc) => spendToken(action, amount, desc)}
            onTokenStore={() => requireAuth(() => go("token-store"))}
            onRequireLogin={() => setShowLoginRequired(true)}
          />
        )}

        {screen==="lounge-story" && (
          <LoungeStoryUploadScreen
            user={user}
            onBack={() => setScreen("lounge")}
            onPublish={(story) => { if (story) setLocalLoungeStories(prev => [story, ...prev]); showToast("📸 스토리가 공유됐어요! (24시간)"); setScreen("lounge"); }}
          />
        )}

        {screen==="token-store" && (
          <TokenStoreScreen
            user={user}
            balance={tokenBalance}
            logs={tokenLogs}
            onBack={() => setScreen(prevScreen || "my")}
            onEarnToken={(action) => earnToken(action)}
            onHistory={() => go("token-history")}
          />
        )}

        {screen==="token-history" && (
          <TokenHistoryScreen
            balance={tokenBalance}
            logs={tokenLogs}
            onBack={() => setScreen("token-store")}
          />
        )}

        {screen==="chatlist" && (
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:S.xl }}>채팅</div>
            {companies.map(c => (
              <div key={c.id} onClick={() => isGuestCompany ? setShowRegisterPrompt(true) : go("chat",c)}
                style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm, display:"flex", gap:S.lg, alignItems:"center", cursor:"pointer", border:`1px solid ${C.bgWarm}` }}>
                <div style={{ width:48, height:48, borderRadius:R.full, flexShrink:0, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:C.brand, position:"relative" }}>
                  {(c.name ?? "?")[0]}
                  {c.online && <div style={{ position:"absolute", bottom:0, right:0, width:12, height:12, borderRadius:"50%", background:C.green, border:"2px solid #fff" }} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{c.name}</div>
                    <TempBadge temp={c.temp} />
                  </div>
                  <div style={{ fontSize:13, color:C.text3, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                    {(() => { const logs = chatLogs[c.id] ?? []; return logs.length > 0 ? (logs[logs.length-1]?.text ?? "채팅을 시작해보세요") : "채팅을 시작해보세요"; })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {screen==="timeline" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:S.md, marginBottom:S.xl }}>
              <button onClick={() => setScreen("home")} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
              <div style={{ fontSize:17, fontWeight:800, color:C.text1 }}>시공 진행 현황</div>
            </div>
            {myRequests.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 0" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:14, color:C.text3 }}>아직 견적 요청이 없어요</div>
                <button onClick={() => { setScreen("home"); handleOpenNewReq(); }}
                  style={{ marginTop:S.xl, padding:"12px 24px", background:C.brand,
                    color:"#fff", border:"none", borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer" }}>
                  안전하게 견적 시작하기
                </button>
              </div>
            ) : myRequests.map(r => {
              const escData = myRequestsEscrow[r.id] ?? null;
              const { escrow: esc, payouts: po = [] } = escData ?? {};
              const txStatus = esc?.transaction_status ?? null;
              const hasEscrow = !!esc;
              const isSettled = txStatus === "SETTLED";
              const csStage = computeCustomerStage(r, escData);
              const inProgress = hasEscrow || r.status === "in_progress";
              const step2done = inProgress;
              const step3active = inProgress && !isSettled;
              const step4done = isSettled;

              const constructionSub = (() => {
                if (txStatus === "STARTED") return "착공 사진 확인 대기";
                if (txStatus === "MID_INSPECTION") return "중간 점검 사진 확인 대기";
                if (txStatus === "COMPLETED") return "완료 사진 확인 대기";
                if (hasEscrow) return "착공 대기 · 에스크로 보관 중";
                if (r.status === "in_progress") return "에스크로 정산 진행 중";
                return "착공 ~ 중간점검";
              })();

              const steps = [
                { label:"견적 요청",    sub:"요청 등록 완료",           done:true,      time:r.time },
                { label:"업체 선택",   sub: step2done ? "계약 완료" : "입찰 비교 후 계약", done:step2done, active:!step2done, bidStep:!step2done },
                { label:"공사 진행",   sub: constructionSub,            done:isSettled, active:step3active, escrowStep:step3active },
                { label:"완료 및 정산", sub:"완료 확인 + 잔금 지급",     done:step4done },
              ];

              return (
                <div key={r.id} style={{ background:C.surface, borderRadius:R.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}`, overflow:"hidden" }}>
                  <div style={{ height:3, background:C.brand }} />
                  <div style={{ padding:S.xl }}>
                    <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:4 }}>{r.type} · {r.size}</div>
                    <div style={{ fontSize:12, color:C.text3, marginBottom:S.xl }}>📍 {r.area} · 💰 {r.budget}</div>
                    {steps.map((step, i, arr) => (
                      <div key={step.label} style={{ display:"flex", gap:S.md, marginBottom: i<arr.length-1?S.lg:0 }}>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                          <div style={{ width:32, height:32, borderRadius:R.full,
                            background: step.done?C.green : step.active?C.brand : C.bgWarm,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:14, color: step.done||step.active?"#fff":C.text4,
                            boxShadow: step.active?`0 0 0 4px ${C.brand}22`:"none", fontWeight:900 }}>
                            {step.done?"✓":i+1}
                          </div>
                          {i<arr.length-1 && <div style={{ width:2, flex:1, minHeight:16, marginTop:4, background:step.done?C.green:step.active?`${C.brand}44`:C.bgWarm }} />}
                        </div>
                        <div style={{ flex:1, paddingTop:6 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:step.done?C.green:step.active?C.brand:C.text3 }}>{step.label}</div>
                          <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>{step.sub}</div>
                          {step.time && <div style={{ fontSize:11, color:C.text4, marginTop:2 }}>{step.time}</div>}
                          {step.bidStep && (
                            <button onClick={() => { setBidViewRequestId(r.id); setScreen("bidstatus"); }}
                              style={{ marginTop:S.sm, padding:"8px 16px", background:C.brand, color:"#fff", border:"none", borderRadius:R.full, fontWeight:700, fontSize:12, cursor:"pointer", boxShadow:`0 3px 10px ${C.brand}44` }}>
                              🔔 입찰 비교 후 업체 선택 →
                            </button>
                          )}
                          {step.escrowStep && (
                            <button onClick={() => { setBidViewRequestId(r.id); go("escrow"); }}
                              style={{ marginTop:S.sm, padding:"8px 16px",
                                background: csStage?.badge === "확인 필요" ? "#C07000" : C.brand,
                                color:"#fff", border:"none", borderRadius:R.full, fontWeight:700, fontSize:12, cursor:"pointer", boxShadow:`0 3px 10px ${C.brand}44` }}>
                              {csStage?.cta ?? "에스크로 진행현황 보기"} →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {screen==="favorites" && (
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:S.xl }}>관심</div>

            {/* 4탭 */}
            <div style={{ display:"flex", background:C.bg, borderRadius:R.lg, padding:4, marginBottom:S.xl, gap:2 }}>
              {[["받은❤️","received"],["보낸❤️","sent"],["📸스토리","stories"],["🔖저장","saved"]].map(([label,id]) => (
                <button key={id} onClick={() => setFavTab(id)} style={{ flex:1, padding:"9px 2px", border:"none", borderRadius:R.md, background:favTab===id?C.surface:"transparent", color:favTab===id?C.brand:C.text3, fontWeight:favTab===id?800:500, fontSize:11, cursor:"pointer", transition:"background 0.15s", whiteSpace:"nowrap" }}>
                  {label}
                </button>
              ))}
            </div>

            {favTab === "received" && (
              <div style={{ textAlign:"center", padding:"48px 0 20px" }}>
                <div style={{ fontSize:52, marginBottom:12 }}>📬</div>
                <div style={{ fontSize:15, fontWeight:700, color:C.text1, marginBottom:8 }}>받은 하트글이 없어요</div>
                <div style={{ fontSize:13, color:C.text3, lineHeight:1.7, marginBottom:S.xl }}>
                  내 게시글에 ❤️를 받으면<br/>여기서 확인할 수 있어요
                </div>
                <button onClick={() => setScreen("lounge")} style={{ padding:"12px 28px", background:C.brand, color:"#fff", border:"none", borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44` }}>
                  라운지 가기
                </button>
              </div>
            )}

            {favTab === "sent" && (
              <div style={{ textAlign:"center", padding:"48px 0 20px" }}>
                <div style={{ fontSize:52, marginBottom:12 }}>❤️</div>
                <div style={{ fontSize:15, fontWeight:700, color:C.text1, marginBottom:8 }}>보낸 하트글이 없어요</div>
                <div style={{ fontSize:13, color:C.text3, lineHeight:1.7, marginBottom:S.xl }}>
                  라운지 글에 ❤️를 누르면<br/>여기서 모아볼 수 있어요
                </div>
                <button onClick={() => setScreen("lounge")} style={{ padding:"12px 28px", background:C.brand, color:"#fff", border:"none", borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44` }}>
                  라운지 가기
                </button>
              </div>
            )}

            {favTab === "stories" && (
              <div style={{ textAlign:"center", padding:"48px 0 20px" }}>
                <div style={{ fontSize:52, marginBottom:12 }}>📸</div>
                <div style={{ fontSize:15, fontWeight:700, color:C.text1, marginBottom:8 }}>하트한 스토리가 없어요</div>
                <div style={{ fontSize:13, color:C.text3, lineHeight:1.7, marginBottom:S.xl }}>
                  스토리에 ❤️를 누르면<br/>24시간 동안 여기서 볼 수 있어요
                </div>
                <button onClick={() => setScreen("lounge")} style={{ padding:"12px 28px", background:C.brand, color:"#fff", border:"none", borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44` }}>
                  라운지 가기
                </button>
              </div>
            )}

            {favTab === "saved" && (
              <div style={{ textAlign:"center", padding:"48px 0 20px" }}>
                <div style={{ fontSize:52, marginBottom:12 }}>🔖</div>
                <div style={{ fontSize:15, fontWeight:700, color:C.text1, marginBottom:8 }}>저장한 글이 없어요</div>
                <div style={{ fontSize:13, color:C.text3, lineHeight:1.7, marginBottom:S.xl }}>
                  게시글 상세에서 📄 저장을 누르면<br/>여기서 모아볼 수 있어요
                </div>
                <button onClick={() => setScreen("lounge")} style={{ padding:"12px 28px", background:C.brand, color:"#fff", border:"none", borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44` }}>
                  라운지 가기
                </button>
              </div>
            )}
          </div>
        )}

        {screen==="my" && (
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:S.xl }}>마이페이지</div>
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xxl,
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}`, textAlign:"center" }}>
              <div style={{ width:72, height:72, borderRadius:R.full, background:C.brandL,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:28, fontWeight:900, color:C.brand, margin:"0 auto 14px" }}>{user.name?.[0] ?? "?"}</div>
              <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>{user.name}</div>
              <div style={{ fontSize:13, color:C.text3, marginBottom:S.md }}>📍 {user.region} · {activeRole==="consumer"?"의뢰인":"검증 업체"}</div>
              {activeRole === "consumer" && (() => {
                const grade = calcCustomerGrade(user.completedJobs ?? 0);
                return (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:6,
                    background:C.brandL, borderRadius:R.full, padding:"4px 12px",
                    border:`1px solid ${C.brandM}`, marginBottom:S.xl }}>
                    <span style={{ fontSize:16 }}>{grade.icon}</span>
                    <span style={{ fontSize:12, fontWeight:800, color:C.brand }}>{grade.label}</span>
                  </div>
                );
              })()}
              <div style={{ display:"flex", gap:0, marginBottom:S.xl, borderTop:`1px solid ${C.bgWarm}`, paddingTop:S.xl }}>
                {(activeRole==="consumer"
                  ? [[`${myRequests.length}`,"견적 요청"],["0","진행중"],["0","완료"]]
                  : [[" 3","낙찰"],["84","후기"],["97°","공간온도"]]
                ).map(([v,l],i,arr) => (
                  <div key={l} style={{ flex:1, borderRight:i<arr.length-1?`1px solid ${C.bgWarm}`:"none" }}>
                    <div style={{ fontSize:22, fontWeight:900, color:C.brand }}>{v}</div>
                    <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <button onClick={onLogout} style={{ background:C.bg, color:C.text2,
                border:`1px solid ${C.bgWarm}`, borderRadius:R.full,
                padding:"11px 28px", fontWeight:700, fontSize:14, cursor:"pointer" }}>로그아웃</button>
            </div>

            {activeRole === "company" && user.isEarlyPartner && user.earlyPartnerBenefitUntil && (
              <div style={{ background: C.brandL, borderRadius: R.xl, padding: S.xl, marginTop: S.lg, border: `1px solid ${C.brandM}` }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginBottom: 4 }}>🏆 초기 파트너 혜택 중</div>
                <div style={{ fontSize: 12, color: C.text3 }}>
                  혜택 만료일: {new Date(user.earlyPartnerBenefitUntil).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
            )}

            {/* 앱 정보 / 약관 */}
            <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>앱 정보</div>
              {[
                { label: "이용약관", icon: "📄" },
                { label: "개인정보처리방침", icon: "🔒" },
                { label: "위치기반서비스 이용약관", icon: "📍" },
                { label: "문의하기", icon: "💌" },
              ].map(({ label, icon }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${S.md}px 0`, borderBottom: `1px solid ${C.bg}`, cursor: "pointer" }}
                  onClick={() => showToast("준비 중입니다")}>
                  <span style={{ fontSize: 14, color: C.text2 }}>{icon} {label}</span>
                  <span style={{ fontSize: 16, color: C.text3 }}>›</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: C.text4, marginTop: S.sm }}>토큰 결제는 준비 중이며 현재 테스트 운영 중입니다.</div>
            </div>

            <div style={{ textAlign: "center", marginTop: S.lg }}>
              <div
                onClick={() => {
                  const next = adminTapCount + 1;
                  setAdminTapCount(next);
                  if (next >= 5) {
                    setAdminTapCount(0);
                    setShowAdminCodeModal(true);
                  }
                }}
                style={{ fontSize: 11, color: C.text4, cursor: "default", userSelect: "none" }}>
                공간마켓 v1.0.0 · 베타
              </div>
            </div>

            {activeRole==="company" && (
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>🏦 보증금 현황</div>
                <CompanyDepositCard
                  badge={currentUser?.badge ?? user.badge ?? "standard"}
                  hasInsurance={currentUser?.hasInsurance ?? user.insurance ?? false}
                  onUpgrade={(next) => showToast(`${next.label} 업그레이드 신청이 접수됐어요!`)}
                />
                <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginTop:S.md, border:`1px solid ${C.bgWarm}` }}>
                  <div onClick={() => setScreen("document-center")}
                    style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
                    <span style={{ fontSize:14, color:C.text1, fontWeight:600 }}>📁 서류 관리</span>
                    <span style={{ fontSize:16, color:C.text3 }}>›</span>
                  </div>
                </div>
              </div>
            )}

            {activeRole==="consumer" && (() => {
              const grade = calcCustomerGrade(user.completedJobs ?? 0);
              const nextGrade = [0,1,3,5].find(n => n > (user.completedJobs ?? 0));
              return (
                <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
                  marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
                    <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{grade.icon} {grade.label} 등급</div>
                    {nextGrade !== undefined && (
                      <span style={{ fontSize:11, color:C.text3 }}>다음 등급까지 {nextGrade - (user.completedJobs ?? 0)}건</span>
                    )}
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:S.md }}>
                    {grade.benefits.map(b => (
                      <span key={b} style={{ background:C.brandL, color:C.brand, borderRadius:R.full,
                        padding:"3px 10px", fontSize:11, fontWeight:700 }}>✓ {b}</span>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:4 }}>
                    {[0,1,3,5].map((threshold, i) => {
                      const done = (user.completedJobs ?? 0) >= threshold || threshold === 0;
                      return (
                        <div key={i} style={{ flex:1, height:4, borderRadius:R.full,
                          background: done ? C.brand : C.bgWarm }} />
                      );
                    })}
                  </div>
                  <div style={{ fontSize:11, color:C.text3, marginTop:S.sm }}>
                    완료 {user.completedJobs ?? 0}건 · 새집 → 우리집(1건) → 드림하우스(3건) → 홈마스터(5건)
                  </div>
                </div>
              );
            })()}

            <LoungeMyPageSection
              user={user}
              temperature={temperature}
              balance={tokenBalance}
              onNavigate={(target) => {
                if (target === "token-store")        { requireAuth(() => go("token-store")); }
                else if (target === "token-history") { requireAuth(() => go("token-history")); }
                else { showToast("준비 중인 기능이에요"); }
              }}
            />

            {activeRole==="consumer" && (
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>내 견적 이력</div>
                {myRequests.length === 0 ? (
                  <div style={{ background:C.surface, borderRadius:R.xl, padding:"40px 20px", textAlign:"center", border:`1px solid ${C.bgWarm}` }}>
                    <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                    <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>아직 견적 요청이 없어요</div>
                    <button onClick={() => { setScreen("home"); handleOpenNewReq(); }}
                      style={{ padding:"12px 24px", background:C.brand, color:"#fff", border:"none", borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer" }}>
                      첫 견적 시작하기
                    </button>
                  </div>
                ) : myRequests.map(r => {
                  const closed = r.isClosed || r.status === "completed";
                  const dLabel = r.isClosed
                    ? (r.isExpiredByTime ? "기간만료" : "마감됨")
                    : r.status === "in_progress" ? "진행중"
                    : r.status === "completed"   ? "완료"
                    : `마감 ${r.daysLeft}일 전`;
                  const dColor = r.isClosed ? C.text4
                    : r.status === "in_progress" ? C.brand
                    : r.status === "completed"   ? C.green
                    : r.daysLeft <= 1 ? C.red : r.daysLeft <= 3 ? "#C07000" : C.brand;
                  const dBg = r.isClosed ? C.bg
                    : r.daysLeft <= 1 ? "#FFF0F0" : r.daysLeft <= 3 ? "#FFF7E6" : C.brandL;
                  return (
                    <div key={r.id} onClick={() => !closed && setScreen("timeline")}
                      style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm, border:`1px solid ${C.bgWarm}`, cursor: closed ? "default" : "pointer", display:"flex", justifyContent:"space-between", alignItems:"center", opacity: closed ? 0.7 : 1 }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:800, color: closed ? C.text3 : C.text1 }}>{r.type} · {r.size}</div>
                        <div style={{ fontSize:12, color:C.text3, marginTop:3 }}>📍 {r.area} · {r.time}</div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                        <span style={{ background:dBg, color:dColor, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{dLabel}</span>
                        {!closed && <span style={{ fontSize:11, color:C.brand, fontWeight:700 }}>진행 현황 →</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 견적 마감 확인 ── */}
      {showCloseConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"24px 24px 40px" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
            <div style={{ textAlign:"center", marginBottom:S.xxl }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:8 }}>견적을 마감할까요?</div>
              <div style={{ fontSize:13, color:C.text3, lineHeight:1.7 }}>
                마감 후에는 새 입찰을 받을 수 없어요.<br/>기존에 받은 입찰은 계속 확인할 수 있어요.
              </div>
            </div>
            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setShowCloseConfirm(null)}
                style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                취소
              </button>
              <button onClick={() => { handleCloseRequest(showCloseConfirm); setShowCloseConfirm(null); }}
                style={{ flex:2, padding:S.xl, background:C.text1, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer" }}>
                견적 마감하기
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegisterPrompt && (
        <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"24px 24px 40px" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
            <div style={{ textAlign:"center", marginBottom:S.xxl }}>
              <div style={{ fontSize:44, marginBottom:10 }}>🔨</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:8 }}>업체 등록이 필요해요</div>
              <div style={{ fontSize:13, color:C.text3, lineHeight:1.7 }}>입찰하려면 업체 등록이 필요합니다.<br/>사업자 인증 후 🛡 인증 배지가 부여돼요.</div>
            </div>
            <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl }}>
              {["견적 입찰 가능","채팅 상담 가능","🛡 공간마켓 인증 배지","상단 노출 우선순위"].map(t => (
                <div key={t} style={{ fontSize:13, color:C.brand, fontWeight:600, marginBottom:4 }}>✓ {t}</div>
              ))}
            </div>
            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setShowRegisterPrompt(false)} style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>나중에</button>
              <button onClick={() => { setShowRegisterPrompt(false); onStartOnboarding(); }} style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44` }}>🚀 업체 등록하기</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", background:C.brand, color:"#fff", borderRadius:R.full, padding:"12px 22px", fontSize:13, fontWeight:700, boxShadow:`0 8px 24px ${C.brand}44`, zIndex:200, whiteSpace:"nowrap" }}>{toast}</div>
      )}

      {showLoginRequired && (
        <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:500 }}
          onClick={() => setShowLoginRequired(false)}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"24px 24px 40px" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
            <div style={{ textAlign:"center", marginBottom:S.xxl }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:8 }}>로그인이 필요해요</div>
              <div style={{ fontSize:13, color:C.text3, lineHeight:1.7 }}>
                글쓰기, 댓글, 대화 신청, 토큰 사용 등<br/>
                라운지 활동은 로그인 후 이용할 수 있어요.
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:S.sm }}>
              <button onClick={() => { setShowLoginRequired(false); onLogout(); }}
                style={{ width:"100%", padding:S.xl, background:`linear-gradient(135deg,${C.brand},${C.brandD})`, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44` }}>
                🏡 의뢰인으로 시작
              </button>
              <button onClick={() => { setShowLoginRequired(false); onLogout(); }}
                style={{ width:"100%", padding:S.xl, background:C.surface, color:C.brand, border:`2px solid ${C.brandM}`, borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer" }}>
                🔨 업체로 시작
              </button>
              <button onClick={() => setShowLoginRequired(false)}
                style={{ width:"100%", padding:"12px", background:"none", border:"none", color:C.text3, fontWeight:700, fontSize:14, cursor:"pointer", marginTop:S.xs }}>
                계속 둘러보기
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdminCodeModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:20 }}>
          <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xxl, width:"100%", maxWidth:340 }}>
            <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:6 }}>관리자 코드</div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>관리자 전용 코드를 입력해주세요</div>
            <input
              value={adminCodeInput}
              onChange={e => { setAdminCodeInput(e.target.value); setAdminCodeError(""); }}
              type="password"
              placeholder="코드 입력"
              style={{ width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.md, fontSize:18, outline:"none", boxSizing:"border-box", marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface, textAlign:"center", letterSpacing:4 }}
            />
            {adminCodeError && <div style={{ color:C.red, fontSize:12, fontWeight:600, marginBottom:S.sm }}>{adminCodeError}</div>}
            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => { setShowAdminCodeModal(false); setAdminCodeInput(""); setAdminCodeError(""); }}
                style={{ flex:1, padding:S.lg, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                취소
              </button>
              <button onClick={() => {
                if (adminCodeInput === "admin1234") {
                  setShowAdminCodeModal(false);
                  setAdminCodeInput("");
                  setAdminCodeError("");
                  onLogin({ ...user, role: "admin", activeRole: "admin" });
                  setScreen("admin");
                } else {
                  setAdminCodeError("관리자 코드가 올바르지 않습니다");
                }
              }}
                style={{ flex:1, padding:S.lg, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer" }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {editRequest && (
        <RequestModal
          isEdit
          initialData={editRequest}
          onClose={() => setEditRequest(null)}
          onDone={(form) => handleUpdateRequest(form, editRequest.id)}
        />
      )}

      {reqBlock && (() => {
        const isEscrow = reqBlock.type === "ESCROW_BLOCK";
        const isCooldown = reqBlock.type === "COOLDOWN_BLOCK";
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:500 }}>
            <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"28px 24px 40px" }}>
              <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
              <div style={{ fontSize:22, textAlign:"center", marginBottom:12 }}>📋</div>
              <div style={{ fontSize:17, fontWeight:900, color:C.text1, textAlign:"center", marginBottom:10 }}>
                진행 중인 견적요청이 있습니다
              </div>
              <div style={{ fontSize:13, color:C.text3, textAlign:"center", lineHeight:1.7, marginBottom: isCooldown ? S.sm : S.xl }}>
                {isEscrow
                  ? <>업체 선택 또는 요청 종료 후<br/>새 요청을 등록할 수 있습니다.</>
                  : <>견적 요청 등록 후 6일 동안은<br/>새 요청 등록이 제한됩니다.</>
                }
              </div>
              {isCooldown && reqBlock.remainingMs > 0 && (
                <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.md,
                  marginBottom:S.xl, textAlign:"center", border:`1px solid ${C.brandM}` }}>
                  <div style={{ fontSize:12, color:C.text3, marginBottom:4 }}>새 요청 가능까지</div>
                  <div style={{ fontSize:16, fontWeight:900, color:C.brand }}>
                    {fmtCooldown(reqBlock.remainingMs)} 남았습니다
                  </div>
                </div>
              )}
              <button
                onClick={() => { setReqBlock(null); setScreen("home"); }}
                style={{ width:"100%", padding:"14px", background:C.brand, color:"#fff", border:"none",
                  borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer",
                  boxShadow:`0 4px 16px ${C.brand}44`, marginBottom:10 }}>
                진행 중 요청 보기
              </button>
              {!isEscrow && reqBlock.activeReq?.id && (
                <button
                  onClick={async () => {
                    await archiveRequestAuto(reqBlock.activeReq.id, "manual_hide").catch(() => {});
                    setMyRequests(prev => prev.filter(r => r.id !== reqBlock.activeReq.id));
                    setReqBlock(null);
                    setShowReq(true);
                  }}
                  style={{ width:"100%", padding:"12px", background:C.surface2, color:C.text2,
                    border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:10 }}>
                  요청 숨기고 새 요청 등록하기
                </button>
              )}
              <button
                onClick={() => setReqBlock(null)}
                style={{ width:"100%", padding:"12px", background:"none", color:C.text4,
                  border:"none", borderRadius:R.lg, fontWeight:600, fontSize:13, cursor:"pointer" }}>
                닫기
              </button>
            </div>
          </div>
        );
      })()}

      {showReq && <RequestModal onClose={() => setShowReq(false)} onDone={async (form) => {
        // Pre-insert server-side duplicate guard
        if (user?.id) {
          const { data: dup } = await getActiveRequestByUser(user.id);
          if (dup) {
            const isEscrow = ESCROW_STATUSES.includes(dup.status);
            const baseTs = dup.last_activity_at ?? dup.created_at;
            const ageMs = Date.now() - new Date(baseTs).getTime();
            const canProceed = !isEscrow && ageMs >= COOLDOWN_MS;
            if (canProceed) {
              await archiveRequestAuto(dup.id, "auto_new_request_after_6days").catch(() => {});
              setMyRequests(prev => prev.filter(r => r.id !== dup.id));
              // proceed with insert
            } else {
              setShowReq(false);
              setReqBlock({
                type: isEscrow ? "ESCROW_BLOCK" : "COOLDOWN_BLOCK",
                activeReq: dup,
                remainingMs: Math.max(0, COOLDOWN_MS - ageMs),
              });
              return;
            }
          }
        }

        // Optimistic local entry (shown immediately)
        const _now = Date.now();
        const optimistic = {
          id: `tmp-${_now}`,
          user_id: user.id ?? null,
          type: form.type, size: form.size, budget: form.budget,
          style: form.style, desc: form.desc,
          area: user.region ?? "", user: user.name,
          bids: 0, bidCount: 0, time: "방금", status: "open",
          createdAt: new Date(_now).toISOString(),
          expiresAt: new Date(_now + REQUEST_TTL_MS).toISOString(),
          daysLeft: 7,
          isExpiredByTime: false,
          isActive: true,
          isClosed: false,
        };
        setMyRequests(prev => [optimistic, ...prev]);
        setCustomerRequests(prev => [optimistic, ...prev]);
        setShowReq(false);
        showToast("✅ 인근 업체들에게 전달됐어요!");

        // INSERT to Supabase
        if (user.id) {
          const { data, error } = await createRequest({
            user_id:     user.id,
            status:      'open',
            area:        user.region ?? "",
            space_type:  form.type,
            size:        form.size,
            style:       form.style,
            description: form.desc ?? "",
            budget_min:  form.budget_min ?? 0,
            budget_max:  form.budget_max ?? 0,
            expires_at:  new Date(Date.now() + REQUEST_TTL_MS).toISOString(),
          });
          setReqCreateDebug({
            id:         data?.id ?? null,
            status:     data?.status ?? null,
            expires_at: data?.expires_at ?? null,
            space_type: data?.space_type ?? null,
            user_id:    data?.user_id ?? null,
            insertError: error?.message ?? null,
            _note: "신규 견적 요청",
          });
          if (error) {
            void error;
          } else if (data) {
            const saved = normalizeRequest(data);
            const replace = r => r.id === optimistic.id ? saved : r;
            setMyRequests(prev => prev.map(replace));
            setCustomerRequests(prev => prev.map(replace));
          }
        }
      }} />}

      {bidAlert && (
        <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:400 }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"24px 24px 40px" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
            <div style={{ textAlign:"center", marginBottom:S.xxl }}>
              <div style={{ fontSize:48, marginBottom:10 }}>🔔</div>
              <div style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:8 }}>업체 {bidAlert.count}곳이 입찰했어요!</div>
              <div style={{ fontSize:14, color:C.text3, lineHeight:1.7 }}>{bidAlert.requestType} 견적을 확인한 업체들이<br/>금액과 기간을 제출했어요</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:S.sm, marginBottom:S.xl }}>
              {(bidAlert.companies || []).map((c, i) => (
                <div key={c?.id ?? i} style={{ background:C.surface2, borderRadius:R.lg, padding:`${S.sm}px ${S.lg}px`, display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ display:"flex", gap:S.sm, alignItems:"center" }}>
                    <div style={{ width:32, height:32, borderRadius:R.sm, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:C.brand }}>{(c?.name ?? "?")[0]}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{c?.name ?? "—"}</div>
                      <div style={{ fontSize:11, color:C.text3 }}>{c?.distance || "인근"} · 견적 제출</div>
                    </div>
                  </div>
                  <TempBadge temp={c?.temp ?? 0} />
                </div>
              ))}
            </div>
            <div style={{ background:C.navyL, borderRadius:R.lg, padding:S.md, marginBottom:S.xl, display:"flex", gap:S.sm, alignItems:"center", border:`1px solid ${C.trustM}` }}>
              <span style={{ fontSize:16 }}>🛡</span>
              <span style={{ fontSize:12, color:C.navy, fontWeight:600 }}>선택한 업체와 에스크로 안전 정산으로 진행됩니다</span>
            </div>
            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setBidAlert(null)} style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>나중에</button>
              <button onClick={() => { setBidViewRequestId(bidAlert.requestId ?? null); setBidAlert(null); setScreen("bidstatus"); }} style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44` }}>💰 견적 비교하기</button>
            </div>
          </div>
        </div>
      )}

      {IS_DEBUG && (
        <div style={{ position:"fixed", top:8, right:8, background:"rgba(0,0,0,0.82)", color:"#0f0", borderRadius:8, padding:"8px 10px", fontSize:10, zIndex:9999, lineHeight:1.9, fontFamily:"monospace", maxWidth:200, pointerEvents:"none" }}>
          activeRole: {activeRole}<br/>
          dbRole: {user.role ?? "—"}<br/>
          screen: {screen}<br/>
          mode: {mode}
        </div>
      )}

      {!FULL && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:C.surface, borderTop:`1px solid ${C.bgWarm}`, display:"flex", zIndex:10 }}>
          {NAV.map(([icon,label,target]) => (
            <button key={target} onClick={() => setScreen(target)}
              style={{ flex:1, background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"10px 0 14px" }}>
              <div style={{ fontSize:22 }}>{icon}</div>
              <div style={{ fontSize:10, fontWeight:screen===target?800:500, color:screen===target?C.brand:C.text3 }}>{label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
