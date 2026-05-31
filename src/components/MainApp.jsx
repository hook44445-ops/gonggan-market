import { useState, useEffect, useRef, useMemo } from "react";
import { C, R, S, GRADE, SHADOW, calcCustomerGrade } from "../constants";
import { TempBadge, CertBadge, Divider, BrandLockup, LeafSprig, LogoMark } from "./common";
import { SHOW_DEBUG_UI } from "../constants/release";
import LiveFeed from "./LiveFeed";
import RegionSelectorBar from "./RegionSelectorBar";
import RegionSelectSheet from "./RegionSelectSheet";
import { useGPS } from "../hooks/useGPS";
import { resolveMapCenter } from "../hooks/useMapCenter";
import { getActivityRegions, getServiceRegions, getPrimaryRegion, getPrimaryRegionId, regionKey, makeRegionEntry } from "../constants/regions";
import { getMatchedCompaniesWithTier } from "../utils/regionMatching";
import { isJunkText } from "../utils/dataHygiene";
import { updateUserActivityRegions } from "../lib/supabase";
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
import TermsModal from "./TermsModal";
import ConsentGate, { hasConsented } from "./ConsentGate";
import BidCard from "./BidCard";
import ImageViewerModal from "./ImageViewerModal";
import CompanyDepositCard from "./CompanyDepositCard";
import RequestModal from "./RequestModal";
import LoungeMyPageSection from "./lounge/LoungeMyPageSection";
import SiteVisitModal from "./SiteVisitModal";
import PlatformEstimateModal from "./PlatformEstimateModal";
import CompanyActiveJobCard from "./CompanyActiveJobCard";
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
  getCompanyActiveJobs,
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
  getTopReviews,
  getSeedReviews,
  requestMockIdentityVerification,
  updateCompanyServiceRegions,
} from "../lib/supabase";
import { useCompanyList } from "../hooks/useCompanyList";
import KakaoMap from "./KakaoMap";

// ── normalizers: DB row → local shape ─────────────────────────────────────────

const normalizeCompany = (row) => ({
  id:            row.id,
  ownerId:       row.owner_id ?? null,
  name:          row.name ?? "업체",
  temp:          row.temp ?? 36.5,
  verified:      row.verified ?? false,
  badge:         row.badge ?? "basic",
  hasInsurance:  row.has_insurance ?? false,
  completedJobs: row.completed_jobs ?? 0,
  recontractRate: row.recontract_rate ?? 0,
  asRate:        row.as_rate ?? 0,
  region:        row.region ?? "",
  service_regions: Array.isArray(row.service_regions) ? row.service_regions : null,
  online:        row.online ?? false,
  specialties:   row.specialties ?? [],
  companyStatus: row.company_status ?? "PENDING",
});

const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// C-1: RequestModal은 예산을 "2,500~3,000만원" 같은 단일 문자열로 수집한다.
// DB는 budget_min/budget_max(만원 단위 정수)로 저장하므로 문자열에서 숫자를 안전하게 파싱한다.
// - 숫자 2개: [min, max]   - 숫자 1개: [n, n]   - 숫자 없음(협의 등): [0, 0]
// 기존 데이터는 이미 budget_min/max 정수로 저장되어 있어 영향 없음.
const parseBudgetRange = (str) => {
  if (!str || typeof str !== "string") return { min: 0, max: 0 };
  const nums = (str.match(/\d[\d,]*/g) ?? [])
    .map(s => parseInt(s.replace(/,/g, ""), 10))
    .filter(n => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  const sorted = [...nums].sort((a, b) => a - b);
  return { min: sorted[0], max: sorted[sorted.length - 1] };
};

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

function ConsumerRequestCard({ r, closed, dLabel, dColor, dBg, onOpen }) {
  const [devOpen, setDevOpen] = useState(false);
  return (
    <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm, border:`1px solid ${C.bgWarm}`, opacity: closed ? 0.7 : 1 }}>
      <div onClick={onOpen} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor: closed ? "default" : "pointer" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color: closed ? C.text3 : C.text1 }}>{r.type} · {r.size}</div>
          <div style={{ fontSize:12, color:C.text3, marginTop:3 }}>📍 {r.area} · {r.time}</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
          <span style={{ background:dBg, color:dColor, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{dLabel}</span>
          {!closed && <span style={{ fontSize:11, color:C.brand, fontWeight:700 }}>진행 현황 →</span>}
        </div>
      </div>
      <div style={{ marginTop:S.sm }}>
        <button onClick={e => { e.stopPropagation(); setDevOpen(v => !v); }}
          style={{ background:C.bg, border:`1px solid ${C.bgWarm}`, borderRadius:R.sm, padding:"2px 6px", fontSize:10, color:C.text4, fontWeight:700, cursor:"pointer" }}>
          {devOpen ? "▲" : "▼"} DEV
        </button>
        {devOpen && (
          <div style={{ marginTop:S.sm, background:C.bg, borderRadius:R.md, padding:S.md, fontSize:10, color:C.text3, fontFamily:"monospace", lineHeight:1.8 }}>
            <div>request_id: {r.id ?? "-"}</div>
            <div>request_status: {r.status ?? "-"}</div>
            <div>fetch_err: null</div>
          </div>
        )}
      </div>
    </div>
  );
}

const maskCompanyName = (name) => {
  if (!name) return "업체";
  const len = name.length;
  if (len <= 3) return name[0] + "*";
  if (len <= 5) return name.slice(0, 2) + "***";
  return name.slice(0, Math.min(Math.ceil(len / 2), 4)) + "***";
};

// ── (mock code removed — replaced by seed_reviews DB table) ─────────────────

// Compute customer-facing stage from request + escrow/payout data
const computeCustomerStage = (r, escrowData) => {
  if (!r) return null;
  const { escrow = null, payouts = [] } = escrowData ?? {};

  if (!escrow) {
    if (r.status === "in_progress") return {
      badge: "계약중", badgeBg: C.brandL, badgeFg: C.brand,
      label: "계약 진행중", sub: "안전 결제 진행 중",
      action: "escrow", cta: "공사 현황 보기",
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

// ── 의뢰인 상태 배지 — 단일 소스(SSOT) ──────────────────────────────
// 홈 / 마이 / 견적 이력 모두 이 함수로 라벨·색을 도출해 상태가 100% 일치하게 한다.
// 계약(에스크로) 라이프사이클에 들어간 요청은 computeCustomerStage(에스크로 기준)를
// 따르고, 아직 계약 전(open)인 요청만 마감일 기반 라벨을 쓴다.
// request.status 단독 사용 금지 — 에스크로/정산 단계가 우선.
function consumerStatusBadge(r, escrowData) {
  const hasEscrow = !!escrowData?.escrow;
  const inContractLifecycle = hasEscrow || r.status === "in_progress" || r.status === "completed";

  if (inContractLifecycle) {
    const cs = computeCustomerStage(r, escrowData);
    return {
      label: cs?.badge ?? "진행중",
      color: cs?.badgeFg ?? C.brand,
      bg:    cs?.badgeBg ?? C.brandL,
      // 정산완료/완료 또는 만료·취소된 요청만 closed 로 본다.
      closed: cs?.badge === "완료" || r.isClosed === true,
    };
  }

  // 계약 전(open) — 마감일 기반 라벨 유지
  if (r.isClosed) {
    return { label: r.isExpiredByTime ? "기간만료" : "마감됨", color: C.text4, bg: C.bg, closed: true };
  }
  return {
    label: `마감 ${r.daysLeft}일 전`,
    color: r.daysLeft <= 1 ? C.red : r.daysLeft <= 3 ? "#C07000" : C.brand,
    bg:    r.daysLeft <= 1 ? "#FFF0F0" : r.daysLeft <= 3 ? "#FFF7E6" : C.brandL,
    closed: false,
  };
}

// 완료/정산완료 판정 — 단일 소스(에스크로). "내 견적 요청"(active 슬롯)에서 제외하고
// 새 견적 생성 카운트에서도 빼는 기준. computeCustomerStage 의 "완료" 배지와 일치
// (escrow SETTLED 또는 완료 단계 payout 승인). request.status 단독 사용 금지.
function isRequestSettled(r, escrowData) {
  const escrow = escrowData?.escrow ?? null;
  if (escrow) {
    const tx = escrow.transaction_status;
    if (tx === "SETTLED") return true;
    const payout4 = (escrowData?.payouts ?? []).find(p => p.stage === 4);
    if (payout4?.status === "APPROVED") return true;
  }
  // 에스크로 미적재 상태에서도 raw status 가 명시적 완료면 active 에서 제외
  if (r?.status === "completed" || r?.status === "settled") return true;
  return false;
}

// 관심 — 조용한 갤러리 톤의 빈 상태
function FavEmptyState({ title, desc, onGo }) {
  return (
    <div style={{ background:C.ivory, borderRadius:R.xl, padding:"44px 24px 36px",
      border:`1px solid ${C.bgWarm}`, boxShadow:SHADOW.soft, textAlign:"center", marginTop:S.sm }}>
      <div style={{ position:"relative", width:64, height:64, margin:"0 auto 18px" }}>
        <div style={{ width:64, height:64, borderRadius:R.full, background:`linear-gradient(135deg,${C.brandL},${C.bgWarm})`,
          display:"flex", alignItems:"center", justifyContent:"center", border:`1.5px solid ${C.brandM}` }}>
          <span style={{ fontSize:26, lineHeight:1 }}>🌿</span>
        </div>
      </div>
      <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:8, letterSpacing:"-0.3px" }}>{title}</div>
      <div style={{ fontSize:13, color:C.text3, lineHeight:1.8, marginBottom:S.xl, whiteSpace:"pre-line" }}>{desc}</div>
      <button onClick={onGo} style={{ padding:"11px 28px", background:C.brand, color:"#fff",
        border:"none", borderRadius:R.full, fontWeight:700, fontSize:13, cursor:"pointer",
        boxShadow:SHADOW.brand }}>
        라운지 둘러보기
      </button>
    </div>
  );
}

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

  // H-A: realtime closure에서 최신 screen 값을 동기적으로 읽기 위한 ref
  // (useState는 closure에서 stale하게 캡처되므로 ref로 항상 최신 값 참조)
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // H-B: review 화면으로 진입했는데 selCo가 없으면 홈으로 복구 (blank screen 방지)
  useEffect(() => {
    if (screen === "review" && !selCo) setScreen("home");
  }, [screen, selCo]);

  // Expose current screen + role for ErrorBoundary diagnostics (white-screen triage).
  useEffect(() => {
    try { window.__GG_ROUTE__ = `${activeRole}/${screen}`; } catch {}
  }, [screen, activeRole]);
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
  const bidSubmitGuardRef = useRef(false); // H-2: 입찰 동시 더블서브밋 가드

  // ── 관심 탭 ──────────────────────────────────────────────────────────────────
  const [favTab, setFavTab] = useState("received");

  // ── 라운지 상태 ──────────────────────────────────────────────────────────────
  const [loungePost, setLoungePost]               = useState(null);
  const [editingLoungePost, setEditingLoungePost] = useState(null);
  const [loungeRefreshKey, setLoungeRefreshKey] = useState(0);
  const [editOriginScreen, setEditOriginScreen]   = useState('lounge-detail');
  const [myPostsRefreshKey, setMyPostsRefreshKey] = useState(0);
  const [localLoungePosts, setLocalLoungePosts]   = useState([]);
  const [localLoungeStories, setLocalLoungeStories] = useState([]);
  const { balance: tokenBalance, logs: tokenLogs, missionStats: tokenMissionStats, spend: spendToken, earn: earnToken } = useSpaceToken(user?.id);
  const { temperature } = useSpaceTemperature(user?.id);

  const [activeJobs, setActiveJobs] = useState([]);
  const [homeReviewViewer, setHomeReviewViewer] = useState(null);
  const [siteVisitJob, setSiteVisitJob] = useState(null);
  const [estimateJob, setEstimateJob] = useState(null);
  const [termsDocType, setTermsDocType] = useState(null);
  const [consentGateConfig, setConsentGateConfig] = useState(null);

  // Admin hidden entry
  const [adminTapCount, setAdminTapCount] = useState(0);
  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [adminIdInput, setAdminIdInput] = useState("");
  const [adminCodeInput, setAdminCodeInput] = useState("");
  const [adminCodeError, setAdminCodeError] = useState("");

  const [mapSelectedId, setMapSelectedId] = useState(null);
  const mapCardRefs = useRef({});

  // ── 지역 정책: 활동지역(최대 2) — 지도에서 직접 설정 ──
  const [activityRegions, setActivityRegions] = useState(() => getActivityRegions(user));
  const [activeRegion, setActiveRegion] = useState(() => getPrimaryRegion(getActivityRegions(user)));
  const [regionSheetOpen, setRegionSheetOpen] = useState(false);
  const { gpsCenter, loading: gpsLoading, requestCurrentLocation, clearGps } = useGPS();

  // user prop 변경(재로그인 등) 시 활동지역 재동기화
  useEffect(() => {
    const regs = getActivityRegions(user);
    setActivityRegions(regs);
    setActiveRegion(getPrimaryRegion(regs));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 지도 중심 — activeRegion > GPS > 저장 primary > fallback
  const mapCenter = useMemo(
    () => resolveMapCenter({ user: { activity_regions: activityRegions, region: user?.region }, activeRegion, gpsCenter }),
    [activityRegions, user?.region, activeRegion, gpsCenter]
  );

  const [mapLocalOnly, setMapLocalOnly] = useState(false);

  const onSelectRegionTab = (r) => { clearGps(); setActiveRegion(r); setMapLocalOnly(false); };
  const onRequestMapLocation = () => { setActiveRegion(null); requestCurrentLocation(); };

  const onSaveRegions = async (entries) => {
    const primary = getPrimaryRegion(entries);
    const primaryText = primary ? regionKey(primary.city, primary.district) : null;
    setActivityRegions(entries);
    setActiveRegion(primary);
    setRegionSheetOpen(false);
    clearGps();
    if (user?.id) {
      try { await updateUserActivityRegions(user.id, entries, primaryText, getPrimaryRegionId(entries)); }
      catch (e) { console.warn("[region] save failed", e?.message); } // eslint-disable-line no-console
    }
  };

  // ── Phase C: 업체 영업지역(service_regions, 최대 2) — 마이페이지에서 수정 ──
  const [companyServiceRegions, setCompanyServiceRegions] = useState([]);
  const [companyRegionSheetOpen, setCompanyRegionSheetOpen] = useState(false);

  // 업체 프로필 로드/변경 시 영업지역 동기화 (없으면 legacy region text fallback)
  useEffect(() => {
    setCompanyServiceRegions(getServiceRegions(currentUser));
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSaveServiceRegions = async (entries) => {
    const primary = getPrimaryRegion(entries);
    const primaryText = primary ? regionKey(primary.city, primary.district) : null;
    setCompanyServiceRegions(entries);
    setCompanyRegionSheetOpen(false);
    // 로컬 업체 상태 즉시 반영 (primary 는 legacy region text 로도 미러링)
    setCurrentUser(prev => prev
      ? { ...prev, service_regions: entries, region: primaryText ?? prev.region }
      : prev);
    if (currentUser?.id) {
      try {
        await updateCompanyServiceRegions(currentUser.id, entries, primaryText, getPrimaryRegionId(entries));
        showToast("✅ 영업지역이 저장됐어요");
      } catch (e) {
        console.warn("[service-region] save failed", e?.message); // eslint-disable-line no-console
        showToast("영업지역 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    }
  };

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

  const [reqDebug, setReqDebug] = useState(null);
  const [reqCreateDebug, setReqCreateDebug] = useState(null);
  const [bidFetchDebug, setBidFetchDebug] = useState(null);
  const [lastFetchAt, setLastFetchAt] = useState(null);
  const [companyJobs, setCompanyJobs] = useState([]);
  const [companyJobsDebug, setCompanyJobsDebug] = useState(null);
  const [myRequestsEscrow, setMyRequestsEscrow] = useState({}); // { [requestId]: { escrow, payouts } }
  const [escrowRefreshTrigger, setEscrowRefreshTrigger] = useState(0);
  const [topReviews, setTopReviews] = useState([]);
  const [hidingId, setHidingId] = useState(null);     // requestId currently being hidden
  const [hideDebug, setHideDebug] = useState(null);   // DEV panel

  // Identity verification state (mock, no real KYC)
  // Required DB columns: is_identity_verified, identity_verified_at, identity_provider, identity_verification_status
  const [idVerified,   setIdVerified]   = useState(user?.is_identity_verified ?? false);
  const [idVerifiedAt, setIdVerifiedAt] = useState(user?.identity_verified_at ?? null);
  const [idStatus,     setIdStatus]     = useState(user?.identity_verification_status ?? null);
  const [idVerifying,  setIdVerifying]  = useState(false);

  const handleMockIdVerify = async () => {
    if (!user?.id || idVerifying) return;
    setIdVerifying(true);
    const { data, error } = await requestMockIdentityVerification(user.id);
    if (error) {
      showToast("인증 처리 중 오류가 발생했습니다", false);
    } else if (data) {
      setIdVerified(true);
      setIdVerifiedAt(data.identity_verified_at ?? null);
      setIdStatus("verified");
      showToast("본인인증이 완료됐습니다");
    }
    setIdVerifying(false);
  };

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

  const [reviewFetchErr, setReviewFetchErr] = useState(null);
  const [seedReviews, setSeedReviews] = useState([]);
  const [seedFetchErr, setSeedFetchErr] = useState(null);

  // Load top reviews + seed reviews once on mount
  useEffect(() => {
    getTopReviews({ limit: 12 }).then(({ data, error }) => {
      if (error) { setReviewFetchErr(error.message ?? "fetch_err"); return; }
      if (data) setTopReviews(data.slice(0, 5));
    }).catch(e => setReviewFetchErr(String(e)));

    getSeedReviews({ limit: 10, activeOnly: true }).then(({ data, error }) => {
      if (error) setSeedFetchErr(error.message ?? "seed_err");
      else if (data) setSeedReviews(data);
    }).catch(e => setSeedFetchErr(String(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (activeRole !== "company" || !currentUser?.id) return;
    getCompanyActiveJobs(currentUser.id).then(({ data }) => {
      if (data) setActiveJobs(data);
    });
  }, [currentUser?.id, activeRole]);

  // Load company's own awarded/in-progress jobs — multi-path fetch with payment_orders fallback
  useEffect(() => {
    if (activeRole !== "company" || !user?.id) return;

    const loadJobs = async () => {
      const candidateIds = [...new Set([
        user.id,
        currentUser?.id,
        currentUser?.ownerId,
      ].filter(Boolean))];

      const dev = {
        auth_user_id:              user.id?.slice(0, 8) ?? "null",
        currentUser_id:            currentUser?.id?.slice(0, 8) ?? "null",
        company_owner_id:          currentUser?.ownerId?.slice(0, 8) ?? "null",
        candidateIds:              candidateIds.map(id => id.slice(0, 8)).join(", "),
        raw_bids:                  0,
        selected_count:            0,
        request_id_present_count:  0,
        request_id_null_count:     0,
        join_mode:                 "none",
        payment_orders_found:      0,
        escrow_direct_found:       0,
        request_count:             0,
        contract_count:            0,
        escrow_count:              0,
        displayed_jobs:            0,
        request_ids:               "—",
        statuses:                  "—",
        bid_err:                   "none",
        req_err:                   "none",
        caught_err:                null,
        bid_details:               "—",
      };

      // ── Path A: bids WHERE company_id ∈ candidateIds ─────────────────────────
      const { data: bids, error: bidErr } = await supabase
        .from("bids")
        .select("*")
        .in("company_id", candidateIds);

      dev.bid_err            = bidErr?.message ?? "none";
      dev.raw_bids           = bids?.length ?? 0;
      dev.selected_count     = (bids ?? []).filter(b => b.selected).length;

      const allBids = bids ?? [];
      dev.request_id_present_count = allBids.filter(b => b.request_id != null).length;
      dev.request_id_null_count    = allBids.filter(b => b.request_id == null).length;
      dev.bid_details = allBids.slice(0, 5).map(b =>
        `id:${b.id?.slice(0,8)} cid:${b.company_id?.slice(0,8)} rid:${b.request_id?.slice(0,8) ?? "NULL"} sel:${b.selected}`
      ).join(" | ") || "none";

      const bidIds = allBids.map(b => b.id).filter(Boolean);

      // Collect request_id → bid mapping; start with bids that have request_id
      const bidRequestMap = {}; // bid.id → request_id
      for (const b of allBids) {
        if (b.request_id != null) bidRequestMap[b.id] = b.request_id;
      }

      // ── Path B: payment_orders fallback (when bids.request_id is NULL) ───────
      if (bidIds.length > 0) {
        const { data: payOrders } = await supabase
          .from("payment_orders")
          .select("bid_id, request_id, contract_id")
          .in("bid_id", bidIds);

        dev.payment_orders_found = payOrders?.length ?? 0;
        for (const po of payOrders ?? []) {
          if (po.bid_id && po.request_id && !bidRequestMap[po.bid_id]) {
            bidRequestMap[po.bid_id] = po.request_id;
          }
        }
      }

      // ── Path C: escrow_payments WHERE company_id ∈ candidateIds (direct) ─────
      const { data: escrowsDirect } = await supabase
        .from("escrow_payments")
        .select("id, request_id, company_id, transaction_status")
        .in("company_id", candidateIds);

      dev.escrow_direct_found = escrowsDirect?.length ?? 0;

      // Merge request_ids: from bids (path A+B) + from escrow direct (path C)
      const requestIdsFromBids = new Set(Object.values(bidRequestMap));
      const requestIdsFromEscrow = new Set(
        (escrowsDirect ?? []).map(e => e.request_id).filter(Boolean)
      );
      const allRequestIds = [...new Set([...requestIdsFromBids, ...requestIdsFromEscrow])];

      if (allRequestIds.length > 0) {
        dev.join_mode = requestIdsFromBids.size > 0 && requestIdsFromEscrow.size > 0
          ? "bid+escrow_direct"
          : requestIdsFromBids.size > 0 ? "bid_only" : "escrow_direct_only";
      }

      dev.request_ids = allRequestIds.length > 0
        ? allRequestIds.map(id => id.slice(0, 8)).join(", ")
        : "none";

      if (allRequestIds.length === 0) {
        setCompanyJobs([]);
        setCompanyJobsDebug(dev);
        return;
      }

      // ── Fetch requests ────────────────────────────────────────────────────────
      const { data: reqs, error: reqErr } = await supabase
        .from("requests")
        .select("*")
        .in("id", allRequestIds);

      dev.req_err       = reqErr?.message ?? "none";
      dev.request_count = reqs?.length ?? 0;
      dev.statuses = (reqs ?? []).map(r => `${r.id.slice(0,8)}:${r.status ?? "null"}`).join(", ") || "none";

      const requestMap = Object.fromEntries((reqs ?? []).map(r => [r.id, r]));

      // ── Fetch escrow_payments by request_id ───────────────────────────────────
      const { data: escrowsByReq } = await supabase
        .from("escrow_payments")
        .select("id, request_id, transaction_status")
        .in("request_id", allRequestIds);

      // Merge escrow data: by request_id (covers both path B lookup and path C direct)
      const escrowByRequestId = {};
      for (const e of escrowsDirect ?? []) {
        if (e.request_id) escrowByRequestId[e.request_id] = e;
      }
      for (const e of escrowsByReq ?? []) {
        if (e.request_id) escrowByRequestId[e.request_id] = e;
      }

      dev.escrow_count   = Object.keys(escrowByRequestId).length;
      dev.contract_count = dev.escrow_count;

      // Terminal / closed request states — never "진행중".
      // NOTE: do NOT hard-exclude open/expired/bidding here — a stale request.status
      // with an ACTIVE escrow is still in progress (escrow is source of truth).
      const EXCL_REQ  = new Set(["completed","settled","cancelled","refunded","rejected","done","finished","closed"]);
      const EXCL_TX   = new Set(["SETTLED","CANCELLED","REFUNDED","DISPUTE_RESOLVED"]);
      // Active construction phases on the escrow state machine.
      // NOTE: "COMPLETED"(=완료대기, 공사 완료 보고 후 고객 최종 승인/정산 대기)는 진행중에서 제외합니다.
      // 고객 화면 "진행중" 기준(정산되면 빠짐)과 업체 대시보드 카운트를 일치시키기 위함.
      // 완료대기 건은 별도 완료/정산 영역에서 다루며, 진행중(업체가 지금 진행해야 할 일)에는 넣지 않습니다.
      const ACTIVE_TX = new Set(["CONTRACTED","STARTED","MID_INSPECTION","DISPUTE"]);
      const ACTIVE_REQ = new Set(["contracted","in_progress","escrow","working","contract_signed","material_paid","started"]);

      // Build synthetic bid entries for request_ids discovered via escrow direct (no bid row)
      const escrowOnlyRequestIds = [...requestIdsFromEscrow].filter(rid => !requestIdsFromBids.has(rid));
      const syntheticBids = escrowOnlyRequestIds.map(rid => ({
        id: null,
        request_id: rid,
        company_id: candidateIds[0],
        selected: false,
        price: null,
        period_days: null,
        material_note: "",
        comment: "",
        created_at: null,
        _synthetic: true,
      }));

      // Reverse map: request_id → bid (from allBids using bidRequestMap, plus synthetics)
      const jobsByRequestId = {};
      for (const b of allBids) {
        const rid = bidRequestMap[b.id] ?? b.request_id;
        if (!rid) continue;
        const existing = jobsByRequestId[rid];
        if (!existing || b.selected || (b.created_at ?? "") > (existing.created_at ?? "")) {
          jobsByRequestId[rid] = { ...b, request_id: rid };
        }
      }
      for (const sb of syntheticBids) {
        if (!jobsByRequestId[sb.request_id]) jobsByRequestId[sb.request_id] = sb;
      }

      // request_id-level dedupe already done by jobsByRequestId; this is the candidate set.
      const dedupedCandidates = Object.values(jobsByRequestId);
      const excludedReasons = [];

      const jobs = dedupedCandidates
        .filter(b => {
          const rid8 = (b.request_id ?? "").slice(0, 8);
          const reqStatus = (requestMap[b.request_id]?.status ?? "").toLowerCase();
          const esc = escrowByRequestId[b.request_id];
          const txStatus = esc?.transaction_status ?? null;

          // Hard exclude terminal / closed states (req-level or escrow-level).
          if (reqStatus && EXCL_REQ.has(reqStatus)) { excludedReasons.push(`${rid8}:req=${reqStatus}`); return false; }
          if (txStatus && EXCL_TX.has(txStatus))    { excludedReasons.push(`${rid8}:tx=${txStatus}`);  return false; }

          // Include ONLY real, in-progress contracts:
          //  • escrow exists AND its tx is an active construction phase, OR
          //  • escrow exists with unknown tx but request status is active.
          // A request with NO escrow row is NOT a paid/contracted job (no payment was
          // made) — a stale request.status="in_progress" without escrow is excluded.
          // A merely-selected bid with no escrow is "낙찰" (awaiting contract), NOT 진행중.
          const include =
            (esc && txStatus && ACTIVE_TX.has(txStatus)) ||
            (esc && !txStatus && ACTIVE_REQ.has(reqStatus));

          if (!include) {
            excludedReasons.push(`${rid8}:not_active(req=${reqStatus || "∅"},tx=${txStatus || "∅"},escrow=${!!esc},sel=${b.selected === true})`);
          }
          return include;
        })
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
            status: b.selected ? "selected" : "pending",
            company: { id: b.company_id, name: user.name ?? "업체", temp: 36.5, ownerId: user.id },
          },
          request: requestMap[b.request_id] ? normalizeRequest(requestMap[b.request_id]) : null,
          escrow: escrowByRequestId[b.request_id] ?? null,
        }));

      dev.displayed_jobs = jobs.length;
      // ── In-progress dedupe diagnostics (per request) ──
      dev.raw_count               = allBids.length + syntheticBids.length; // pre-dedupe candidate rows
      dev.deduped_count           = dedupedCandidates.length;              // after request_id dedupe
      dev.displayed_dashboard_count = jobs.length;                          // after active-only filter
      dev.excluded_reason         = excludedReasons.length ? excludedReasons.join(" | ") : "none";
      // request_statuses for dashboard DEV (id:status)
      dev.request_statuses = (reqs ?? [])
        .map(r => `${r.id.slice(0,8)}:${r.status ?? "null"}`)
        .join(", ") || "none";
      setCompanyJobs(jobs);
      setCompanyJobsDebug(dev);
    };

    loadJobs().catch(err => {
      setCompanyJobsDebug(d => ({ ...(d ?? {}), caught_err: err?.message ?? String(err) }));
    });
  }, [activeRole, user?.id, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load escrow+payouts for consumer requests that entered a contract lifecycle.
  // in_progress + completed 모두 포함 — 홈/마이/이력이 동일 contract 상태를 보도록.
  useEffect(() => {
    if (activeRole !== "consumer") return;
    const contracted = myRequests.filter(r => r.status === "in_progress" || r.status === "completed");
    if (contracted.length === 0) return;
    contracted.forEach(r => {
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
      // C-3: server-side payment verification — abort if Toss rejects
      if (paymentKey && orderId && amount) {
        try {
          const confirmRes = await fetch("/api/confirm-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentKey, orderId, amount }),
          });
          if (!confirmRes.ok) {
            showToast("결제 확인에 실패했습니다. 고객센터에 문의해주세요.");
            return;
          }
        } catch {
          showToast("결제 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.");
          return;
        }
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
          company: { id: bid.company_id, name: pending.companyName ?? "업체", temp: 36.5, ownerId: pending.companyOwnerId },
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
    let alive = true; // H-4: 언마운트/요청 변경 후 늦게 도착한 응답이 최신 상태를 덮어쓰는 것 방지

    // H-4: 이전 채널이 남아 있으면 먼저 정리해 중복 구독을 막는다
    if (bidRealtimeRef.current) {
      supabase.removeChannel(bidRealtimeRef.current);
      bidRealtimeRef.current = null;
    }

    getBidsForRequest(bidViewRequestId).then(({ data, error }) => {
      if (!alive) return; // stale 응답 무시
      if (SHOW_DEBUG_UI) setBidFetchDebug({ src: "mainapp_effect", req_id: bidViewRequestId, count: data?.length ?? 0, err: error?.message ?? null, req_ids: (data ?? []).map(b => b.request_id) });
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
        if (!alive || !data) return; // 구독 해제 후 도착한 이벤트 무시
        const normalized = data.map(normalizeBid);
        setSubmittedBids(normalized);
        // H-A: 에스크로/결제/리뷰/관리자 화면에서는 팝업 금지
        // 입찰 알림은 홈·입찰목록·타임라인 같이 알림이 맥락에 맞는 화면에서만 표시한다.
        const SAFE_ALERT_SCREENS = new Set(["home", "bidstatus", "timeline", "my"]);
        if (SAFE_ALERT_SCREENS.has(screenRef.current)) {
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
    return () => {
      alive = false;
      supabase.removeChannel(channel);
      bidRealtimeRef.current = null;
    };
  }, [bidViewRequestId]);

  const { companies } = useCompanyList();

  // 지도 노출 업체 — 단계별(exact→legacy→city→all) 매칭, fallback 시 배너/배지 표시
  const { mapCompanies, mapLocalMatches, mapFallbackTier, mapIsFallback, mapFallbackReason } = useMemo(() => {
    const activeFilter = activeRegion?.city
      ? { city: activeRegion.city, district: activeRegion.district }
      : null;
    const result = getMatchedCompaniesWithTier(
      companies,
      { activity_regions: activityRegions, region: user?.region },
      activeFilter
    );
    return { mapCompanies: result.matched, mapLocalMatches: result.localMatches, mapFallbackTier: result.tier, mapIsFallback: result.isFallback, mapFallbackReason: result.fallbackReason };
  }, [companies, activeRegion, activityRegions, user?.region]);

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
  const COOLDOWN_MS = 6 * 24 * 60 * 60 * 1000; // 144h — applied after manual hide
  const QUOTE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — quote comparison protection window
  const OVERRIDE_LS_KEY = "gm_req_override_ts";

  const fmtCooldown = (ms) => {
    const totalH = Math.floor(ms / (3600 * 1000));
    const d = Math.floor(totalH / 24);
    const h = totalH % 24;
    if (d > 0 && h > 0) return `${d}일 ${h}시간`;
    if (d > 0) return `${d}일`;
    return `${h}시간`;
  };

  const checkRequestBlock = async () => {
    // 1. Override cooldown check (localStorage — penalty after manual hide)
    const overrideTs = localStorage.getItem(OVERRIDE_LS_KEY);
    if (overrideTs) {
      const remainingMs = Math.max(0, COOLDOWN_MS - (Date.now() - parseInt(overrideTs, 10)));
      if (remainingMs > 0) {
        setReqCheckDebug({ active_count: 0, active_request_status: "cooldown", cooldown_remaining_hours: Math.ceil(remainingMs / 3600000), blocked_reason: "COOLDOWN_BLOCK" });
        return { type: "COOLDOWN_BLOCK", remainingMs };
      }
      localStorage.removeItem(OVERRIDE_LS_KEY);
    }

    // 2. Active request check — 완료/정산완료(에스크로 기준)는 active 에서 제외.
    //    request.status 가 in_progress 로 남아있어도 escrow SETTLED 면 새 견적 허용.
    let active = myRequests.find(r =>
      ACTIVE_STATUSES.includes(r.status) && !r.is_hidden && !r.is_deleted
      && !isRequestSettled(r, myRequestsEscrow[r.id] ?? null)
    ) ?? null;
    if (!active && user?.id) {
      const { data } = await getActiveRequestByUser(user.id);
      // 서버 조회분도 로컬 에스크로 맵으로 정산완료 여부 재확인
      if (data && !isRequestSettled(data, myRequestsEscrow[data.id] ?? null)) active = data;
      else active = null;
    }
    if (!active) {
      setReqCheckDebug({ active_count: 0, active_request_status: "none", cooldown_remaining_hours: 0, blocked_reason: "none" });
      return null;
    }

    // 3. open 상태: 업체 견적서 발급 보호 — 7일 이내에는 새 요청 불가
    if (active.status === "open") {
      const createdAt = new Date(active.created_at).getTime();
      const remainingMs = Math.max(0, QUOTE_COOLDOWN_MS - (Date.now() - createdAt));
      if (remainingMs > 0) {
        setReqCheckDebug({ active_count: 1, active_request_status: "open", cooldown_remaining_hours: Math.ceil(remainingMs / 3600000), blocked_reason: "QUOTE_COMPARISON_BLOCK" });
        return { type: "QUOTE_COMPARISON_BLOCK", activeReq: active, remainingMs };
      }
      // 7일 경과: 견적 비교 기간 만료 → 새 요청 허용
      setReqCheckDebug({ active_count: 1, active_request_status: "open_expired", cooldown_remaining_hours: 0, blocked_reason: "OPEN_ALLOW" });
      return null;
    }

    // 4. in_progress/contracting/escrow_pending: 계약 진행 중 → 하드 블록
    setReqCheckDebug({ active_count: 1, active_request_status: active.status, cooldown_remaining_hours: 0, blocked_reason: "HARD_BLOCK" });
    return { type: "HARD_BLOCK", activeReq: active };
  };

  const CONSUMER_CONSENT_TYPES = ["service_terms", "privacy_policy", "location_terms", "customer_transaction_notice"];
  const LOUNGE_CONSENT_TYPES   = ["lounge_policy", "chat_policy", "report_block_policy"];

  const handleOpenNewReq = async () => {
    const block = await checkRequestBlock();
    if (block) { setReqBlock(block); return; }
    if (!hasConsented(user?.id, CONSUMER_CONSENT_TYPES)) {
      setConsentGateConfig({
        types: CONSUMER_CONSENT_TYPES,
        title: "견적 요청 전 약관 동의",
        onComplete: () => { setConsentGateConfig(null); setShowReq(true); },
      });
      return;
    }
    setShowReq(true);
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
    const actor = currentUser ?? { id: null, ownerId: null, name: user.name ?? "업체", temp: 36.5 };
    // bids.company_id FK → users.id, so always use auth user.id
    const bidCompanyId = user.id;
    if (!bidCompanyId || typeof bidCompanyId !== "string" || !bidCompanyId.includes("-")) {
      setBidDebug({ request_id: request.id, payload_company_id: null, insertError: "user.id null — 로그인 필요" });
      showToast("로그인 정보를 확인할 수 없습니다");
      return;
    }

    // H-2: 중복 입찰 방지 — 이미 이 요청에 저장된(비-임시) 입찰이 있으면 차단.
    // DB에는 unique(request_id, company_id) 제약이 있지만, 클라이언트에서 먼저 막아
    // optimistic 중복/제약 위반 오류 노출을 예방한다.
    const alreadyBid = submittedBids.some(
      b => b.requestId === request.id && b.companyId === bidCompanyId && !String(b.id).startsWith("tmp-")
    );
    if (alreadyBid) {
      showToast("이미 이 견적에 입찰하셨습니다");
      return;
    }
    // H-2: 동시 더블서브밋 가드 (빠른 연타로 두 번 insert 되는 것 방지)
    if (bidSubmitGuardRef.current) return;
    bidSubmitGuardRef.current = true;

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

    let insertOk = false;
    try {
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
        // H-2: 실패 시 optimistic 입찰을 롤백 (중복 키 위반 포함)
        setSubmittedBids(prev => prev.filter(b => b.id !== optimistic.id));
        setBidDebug({
          payload_company_id: bidCompanyId,
          expected_fk_target: "users.id",
          companyProfile_id:  currentUser?.id ?? null,
          companyProfile_ownerId: currentUser?.ownerId ?? null,
          request_id:   request.id,
          insertResult: null,
          insertError:  error.message,
        });
        const dup = /duplicate|unique/i.test(error.message ?? "");
        showToast(dup ? "이미 이 견적에 입찰하셨습니다" : `입찰 저장 실패: ${error.message}`);
        return;
      }
      if (data) {
        insertOk = true;
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
    } finally {
      bidSubmitGuardRef.current = false;
    }

    if (!insertOk) return; // 실패/롤백 시 알림 갱신 생략

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

      {SHOW_DEBUG_UI && (
        <div style={{ background:"#1a1a1a", color:"#00ff88", textAlign:"center", padding:"4px 0", fontSize:10, fontFamily:"monospace", letterSpacing:"0.5px", position:"sticky", top:0, zIndex:999 }}>
          ▶ DEPLOY 2026-05-25 sha:{typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "?"} ◀
          &nbsp;|&nbsp;landing_footer_rendered:true
          &nbsp;|&nbsp;review_card_v2_enabled:true
          &nbsp;|&nbsp;live_hybrid_enabled:true
          &nbsp;|&nbsp;MODE:{import.meta.env.MODE}
        </div>
      )}

      {(screen==="home"||screen==="map") && (
        <div style={{ background:C.ivory, padding:"14px 20px 0",
          borderBottom:`1px solid ${C.bgWarm}`, position:"sticky", top:0, zIndex:10,
          boxShadow:"0 2px 12px rgba(46,95,75,0.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <BrandLockup size={32} />
            <div style={{ display:"flex", gap:S.sm, alignItems:"center" }}>
              {/* 로그아웃 버튼은 실수 터치 방지를 위해 마이페이지(내정보)로 이동됨 */}
            </div>
          </div>
          <div style={{ display:"flex" }}>
            {[["home",mode==="consumer"?"홈":"요청 목록"],["map","지역 지도"]].map(([v,l]) => (
              <button key={v} onClick={() => setScreen(v)}
                style={{ flex:1, padding:"10px 0", border:"none", background:"transparent",
                  fontWeight:screen===v?800:500, fontSize:14,
                  color:screen===v?C.brand:C.text3,
                  borderBottom:`3px solid ${screen===v?C.brand:"transparent"}`,
                  cursor:"pointer", transition:"color 0.2s" }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding:(FULL||NO_PAD)?0:`${S.xl}px ${S.xl}px 90px` }}>

        {/* 의뢰인 홈 */}
        {screen==="home" && mode==="consumer" && (
          <div>
            <div style={{ background:`linear-gradient(145deg,${C.ivory} 0%,${C.brandL} 55%,${C.bgWarm} 100%)`,
              borderRadius:R.xl, padding:S.xxl, marginBottom:S.lg,
              border:`1px solid ${C.brandM}`,
              position:"relative", overflow:"hidden", boxShadow:SHADOW.card }}>
              <LeafSprig size={130} color={C.brand} opacity={0.08}
                style={{ position:"absolute", right:-14, bottom:-28, transform:"rotate(-15deg)" }} />
              <div style={{ fontSize:12, color:C.brand, fontWeight:700, marginBottom:8,
                display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:C.brand, display:"inline-block" }} />
                {user.region} · {user.name}님 안녕하세요
              </div>
              <div style={{ fontSize:23, fontWeight:800, color:C.text1, marginBottom:10, lineHeight:1.35, letterSpacing:"-0.4px" }}>
                인테리어는 어디서?
              </div>
              <div style={{ marginBottom:S.xl }}>
                <div style={{ fontSize:13, color:C.text2, lineHeight:1.75, marginBottom:2 }}>집, 상가, 리모델링까지</div>
                <div style={{ fontSize:12, color:C.text3, lineHeight:1.75 }}>믿고 맡길 수 있는 공간을 함께 찾아요</div>
              </div>
              {(() => {
                const hasActive = myRequests.some(r => r.isActive);
                return hasActive ? (
                  <div style={{ background:`${C.brand}22`, borderRadius:R.full,
                    padding:"11px 22px", fontSize:13, fontWeight:700, color:C.brand,
                    border:`1.5px solid ${C.brand}44`, display:"inline-block" }}>
                    📋 진행 중인 견적이 있습니다
                  </div>
                ) : (
                  <button onClick={handleOpenNewReq}
                    style={{ background:C.brand, color:"#fff", border:"none",
                      borderRadius:R.full, padding:"13px 26px", fontWeight:800, fontSize:14, cursor:"pointer",
                      boxShadow:SHADOW.brand, letterSpacing:"-0.2px" }}>
                    견적 시작하기
                  </button>
                );
              })()}
            </div>

            {/* 공간사이의 약속 */}
            <div style={{ background:C.ivory, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}`, boxShadow:SHADOW.soft,
              position:"relative", overflow:"hidden" }}>
              <LeafSprig size={80} color={C.brand} opacity={0.05}
                style={{ position:"absolute", right:-10, top:-14, transform:"rotate(10deg)" }} />
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:S.md }}>
                <LogoMark size={16} bare />
                <span style={{ fontSize:11, fontWeight:800, color:C.brand,
                  letterSpacing:"0.5px", textTransform:"uppercase" }}>공간사이의 약속</span>
              </div>
              <div style={{ display:"flex" }}>
                {[
                  { icon:"🛡", title:"안전한 거래", sub:"에스크로 보호" },
                  { icon:"✓",  title:"신뢰 파트너", sub:"검증된 업체" },
                  { icon:"🤝", title:"따뜻한 연결", sub:"사람과 공간 사이" },
                ].map((item, i, arr) => (
                  <div key={item.title} style={{ flex:1, textAlign:"center",
                    borderRight:i<arr.length-1?`1px solid ${C.bgWarm}`:"none",
                    padding:`0 ${S.sm}px` }}>
                    <div style={{ width:36, height:36, borderRadius:R.full, background:C.brandL,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      margin:"0 auto 8px", fontSize:15, border:`1px solid ${C.brandM}` }}>
                      {item.icon}
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:C.text1, marginBottom:2 }}>{item.title}</div>
                    <div style={{ fontSize:10, color:C.text3, lineHeight:1.5 }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 믿고 맡긴 후기 — 실제 우선, 부족분은 seed_reviews로 채움 ── */}
            {(() => {
              const seedNeeded = Math.max(0, 5 - topReviews.length);
              const displayReviews = [
                ...topReviews.map(r => {
                  const beforeImgs = r.before_image_urls?.length ? r.before_image_urls
                    : r.image_urls?.length ? [r.image_urls[0]] : [];
                  const afterImgs = r.after_image_urls?.length ? r.after_image_urls
                    : r.image_urls?.length > 1 ? [r.image_urls[1]]
                    : r.image_urls?.length ? [r.image_urls[0]] : [];
                  return {
                    id: r.id, isSeed: false,
                    rating: r.rating, content: r.content,
                    user_name: r.user_name ?? "익명",
                    space_type: r.space_type ?? r.region ?? "시공",
                    companyName: maskCompanyName(r.companies?.name ?? null),
                    beforeThumb: beforeImgs[0] ?? null,
                    afterThumb: afterImgs[0] ?? null,
                  };
                }),
                ...seedReviews.slice(0, seedNeeded).map(s => ({
                  id: s.id, isSeed: true,
                  rating: s.rating, content: s.content,
                  user_name: s.user_name ?? "익명",
                  space_type: s.space_type ?? s.region ?? "시공",
                  companyName: s.masked_company_name ?? "공간○○",
                  beforeThumb: s.before_image_url ?? null,
                  afterThumb: s.after_image_url ?? null,
                })),
              ].filter(rv => !isJunkText(rv.content)).slice(0, 5);

              return (
                <>
                  <div style={{ marginBottom:S.xl }}>
                    <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.md }}>
                      믿고 맡긴 후기
                      <span style={{ fontSize:12, fontWeight:600, color:C.text3, marginLeft:6 }}>
                        실제 시공 완료 고객
                      </span>
                    </div>
                    <div style={{ display:"flex", gap:S.md, overflowX:"auto", paddingBottom:S.sm,
                      scrollbarWidth:"none", msOverflowStyle:"none" }}>
                      {displayReviews.map(rv => {
                        const { beforeThumb, afterThumb } = rv;
                        const showSplit = !!beforeThumb && !!afterThumb;
                        const hasPhoto  = !!beforeThumb || !!afterThumb;
                        return (
                          <div key={rv.id}
                            style={{ flexShrink:0, width:228, background:C.surface,
                              borderRadius:R.xl, border:`1px solid ${C.bgWarm}`,
                              overflow:"hidden", boxShadow:"0 1px 8px rgba(28,23,18,0.06)",
                              cursor:"default" }}>
                            {hasPhoto && (
                              <div style={{ display:"flex", height:116, overflow:"hidden" }}>
                                {showSplit ? (
                                  <>
                                    <div style={{ flex:1, position:"relative", borderRight:"1.5px solid #fff" }}>
                                      <img src={beforeThumb} alt=""
                                        onClick={() => setHomeReviewViewer({ images:[beforeThumb,afterThumb].filter(Boolean), index:0 })}
                                        style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", cursor:"pointer" }}
                                        onError={e => { e.target.style.display="none"; }} />
                                      <span style={{ position:"absolute", bottom:4, left:4,
                                        background:"rgba(58,95,204,0.82)", color:"#fff",
                                        borderRadius:R.full, padding:"2px 6px", fontSize:9, fontWeight:800,
                                        pointerEvents:"none" }}>
                                        BEFORE
                                      </span>
                                    </div>
                                    <div style={{ flex:1, position:"relative" }}>
                                      <img src={afterThumb} alt=""
                                        onClick={() => setHomeReviewViewer({ images:[beforeThumb,afterThumb].filter(Boolean), index:1 })}
                                        style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", cursor:"pointer" }}
                                        onError={e => { e.target.style.display="none"; }} />
                                      <span style={{ position:"absolute", bottom:4, right:4,
                                        background:"rgba(0,0,0,0.55)", color:"#fff",
                                        borderRadius:R.full, padding:"2px 6px", fontSize:9, fontWeight:800,
                                        pointerEvents:"none" }}>
                                        AFTER
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ flex:1, position:"relative" }}>
                                    <img src={afterThumb ?? beforeThumb} alt=""
                                      onClick={() => setHomeReviewViewer({ images:[afterThumb ?? beforeThumb].filter(Boolean), index:0 })}
                                      style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", cursor:"pointer" }}
                                      onError={e => { e.target.style.display="none"; }} />
                                    <span style={{ position:"absolute", bottom:4, left:4,
                                      background: afterThumb ? "rgba(0,0,0,0.55)" : "rgba(58,95,204,0.82)",
                                      color:"#fff", borderRadius:R.full,
                                      padding:"2px 6px", fontSize:9, fontWeight:800,
                                      pointerEvents:"none" }}>
                                      {afterThumb ? "AFTER" : "BEFORE"}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            <div style={{ padding:"10px 12px 12px" }}>
                              {hasPhoto && (
                                <span style={{ display:"inline-block", background:"#FFF8EC", color:"#8A5C00",
                                  borderRadius:R.full, padding:"2px 7px", fontSize:9, fontWeight:800,
                                  border:"1px solid #F5D97A", marginBottom:6 }}>
                                  📷 포토리뷰
                                </span>
                              )}
                              <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:5 }}>
                                {[1,2,3,4,5].map(s => (
                                  <span key={s} style={{ fontSize:12, color: s <= rv.rating ? C.gold : "#E8E4DC" }}>★</span>
                                ))}
                                <span style={{ fontSize:10, color:C.text4, marginLeft:2 }}>{rv.rating}.0</span>
                              </div>
                              <div style={{ fontSize:12, color:C.text2, lineHeight:1.6, marginBottom:6,
                                overflow:"hidden", display:"-webkit-box",
                                WebkitLineClamp:3, WebkitBoxOrient:"vertical" }}>
                                {rv.content}
                              </div>
                              <div style={{ fontSize:11, color:C.text4, marginBottom:4 }}>
                                {rv.user_name} · {rv.space_type}
                              </div>
                              <div style={{ fontSize:11, fontWeight:700, color:C.text3 }}>
                                🏠 {rv.companyName}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* DEV panel */}
                  {SHOW_DEBUG_UI && (
                    <div style={{ marginBottom:S.md, padding:"8px 10px", background:"#111",
                      color:"#0f0", borderRadius:6, fontSize:10, fontFamily:"monospace", lineHeight:1.8 }}>
                      <span style={{ color:"#ff0", fontWeight:700 }}>── review panel ──</span><br/>
                      real_reviews_count: {topReviews.length}<br/>
                      seed_reviews_count: {seedReviews.length}<br/>
                      rendered_reviews_count: {displayReviews.length}<br/>
                      first_real_review_id: {topReviews[0]?.id ?? "—"}<br/>
                      first_seed_review_id: {seedReviews[0]?.id ?? "—"}<br/>
                      review_fetch_err: {reviewFetchErr ?? "—"}<br/>
                      seed_fetch_err: {seedFetchErr ?? "—"}
                    </div>
                  )}
                </>
              );
            })()}

            <LiveFeed />

            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:S.lg, textAlign:"center" }}>
                공간마켓은 이렇게 작동해요
              </div>
              {[
                { step:"1", icon:"📋", title:"견적 요청", sub:"공사 내용 입력하면\n인근 검증 업체에 자동 전달" },
                { step:"2", icon:"💰", title:"입찰 비교", sub:"업체들이 금액·기간 제출\n공간온도 보고 비교 선택" },
                { step:"3", icon:"🛡", title:"안전 결제", sub:"고객 돈은 공간마켓 보관\n단계 확인 후 업체에 지급" },
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
              // 완료/정산완료(에스크로 기준)는 active 에서 제외 → 견적 이력으로.
              const isSettled = (r) => isRequestSettled(r, myRequestsEscrow[r.id] ?? null);
              const activeReqs  = myRequests.filter(r => (r.isActive || r.status === "in_progress") && !isSettled(r));
              const historyReqs = myRequests.filter(r => r.isClosed || r.status === "completed" || isSettled(r));
              if (SHOW_DEBUG_UI) {
                myRequests.forEach(r => {
                  const ed = myRequestsEscrow[r.id] ?? null;
                  const settled = isSettled(r);
                  const included = (r.isActive || r.status === "in_progress") && !settled;
                  // eslint-disable-next-line no-console
                  console.log("[ActiveRequestFilter]", {
                    request_id: r.id,
                    contract_id: ed?.escrow?.id ?? null,
                    request_status: r.status,
                    contract_status: ed?.escrow?.transaction_status ?? null,
                    escrow_status: ed?.escrow?.transaction_status ?? null,
                    customer_stage: computeCustomerStage(r, ed)?.badge ?? null,
                    included_in_active: included,
                    reason: settled ? "settled→history" : (r.isActive || r.status === "in_progress") ? "active" : "closed/other",
                  });
                });
              }
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
                        if (SHOW_DEBUG_UI) {
                          // eslint-disable-next-line no-console
                          console.log("[ContractMapping]", {
                            screen: "consumer_home", role: activeRole,
                            request_id: r.id, contract_id: escrowData?.escrow?.id ?? null,
                            bid_id: null, company_id: escrowData?.escrow?.company_id ?? null,
                            consumer_id: user?.id ?? null, title: r.type, region: r.area, amount: r.budget,
                            request_status: r.status, contract_status: escrowData?.escrow?.transaction_status ?? null,
                            escrow_status: escrowData?.escrow?.transaction_status ?? null, source: "myRequestsEscrow[r.id]",
                          });
                        }
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
                                  disabled={hidingId === r.id}
                                  onClick={async () => {
                                    setHidingId(r.id);
                                    const log = { hide_click: r.id.slice(0, 8), hide_db_ok: false, hide_local_ok: false, hide_err: null };
                                    try {
                                      const { data, error } = await archiveRequest(r.id);
                                      if (error) {
                                        log.hide_err = error.message;
                                        setHideDebug(log);
                                        setToast("숨기기에 실패했습니다");
                                        setTimeout(() => setToast(null), 3000);
                                        return;
                                      }
                                      if (!data) {
                                        log.hide_err = "0 rows updated — RLS or missing row";
                                        setHideDebug(log);
                                        setToast("숨기기에 실패했습니다");
                                        setTimeout(() => setToast(null), 3000);
                                        return;
                                      }
                                      log.hide_db_ok = true;
                                      setMyRequests(prev => prev.filter(x => x.id !== r.id));
                                      log.hide_local_ok = true;
                                      setHideDebug(log);
                                      setToast("요청이 숨겨졌습니다");
                                      setTimeout(() => setToast(null), 3000);
                                    } catch (e) {
                                      log.hide_err = e?.message ?? "unknown";
                                      setHideDebug(log);
                                      setToast("숨기기에 실패했습니다");
                                      setTimeout(() => setToast(null), 3000);
                                    } finally {
                                      setHidingId(null);
                                    }
                                  }}
                                  style={{ flex:1, padding:"10px", background:hidingId === r.id ? C.bgWarm : C.surface,
                                    color:C.text4, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
                                    fontWeight:700, fontSize:13, cursor: hidingId === r.id ? "not-allowed" : "pointer",
                                    opacity: hidingId === r.id ? 0.6 : 1 }}>
                                  {hidingId === r.id ? "숨기는 중..." : "숨기기"}
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

            {SHOW_DEBUG_UI && (
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
                {hideDebug && (
                  <>
                    <span style={{color:"#ff0"}}>── 숨기기 결과 ──</span><br/>
                    <span style={{color:"#4ff"}}>hide_click: {hideDebug.hide_click}</span><br/>
                    <span style={{color: hideDebug.hide_db_ok ? "#0f0" : "#f66"}}>
                      hide_db_ok: {String(hideDebug.hide_db_ok)}
                    </span><br/>
                    <span style={{color: hideDebug.hide_local_ok ? "#0f0" : "#f66"}}>
                      hide_local_ok: {String(hideDebug.hide_local_ok)}
                    </span><br/>
                    {hideDebug.hide_err && (
                      <span style={{color:"#f66"}}>hide_err: {hideDebug.hide_err}<br/></span>
                    )}
                  </>
                )}
              </div>
            )}

            {(() => {
              const totalJobs = companies.reduce((s, c) => s + (c.completedJobs ?? 0), 0);
              const avgTemp = companies.length > 0
                ? Math.round(companies.reduce((s, c) => s + (c.temp ?? 36.5), 0) / companies.length)
                : 36.5;
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
                style={{ width:"100%", padding:"13px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer", boxShadow:`0 4px 14px ${C.brand}33` }}>
                라운지 들어가기
              </button>
            </div>

            {/* 공간사이 브랜드 무드 카드 */}
            <div style={{ display:"flex", gap:S.sm, marginTop:S.xl, marginBottom:S.sm, overflowX:"auto", paddingBottom:4, scrollbarWidth:"none" }}>
              {[
                { bg:C.brandD, color:"rgba(255,255,255,0.92)", text:"자연의 숨결,\n감사의 마음으로\n공간을 함께\n만들어갑니다." },
                { bg:"#DFABC6", color:"#6B3355", text:"오늘도,\n함께 웃는\n하루 되세요! ☺" },
                { bg:"#686E57", color:"rgba(255,255,255,0.9)", text:"공간을 넘어\n가치 있는 경험을\n전합니다." },
              ].map((card, i) => (
                <div key={i} style={{ flexShrink:0, width:150, background:card.bg, borderRadius:R.xl,
                  padding:`${S.xl}px ${S.lg}px`, minHeight:110,
                  display:"flex", alignItems:"flex-end", position:"relative", overflow:"hidden" }}>
                  {i===0 && <LeafSprig size={62} color="#fff" opacity={0.18} style={{ position:"absolute", right:-8, top:2, transform:"rotate(15deg)" }} />}
                  {i===1 && (
                    <svg width={58} height={58} viewBox="0 0 100 100" fill="none"
                      style={{ position:"absolute", right:-6, top:2, opacity:0.18, pointerEvents:"none" }} aria-hidden="true">
                      <circle cx="50" cy="50" r="44" stroke="#6B3355" strokeWidth="6" />
                      <circle cx="36" cy="43" r="6" fill="#6B3355" />
                      <circle cx="64" cy="43" r="6" fill="#6B3355" />
                      <path d="M32 62 Q50 76 68 62" stroke="#6B3355" strokeWidth="5.5" strokeLinecap="round" />
                    </svg>
                  )}
                  {i===2 && (
                    <svg width={58} height={58} viewBox="0 0 100 100" fill="none"
                      style={{ position:"absolute", right:-6, top:2, opacity:0.18, pointerEvents:"none" }} aria-hidden="true">
                      <polygon points="50,8 94,50 80,50 80,92 58,92 58,68 42,68 42,92 20,92 20,50 6,50" fill="#fff" />
                    </svg>
                  )}
                  <div style={{ fontSize:12, color:card.color, lineHeight:1.65, whiteSpace:"pre-line", fontWeight:500 }}>
                    {card.text}
                  </div>
                </div>
              ))}
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
            <div style={{ position:"relative", background:`linear-gradient(135deg,${C.brand},${C.brandD})`,
              borderRadius:R.xl, padding:S.xxl, marginBottom:S.xl, color:"#fff", overflow:"hidden" }}>
              <LeafSprig size={130} color="#fff" opacity={0.08}
                style={{ position:"absolute", right:-16, bottom:-28, transform:"rotate(-12deg)" }} />
              <div style={{ position:"relative", display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.xl }}>
                <div>
                  <div style={{ fontSize:10, opacity:0.7, marginBottom:5, letterSpacing:"0.2px" }}>
                    안녕하세요, 공간사이 파트너님
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, marginBottom:4 }}>{user.name}</div>
                  <div style={{ fontSize:11, opacity:0.65, marginBottom:8 }}>오늘도 공간을 빛내주셔서 감사합니다</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <TempBadge temp={currentUser?.temp ?? 36.5} lg />
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

            {activeJobs.length > 0 && (
              <div style={{ marginBottom:S.xl }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>🔨 진행중 작업 ({activeJobs.length})</div>
                {activeJobs.map((job) => (
                  <CompanyActiveJobCard
                    key={job.bid.id}
                    job={job}
                    onAction={(actionType, j) => {
                      if (actionType === "schedule" || actionType === "checkin" || actionType === "field_estimate") {
                        setSiteVisitJob(j);
                      } else if (actionType === "platform_estimate") {
                        setEstimateJob(j);
                      } else if (actionType === "escrow") {
                        go("escrow");
                      }
                    }}
                  />
                ))}
              </div>
            )}

            <LiveFeed />

            {activeJobs.length > 0 && (
              <div style={{ marginBottom:S.xl }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>🔨 진행중 작업 ({activeJobs.length})</div>
                {activeJobs.map((job) => (
                  <CompanyActiveJobCard
                    key={job.bid.id}
                    job={job}
                    onAction={(actionType, j) => {
                      if (actionType === "schedule" || actionType === "checkin" || actionType === "field_estimate") {
                        setSiteVisitJob(j);
                      } else if (actionType === "platform_estimate") {
                        setEstimateJob(j);
                      } else if (actionType === "escrow") {
                        go("escrow");
                      }
                    }}
                  />
                ))}
              </div>
            )}

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
                        {bid.price ? `${Math.round(Number(bid.price)).toLocaleString()}만원` : "금액 미정"}
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
                <div style={{ fontSize:15, fontWeight:700, color:C.text1, marginBottom:6 }}>아직 새 요청이 없어요 🏠</div>
                <div style={{ fontSize:13, color:C.text3, lineHeight:1.6 }}>
                  의뢰인이 요청을 등록하면 이곳에 표시됩니다
                  {SHOW_DEBUG_UI && <><br/>{`(db_rows: ${reqDebug?.companyRows ?? "?"}, fetch_err: ${reqDebug?.companyFetchError ?? "none"})`}</>}
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

            {SHOW_DEBUG_UI && (
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
                <span style={{color:"#ff0"}}>── companyJobs fetch ──</span><br/>
                <span style={{color:"#4ff"}}>auth: {companyJobsDebug?.auth_user_id ?? "?"} cu: {companyJobsDebug?.currentUser_id ?? "?"} owner: {companyJobsDebug?.company_owner_id ?? "?"}</span><br/>
                candidateIds: [{companyJobsDebug?.candidateIds ?? "?"}]<br/>
                <span style={{color: (companyJobsDebug?.raw_bids ?? 0) > 0 ? "#0f0" : "#f66"}}>
                  raw_bids: {companyJobsDebug?.raw_bids ?? "?"} | selected: {companyJobsDebug?.selected_count ?? "?"} | matched(req_id≠null): {companyJobsDebug?.matched_bids ?? "?"}
                </span><br/>
                request_ids: [{companyJobsDebug?.request_ids ?? "?"}]<br/>
                <span style={{color: (companyJobsDebug?.request_count ?? 0) > 0 ? "#0f0" : "#f88"}}>
                  request_count: {companyJobsDebug?.request_count ?? "?"} | statuses: {companyJobsDebug?.statuses ?? "?"}
                </span><br/>
                contract_count: {companyJobsDebug?.contract_count ?? "?"} | escrow_count: {companyJobsDebug?.escrow_count ?? "?"}<br/>
                <span style={{color: (companyJobsDebug?.displayed_jobs ?? 0) > 0 ? "#0f0" : "#f88"}}>
                  displayed_jobs: {companyJobsDebug?.displayed_jobs ?? "?"}
                </span><br/>
                <span style={{color: companyJobsDebug?.bid_err !== "none" ? "#f66" : "#888"}}>bid_err: {companyJobsDebug?.bid_err ?? "?"}</span> | <span style={{color: companyJobsDebug?.req_err !== "none" ? "#f66" : "#888"}}>req_err: {companyJobsDebug?.req_err ?? "?"}</span><br/>
                {companyJobsDebug?.caught_err && <span style={{color:"#f66"}}>caught: {companyJobsDebug.caught_err}<br/></span>}
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
            {/* 활동지역 선택 바 — 지도에서 직접 설정 (당근 방식) */}
            <RegionSelectorBar
              regions={activityRegions}
              activeKey={activeRegion ? regionKey(activeRegion.city, activeRegion.district) : null}
              onSelect={onSelectRegionTab}
              onAdd={() => setRegionSheetOpen(true)}
            />
            {/* ── 지역 매칭 진단 badge (개발 환경에서만 — production 미노출) ── */}
            {SHOW_DEBUG_UI && (
              <div style={{
                background:"rgba(0,0,0,0.85)", color:"#4AFF91", borderRadius:8,
                padding:"6px 10px", marginBottom:8, fontSize:10, fontFamily:"monospace",
                lineHeight:1.7, wordBreak:"break-all",
              }}>
                <span style={{ color:"#FFD700", fontWeight:700 }}>[region_debug] </span>
                customer: {(activityRegions?.length || (user?.region ? 1 : 0)) ? "ok" : "empty"}
                {" · "}company: {mapCompanies.length ? (mapFallbackTier === "exact" || mapFallbackTier === "legacy" ? "ok" : "fallback") : "empty"}
                {" · "}tier: {mapFallbackTier}
                {mapFallbackReason && <span style={{ color:"#FF6B6B" }}>{" · "}reason: {mapFallbackReason}</span>}
              </div>
            )}
            <div style={{ marginBottom:S.xl }}>
              <KakaoMap
                companies={mapLocalOnly ? mapLocalMatches : mapCompanies}
                userRegion={(activeRegion ? regionKey(activeRegion.city, activeRegion.district) : user.region) ?? ""}
                selectedId={mapSelectedId}
                center={mapCenter}
                onRequestLocation={onRequestMapLocation}
                gpsLoading={gpsLoading}
                onPinClick={c => {
                  setMapSelectedId(c.id);
                  const el = mapCardRefs.current[c.id];
                  if (el) el.scrollIntoView({ behavior:"smooth", block:"center" });
                }}
              />
            </div>

            {/* ── 초기 런칭 fallback 배너 (tier city/all) ── */}
            {mapIsFallback && (
              <div style={{ background:"#FFF8F0", border:`1px solid ${C.brandM}`, borderRadius:R.lg,
                padding:"10px 14px", marginBottom:S.md, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                <div style={{ fontSize:12, color:C.text2, lineHeight:1.55 }}>
                  📍 아직 이 지역 등록 업체가 적어,{" "}
                  {mapFallbackTier === "city" ? "같은 시/도" : "전국"} 업체도 함께 보여드려요
                </div>
                <button onClick={() => setMapLocalOnly(v => !v)}
                  style={{ flexShrink:0, padding:"5px 10px", borderRadius:R.full, border:`1px solid ${C.brand}`,
                    background: mapLocalOnly ? C.brand : "transparent", color: mapLocalOnly ? "#fff" : C.brand,
                    fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                  {mapLocalOnly ? "전체 보기" : "내 지역만"}
                </button>
              </div>
            )}

            {/* 업체 수 헤더 */}
            {(() => {
              const list = mapLocalOnly ? mapLocalMatches : mapCompanies;
              return (
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>
                  인근 업체 <span style={{ color:C.brand }}>{list.length}곳</span>
                  {mapIsFallback && !mapLocalOnly && mapFallbackTier === "city" &&
                    <span style={{ fontSize:11, color:C.text3, fontWeight:500, marginLeft:6 }}>시/도 확장</span>}
                  {mapIsFallback && !mapLocalOnly && mapFallbackTier === "all" &&
                    <span style={{ fontSize:11, color:C.text3, fontWeight:500, marginLeft:6 }}>전국 기준</span>}
                </div>
              );
            })()}

            {/* 업체 카드 목록 */}
            {(mapLocalOnly ? mapLocalMatches : mapCompanies).map(c => (
              <div key={c.id} ref={el => { mapCardRefs.current[c.id] = el; }}
                onMouseEnter={() => setMapSelectedId(c.id)}
                style={{ borderRadius:R.xl,
                  outline: mapSelectedId===c.id ? `2px solid ${C.brand}` : "2px solid transparent",
                  outlineOffset: 2, transition:"outline-color 0.2s", marginBottom:S.sm }}>
                {/* 지역 확장 배지 — fallback 업체에만 */}
                {mapIsFallback && !mapLocalOnly && (
                  <div style={{ marginBottom:3, paddingLeft:2 }}>
                    <span style={{ display:"inline-block", background:"#FFF3E0", border:"1px solid #FFCC80",
                      borderRadius:R.full, padding:"2px 8px", fontSize:10, color:"#E65100", fontWeight:700 }}>
                      {mapFallbackTier === "city" ? "📌 지역 확장" : "📌 추천"}
                    </span>
                  </div>
                )}
                <CompanyCard company={c} isLoggedIn={!!user?.id} onClick={() => go("portfolio",c)} />
              </div>
            ))}

            {/* 내 지역만 보기 + 결과 0건 empty state */}
            {mapLocalOnly && mapLocalMatches.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 0", color:C.text3 }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.text2, marginBottom:6 }}>이 지역 등록 업체가 아직 없어요</div>
                <div style={{ fontSize:12, lineHeight:1.6 }}>
                  활동지역을 변경하거나<br />"전체 보기"로 인근 업체를 확인해보세요
                </div>
                <button onClick={() => setMapLocalOnly(false)}
                  style={{ marginTop:16, padding:"10px 20px", background:C.brand, color:"#fff",
                    border:"none", borderRadius:R.full, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  전체 보기
                </button>
              </div>
            )}

            <RegionSelectSheet
              open={regionSheetOpen}
              onClose={() => setRegionSheetOpen(false)}
              selectedRegions={activityRegions}
              maxCount={2}
              onSave={onSaveRegions}
            />
          </div>
        )}

        {screen==="portfolio" && selCo && <PortfolioScreen company={selCo} onChat={c => isGuestCompany ? setShowRegisterPrompt(true) : go("chat",c)} onReview={() => go("review",selCo)} onBack={() => setScreen("home")} onEscrow={() => go("escrow")} />}
        {screen==="review" && selCo && <ReviewScreen company={selCo} onBack={() => setScreen("portfolio")} currentUser={currentUser} requestId={bidViewRequestId ?? null} contractId={contractId ?? null} onEarnToken={earnToken} />}
        {screen==="chat" && selCo && <ChatScreen company={selCo} user={user} onBack={() => setScreen(prevScreen==="chatlist"?"chatlist":"portfolio")} />}
        {screen==="escrow" && <EscrowScreen onBack={() => { setEscrowRefreshTrigger(t => t+1); setScreen(prevScreen||"home"); }} activeRole={activeRole} selectedBid={selectedBid} currentUser={currentUser} contractId={contractId} userId={user?.id ?? null} request={[...myRequests, ...customerRequests].find(r => r.id === bidViewRequestId) ?? null} onReview={(co) => { if (co) setSelCo(co); setScreen("review"); }} />}
        {screen==="dashboard" && <DashboardScreen onBack={() => setScreen("home")} onEscrow={() => go("escrow")} onOpenJob={(bid) => { if (bid) { setSelectedBid(bid); setBidViewRequestId(bid.requestId); } go("escrow"); }} companyJobs={companyJobs} companyJobsDebug={companyJobsDebug} allRequests={customerRequests} currentUser={currentUser} submittedBids={submittedBids} userId={user?.id} />}
        {screen==="bidstatus" && (
          <BidStatusScreen
            onBack={() => setScreen("home")}
            onChat={c => go("chat",c)}
            onEscrow={(bid) => { setSelectedBid(bid); if (bid?.contractId) setContractId(bid.contractId); go("escrow"); }}
            onReview={(co) => { if (co) setSelCo(co); setScreen("review"); }}
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
            onWrite={() => requireAuth(() => {
              if (!hasConsented(user?.id, LOUNGE_CONSENT_TYPES)) {
                setConsentGateConfig({ types: LOUNGE_CONSENT_TYPES, title: "라운지 이용 전 약관 동의", onComplete: () => { setConsentGateConfig(null); go("lounge-write"); } });
                return;
              }
              go("lounge-write");
            })}
            onStoryUpload={() => requireAuth(() => {
              if (!hasConsented(user?.id, LOUNGE_CONSENT_TYPES)) {
                setConsentGateConfig({ types: LOUNGE_CONSENT_TYPES, title: "라운지 이용 전 약관 동의", onComplete: () => { setConsentGateConfig(null); go("lounge-story"); } });
                return;
              }
              go("lounge-story");
            })}
            onRequireLogin={() => setShowLoginRequired(true)}
            onGoMyPage={() => setScreen("my")}
            onDeleteStory={(id) => setLocalLoungeStories(prev => prev.filter(s => s.id !== id))}
            refreshKey={loungeRefreshKey}
          />
        )}

        {screen==="lounge-write" && (
          <LoungeWriteScreen
            user={user}
            onBack={() => setScreen("lounge")}
            onPublish={(post) => {
              setLocalLoungePosts(prev => [post, ...prev.filter(p => p.id !== post.id)]);
              showToast("✅ 글이 등록됐어요!");
              earnToken("first_post");
              setScreen("lounge");
            }}
          />
        )}

        {screen==="lounge-edit" && editingLoungePost && (
          <LoungeWriteScreen
            user={user}
            editPost={editingLoungePost}
            onBack={() => { setEditingLoungePost(null); setScreen(editOriginScreen); }}
            onPublish={(updated) => {
              setLocalLoungePosts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
              if (loungePost?.id === updated.id) setLoungePost(prev => ({ ...prev, ...updated }));
              setEditingLoungePost(null);
              showToast("✅ 글이 수정됐어요!");
              if (editOriginScreen === 'my') setMyPostsRefreshKey(k => k + 1);
              setLoungeRefreshKey(k => k + 1);
              setScreen(editOriginScreen);
            }}
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
            onEditPost={(post) => { setEditingLoungePost(post); setEditOriginScreen('lounge-detail'); go("lounge-edit"); }}
            onDeletePost={(id) => {
              setLocalLoungePosts(prev => prev.filter(p => p.id !== id));
              setLoungePost(null);
              setLoungeRefreshKey(k => k + 1);
            }}
          />
        )}

        {screen==="lounge-story" && (
          <LoungeStoryUploadScreen
            user={user}
            onBack={() => setScreen("lounge")}
            onPublish={(story) => {
              if (story) setLocalLoungeStories(prev => [story, ...prev]);
              showToast("📸 스토리가 공유됐어요! (24시간)");
              earnToken("first_story");
              setScreen("lounge");
            }}
          />
        )}

        {screen==="token-store" && (
          <TokenStoreScreen
            user={user}
            balance={tokenBalance}
            logs={tokenLogs}
            missionStats={tokenMissionStats}
            onBack={() => setScreen(prevScreen || "my")}
            onEarnToken={async (action) => earnToken(action)}
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
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:S.xl }}>
              <LogoMark size={34} />
              <div>
                <div style={{ fontSize:11, color:C.brand, marginBottom:2, letterSpacing:"0.3px", fontWeight:600 }}>공간사이</div>
                <div style={{ fontSize:20, fontWeight:800, color:C.text1, letterSpacing:"-0.4px" }}>대화</div>
                <div style={{ fontSize:12, color:C.text3, marginTop:3, lineHeight:1.6 }}>파트너와 나눈 이야기</div>
              </div>
            </div>
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
              const { escrow: esc } = escData ?? {};
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
                if (r.status === "in_progress") return "실측 방문 3일 내 · 견적서 24시간 내 등록";
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
                          {step.escrowStep && r.status === "in_progress" && !hasEscrow && (
                            <div style={{ marginTop:S.sm, background:C.brandL, borderRadius:R.md, padding:"8px 12px", fontSize:11, color:C.brand }}>
                              💬 상세 견적서는 실측 후 24시간 내 플랫폼에 등록됩니다
                            </div>
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
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:S.xl }}>
              <LogoMark size={34} />
              <div>
                <div style={{ fontSize:11, color:C.brand, marginBottom:2, letterSpacing:"0.3px", fontWeight:600 }}>공간사이</div>
                <div style={{ fontSize:20, fontWeight:800, color:C.text1, letterSpacing:"-0.4px" }}>관심</div>
                <div style={{ fontSize:12, color:C.text3, marginTop:3, lineHeight:1.6 }}>마음이 머문 공간과 이야기를 모았어요</div>
              </div>
            </div>

            {/* 4탭 */}
            <div style={{ display:"flex", background:C.bg, borderRadius:R.xl, padding:4, marginBottom:S.xl, gap:2,
              border:`1px solid ${C.bgWarm}` }}>
              {[["받은 ♥","received"],["보낸 ♥","sent"],["스토리","stories"],["저장","saved"]].map(([label,id]) => (
                <button key={id} onClick={() => setFavTab(id)} style={{ flex:1, padding:"9px 2px", border:"none",
                  borderRadius:R.lg, background:favTab===id?C.ivory:"transparent",
                  color:favTab===id?C.brand:C.text3, fontWeight:favTab===id?700:500, fontSize:12,
                  cursor:"pointer", transition:"all 0.18s",
                  boxShadow:favTab===id?"0 2px 8px rgba(46,95,75,0.10)":"none",
                  whiteSpace:"nowrap" }}>
                  {label}
                </button>
              ))}
            </div>

            {favTab === "received" && (
              <FavEmptyState
                title="아직 받은 마음이 없어요"
                desc={"내 이야기에 마음을 받으면\n여기 조용히 모여요"}
                onGo={() => setScreen("lounge")}
              />
            )}

            {favTab === "sent" && (
              <FavEmptyState
                title="아직 담아둔 이야기가 없어요"
                desc={"마음이 가는 글에 ♥를 누르면\n여기서 다시 볼 수 있어요"}
                onGo={() => setScreen("lounge")}
              />
            )}

            {favTab === "stories" && (
              <FavEmptyState
                title="담아둔 스토리가 없어요"
                desc={"스토리에 마음을 누르면\n24시간 동안 여기 머물러요"}
                onGo={() => setScreen("lounge")}
              />
            )}

            {favTab === "saved" && (
              <FavEmptyState
                title="저장한 공간이 없어요"
                desc={"다시 보고 싶은 글을 저장하면\n조용한 갤러리처럼 모여요"}
                onGo={() => setScreen("lounge")}
              />
            )}
          </div>
        )}

        {screen==="my" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:S.xl }}>
              <LogoMark size={34} />
              <div>
                <div style={{ fontSize:11, color:C.brand, marginBottom:2, letterSpacing:"0.3px", fontWeight:600 }}>공간사이</div>
                <div style={{ fontSize:20, fontWeight:800, color:C.text1, letterSpacing:"-0.4px" }}>마이페이지</div>
                <div style={{ fontSize:12, color:C.text3, marginTop:3, lineHeight:1.6 }}>나의 공간 여정을 한눈에</div>
              </div>
            </div>
            {/* 신뢰 여권 카드 */}
            <div style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
              {/* 여권 헤더 띠 */}
              <div style={{ position:"relative", background:`linear-gradient(135deg,${C.brand},${C.brandD})`,
                padding:`${S.md}px ${S.xl}px`, display:"flex", justifyContent:"space-between", alignItems:"center", overflow:"hidden" }}>
                <LeafSprig size={70} color="#fff" opacity={0.1}
                  style={{ position:"absolute", right:60, top:-14, transform:"rotate(8deg)" }} />
                <div style={{ position:"relative", display:"flex", alignItems:"center", gap:7 }}>
                  <LogoMark size={20} />
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.9)", fontWeight:600, letterSpacing:"0.5px" }}>
                    공간사이 신뢰 기록
                  </span>
                </div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.65)" }}>
                  {activeRole==="consumer"?"공간사이 회원":"공간사이 파트너"}
                </div>
              </div>

              <div style={{ padding:S.xxl, textAlign:"center" }}>
                <div style={{ width:72, height:72, borderRadius:R.full, background:C.brandL,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:28, fontWeight:800, color:C.brand, margin:"0 auto 14px" }}>{user.name?.[0] ?? "?"}</div>
                <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>{user.name}</div>
                <div style={{ fontSize:13, color:C.text3, marginBottom:S.md }}>{user.region} · {activeRole==="consumer"?"의뢰인":"검증 업체"}</div>
                {activeRole === "consumer" && (() => {
                  const grade = calcCustomerGrade(user.completedJobs ?? 0);
                  return (
                    <div style={{ display:"inline-flex", alignItems:"center", gap:6,
                      background:C.brandL, borderRadius:R.full, padding:"4px 12px",
                      border:`1px solid ${C.brandM}`, marginBottom:S.xl }}>
                      <span style={{ fontSize:16 }}>{grade.icon}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:C.brand }}>{grade.label}</span>
                    </div>
                  );
                })()}
                <div style={{ display:"flex", gap:0, marginBottom:S.xl, borderTop:`1px solid ${C.bgWarm}`, paddingTop:S.xl }}>
                  {(activeRole==="consumer"
                    ? [[`${myRequests.length}`,"견적 요청"],["0","진행중"],["0","완료"]]
                    : [[" 3","낙찰"],["84","후기"],[`${currentUser?.temp ?? 36.5}°`,"공간온도"]]
                  ).map(([v,l],i,arr) => (
                    <div key={l} style={{ flex:1, borderRight:i<arr.length-1?`1px solid ${C.bgWarm}`:"none" }}>
                      <div style={{ fontSize:22, fontWeight:800, color:C.brand }}>{v}</div>
                      <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:11, color:C.text4, marginBottom:S.lg }}>
                  사람과 공간 사이, 신뢰가 쌓이는 기록
                </div>
                <button onClick={onLogout} style={{ background:C.bg, color:C.text2,
                  border:`1px solid ${C.bgWarm}`, borderRadius:R.full,
                  padding:"11px 28px", fontWeight:600, fontSize:14, cursor:"pointer" }}>로그아웃</button>
              </div>
            </div>

            {activeRole === "company" && user.isEarlyPartner && user.earlyPartnerBenefitUntil && (
              <div style={{ background: C.brandL, borderRadius: R.xl, padding: S.xl, marginTop: S.lg, border: `1px solid ${C.brandM}` }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginBottom: 4 }}>🏆 초기 파트너 혜택 중</div>
                <div style={{ fontSize: 12, color: C.text3 }}>
                  혜택 만료일: {new Date(user.earlyPartnerBenefitUntil).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
            )}

            {/* 도움말 — 에스크로/분쟁/환불 안내 (고객센터) */}
            <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>도움말 · 고객센터</div>
              {[
                { q: "에스크로 결제란 무엇인가요?",
                  a: "공사비를 공간마켓이 안전하게 보관하고, 착공·중간·완료 단계를 확인할 때마다 업체에 나눠 지급하는 안전결제 방식입니다. 고객은 단계별로 직접 승인합니다." },
                { q: "시공에 문제가 생기면 어떻게 하나요?",
                  a: "각 단계 승인 화면에서 ‘이의 제기’로 보류할 수 있어요. 사진·대화·계약 기록이 모두 저장되며, 분쟁 시 관리자가 검토해 중재합니다." },
                { q: "환불은 어떻게 받나요?",
                  a: "아직 지급되지 않은 예치금은 환불 대상입니다. 단계 미승인 상태의 잔여 금액은 관리자 검토 후 결제 수단으로 환불됩니다." },
                { q: "고객센터 연락처",
                  a: "문의하기(아래 ‘문의하기’) 또는 이메일 help@gonggan.market 으로 연락주시면 순차적으로 도와드립니다." },
              ].map(({ q, a }) => (
                <details key={q} style={{ borderBottom: `1px solid ${C.bg}`, padding: `${S.sm}px 0` }}>
                  <summary style={{ fontSize: 14, color: C.text2, cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>❔ {q}</span><span style={{ fontSize: 16, color: C.text3 }}>›</span>
                  </summary>
                  <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.7, marginTop: S.sm, paddingLeft: 2 }}>{a}</div>
                </details>
              ))}
            </div>

            {/* 앱 정보 / 약관 */}
            <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>앱 정보</div>
              {[
                { label: "이용약관",                icon: "📄", docType: "service_terms" },
                { label: "개인정보처리방침",         icon: "🔒", docType: "privacy_policy" },
                { label: "위치기반서비스 이용약관",   icon: "📍", docType: "location_terms" },
                { label: "고객 거래 유의사항",        icon: "📋", docType: "customer_transaction_notice" },
                ...(activeRole === "company" ? [{ label: "업체 운영 준수서약", icon: "📝", docType: "operation_pledge" }] : []),
                { label: "문의하기",                icon: "💌", docType: null },
              ].map(({ label, icon, docType }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${S.md}px 0`, borderBottom: `1px solid ${C.bg}`, cursor: "pointer" }}
                  onClick={() => docType ? setTermsDocType(docType) : showToast("준비 중입니다")}>
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
                공간마켓 v1.0.0
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

                {/* Phase C: 영업지역 관리 (최대 2곳) */}
                <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginTop:S.md, border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
                    <span style={{ fontSize:14, color:C.text1, fontWeight:800 }}>📍 영업지역</span>
                    <span style={{ fontSize:11, color:C.text3 }}>최대 2곳</span>
                  </div>
                  {companyServiceRegions.length > 0 ? (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:S.md }}>
                      {companyServiceRegions.map((r, i) => (
                        <span key={regionKey(r.city, r.district) || i}
                          style={{ display:"inline-flex", alignItems:"center", gap:4, background:C.brandL, color:C.brand,
                            borderRadius:R.full, padding:"5px 12px", fontSize:12, fontWeight:800, border:`1px solid ${C.brandM}` }}>
                          📍 {regionKey(r.city, r.district)}{r.is_primary ? " · 기본" : ""}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize:12, color:C.text3, marginBottom:S.md }}>
                      아직 영업지역이 설정되지 않았어요. 영업지역을 설정하면 해당 지역 고객에게 우선 노출돼요.
                    </div>
                  )}
                  <button onClick={() => setCompanyRegionSheetOpen(true)}
                    style={{ width:"100%", padding:"11px 0", borderRadius:R.lg, cursor:"pointer",
                      border:`1.5px dashed ${C.brandM}`, background:C.brandL, color:C.brand, fontSize:13, fontWeight:800 }}>
                    {companyServiceRegions.length ? "✏️ 영업지역 수정" : "+ 영업지역 설정"}
                  </button>
                  {/* DEV 전용 — 테스트 업체 영업지역 즉시 주입(강서구·영등포구) → RegionRefetch + region_debug 재검증용 */}
                  {SHOW_DEBUG_UI && currentUser?.id && (
                    <button onClick={() => onSaveServiceRegions([
                        makeRegionEntry("서울", "강서구", true),
                        makeRegionEntry("서울", "영등포구", false),
                      ])}
                      style={{ width:"100%", marginTop:8, padding:"10px 0", borderRadius:R.lg, cursor:"pointer",
                        border:`1px solid ${C.bgWarm}`, background:"#1a1a1a", color:"#4AFF91",
                        fontSize:12, fontWeight:700, fontFamily:"monospace" }}>
                      🧪 DEV 주입: 강서구 · 영등포구 (company_id={currentUser.id})
                    </button>
                  )}
                </div>

                <RegionSelectSheet
                  open={companyRegionSheetOpen}
                  onClose={() => setCompanyRegionSheetOpen(false)}
                  selectedRegions={companyServiceRegions}
                  maxCount={2}
                  title="영업지역 설정"
                  subtitle="영업하실 지역을 최대 2곳까지 설정할 수 있어요"
                  onSave={onSaveServiceRegions}
                />
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

            {activeRole === "consumer" && (() => {
              const statusColor = idVerified ? C.green : idStatus === "required" ? C.gold : C.text4;
              const statusLabel = idVerified ? "인증 완료" : idStatus === "required" ? "인증 필요" : "미인증";
              const statusIcon  = idVerified ? "✓" : idStatus === "required" ? "⚠️" : "—";
              return (
                <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
                  marginBottom: S.lg, border: `1px solid ${idStatus === "required" ? C.gold + "66" : C.bgWarm}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>🔐 본인인증</div>
                      <div style={{ fontSize: 11, color: statusColor, fontWeight: 700, marginTop: 3 }}>
                        {statusIcon} {statusLabel}
                        {idVerified && idVerifiedAt && (
                          <span style={{ fontWeight: 400, color: C.text4, marginLeft: 6 }}>
                            {new Date(idVerifiedAt).toLocaleDateString("ko-KR")}
                          </span>
                        )}
                      </div>
                      {!idVerified && (
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 4, lineHeight: 1.5 }}>
                          {idStatus === "required"
                            ? "인증이 필요한 서비스입니다. 아래 버튼을 눌러 인증을 완료해주세요."
                            : "본인인증으로 더 안전한 거래를 시작하세요."}
                        </div>
                      )}
                    </div>
                    {!idVerified && (
                      <button onClick={handleMockIdVerify} disabled={idVerifying}
                        style={{ padding: "8px 14px", background: idVerifying ? C.bgWarm : C.brand,
                          color: idVerifying ? C.text3 : "#fff", border: "none", borderRadius: R.full,
                          fontWeight: 700, fontSize: 12, cursor: idVerifying ? "not-allowed" : "pointer",
                          flexShrink: 0, marginLeft: S.md }}>
                        {idVerifying ? "처리중…" : "본인인증하기"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            <LoungeMyPageSection
              user={user}
              temperature={temperature}
              balance={tokenBalance}
              tokenLogs={tokenLogs}
              myPosts={localLoungePosts}
              refreshKey={myPostsRefreshKey}
              onNavigate={(target) => {
                if (target === "token-store")        { requireAuth(() => go("token-store")); }
                else if (target === "token-history") { requireAuth(() => go("token-history")); }
              }}
              onEditPost={(post) => {
                setEditingLoungePost(post);
                setEditOriginScreen('my');
                go("lounge-edit");
              }}
              onDeletePost={(id) => {
                setLocalLoungePosts(prev => prev.filter(p => p.id !== id));
                if (loungePost?.id === id) setLoungePost(null);
              }}
            />

            {activeRole==="consumer" && (
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>내 견적 이력</div>
                {myRequests.length === 0 ? (
                  <div style={{ background:C.ivory, borderRadius:R.xl, padding:"40px 20px",
                    textAlign:"center", border:`1px solid ${C.bgWarm}`, boxShadow:SHADOW.soft }}>
                    <div style={{ width:56, height:56, borderRadius:R.full,
                      background:`linear-gradient(135deg,${C.brandL},${C.bgWarm})`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      margin:"0 auto 14px", fontSize:22, border:`1px solid ${C.brandM}` }}>🏠</div>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text1, marginBottom:6 }}>아직 견적 요청이 없어요</div>
                    <div style={{ fontSize:12, color:C.text3, marginBottom:S.xl, lineHeight:1.7 }}>공간사이에서 첫 공간 여정을 시작해보세요</div>
                    <button onClick={() => { setScreen("home"); handleOpenNewReq(); }}
                      style={{ padding:"12px 26px", background:C.brand, color:"#fff", border:"none",
                        borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer",
                        boxShadow:SHADOW.brand }}>
                      첫 견적 시작하기
                    </button>
                  </div>
                ) : myRequests.map(r => {
                  // SSOT: 홈/마이와 동일하게 에스크로 기준 상태를 사용 (request.status 단독 사용 금지)
                  const escrowData = myRequestsEscrow[r.id] ?? null;
                  const b = consumerStatusBadge(r, escrowData);
                  if (SHOW_DEBUG_UI) {
                    // eslint-disable-next-line no-console
                    console.log("[ContractMapping]", {
                      screen: "consumer_history", role: activeRole,
                      request_id: r.id, contract_id: escrowData?.escrow?.id ?? null,
                      bid_id: null, company_id: escrowData?.escrow?.company_id ?? null,
                      consumer_id: user?.id ?? null, title: r.type, region: r.area, amount: r.budget,
                      request_status: r.status, contract_status: escrowData?.escrow?.transaction_status ?? null,
                      escrow_status: escrowData?.escrow?.transaction_status ?? null, source: "myRequestsEscrow[r.id]",
                    });
                  }
                  return (
                    <ConsumerRequestCard key={r.id} r={r} closed={b.closed} dLabel={b.label} dColor={b.color} dBg={b.bg} onOpen={() => !b.closed && setScreen("timeline")} />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {siteVisitJob && (
        <SiteVisitModal
          job={siteVisitJob}
          companyId={currentUser?.id}
          userId={user?.id}
          onClose={() => setSiteVisitJob(null)}
          onChange={(updatedJob) => {
            setActiveJobs(prev => prev.map(j => j.bid.id === updatedJob.bid.id ? updatedJob : j));
            setSiteVisitJob(updatedJob);
          }}
          onGoEstimate={(job) => { setSiteVisitJob(null); setEstimateJob(job); }}
        />
      )}
      {estimateJob && (
        <PlatformEstimateModal
          job={estimateJob}
          companyId={currentUser?.id}
          userId={user?.id}
          onClose={() => setEstimateJob(null)}
          onChange={(updatedJob) => {
            setActiveJobs(prev => prev.map(j => j.bid.id === updatedJob.bid.id ? updatedJob : j));
            setEstimateJob(updatedJob);
          }}
        />
      )}

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
            <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:6 }}>관리자 로그인</div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>관리자 계정으로 로그인하세요</div>
            <input
              value={adminIdInput}
              onChange={e => { setAdminIdInput(e.target.value); setAdminCodeError(""); }}
              type="text"
              placeholder="아이디"
              autoComplete="off"
              onKeyDown={e => e.key === "Enter" && document.getElementById("admin-pw-input")?.focus()}
              style={{ width:"100%", padding:"13px 14px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box", marginBottom:10, fontFamily:"inherit", color:C.text1, background:C.surface }}
            />
            <input
              id="admin-pw-input"
              value={adminCodeInput}
              onChange={e => { setAdminCodeInput(e.target.value); setAdminCodeError(""); }}
              type="password"
              placeholder="비밀번호"
              autoComplete="off"
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const _ac = import.meta.env.VITE_ADMIN_CODE;
                  if (_ac && adminIdInput === "admin" && adminCodeInput === _ac) {
                    localStorage.setItem("admin_authed", "true");
                    setShowAdminCodeModal(false); setAdminIdInput(""); setAdminCodeInput(""); setAdminCodeError("");
                    onLogin({ ...user, role:"admin", activeRole:"admin" }); setScreen("admin");
                  } else { setAdminCodeError("아이디 또는 비밀번호가 올바르지 않습니다"); }
                }
              }}
              style={{ width:"100%", padding:"13px 14px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box", marginBottom:adminCodeError ? 8 : S.xl, fontFamily:"inherit", color:C.text1, background:C.surface }}
            />
            {adminCodeError && <div style={{ color:C.red, fontSize:12, fontWeight:600, marginBottom:S.md }}>{adminCodeError}</div>}
            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => { setShowAdminCodeModal(false); setAdminIdInput(""); setAdminCodeInput(""); setAdminCodeError(""); }}
                style={{ flex:1, padding:S.lg, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                취소
              </button>
              <button onClick={() => {
                const _ac = import.meta.env.VITE_ADMIN_CODE;
                if (_ac && adminIdInput === "admin" && adminCodeInput === _ac) {
                  localStorage.setItem("admin_authed", "true");
                  setShowAdminCodeModal(false); setAdminIdInput(""); setAdminCodeInput(""); setAdminCodeError("");
                  onLogin({ ...user, role:"admin", activeRole:"admin" }); setScreen("admin");
                } else {
                  setAdminCodeError("아이디 또는 비밀번호가 올바르지 않습니다");
                }
              }}
                style={{ flex:1, padding:S.lg, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer" }}>
                로그인
              </button>
            </div>
            {SHOW_DEBUG_UI && (
              <div style={{ marginTop:S.lg, padding:"8px 10px", background:"#111", color:"#0f0", borderRadius:6, fontSize:10, fontFamily:"monospace", lineHeight:1.8 }}>
                admin_authed: {localStorage.getItem("admin_authed") ?? "null"}<br/>
                activeRole: {activeRole}<br/>
                admin_login_err: {adminCodeError || "—"}
              </div>
            )}
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
        const isHard = reqBlock.type === "HARD_BLOCK";
        const isCooldown = reqBlock.type === "COOLDOWN_BLOCK";
        const isQuoteBlock = reqBlock.type === "QUOTE_COMPARISON_BLOCK";
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:500 }}>
            <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"28px 24px 40px" }}>
              <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
              <div style={{ fontSize:22, textAlign:"center", marginBottom:12 }}>{isCooldown ? "⏳" : isQuoteBlock ? "🛡" : "📋"}</div>

              {isQuoteBlock && (<>
                <div style={{ fontSize:17, fontWeight:900, color:C.text1, textAlign:"center", marginBottom:10 }}>
                  견적 비교 중
                </div>
                <div style={{ fontSize:13, color:C.text3, textAlign:"center", lineHeight:1.7, marginBottom:S.md }}>
                  업체의 견적서 발급을 보호하기 위해<br/>견적 비교 기간 중에는 새 요청을 등록할 수 없습니다.
                </div>
                {reqBlock.remainingMs > 0 && (
                  <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.md,
                    marginBottom:S.xl, textAlign:"center", border:`1px solid ${C.brandM}` }}>
                    <div style={{ fontSize:12, color:C.text3, marginBottom:4 }}>새 요청 가능까지</div>
                    <div style={{ fontSize:16, fontWeight:900, color:C.brand }}>
                      {fmtCooldown(reqBlock.remainingMs)} 남았습니다
                    </div>
                    <div style={{ fontSize:11, color:C.text4, marginTop:4 }}>또는 진행 중인 견적을 종료하면 바로 새 요청 가능</div>
                  </div>
                )}
                <button
                  onClick={() => { setReqBlock(null); setScreen("home"); }}
                  style={{ width:"100%", padding:"14px", background:C.brand, color:"#fff", border:"none",
                    borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer",
                    boxShadow:`0 4px 16px ${C.brand}44`, marginBottom:10 }}>
                  진행 중 견적 보기
                </button>
                {reqBlock.activeReq?.id && (
                  <button
                    onClick={async () => {
                      await archiveRequestAuto(reqBlock.activeReq.id, "manual_override").catch(() => {});
                      setMyRequests(prev => prev.filter(r => r.id !== reqBlock.activeReq.id));
                      setReqBlock(null);
                    }}
                    style={{ width:"100%", padding:"12px", background:C.surface2, color:C.red,
                      border:`1px solid ${C.red}33`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:10 }}>
                    견적 종료하고 새 요청 등록
                  </button>
                )}
              </>)}

              {isHard && (<>
                <div style={{ fontSize:17, fontWeight:900, color:C.text1, textAlign:"center", marginBottom:10 }}>
                  진행 중인 견적요청이 있습니다
                </div>
                <div style={{ fontSize:13, color:C.text3, textAlign:"center", lineHeight:1.7, marginBottom:S.xl }}>
                  업체 선택 또는 요청 종료 후<br/>새 요청을 등록할 수 있습니다.
                </div>
                <button
                  onClick={() => { setReqBlock(null); setScreen("home"); }}
                  style={{ width:"100%", padding:"14px", background:C.brand, color:"#fff", border:"none",
                    borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer",
                    boxShadow:`0 4px 16px ${C.brand}44`, marginBottom:10 }}>
                  진행 중 요청 보기
                </button>
                {reqBlock.activeReq?.id && (
                  <button
                    onClick={async () => {
                      await archiveRequestAuto(reqBlock.activeReq.id, "manual_override").catch(() => {});
                      setMyRequests(prev => prev.filter(r => r.id !== reqBlock.activeReq.id));
                      localStorage.setItem(OVERRIDE_LS_KEY, Date.now().toString());
                      setReqBlock({ type: "COOLDOWN_BLOCK", remainingMs: COOLDOWN_MS });
                    }}
                    style={{ width:"100%", padding:"12px", background:C.surface2, color:C.text2,
                      border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:10 }}>
                    진행 중 요청 숨기기
                  </button>
                )}
              </>)}

              {isCooldown && (<>
                <div style={{ fontSize:17, fontWeight:900, color:C.text1, textAlign:"center", marginBottom:10 }}>
                  새 요청 등록 대기 중
                </div>
                <div style={{ fontSize:13, color:C.text3, textAlign:"center", lineHeight:1.7, marginBottom:S.sm }}>
                  진행 중 요청 숨기기 후 6일 동안은<br/>새 요청 등록이 제한됩니다.
                </div>
                {reqBlock.remainingMs > 0 && (
                  <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.md,
                    marginBottom:S.xl, textAlign:"center", border:`1px solid ${C.brandM}` }}>
                    <div style={{ fontSize:12, color:C.text3, marginBottom:4 }}>새 요청 가능까지</div>
                    <div style={{ fontSize:16, fontWeight:900, color:C.brand }}>
                      {fmtCooldown(reqBlock.remainingMs)} 남았습니다
                    </div>
                  </div>
                )}
              </>)}

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
        const overrideTsInsert = localStorage.getItem(OVERRIDE_LS_KEY);
        if (overrideTsInsert) {
          const remainingMs = Math.max(0, COOLDOWN_MS - (Date.now() - parseInt(overrideTsInsert, 10)));
          if (remainingMs > 0) {
            setShowReq(false);
            setReqBlock({ type: "COOLDOWN_BLOCK", remainingMs });
            return;
          }
          localStorage.removeItem(OVERRIDE_LS_KEY);
        }
        // C-6: block guests before any optimistic update
        if (!user?.id) {
          setShowReq(false);
          showToast("견적 요청은 로그인 후 이용할 수 있어요");
          return;
        }

        const { data: dup } = await getActiveRequestByUser(user.id);
        if (dup) {
          setShowReq(false);
          if (dup.status === "open") {
            const remainingMs = Math.max(0, QUOTE_COOLDOWN_MS - (Date.now() - new Date(dup.created_at).getTime()));
            if (remainingMs > 0) {
              setReqBlock({ type: "QUOTE_COMPARISON_BLOCK", activeReq: dup, remainingMs });
              return;
            }
            // 7일 경과 — 허용
          } else {
            setReqBlock({ type: "HARD_BLOCK", activeReq: dup });
            return;
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
        showToast("✅ 요청이 접수됐어요 · 검증된 업체가 보통 2~4시간 내에 연락드려요. 대화 탭에서 확인하세요.");

        // INSERT to Supabase
        if (user.id) {
          // C-1: form.budget 단일 문자열을 budget_min/budget_max 정수로 파싱
          const { min: budgetMin, max: budgetMax } = parseBudgetRange(form.budget);
          const { data, error } = await createRequest({
            user_id:     user.id,
            status:      'open',
            area:        user.region ?? "",
            space_type:  form.type,
            size:        form.size,
            style:       form.style,
            description: form.desc ?? "",
            budget_min:  budgetMin,
            budget_max:  budgetMax,
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
            // C-5: rollback optimistic UI + toast on failure
            setMyRequests(prev => prev.filter(r => r.id !== optimistic.id));
            setCustomerRequests(prev => prev.filter(r => r.id !== optimistic.id));
            showToast("❌ 견적 요청 저장에 실패했어요. 다시 시도해주세요.");
          } else if (data) {
            const saved = normalizeRequest(data);
            const replace = r => r.id === optimistic.id ? saved : r;
            setMyRequests(prev => prev.map(replace));
            setCustomerRequests(prev => prev.map(replace));
            earnToken("first_quote_request");
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

      {termsDocType && <TermsModal docType={termsDocType} onClose={() => setTermsDocType(null)} />}
      {consentGateConfig && (
        <ConsentGate
          requiredTypes={consentGateConfig.types}
          userId={user?.id}
          title={consentGateConfig.title}
          onComplete={consentGateConfig.onComplete}
          onClose={() => setConsentGateConfig(null)}
        />
      )}

      {homeReviewViewer && (
        <ImageViewerModal
          images={homeReviewViewer.images}
          startIndex={homeReviewViewer.index}
          onClose={() => setHomeReviewViewer(null)}
        />
      )}

      {SHOW_DEBUG_UI && (
        <div style={{ position:"fixed", top:8, right:8, background:"rgba(0,0,0,0.82)", color:"#0f0", borderRadius:8, padding:"8px 10px", fontSize:10, zIndex:9999, lineHeight:1.9, fontFamily:"monospace", maxWidth:200, pointerEvents:"none" }}>
          activeRole: {activeRole}<br/>
          dbRole: {user.role ?? "—"}<br/>
          screen: {screen}<br/>
          mode: {mode}<br/>
          admin_authed: {localStorage.getItem("admin_authed") ?? "null"}
        </div>
      )}

      {!FULL && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:C.ivory,
          borderTop:`1px solid ${C.bgWarm}`, display:"flex", zIndex:10,
          boxShadow:"0 -2px 16px rgba(46,95,75,0.07)" }}>
          {NAV.map(([icon,label,target]) => {
            const active = screen === target;
            return (
              <button key={target} onClick={() => setScreen(target)}
                style={{ flex:1, background:"none", border:"none", cursor:"pointer",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                  padding:"8px 0 14px", position:"relative" }}>
                <div style={{
                  display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                  padding:"6px 14px 4px",
                  borderRadius:R.lg,
                  background:active?C.brandL:"transparent",
                  transition:"background 0.2s" }}>
                  <div style={{ fontSize:20, opacity:active?1:0.55,
                    transform:active?"scale(1.08)":"scale(1)", transition:"transform 0.2s" }}>{icon}</div>
                  <div style={{ fontSize:10, fontWeight:active?800:400,
                    color:active?C.brand:C.text3, letterSpacing:active?"-0.2px":"0" }}>{label}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
