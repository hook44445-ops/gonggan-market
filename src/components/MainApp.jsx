import { useState, useEffect, useRef, useMemo } from "react";
import { C, R, S, GRADE, SHADOW, calcCustomerGrade } from "../constants";
import { TempBadge, CertBadge, Divider, BrandLockup, LeafSprig, LogoMark } from "./common";
import { SHOW_DEBUG_UI } from "../constants/release";
import { TOKEN_COSTS } from "../constants/lounge";
import { getAnonymousNickname } from "../utils/anonymousNickname";
import LiveFeed from "./LiveFeed";
import RegionSelectorBar from "./RegionSelectorBar";
import RegionSelectSheet from "./RegionSelectSheet";
import { useGPS } from "../hooks/useGPS";
import { resolveMapCenter } from "../hooks/useMapCenter";
import { getActivityRegions, getServiceRegions, getPrimaryRegion, getPrimaryRegionId, regionKey, makeRegionEntry } from "../constants/regions";
import { getMatchedCompaniesWithTier } from "../utils/regionMatching";
import { isJunkText } from "../utils/dataHygiene";
import { updateUserActivityRegions, getSavedCompanyIds, getSavedCompanies, saveCompany, unsaveCompany, getCustomerTrust } from "../lib/supabase";
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
import OperatorBoardScreen from "../screens/OperatorBoardScreen";
import LoungeStoryUploadScreen from "../screens/LoungeStoryUploadScreen";
import { buildPostPath, seoSlugToCategoryId } from "../utils/loungeSeo";
import PushNotificationSettings from "./PushNotificationSettings";
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
import OwnershipHistory from "./OwnershipHistory";
import ProtectionNotice from "./ProtectionNotice";
import DisputeNotice from "./DisputeNotice";
import AppFooter from "./AppFooter";
import SiteVisitModal from "./SiteVisitModal";
import PlatformEstimateModal from "./PlatformEstimateModal";
import CompanyActiveJobCard from "./CompanyActiveJobCard";
import { useSpaceToken } from "../hooks/useSpaceToken";
import { useSpaceTemperature } from "../hooks/useSpaceTemperature";
import {
  supabase,
  IS_SUPABASE_READY,
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
  updateBid,
  getBidsForRequest,
  getCompanyByOwnerId,
  getCompanyActiveJobs,
  respondSiteVisit,
  upsertCompany,
  getBidById,
  getPaymentOrderByRequest,
  getEscrowByRequest,
  getOrCreateEscrow,
  createEscrowPayoutsForContract,
  createPaymentOrder,
  createPaymentTransaction,
  createNotification,
  createLoungeChat,
  setRequestInProgress,
  markRequestSiteVisit,
  getCompanyBids,
  getEscrowWithPayouts,
  getActiveRequestByUser,
  archiveRequestAuto,
  getTopReviews,
  getSeedReviews,
  requestMockIdentityVerification,
  updateCompanyServiceRegions,
  getNotifications,
  getReviewByRequest,
  getUnreadChatCounts,
} from "../lib/supabase";
import { useCompanyList } from "../hooks/useCompanyList";
import { sendTieredNotification } from "../utils/notify";
import KakaoMap from "./KakaoMap";

// ── 시/도 표기 정규화: 카카오 region_1depth("인천광역시") → 앱 city("인천") ──
function normalizeSido(s) {
  if (!s) return "";
  return String(s)
    .replace(/특별자치도$|특별자치시$|특별시$|광역시$/, "")
    .replace(/도$/, "")
    .trim();
}

// ── reverse geocoding: lat/lng → { sido, sigungu } (kakao.maps.services) ──
// 버튼 클릭으로 받은 GPS 좌표 1회 변환에만 사용. 자동/반복 호출 없음.
function reverseGeocode(lat, lng) {
  return new Promise((resolve, reject) => {
    const services = typeof window !== "undefined" ? window.kakao?.maps?.services : null;
    if (!services?.Geocoder) { reject(new Error("geocoder-unavailable")); return; }
    const geocoder = new services.Geocoder();
    geocoder.coord2RegionCode(lng, lat, (result, status) => {
      if (status === services.Status.OK && Array.isArray(result) && result.length) {
        const r = result.find((x) => x.region_type === "H") ?? result[0];
        resolve({ rawSido: r.region_1depth_name, sigungu: r.region_2depth_name });
      } else {
        reject(new Error("geocode-failed"));
      }
    });
  });
}

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
  created_at:    row.created_at ?? null,   // 공간멤버십파트너 이용수수료 표기 기준
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
  // bids relation 기준 단일 산정 (legacy row.bid_count 사용 금지)
  const bidCount   = row.bids?.length || 0;
  const hasBids    = bidCount > 0;
  // 삭제/숨김 처리된 요청은 어떤 목록에도 "진행중"으로 노출되면 안 됨.
  const isDeleted  = row.is_deleted === true || row.is_hidden === true;
  // 순수 open(아직 계약 전) 상태만 활성 슬롯으로 본다. in_progress/site_visit 등 계약 진입
  // 후 상태가 (hasBids 로) 활성 슬롯으로 잘못 잡혀 activeOwn>1 오감지 → 정상 요청 자동 만료되던
  // 버그 방지(#210). 진행중 판정은 isRequestInProgress(에스크로/선택 기준)가 담당한다.
  const isActive   = status === "open" && !isExpiredByTime && !isDeleted;
  const isClosed   = isDeleted ||
                     status === "closed" || status === "cancelled" ||
                     status === "expired" ||
                     (status === "open" && isExpiredByTime);
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.space_type ?? "",
    size: row.size ?? "",
    // 고객 예산 — DB budget_min/max(만원) 그대로. 하드코딩 fallback 없음.
    //   값 없음(null/0) → "협의", min==max → 단일 표시, 범위 → "a~b만원".
    budgetMin: Number.isFinite(row.budget_min) && row.budget_min > 0 ? row.budget_min : null,
    budgetMax: Number.isFinite(row.budget_max) && row.budget_max > 0 ? row.budget_max : null,
    budget: (() => {
      const lo = Number.isFinite(row.budget_min) && row.budget_min > 0 ? row.budget_min : null;
      const hi = Number.isFinite(row.budget_max) && row.budget_max > 0 ? row.budget_max : null;
      if (lo == null && hi == null) return "협의";
      const a = lo ?? hi, b = hi ?? lo;
      return a === b ? `${a}만원` : `${a}~${b}만원`;
    })(),
    style: row.style ?? "",
    desc: row.description ?? row.desc ?? "",
    area: row.area ?? "",
    user: "의뢰인",
    bids: bidCount,
    bidCount,
    time: new Date(row.created_at).toLocaleString("ko-KR", { month:"numeric", day:"numeric", hour:"numeric", minute:"2-digit" }),
    status,
    urgent: row.urgent ?? false,
    createdAt: row.created_at,
    expiresAt: expiresAt.toISOString(),
    daysLeft: Math.max(0, daysLeft),
    isExpiredByTime,
    isDeleted,
    isActive,
    isClosed,
    // 업체 선택 추적 — stale 'open' 진행건 판정/이중 노출 방지에 사용.
    selectedBidId:     row.selected_bid_id ?? null,
    selectedCompanyId: row.selected_company_id ?? null,
    // raw bids 배열(원본). 주의: 위 `bids`/`bidCount` 는 개수(숫자)이므로 배열 메서드 호출 금지.
    // 이미입찰(already_bid) 판정 등 company_id 검사는 반드시 이 bidsRaw(배열) 를 사용한다.
    bidsRaw: Array.isArray(row.bids) ? row.bids : [],
    // 리뷰 존재 = 플로우 종결 신호. status/escrow_tx 가 stale 이어도 완료 분류 최우선 근거.
    hasReview: Array.isArray(row.reviews) && row.reviews.length > 0,
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

  // 현장방문 견적 흐름(에스크로 생성 전) — requests.status 기준.
  // ⚠️ 활성 에스크로 계약이 이미 있으면(결제 완료/tx 진행) request.status 가 stale(site_visit/
  //    final_quote_submitted/escrow_pending)이어도 결제 전 화면(action:"bids")으로 회귀시키지 않는다.
  //    → `&& !escrow` 로 가드해 아래 에스크로 진행 단계 계산(txStatus)으로 fall-through 시킨다.
  if (r.status === "site_visit" && !escrow) return {
    badge: "현장방문", badgeBg: C.brandL, badgeFg: C.brand,
    label: "현장방문 견적 진행중", sub: "선택한 업체가 현장 방문 후 최종 견적서를 보내드려요",
    action: "escrow", cta: "진행 상황 보기",
  };
  if (r.status === "final_quote_submitted" && !escrow) return {
    badge: "견적 도착", badgeBg: C.sand, badgeFg: "#7A5C1E",
    label: "최종 견적서 확인", sub: "업체가 최종 견적서를 보냈어요 · 확인 후 안전결제로 진행하세요",
    action: "bids", cta: "최종 견적서 확인하기",
  };
  if (r.status === "escrow_pending" && !escrow) return {
    badge: "결제 대기", badgeBg: C.brandL, badgeFg: C.brand,
    label: "에스크로 결제 대기", sub: "최종 견적을 승인했어요 · 안전결제를 진행해주세요",
    action: "bids", cta: "에스크로 결제하기",
  };

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
      label: "접수완료", sub: "검증된 업체들이 견적을 검토 중입니다 · 보통 2~4시간 내 응답이 와요 ⏱️",
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

// ── 진행감(Progress) 계산 — 에스크로 단계 기준 ──────────────────────────
// 진행률: 착공완료 25 → 중간완료 50 → 마감완료 75 → 최종완료 100
// (계약 직후/예치만 된 상태는 시작 전 0%)
// 반환: { percent, stepNo, totalSteps, nextActionText, isWaiting } | null
function computeProgress(r, escrowData) {
  const escrow = escrowData?.escrow ?? null;
  if (!escrow) return null;
  const payouts = escrowData?.payouts ?? [];
  const tx = escrow.transaction_status ?? "CONTRACTED";
  const approved = (stage) => payouts.find(p => p.stage === stage)?.status === "APPROVED";

  // 단계 라벨/번호(전체 4단계: 착공·중간·마감·완료확인)
  let percent = 0, stepNo = 1, nextActionText = "", isWaiting = false;

  if (tx === "SETTLED" || approved(4)) {
    percent = 100; stepNo = 4;
    nextActionText = "모든 공사가 완료됐어요 · 후기를 남겨주세요";
  } else if (tx === "COMPLETED") {
    percent = 75; stepNo = 4; isWaiting = true;
    nextActionText = "완료 사진 확인 후 잔금 30%가 업체에 지급됩니다";
  } else if (tx === "MID_INSPECTION") {
    percent = 50; stepNo = 3; isWaiting = true;
    nextActionText = "중간 검수 확인 후 40%가 업체에 지급됩니다";
  } else if (tx === "STARTED") {
    percent = approved(2) ? 25 : 25; stepNo = 2; isWaiting = !approved(2);
    nextActionText = approved(2)
      ? "다음은 중간 검수 단계입니다"
      : "착공 사진 확인 후 20%가 업체에 지급됩니다";
  } else {
    // CONTRACTED/예치 등 — 착공 전
    percent = 0; stepNo = 1; isWaiting = true;
    nextActionText = "업체가 착공을 준비하고 있습니다";
  }

  return { percent, stepNo, totalSteps: 4, nextActionText, isWaiting };
}

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
  // [상태 우선순위] 완료 신호가 하나라도 있으면 requests.status/bids.status/escrow_tx 가
  // 과거 단계값으로 stale 해도 completed 로 분류한다(분류만 — 결제/단계 전이 로직 무관).
  // 1) 리뷰 존재 = 플로우 종결(리뷰는 완료 이후에만 작성됨) → 최우선 완료.
  if (r?.hasReview === true) return true;
  const escrow = escrowData?.escrow ?? null;
  if (escrow) {
    const tx = escrow.transaction_status;
    // 2) 정산 완료(SETTLED) 또는 완료 보고(COMPLETED) → 완료.
    if (tx === "SETTLED" || tx === "COMPLETED") return true;
    // 완료 기록: 완료 단계(stage4) payout 승인 → 완료.
    const payout4 = (escrowData?.payouts ?? []).find(p => p.stage === 4);
    if (payout4?.status === "APPROVED") return true;
    // 3·4) MID_INSPECTION/STARTED 는 완료 아님 → isRequestInProgress(hasActiveEscrow)가 진행중 분류.
  }
  // 5) 그 외 raw status 가 명시적 완료면 active 에서 제외
  if (r?.status === "completed" || r?.status === "settled") return true;
  return false;
}

// 활성(정산 전) 에스크로 계약이 존재하는가 — 진행중 판정의 1차 기준(상태 무관).
// 업체가 착공/단계 사진을 올려 계약이 생기면 escrow row 가 존재한다. status 가 stale 'open'
// 이어도 이 escrow 가 곧 "진행중"의 근거다.
function hasActiveEscrow(escrowData) {
  const escrow = escrowData?.escrow ?? null;
  if (!escrow) return false;
  if (escrow.transaction_status === "SETTLED") return false; // 정산 완료 = 진행중 아님
  return true;
}

// 의뢰인 "진행중" 판정 — 정책: 실제 계약(에스크로)이 생겼거나 업체 선택값이 확정됐을 때만.
// ⚠️ 단순 'open' 이나 입찰 존재만으로는 진행중이 아니다(아직 견적/선택 단계 = 견적 요청).
//   진행중 = 활성 에스크로 존재  OR  selected_company_id/selected_bid_id 존재
//   (완료/취소/만료/삭제/정산완료 제외, selected·escrow 모두 없는 broken in_progress 제외)
function isRequestInProgress(r, escrowData) {
  if (!r) return false;
  if (r.isDeleted === true || r.isExpiredByTime === true) return false;
  if (["completed", "cancelled", "expired", "closed", "settled"].includes(r.status)) return false;
  if (isRequestSettled(r, escrowData)) return false;
  // SSOT 진행건 판정: 활성 에스크로 OR 선택 업체/입찰(selected_company_id/selected_bid_id) 존재.
  // ⚠️ status 만 in_progress/site_visit 이고 selected 값·에스크로가 모두 없는 건은 broken request
  //    (escrow 중복/선택값 누락으로 깨진 데이터) → 진행중으로 인정하지 않아 화면에서 제외.
  if (hasActiveEscrow(escrowData)) return true;
  if (r.selectedBidId || r.selectedCompanyId) return true;
  return false;
}

// 의뢰인 "새 견적 요청"(open) 판정 — 진행중/완료/마감이 아닌, 아직 업체 선택 전 open 요청.
// 진행중과 상호배타: 활성 에스크로가 있으면 견적 요청이 아니다(이중 노출 방지).
function isRequestOpenForQuotes(r, escrowData) {
  if (!r) return false;
  if (r.isDeleted === true || r.isExpiredByTime === true) return false;
  if (isRequestInProgress(r, escrowData)) return false;
  if (isRequestSettled(r, escrowData)) return false;
  // 업체 미선택(selected_bid/company 없음)인 순수 open 요청만 '새 견적 요청'.
  if (r.selectedBidId || r.selectedCompanyId) return false;
  return r.status === "open";
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

export default function MainApp({ user, onLogout, onForgetDevice, onLogin, onStartOnboarding }) {
  const activeRole = user.activeRole ?? user.role ?? "consumer";
  const mode = activeRole === "company" ? "company" : activeRole === "admin" ? "admin" : "consumer";
  // 운영자/관리자 — 라운지 운영(추천글·숨김) 권한.
  // operator 는 부가 권한(is_operator 플래그)이며 사용자 유형(company/consumer)을 바꾸지 않음.
  const isModerator = activeRole === "admin"
    || user.role === "admin"
    || user.isOperator === true
    || user.is_operator === true
    || user.role === "operator";   // 레거시(028 마이그레이션 전) 호환
  const [screen, setScreen] = useState(() => {
    if (activeRole === "admin") return "admin";
    if (activeRole === "company") return "dashboard";
    if (user.startAt) return user.startAt;
    return "home";
  });
  const [prevScreen, setPrevScreen] = useState("home");
  const [selCo, setSelCo] = useState(null);
  // 마이페이지: "이 기기 인증 삭제(완전 로그아웃)" 확인 토글
  const [showForgetConfirm, setShowForgetConfirm] = useState(false);

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
  const [reqPrefill, setReqPrefill] = useState(null);          // 라운지 채팅 → 견적요청 시 desc 초기값
  const [loungeChat, setLoungeChat] = useState(null);          // { roomId, partner } — 라운지 1:1 채팅
  useEffect(() => { if (!showReq) setReqPrefill(null); }, [showReq]); // 모달 닫히면 prefill 초기화(다음 일반 견적요청 오염 방지)
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

  // API 중복 호출 방지 — 1초 이내 재진입 차단 (focus/visibility 이벤트 연속 발화 대응)
  const companyReqTsRef   = useRef(0); // loadCompanyRequests
  const companyBidsTsRef  = useRef(0); // getCompanyBids
  const activeJobsTsRef   = useRef(0); // getCompanyActiveJobs
  const companyJobsTsRef  = useRef(0); // loadJobs (companyJobs)
  const companyJobsKeyRef = useRef(""); // loadJobs candidateIds 시그니처 — 후보 변경 시 디바운스 우회

  // ── 관심 탭 ──────────────────────────────────────────────────────────────────
  const [favTab, setFavTab] = useState("received");

  // ── 라운지 상태 ──────────────────────────────────────────────────────────────
  const [loungePost, setLoungePost]               = useState(null);
  const [loungeInitialCategory, setLoungeInitialCategory] = useState(null);
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
  const [homeReviewDetail, setHomeReviewDetail] = useState(null);
  const [reqDoneNotice, setReqDoneNotice] = useState(false); // 견적 요청 완료 직후 안전 보관 안내 카드
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
  const { gpsCenter, gpsErrorCode, gpsTick, loading: gpsLoading, requestCurrentLocation, autoLocateIfGranted, clearGps } = useGPS();
  // GPS 사용 목적: 'view'(지도 이동) | 'add'(현재 위치로 지역 추가)
  const gpsModeRef = useRef("view");
  const [regionChooserOpen, setRegionChooserOpen] = useState(false); // + 지역 추가 선택 시트
  const [regionExploreOpen, setRegionExploreOpen] = useState(false); // 다른 지역 둘러보기(현재지역 변경 전용, 저장 안 함)
  const [gpsPendingRegion, setGpsPendingRegion] = useState(null);    // 저장 확인 대기 { rawSido, sido, sigungu, lat, lng }
  // 교체 모드 — 저장된 칩(index)을 누르면 그 슬롯을 새 지역으로 교체. null = 추가/둘러보기 모드.
  const [editingRegionIndex, setEditingRegionIndex] = useState(null);

  // user prop 변경(재로그인 등) 시 활동지역 재동기화
  useEffect(() => {
    const regs = getActivityRegions(user);
    setActivityRegions(regs);
    setActiveRegion(getPrimaryRegion(regs));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 지도 중심 — GPS(현재위치) > activeRegion(선택지역) > 저장 primary > fallback(서울시청).
  // 지역 선택은 매칭 기준일 뿐 GPS 가 있으면 지도를 강제 이동시키지 않는다.
  const mapCenter = useMemo(
    () => resolveMapCenter({ user: { activity_regions: activityRegions, region: user?.region }, activeRegion, gpsCenter }),
    [activityRegions, user?.region, activeRegion, gpsCenter]
  );

  const [mapLocalOnly, setMapLocalOnly] = useState(false);

  // 진입 시 1회: 위치 권한이 '이미 허용' 인 경우에만(프롬프트 없이) 현재 위치 표시(정책 ①).
  // 미허용(prompt)/거부면 no-op → 활동지역/서울시청 fallback. 'view-auto' 는 토스트 없이 조용히.
  useEffect(() => {
    gpsModeRef.current = "view-auto";
    autoLocateIfGranted();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "현재 위치로 보기" — 버튼 클릭 시 GPS 1회 요청. GPS 가 최우선이라 activeRegion 을 비우지 않아도
  // 지도는 현재 위치로 이동한다(매칭 필터는 유지).
  const onRequestMapLocation = () => { gpsModeRef.current = "view"; requestCurrentLocation(); };

  // 지역 칩 클릭 → 선택 시트 (① 둘러보기 ② 현재 위치로 ③ 관심지역 저장)
  const openRegionChooser = () => setRegionChooserOpen(true);
  // 시트 ① — 현재 위치로 지역 추가: GPS 1회 → reverse geocoding (effect 에서 처리)
  const onAddRegionByGps = () => { gpsModeRef.current = "add"; setRegionChooserOpen(false); requestCurrentLocation(); };
  // 시트 ② — 직접 지역 선택(관심지역 저장, 최대 2)
  const onAddRegionManual = () => { setRegionChooserOpen(false); setRegionSheetOpen(true); };
  // 시트 ③ — 다른 지역 둘러보기(현재지역만 변경, 저장/제한 없음)
  const onExploreRegion = () => { setRegionChooserOpen(false); setRegionExploreOpen(true); };
  // 현재지역(selectedRegion) 즉시 변경 — 저장(savedRegions)과 무관, 개수 제한 없음
  const onPickCurrentRegion = (entry) => { clearGps(); setActiveRegion(entry); setMapLocalOnly(false); };

  // GPS 응답 처리 — 버튼 클릭으로만 trigger 됨(gpsTick). mode 에 따라 분기.
  useEffect(() => {
    if (gpsTick === 0) return; // 최초 mount 무시 (자동 요청 없음)
    if (gpsErrorCode) {
      // 진입 자동 표시(view-auto)는 권한 허용된 경우에만 호출되므로 오류 토스트를 띄우지 않는다.
      if (gpsModeRef.current === "view-auto") return;
      if (gpsErrorCode === "denied") showToast("위치 권한이 꺼져 있어요. 직접 지역을 선택해주세요.");
      else showToast("현재 위치를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (!gpsCenter) return;
    if (gpsModeRef.current === "view") {
      showToast("현재 위치로 지도를 이동했어요.");
    } else if (gpsModeRef.current === "view-auto") {
      // 진입 시 자동 표시 — 토스트 없이 조용히 지도 중심만 현재 위치로.
    } else if (gpsModeRef.current === "add") {
      reverseGeocode(gpsCenter.lat, gpsCenter.lng)
        .then(({ rawSido, sigungu }) => {
          setGpsPendingRegion({ rawSido, sido: normalizeSido(rawSido), sigungu, lat: gpsCenter.lat, lng: gpsCenter.lng });
        })
        .catch(() => showToast("현재 위치의 지역을 확인하지 못했어요. 직접 선택해주세요."));
    }
  }, [gpsTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // 저장된 칩 슬롯(index)을 새 지역으로 교체. 중복 방지 + 지도/필터 즉시 반영.
  const replaceSavedRegion = (index, entry) => {
    setEditingRegionIndex(null);
    if (index == null || index < 0 || index >= activityRegions.length) { onPickCurrentRegion(entry); return; }
    const key = regionKey(entry.city, entry.district);
    const dupIdx = activityRegions.findIndex((r, i) => i !== index && regionKey(r.city, r.district) === key);
    if (dupIdx !== -1) {
      // 이미 다른 슬롯에 저장된 지역 → 중복 추가하지 않고 해당 지역으로 이동만
      onPickCurrentRegion(entry);
      showToast("이미 저장된 지역이에요. 해당 지역으로 이동했어요");
      return;
    }
    const slot = activityRegions[index];
    const newEntry = { ...entry, is_primary: slot?.is_primary ?? entry.is_primary ?? false };
    const next = activityRegions.map((r, i) => (i === index ? newEntry : r));
    onSaveRegions(next);
    setActiveRegion(newEntry);
    showToast("✅ 지역을 교체했어요");
  };

  // 둘러보기 시트에서 지역 선택 — 교체 모드면 슬롯 교체, 아니면 현재지역(activeRegion)만 변경.
  const handleExplorePick = (entry) => {
    setRegionExploreOpen(false);
    if (editingRegionIndex !== null) replaceSavedRegion(editingRegionIndex, entry);
    else onPickCurrentRegion(entry);
  };

  // 현재 위치 지역 확인 → 교체 모드면 그 슬롯 교체, 아니면 관심지역(최대 2곳) 추가/이동.
  const confirmSaveGpsRegion = () => {
    const p = gpsPendingRegion;
    if (!p) return;
    const base = makeRegionEntry(p.sido, p.sigungu, activityRegions.length === 0);
    const entry = { ...base, lat: p.lat, lng: p.lng, source: "gps" };
    setGpsPendingRegion(null);

    if (editingRegionIndex !== null) {
      replaceSavedRegion(editingRegionIndex, entry);
      return;
    }
    const dup = activityRegions.some(r => regionKey(r.city, r.district) === regionKey(entry.city, entry.district));
    if (dup) {
      onPickCurrentRegion(entry);
      showToast("✅ 이 지역으로 이동했어요");
    } else if (activityRegions.length < 2) {
      onSaveRegions([...activityRegions, entry]);
      setActiveRegion(entry);
      showToast("✅ 관심지역으로 저장하고 이 지역으로 이동했어요");
    } else {
      // 2곳이 꽉 참 — 추가 불가(교체는 칩을 눌러 교체 모드로 진입해야 함)
      onPickCurrentRegion(entry);
      showToast("활동지역은 최대 2곳까지 설정할 수 있어요. 기존 칩을 눌러 교체해주세요.");
    }
  };

  const onSaveRegions = async (entries) => {
    const primary = getPrimaryRegion(entries);
    const primaryText = primary ? regionKey(primary.city, primary.district) : null;
    setActivityRegions(entries);
    setActiveRegion(primary);
    setRegionSheetOpen(false);
    // ⚠️ 활동지역 저장은 '매칭 기준' 변경일 뿐 — GPS 현재 위치를 비우지 않는다.
    //    (clearGps 하면 지도가 저장 지역으로 강제 이동 → 정책 위반.) 지도는 GPS 유지.
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

  // 입찰 가능 목록(새 견적 요청): OPEN 상태만 노출.
  // 이미 "내 시공 진행중"(활성 에스크로 계약)에 잡힌 요청은 입찰 목록에서 제외한다.
  // request.status가 stale("open")이어도 진행중 계약이 있으면 입찰 대상이 아니다 → 이중 노출 방지.
  const inProgressRequestIds = useMemo(
    () => new Set(companyJobs.map(j => j.request?.id).filter(Boolean)),
    [companyJobs]
  );
  // 현장방문 단계(activeJobs) 의 request id — 입찰 목록 dedupe 에 사용.
  const activeJobRequestIds = useMemo(
    () => new Set(activeJobs.map(j => j.request?.id).filter(Boolean)),
    [activeJobs]
  );
  // 진행중(에스크로) 요청과 겹치는 현장방문 잡은 화면에서 제외(이중 노출 방지).
  const siteVisitJobs = useMemo(
    () => activeJobs.filter(j => j.request?.id && !inProgressRequestIds.has(j.request.id)),
    [activeJobs, inProgressRequestIds]
  );
  // 새 견적 요청(biddable): 순수 open + 업체 미선택 + 에스크로/진행/현장방문 모두 아님.
  // request.id 기준으로 진행중·현장방문과 dedupe → 같은 건이 양쪽에 동시 노출되지 않음.
  // submittedBids(requestId) + DB bids(company_id) 양쪽으로 이미 입찰한 요청 제외.
  // DB bids 체크: companies.id(신규) 또는 ownerId(기존 데이터 호환) 모두 already_bid 로 처리.
  const biddableRequests = useMemo(() => {
    const companyIdMe = currentUser?.id ?? null;
    const ownerIdMe = user?.id ?? null;
    if (!ownerIdMe) return [];  // auth user 미로드 시 계산 생략
    const bidSubmittedIds = new Set(submittedBids.map(b => b.requestId).filter(Boolean));
    // 소비자 classify 와 동일한 만료/삭제 판정 — 의뢰인단에서 expired/기타로 분류되는 요청은
    // 업체 입찰 목록에도 절대 노출되지 않도록 통일한다. (status='open' 으로 남아 있어도 시간만료 제외)
    const isExpiredReq = (r) =>
      r.status === "expired" || r.isExpiredByTime === true || r.isClosed === true;
    const isDeletedOrHidden = (r) =>
      r.isDeleted === true || r.is_deleted === true || r.is_hidden === true ||
      r.status === "cancelled" || r.status === "canceled" || r.status === "deleted" ||
      r.status === "closed" || r.status === "completed" || r.status === "settled";
    return customerRequests.filter(r => {
      if (r.status !== "open") return false;                     // not_open
      if (r.selectedBidId || r.selectedCompanyId) return false;  // selected
      if (isExpiredReq(r)) return false;                         // expired
      if (isDeletedOrHidden(r)) return false;                    // deleted_or_hidden
      if (inProgressRequestIds.has(r.id)) return false;
      if (activeJobRequestIds.has(r.id)) return false;
      if (bidSubmittedIds.has(r.id)) return false;
      const rawBids = Array.isArray(r.bidsRaw) ? r.bidsRaw : [];
      if (rawBids.some(b => b?.company_id === companyIdMe || b?.company_id === ownerIdMe)) return false;
      return true;
    });
  }, [customerRequests, inProgressRequestIds, activeJobRequestIds, submittedBids, currentUser?.id, user?.id]);
  // 동일 결과의 중복 로그를 막기 위한 ref — key 가 바뀔 때만 출력.
  const lastBiddableLogKeyRef = useRef("");
  useEffect(() => {
    if (activeRole !== "company") return;
    const companyId = currentUser?.id ?? null;
    const ownerId   = user?.id ?? null;
    const key = [companyId, ownerId, customerRequests.length, biddableRequests.map(r => r.id).join(",")].join("|");
    if (key === lastBiddableLogKeyRef.current) return;
    lastBiddableLogKeyRef.current = key;
    try {
      const bidSubmittedIds = new Set(submittedBids.map(b => b.requestId).filter(Boolean));
      console.log("[GONGGAN_DEBUG][biddableRequests]", {
        currentCompanyId: companyId, ownerId,
        customerRequestsTotal: customerRequests.length,
        inProgressIds: [...inProgressRequestIds], activeJobIds: [...activeJobRequestIds],
        biddable: biddableRequests.map(r => ({ id: r.id, status: r.status, selected_company_id: r.selectedCompanyId ?? null, selected_bid_id: r.selectedBidId ?? null, budget_min: r.budgetMin ?? null, budget_max: r.budgetMax ?? null })),
        excluded: customerRequests.filter(r => !biddableRequests.includes(r)).map(r => ({
          id: r.id, status: r.status, selected_company_id: r.selectedCompanyId ?? null,
          reason: r.status !== "open" ? "not_open"
            : (r.selectedBidId || r.selectedCompanyId) ? "selected"
            : (r.status === "expired" || r.isExpiredByTime === true || r.isClosed === true) ? "expired"
            : (r.isDeleted === true || r.is_deleted === true || r.is_hidden === true
                || r.status === "cancelled" || r.status === "canceled" || r.status === "deleted"
                || r.status === "closed" || r.status === "completed" || r.status === "settled") ? "deleted_or_hidden"
            : inProgressRequestIds.has(r.id) ? "inProgress(escrow)"
            : activeJobRequestIds.has(r.id) ? "activeJob(siteVisit)"
            : bidSubmittedIds.has(r.id) ? "already_bid(local)"
            : (Array.isArray(r.bidsRaw) ? r.bidsRaw : []).some(b => b?.company_id === companyId || b?.company_id === ownerId) ? "already_bid(db)"
            : "?",
        })),
      });
    } catch {}
  }, [activeRole, biddableRequests, submittedBids, customerRequests, inProgressRequestIds, activeJobRequestIds, currentUser?.id, user?.id]);
  const [myRequestsEscrow, setMyRequestsEscrow] = useState({}); // { [requestId]: { escrow, payouts } }
  const prevTxStatusRef = useRef({}); // { [requestId]: transaction_status } — 단계 전환 토스트용
  const loadReqInFlightRef = useRef(false); // loadCompanyRequests 중복 호출 가드
  const loadReqLastAtRef = useRef(0);       // loadCompanyRequests 디바운스(1초)
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

  // 취소/숨김/삭제 상태는 소비자(myRequests)·업체(customerRequests→biddableRequests) 양쪽
  // 어디에도 노출하지 않는다. (budget 등 값 기반 하드코딩 필터 금지 — 상태 기준 방어만.)
  // normalizeRequest 가 is_hidden/is_deleted 를 isDeleted 로 통합하므로 그것 + status 로 판정.
  const isHardExcludedRequest = (r) =>
    !r ||
    r.isDeleted === true ||
    r.status === "cancelled" || r.status === "canceled" || r.status === "deleted";

  const applyExpiry = (rows) => {
    const normalized = rows.map(normalizeRequest)
      // 방어 필터: cancelled/canceled/hidden/deleted 는 정규화 후 즉시 제거.
      .filter(r => !isHardExcludedRequest(r));
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
    // 디바운스/중복호출 가드 — 1초 내 재호출(포커스 복귀·새로고침 버튼 연타·effect 재실행) 차단.
    const now = Date.now();
    if (loadReqInFlightRef.current) return;
    if (now - loadReqLastAtRef.current < 1000) return;
    loadReqInFlightRef.current = true;
    loadReqLastAtRef.current = now;
    try {
      // requests.status 단일 기준 — getRequests 가 status='open' 만 반환.
      // (계약/선정 시 status 가 in_progress 로 전이되므로 별도 cross-ref 불필요)
      const { data, error } = await getRequests();
      setLastFetchAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      if (error) {
        setReqDebug(d => ({ ...d, companyFetchError: error?.message ?? null, companyRows: 0, companyData: [] }));
        return;
      }
      setReqDebug(d => ({ ...d, companyFetchError: null, companyRows: data?.length ?? 0, companyData: data ?? [] }));
      setCustomerRequests(applyExpiry(data ?? []));
    } finally {
      loadReqInFlightRef.current = false;
    }
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
    if (!user?.id) return;
    if (activeRole === "consumer") {
      getUserRequests(user.id).then(({ data, error }) => {
        setReqDebug(d => ({ ...d, consumerFetchError: error?.message ?? null, consumerRows: data?.length ?? 0, consumerData: data ?? [] }));
        if (error) return;
        if (data) {
          const withExpiry = applyExpiry(data);
          const activeOwn = withExpiry.filter(r => r.isActive)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          const next = (activeOwn.length > 1)
            ? (() => {
                activeOwn.slice(1).forEach(r => expireRequest(r.id));
                const keepId = activeOwn[0].id;
                return withExpiry.map(r =>
                  r.isActive && r.id !== keepId
                    ? { ...r, status: "expired", isActive: false, isClosed: true }
                    : r
                );
              })()
            : withExpiry;
          // E: 동일 데이터면 같은 참조를 유지해 불필요한 리렌더·에스크로 재조회 루프를 끊는다.
          // (focus/visibility 로 fetch 가 반복돼도 내용이 같으면 myRequests 참조가 바뀌지 않음)
          const sig = (a) => a.map(r =>
            `${r.id}:${r.status}:${r.bidCount ?? 0}:${r.selectedBidId ?? ""}:${r.selectedCompanyId ?? ""}:${r.isActive}`
          ).join("|");
          setMyRequests(prev => (sig(prev) === sig(next) ? prev : next));
        }
      });
    } else {
      loadCompanyRequests();
    }
  }, [activeRole, user?.id, escrowRefreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // 앱 포그라운드 복귀(focus/visibility) 시 요청·에스크로·사진 재조회.
  // escrowRefreshTrigger 를 올리면 (1) 위 요청 fetch (2) 에스크로 fetch 가 함께 재실행된다.
  // 업체가 사진을 올린 뒤 의뢰인이 앱으로 돌아오면 진행중/사진 상태가 즉시 갱신되도록 한다.
  useEffect(() => {
    const refresh = () => setEscrowRefreshTrigger(t => t + 1);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // 업체: 내가 제출한 입찰을 mount 시 로드 → 새로고침해도 입찰 유지(누락 방지).
  // (이전엔 getCompanyBids 가 호출되지 않아 입찰이 optimistic 으로만 보이고 사라졌음)
  useEffect(() => {
    if (activeRole !== "company" || !user?.id) return;
    const _now = Date.now();
    if (_now - companyBidsTsRef.current < 1000) return;
    companyBidsTsRef.current = _now;
    getCompanyBids(user.id).then(({ data, error }) => {
      if (error || !data) return;
      setSubmittedBids(data.map(normalizeBid));
    }).catch(() => {});
  }, [activeRole, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (activeRole !== "company") return;
    if (!currentUser?.id) return;
    if (!user?.id) return;
    const _now = Date.now();
    if (_now - activeJobsTsRef.current < 1000) return;
    activeJobsTsRef.current = _now;
    // 현장방문 견적 단계(결제 전)만 activeJobs 로 — 에스크로 계약 진입 후(in_progress 등)는
    // companyJobs(에스크로 기준)에서 다뤄 이중 노출을 막는다.
    // bids.company_id 는 소유자 user.id 로 저장되므로 company.id 와 user.id 를 함께 후보로 넘긴다.
    const SITE_VISIT_PHASES = new Set(["open", "site_visit", "site_visiting", "visit_requested", "final_quote_submitted", "escrow_pending"]);
    getCompanyActiveJobs(currentUser.id, [user?.id, currentUser?.ownerId]).then(({ data }) => {
      if (data) setActiveJobs(data.filter(j => SITE_VISIT_PHASES.has((j.request?.status ?? "").toLowerCase())));
    });
  }, [currentUser?.id, activeRole, user?.id, escrowRefreshTrigger]);

  // Load company's own awarded/in-progress jobs — multi-path fetch with payment_orders fallback
  useEffect(() => {
    if (activeRole !== "company" || !user?.id) return;

    const loadJobs = async () => {
      const _now = Date.now();
      const candidateIds = [...new Set([
        user.id,
        currentUser?.id,
        currentUser?.ownerId,
      ].filter(Boolean))];
      // 디바운스는 "동일 candidateIds 로의 1초 내 재호출"만 차단한다. currentUser(companies.id)가
      // 첫 렌더 직후 로드되면 candidateIds 가 바뀌므로 즉시 재조회해야 한다 — 이 우회가 없으면
      // 첫 호출(ownerId 만)에서 디바운스가 걸려, selected_company_id=companies.id 로 잡히는
      // site_visiting 진행건(Path D)이 영영 누락된다.
      const candidateKey = candidateIds.join(",");
      if (candidateKey === companyJobsKeyRef.current && _now - companyJobsTsRef.current < 1000) return;
      companyJobsTsRef.current = _now;
      companyJobsKeyRef.current = candidateKey;

      // ── 강제 포함(Path D 직접조회) — 표시 전용, 멀티패스/타이밍 누락 방어 ──────────────
      // 의뢰인이 이 업체(selected_company_id ∈ candidateIds)를 선택한 진행성 요청은 bids/escrow
      // 연결·디바운스 타이밍과 무관하게 반드시 companyJobs 에 포함한다.
      // (현장방문 RPC/insert/classify 미변경 — requests 조회만 추가.)
      // 진행중 포함 status — 최종견적 전송(final_quote_submitted)·착공 계열 포함(목록에서 사라짐 방지).
      const FORCE_STATUS = ["site_visiting","visit_requested","site_visit","final_quote_submitted","construction_confirmed","started","mid_inspection","selected","in_progress","deposit_pending","escrow_pending","contracted","active"];
      // 정산/종료된 escrow 가 붙은 요청은 강제포함에서 제외(완료건이 진행중 유령으로 남는 것 방지).
      const FORCED_EXCL_TX = new Set(["SETTLED","COMPLETED","CANCELLED","REFUNDED","DISPUTE_RESOLVED"]);
      let forcedJobs = [];
      try {
        const { data: selectedRequests, error: selectedError } = await supabase
          .from("requests")
          .select("*, bids(id, price, status, company_id, period_days, material_note, comment, created_at, selected)")
          .in("selected_company_id", candidateIds)
          .in("status", FORCE_STATUS);
        if (selectedError) { try { console.error("[DASHBOARD_SELECTED_REQUESTS_FAILED]", selectedError); } catch {} }
        // 선택건들의 escrow 상태 조회 — SETTLED 등 종료건은 진행중에서 빼야 함.
        const selIds = (selectedRequests ?? []).map(r => r.id).filter(Boolean);
        let txByReq = {};
        if (selIds.length > 0) {
          const { data: selEsc } = await supabase
            .from("escrow_payments")
            .select("request_id, transaction_status")
            .in("request_id", selIds);
          for (const e of selEsc ?? []) {
            if (!e.request_id) continue;
            // 종료 상태가 하나라도 있으면 종료로 간주(가장 진행된 상태 우선).
            if (FORCED_EXCL_TX.has(e.transaction_status) || !txByReq[e.request_id]) {
              txByReq[e.request_id] = e.transaction_status;
            }
          }
        }
        forcedJobs = (selectedRequests ?? [])
          .filter(req => req?.id && req.is_deleted !== true && req.is_hidden !== true)
          .filter(req => !FORCED_EXCL_TX.has(txByReq[req.id]))   // SETTLED/종료 escrow 제외
          .map(req => {
            const rawBids = Array.isArray(req.bids) ? req.bids : [];
            const selectedBid = rawBids.find(b => b.id === req.selected_bid_id) || rawBids[0] || null;
            return {
              bid: selectedBid ? {
                id: selectedBid.id, requestId: req.id, companyId: selectedBid.company_id,
                price: selectedBid.price, period: selectedBid.period_days,
                material: selectedBid.material_note ?? "", comment: selectedBid.comment ?? "",
                createdAt: selectedBid.created_at, status: selectedBid.selected ? "selected" : "pending",
                company: { id: req.selected_company_id, name: user.name ?? "업체", temp: 36.5, ownerId: user.id },
              } : null,
              request: normalizeRequest(req),
              escrow: null,
            };
          });
      } catch (e) { try { console.error("[DASHBOARD_SELECTED_REQUESTS_FAILED]", e); } catch {} }

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
        .select("id, request_id, company_id, transaction_status, total_amount")
        .in("company_id", candidateIds);

      dev.escrow_direct_found = escrowsDirect?.length ?? 0;

      // ── Path D: requests.selected_company_id ∈ candidateIds ──────────────────
      // 의뢰인이 이 업체를 선택한 모든 요청(현장방문 site_visiting 포함)을 bid/escrow 연결
      // 여부와 무관하게 진행중 후보로 확보한다. (bids.request_id 누락 등으로 Path A 가 놓치는
      // site_visiting 건이 진행중 탭에 안 뜨던 문제 보강 — selected_company_id = companies.id.)
      const { data: selCompanyReqs } = await supabase
        .from("requests")
        .select("id, selected_company_id")
        .in("selected_company_id", candidateIds);

      const requestIdsFromSelectedCompany = new Set(
        (selCompanyReqs ?? []).map(r => r.id).filter(Boolean)
      );

      // Merge request_ids: from bids (path A+B) + from escrow direct (path C) + selected_company (path D)
      const requestIdsFromBids = new Set(Object.values(bidRequestMap));
      const requestIdsFromEscrow = new Set(
        (escrowsDirect ?? []).map(e => e.request_id).filter(Boolean)
      );
      const allRequestIds = [...new Set([
        ...requestIdsFromBids,
        ...requestIdsFromEscrow,
        ...requestIdsFromSelectedCompany,
      ])];

      if (allRequestIds.length > 0) {
        dev.join_mode = requestIdsFromBids.size > 0 && requestIdsFromEscrow.size > 0
          ? "bid+escrow_direct"
          : requestIdsFromBids.size > 0 ? "bid_only" : "escrow_direct_only";
      }

      dev.request_ids = allRequestIds.length > 0
        ? allRequestIds.map(id => id.slice(0, 8)).join(", ")
        : "none";

      if (allRequestIds.length === 0) {
        // 멀티패스가 비어도 강제포함(selected_company_id) 진행건은 노출.
        dev.forced_jobs = forcedJobs.length;
        dev.realInProgressIds = forcedJobs.map(j => j.request?.id).filter(Boolean).join(", ") || "none";
        try { console.log("[GONGGAN_DEBUG][realInProgressIds]", { source: "forced_only", ids: forcedJobs.map(j => j.request?.id).filter(Boolean) }); } catch {}
        setCompanyJobs(forcedJobs);
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
        .select("id, request_id, company_id, transaction_status, total_amount")
        .in("request_id", allRequestIds);

      // SSOT: "진행중 계약" 은 이 업체(candidateIds)의 escrow 만 인정한다.
      // 의뢰인이 다른 업체를 선택해 결제한 escrow(타 업체 계약)는 이 업체 진행중이 아니다
      // → 단순 입찰만 한 요청에 타 업체 escrow 가 붙어 '유령 진행건'으로 잡히던 문제 제거.
      const candidateIdSet = new Set(candidateIds);
      const escrowByRequestId = {};
      for (const e of escrowsDirect ?? []) {
        if (e.request_id && candidateIdSet.has(e.company_id)) escrowByRequestId[e.request_id] = e;
      }
      for (const e of escrowsByReq ?? []) {
        if (e.request_id && candidateIdSet.has(e.company_id)) escrowByRequestId[e.request_id] = e;
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
      // 현장방문 견적 단계(site_visit/final_quote_submitted/escrow_pending, 결제 전)는 companyJobs 가
      // 아니라 activeJobs(CompanyActiveJobCard)에서 다룬다 — 이중 노출 방지. companyJobs 는 에스크로 계약만.

      // Build synthetic bid entries for request_ids discovered via escrow direct OR
      // selected_company (path D) that have no bid row in path A — 그래야 진행중 후보로 흐른다.
      const noBidRequestIds = [...new Set([...requestIdsFromEscrow, ...requestIdsFromSelectedCompany])]
        .filter(rid => !requestIdsFromBids.has(rid));
      const syntheticBids = noBidRequestIds.map(rid => ({
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
          const reqRow = requestMap[b.request_id];
          const reqStatus = (reqRow?.status ?? "").toLowerCase();
          const esc = escrowByRequestId[b.request_id];
          const txStatus = esc?.transaction_status ?? null;

          // 삭제/숨김된 요청은 진행중에서 제외 (소프트 삭제 반영).
          if (reqRow?.is_deleted === true || reqRow?.is_hidden === true) { excludedReasons.push(`${rid8}:req_deleted`); return false; }
          // 요청 행이 사라진(하드 삭제) 경우 — fetch 성공했는데도 없으면 제외.
          // (fetch 에러 시에는 제외하지 않아 정상 진행건이 사라지지 않도록 함)
          if (!reqRow && !reqErr) { excludedReasons.push(`${rid8}:req_missing`); return false; }

          // Hard exclude terminal / closed states (req-level or escrow-level).
          if (reqStatus && EXCL_REQ.has(reqStatus)) { excludedReasons.push(`${rid8}:req=${reqStatus}`); return false; }
          if (txStatus && EXCL_TX.has(txStatus))    { excludedReasons.push(`${rid8}:tx=${txStatus}`);  return false; }

          // SSOT(유일 기준): requests.selected_company_id === '이 업체'.
          //   · selected_company_id 가 null 이면 escrow(금액>0 포함)가 있어도 유령으로 간주, 제외.
          //   · 다른 업체를 선택했으면 제외.
          //   · status='in_progress' 단독으로는 절대 진행중 아님.
          const selCid = reqRow?.selected_company_id ?? null;
          if (!selCid) { excludedReasons.push(`${rid8}:no_selected_company(ghost)`); return false; }
          if (!candidateIdSet.has(selCid)) { excludedReasons.push(`${rid8}:selected_other`); return false; }

          // 현장방문 견적 단계(결제 전)는 activeJobs(CompanyActiveJobCard)에서 다룸 → companyJobs 제외(이중 노출 방지).
          // site_visiting/visit_requested 는 selected_company_id 가 이미 설정된 상태이므로
          // companyJobs 에도 포함 허용 → DashboardScreen "진행중" 탭에 노출.
          // final_quote_submitted 는 진행중으로 포함(multipath 에서도 제외하지 않음) → 목록 유지.
          const PRE_ESCROW = new Set(["site_visit", "escrow_pending"]);
          if (PRE_ESCROW.has(reqStatus)) { excludedReasons.push(`${rid8}:pre_escrow(activeJobs)`); return false; }

          // 여기 도달 = 이 업체가 선택된 계약 + 종료/현장방문단계 아님 → 진행중.
          return true;
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

      // 강제포함(selected_company_id) 진행건을 멀티패스 결과에 병합(중복 request 제거).
      const jobReqIds = new Set(jobs.map(j => j.request?.id).filter(Boolean));
      const mergedJobs = [...jobs, ...forcedJobs.filter(fj => fj.request?.id && !jobReqIds.has(fj.request.id))];

      dev.displayed_jobs = mergedJobs.length;
      // ── In-progress dedupe diagnostics (per request) ──
      dev.raw_count               = allBids.length + syntheticBids.length; // pre-dedupe candidate rows
      dev.deduped_count           = dedupedCandidates.length;              // after request_id dedupe
      dev.displayed_dashboard_count = mergedJobs.length;                   // after active-only filter + forced
      dev.forced_jobs             = forcedJobs.length;
      dev.realInProgressIds       = mergedJobs.map(j => j.request?.id).filter(Boolean).join(", ") || "none";
      dev.excluded_reason         = excludedReasons.length ? excludedReasons.join(" | ") : "none";
      // request_statuses for dashboard DEV (id:status)
      dev.request_statuses = (reqs ?? [])
        .map(r => `${r.id.slice(0,8)}:${r.status ?? "null"}`)
        .join(", ") || "none";
      try { console.log("[GONGGAN_DEBUG][realInProgressIds]", { source: "merged", multipath: jobs.map(j => j.request?.id).filter(Boolean), forced: forcedJobs.map(j => j.request?.id).filter(Boolean), merged: mergedJobs.map(j => j.request?.id).filter(Boolean) }); } catch {}
      setCompanyJobs(mergedJobs);
      setCompanyJobsDebug(dev);
    };

    loadJobs().catch(err => {
      setCompanyJobsDebug(d => ({ ...(d ?? {}), caught_err: err?.message ?? String(err) }));
    });
  }, [activeRole, user?.id, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load escrow+payouts for consumer requests.
  // ⚠️ status 단독으로 판단하지 않는다: 업체가 착공/단계 사진을 올려 에스크로 계약이 생겼어도
  //    requests.status 가 stale 'open' 으로 남아있는 경우가 있다(상태 전이 UPDATE 가 반영 안 된 구건).
  //    그 경우에도 에스크로/사진을 읽어 "진행중"으로 분류하고 사진 검토 UI 로 진입할 수 있어야 하므로,
  //    삭제/만료가 아닌(=잠재적으로 진행 가능한) 모든 요청에 대해 에스크로를 조회한다.
  useEffect(() => {
    if (activeRole !== "consumer") return;
    const candidates = myRequests.filter(r =>
      !r.isDeleted && !r.isExpiredByTime &&
      !["cancelled", "closed", "expired"].includes(r.status)
    );
    if (candidates.length === 0) return;
    candidates.forEach(r => {
      getEscrowWithPayouts(r.id).then(({ data }) => {
        // E: 에스크로 내용(에스크로 id·거래상태·payout 수)이 그대로면 setState 를 건너뛰어
        //    새 객체 참조로 인한 불필요한 리렌더를 막는다.
        setMyRequestsEscrow(prev => {
          const old = prev[r.id];
          const same = (old !== undefined)
            && (old?.escrow?.id ?? null) === (data?.escrow?.id ?? null)
            && (old?.escrow?.transaction_status ?? null) === (data?.escrow?.transaction_status ?? null)
            && (old?.payouts?.length ?? 0) === (data?.payouts?.length ?? 0);
          return same ? prev : { ...prev, [r.id]: data ?? null };
        });
        // self-heal: 에스크로(계약)가 있는데 requests.status 가 아직 'open' 이면 in_progress 로 전이.
        // 업체 입찰 목록(status='open' 기준)에서도 즉시 제외되어 이중 노출이 해소된다.
        if (data?.escrow && data.escrow.transaction_status !== "SETTLED" && r.status === "open") {
          setRequestInProgress(r.id).catch(() => {});
          setMyRequests(prev => prev.map(x => x.id === r.id
            ? { ...x, status: "in_progress", isActive: false, isClosed: false }
            : x));
        } else if (!data?.escrow && r.status === "open" && r.selectedBidId && r.selectedCompanyId) {
          // self-heal: 에스크로는 없지만 업체가 선택된(현장방문 단계) stale 'open' → site_visit 전이.
          // 의뢰인(요청 소유자)이 actor — RPC 내부에서 소유 검증. 선택 입찰/업체는 coalesce 로 보존.
          markRequestSiteVisit(r.id, { actorId: user.id }).catch(() => {});
          setMyRequests(prev => prev.map(x => x.id === r.id
            ? { ...x, status: "site_visit", isActive: false, isClosed: false }
            : x));
        }
      }).catch(() => {});
    });
  }, [myRequests, escrowRefreshTrigger, activeRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // 단계 전환 안내 토스트 — 에스크로 transaction_status 가 바뀌면 1회 표시.
  // (최초 로드는 baseline 으로 기록만 하고 토스트는 띄우지 않음)
  useEffect(() => {
    if (activeRole !== "consumer") return;
    const MSG = {
      STARTED:        "🎉 착공이 시작됐습니다 · 30%가 업체에 안전하게 지급됐어요. 다음 정산은 중간 완료 후입니다",
      MID_INSPECTION: "✅ 중간 단계가 확인됐습니다 · 40%가 업체에 지급됐어요. 이제 마무리 단계입니다",
      COMPLETED:      "🛠 마무리 단계입니다 · 완료 사진 확인 후 잔금이 지급됩니다",
      SETTLED:        "🎉 모든 공사가 완료됐습니다 · 총 거래가 안전하게 마무리됐어요. 후기를 남겨주세요",
    };
    Object.entries(myRequestsEscrow).forEach(([rid, ed]) => {
      const tx = ed?.escrow?.transaction_status;
      if (!tx) return;
      const prev = prevTxStatusRef.current[rid];
      if (prev !== undefined && prev !== tx && MSG[tx]) showToast(MSG[tx]);
      prevTxStatusRef.current[rid] = tx;
    });
  }, [myRequestsEscrow, activeRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 진행 알림 자동화(1단계) + 후기 요청 알림(2단계) ───────────────────────
  // 에스크로 단계가 바뀌면 알림 탭에 히스토리로 영구 기록(토스트는 일회성).
  // dedupe(type+related_id)로 새로고침/재방문해도 중복 생성되지 않음.
  useEffect(() => {
    if (activeRole !== "consumer" || !user?.id || user.isGuest || !IS_SUPABASE_READY) return;
    const entries = Object.entries(myRequestsEscrow);
    if (entries.length === 0) return;

    // 단계 → 알림 정의 (진행 알림: 즉시·무제한)
    const STAGE_NOTIF = {
      CONTRACTED:     { type: "CONTRACT_CREATED",     title: "계약 생성", message: "계약서가 생성됐습니다 📄 내용을 확인해보세요" },
      STARTED:        { type: "CONSTRUCTION_STARTED", title: "착공 시작", message: "착공이 시작됐어요 🏗️ 30%가 업체에 안전하게 지급됐습니다" },
      MID_INSPECTION: { type: "ESCROW_MID_CHECK",     title: "중간 점검", message: "중간 단계가 확인됐어요 · 40%가 안전하게 지급됐습니다" },
      COMPLETED:      { type: "CONSTRUCTION_DONE",    title: "공사 완료", message: "공사가 완료됐습니다 🎉 완료 확인 후 잔금이 지급됩니다" },
      SETTLED:        { type: "SETTLEMENT_DONE",      title: "정산 완료", message: "최종 정산이 완료됐어요 🎉 거래가 안전하게 마무리됐습니다" },
    };

    let cancelled = false;
    (async () => {
      const { data: existing } = await getNotifications(user.id);
      if (cancelled) return;
      const notifs = existing ?? [];

      for (const [rid, ed] of entries) {
        const esc = ed?.escrow;
        const tx  = esc?.transaction_status;
        if (!tx) continue;
        const req = myRequests.find(r => r.id === rid) ?? null;

        // (1) 현재 단계 진행 알림 — dedupe 로 단계당 1회만
        const stage = STAGE_NOTIF[tx];
        if (stage) {
          await sendTieredNotification({
            userId: user.id, type: stage.type, title: stage.title, message: stage.message,
            relatedId: rid, relatedType: "escrow", existing: notifs, dedupe: true,
          });
        }

        // (2) 후기 요청 알림 — 완료 24h 후 1회 + 48h 후 미작성 시 1회(최대 2회)
        if (tx === "COMPLETED" || tx === "SETTLED") {
          const doneAt = esc.step4_approved_at || esc.updated_at || esc.created_at;
          const hours  = doneAt ? (Date.now() - new Date(doneAt).getTime()) / 3600000 : 0;
          if (hours >= 24) {
            const { data: review } = await getReviewByRequest(rid);
            if (!review) {
              const label = [req?.area, req?.type].filter(Boolean).join(" ") || "이번 시공";
              const hasFirst = notifs.some(n => n.type === "REVIEW_REQUEST" && n.related_id === rid);
              if (!hasFirst) {
                await sendTieredNotification({
                  userId: user.id, type: "REVIEW_REQUEST", title: "후기를 남겨주세요",
                  message: `${label} 어떠셨나요? 후기를 남겨주시면 업체에게 큰 힘이 됩니다 ⭐`,
                  relatedId: rid, relatedType: "escrow", existing: notifs, dedupe: true,
                });
              } else if (hours >= 48) {
                await sendTieredNotification({
                  userId: user.id, type: "REVIEW_REQUEST_FOLLOWUP", title: "후기를 남겨주세요",
                  message: "아직 후기를 남기지 않으셨어요. 1분이면 작성 가능합니다 ⭐",
                  relatedId: rid, relatedType: "escrow", existing: notifs, dedupe: true,
                });
              }
            }
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [myRequestsEscrow, activeRole, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load recent lounge posts for home preview (consumer home section)
  useEffect(() => {
    getLoungePosts("all", 3).then(({ data }) => {
      if (data && data.length > 0) setLocalLoungePosts(data);
    }).catch(() => {});
  }, []);

  // STEP2: 인기 콘텐츠 큐레이션 — 조회수+좋아요 기준 상위 3건(시공후기 우선)
  const [popularPosts, setPopularPosts] = useState([]);
  useEffect(() => {
    getLoungePosts("all").then(({ data }) => {
      const list = (data ?? [])
        .filter(p => p.is_deleted !== true && p.is_hidden !== true && p.is_visible !== false)
        .map(p => ({ ...p, _score: (p.view_count ?? 0) + (p.like_count ?? 0) * 3 + (p.category === "review" ? 50 : 0) }))
        .sort((a, b) => b._score - a._score)
        .slice(0, 3);
      setPopularPosts(list);
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

      // DB writes — 멱등 에스크로 확보(중복 escrow_payments 생성 방지)
      const { data: escrowData, created: escrowCreated } = await getOrCreateEscrow({
        requestId:   pending.requestId,
        companyId:   pending.companyId,
        totalAmount: pending.bidPrice,
      });
      let pgContractId = escrowData?.id ?? null;

      if (pgContractId) {
        // 신규 생성된 에스크로에만 payout 4건 생성(기존 재사용 시 중복 생성 금지)
        if (escrowCreated) {
          await createEscrowPayoutsForContract(pgContractId, pending.companyId, pending.bidPrice, 0.04, 0.1);
        }
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

  // 관심 업체(위시리스트)
  const [savedCompanyIds, setSavedCompanyIds] = useState([]);
  const [savedCompanies, setSavedCompanies] = useState([]);
  useEffect(() => {
    if (activeRole === "consumer" && user?.id) {
      getSavedCompanyIds(user.id).then(setSavedCompanyIds).catch(() => {});
    }
  }, [activeRole, user?.id]);
  const toggleSaveCompany = async (company) => {
    if (!user?.id || !company?.id) return;
    const isSaved = savedCompanyIds.includes(company.id);
    // optimistic
    setSavedCompanyIds(prev => isSaved ? prev.filter(id => id !== company.id) : [...prev, company.id]);
    try {
      if (isSaved) await unsaveCompany(user.id, company.id);
      else await saveCompany(user.id, company.id);
    } catch { /* 실패 시 다음 로드에서 동기화 */ }
  };
  useEffect(() => {
    if (activeRole !== "consumer" || !user?.id) { setSavedCompanies([]); return; }
    getSavedCompanies(user.id).then(({ data }) => {
      setSavedCompanies((data ?? []).map(r => r.companies).filter(Boolean).map(normalizeCompany));
    }).catch(() => {});
  }, [activeRole, user?.id, savedCompanyIds.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 고객 신뢰도 지수 (업체들이 남긴 평가 평균)
  const [customerTrust, setCustomerTrust] = useState(null);
  useEffect(() => {
    if (activeRole === "consumer" && user?.id) {
      getCustomerTrust(user.id).then(setCustomerTrust).catch(() => {});
    }
  }, [activeRole, user?.id]);

  // 업체 목록 정렬 — 추천순(공간온도+후기) / 후기많은순 / 응답빠른순 / 최근활동순
  const [companySort, setCompanySort] = useState("recommend");
  const sortedCompanies = useMemo(() => {
    const list = [...(companies ?? [])];
    const respHours = (c) => (c.avgResponseHours > 0 ? c.avgResponseHours : Infinity);
    switch (companySort) {
      case "reviews":
        return list.sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0));
      case "response":
        return list.sort((a, b) => respHours(a) - respHours(b));
      case "recent":
        return list.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.temp ?? 0) - (a.temp ?? 0));
      case "recommend":
      default:
        // 공간온도 + 후기 평점 + 후기 수 가중
        return list.sort((a, b) =>
          ((b.temp ?? 0) + (b.rating ?? 0) * 2 + (b.reviews ?? 0) * 0.1) -
          ((a.temp ?? 0) + (a.rating ?? 0) * 2 + (a.reviews ?? 0) * 0.1)
        );
    }
  }, [companies, companySort]);

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

  // C-4: 채팅 안읽음 개수(room_id별). roomId = `${user.id}_${companyId}` (ChatScreen 규칙과 동일).
  const [unreadByRoom, setUnreadByRoom] = useState({});
  const refreshUnreadChats = async () => {
    if (!user?.id || user?.isGuest) { setUnreadByRoom({}); return; }
    const roomIds = (companies ?? []).map(c => `${user.id}_${c.id}`);
    const { data } = await getUnreadChatCounts(roomIds, user.id);
    setUnreadByRoom(data ?? {});
  };
  // 진입/대화목록 전환/채팅방 이탈 시 갱신(과도한 폴링 없음).
  useEffect(() => {
    if (!user?.id || user?.isGuest) return;
    if (screen === "chatlist" || screen === "home") refreshUnreadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, user?.id, companies?.length]);
  const unreadTotal = Object.values(unreadByRoom).reduce((a, b) => a + (b || 0), 0);

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
    console.log('[BID_SUBMIT_BUTTON_CLICK]', {
      requestId: request?.id,
      ownerId: user?.id,
      currentUserId: currentUser?.id,
      currentCompanyId: currentUser?.id,
      price: bidData?.price,
    });
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
    // bids.company_id FK → users.id. ownerId(user.id) 사용. companies.id는 FK 에러 유발.
    const finalBidCompanyId = user?.id;
    const realCompanyId = currentUser?.id;  // companies.id — selected_company_id/site_visits 전용
    if (!finalBidCompanyId || typeof finalBidCompanyId !== "string" || !finalBidCompanyId.includes("-")) {
      alert('오류: 업체 소유자 ID를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    console.log('[BID_SUBMIT_IDS]', { finalBidCompanyId, realCompanyId });

    // H-2: 동시 더블서브밋 가드 (빠른 연타로 두 번 insert 되는 것 방지)
    if (bidSubmitGuardRef.current) return;
    bidSubmitGuardRef.current = true;

    let okFlag = false;
    let didInsert = false;
    let bidCountAfter = 0;
    try {
      // 한 업체당 1입찰 정책 — DB에서 이 업체의 기존 입찰을 확인(로컬 state 누락/새로고침 대비).
      // 기존 데이터 호환: bids.company_id 가 ownerId(user.id)로 저장된 경우도 같은 업체로 인식.
      let existingId = null;
      const { data: existingBids } = await getBidsForRequest(request.id);
      const mine = (existingBids ?? []).find(b => b.company_id === finalBidCompanyId || b.company_id === user.id);
      if (mine) existingId = mine.id;
      else {
        const localMine = submittedBids.find(
          b => b.requestId === request.id && (b.companyId === finalBidCompanyId || b.companyId === user.id) && !String(b.id).startsWith("tmp-")
        );
        if (localMine) existingId = localMine.id;
      }

      if (existingId) {
        // ── 수정 경로 — 기존 입찰 내용 갱신 ──
        const { data: upd, error: updErr } = await updateBid(existingId, {
          price:         bidData.price,
          period_days:   bidData.period,
          material_note: bidData.material,
          comment:       bidData.comment,
        });
        if (updErr) { showToast(`입찰 수정 실패: ${updErr.message}`); return false; }
        if (upd) {
          okFlag = true;
          setSubmittedBids(prev => {
            const others = prev.filter(b => b.id !== existingId);
            return [...others, { ...normalizeBid(upd), company: actor }];
          });
          showToast("입찰 내용을 수정했어요");
          return true;
        }
        return false;
      }

      // ── 신규 입찰 경로 ──
      // Optimistic add 생략 — DB insert 실패 시 flip-flop 방지.
      // INSERT to Supabase — company_id must be users.id (FK target)
      const { data, error } = await createBid({
        request_id:    request.id,
        company_id:    finalBidCompanyId,  // users.id ← FK (companies.id 금지)
        price:         bidData.price,
        period_days:   bidData.period,
        material_note: bidData.material,
        comment:       bidData.comment,
      });
      if (error) {
        console.error('[BID_SUBMIT_FAILED]', error);
        setBidDebug({
          payload_company_id: finalBidCompanyId,
          expected_fk_target: "users.id",
          companyProfile_id:  currentUser?.id ?? null,
          companyProfile_ownerId: currentUser?.ownerId ?? null,
          request_id:   request.id,
          insertResult: null,
          insertError:  error.message,
        });
        const dup = /duplicate|unique/i.test(error.message ?? "");
        showToast(dup ? "이미 입찰한 요청이에요. 입찰 수정으로 변경해주세요." : `입찰 저장 실패: ${error.message}`);
        alert('입찰 저장 실패: ' + error.message);
        return;
      }
      if (data) {
        okFlag = true;
        didInsert = true;
        console.log('[BID_SUBMIT_SUCCESS]', data);
        // DB 성공 이후에만 local state 추가 (flip-flop 방지)
        setSubmittedBids(prev => [...prev, { ...normalizeBid(data), company: actor }]);
        // Post-insert verification: confirm bid is in DB with correct request_id
        const { data: verifyData } = await getBidsForRequest(request.id);
        bidCountAfter = verifyData?.length ?? 0;
        setBidDebug({
          payload_company_id: finalBidCompanyId,
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

    if (!okFlag || !didInsert) return; // 수정이거나 실패면 신규 입찰 알림 생략

    // ── 진행 알림(1단계): 의뢰인에게 "견적 도착" 알림 ──
    // 견적 요청 주인(consumer)에게 즉시 알림. 진행 알림이라 야간/한도 제한 없음.
    if (request.user_id && request.user_id !== finalBidCompanyId) {
      const n = bidCountAfter || 1;
      const allIn = n >= 3;
      sendTieredNotification({
        userId:      request.user_id,
        type:        allIn ? "BID_ALL_IN" : "BID_RECEIVED",
        title:       "견적 도착",
        message:     allIn
          ? `업체 ${n}곳이 견적을 보냈어요 📋 지금 비교해보세요`
          : `업체 ${n}곳이 견적을 보냈어요 📋`,
        relatedId:   request.id,
        relatedType: "request",
      }).catch(() => {});
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
    return true;
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

  // ── 라운지 SEO 딥링크 라우팅 ─────────────────────────────
  // /lounge/posts/:id/:slug · /lounge/category/:seoSlug · /lounge/region/:slug
  // 봇은 vercel.json rewrite 로 /api/prerender 가 처리하고, 사람(SPA)은 여기서 해당 화면으로 진입.
  const applyLoungeRoute = (pathname) => {
    const m = pathname.match(/^\/lounge(?:\/(.*))?$/);
    if (!m) return false;
    const parts = (m[1] || "")
      .split("/")
      .filter(Boolean)
      .map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
    if (parts[0] === "posts" && parts[1]) {
      setLoungePost({ id: parts[1], _deeplink: true });
      setScreen("lounge-detail");
    } else if (parts[0] === "category" && parts[1]) {
      setLoungeInitialCategory(seoSlugToCategoryId(parts[1]) || "all");
      setScreen("lounge");
    } else {
      setScreen("lounge");
    }
    return true;
  };

  // 푸시 클릭 딥링크: /requests/:id · /contracts/:id (라운지 외)
  const applyPushDeepLink = (pathname) => {
    const req = pathname.match(/^\/requests\/([^/]+)/);
    if (req) { setBidViewRequestId(decodeURIComponent(req[1])); go("bidstatus"); return true; }
    const con = pathname.match(/^\/contracts\/([^/]+)/);
    if (con) { setContractId(decodeURIComponent(con[1])); go("escrow"); return true; }
    return false;
  };

  useEffect(() => {
    const route = (p) => applyLoungeRoute(p) || applyPushDeepLink(p);
    route(window.location.pathname);
    const onPop = () => {
      const handled = route(window.location.pathname);
      if (!handled && screenRef.current?.startsWith?.("lounge")) setScreen("home");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            {/* ── 진행감 카드 — 진행 중인 계약(에스크로)이 있을 때만 최상단 노출 ── */}
            {(() => {
              const progRows = myRequests.filter(r => isRequestInProgress(r, myRequestsEscrow[r.id] ?? null));
              if (progRows.length === 0) return null;
              return progRows.map(progRow => {
              const ed = myRequestsEscrow[progRow.id] ?? null;
              const prog = computeProgress(progRow, ed) ?? { percent: 0, stepNo: 1, totalSteps: 4, nextActionText: "업체가 착공을 준비하고 있습니다" };
              const title = `${progRow.area || ""} ${progRow.type || "시공"}`.trim();
              return (
                <div key={progRow.id} style={{ background:C.ivory, borderRadius:R.xl, padding:S.xxl, marginBottom:S.lg,
                  border:`1px solid ${C.brandM}`, boxShadow:SHADOW.card }}>
                  <div style={{ fontSize:14, fontWeight:800, color:C.brandD, marginBottom:6, lineHeight:1.8 }}>
                    🏗️ 현재 시공 진행 중
                  </div>
                  <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.md, lineHeight:1.8 }}>{title}</div>
                  {/* 진행바 */}
                  <div style={{ height:10, borderRadius:R.full, background:C.bgWarm, overflow:"hidden", marginBottom:6 }}>
                    <div style={{ width:`${prog.percent}%`, height:"100%", background:C.brandD, borderRadius:R.full, transition:"width 0.4s ease" }} />
                  </div>
                  <div style={{ fontSize:14, color:C.text2, lineHeight:1.8, marginBottom:S.md }}>
                    {prog.stepNo}단계 / 전체 {prog.totalSteps}단계 · <b style={{ color:C.brandD }}>{prog.percent}%</b>
                  </div>
                  <div style={{ fontSize:14, color:C.text2, lineHeight:1.8, marginBottom:S.lg }}>
                    다음: {prog.nextActionText}
                  </div>
                  <button onClick={() => {
                    setBidViewRequestId(progRow.id);
                    // 이 진행 카드는 활성 에스크로(prog!=null)일 때만 렌더되므로, request.status 가
                    // stale(final_quote_submitted/escrow_pending)이어도 결제 전 화면(bidstatus)이
                    // 아니라 공사 진행(escrow)으로 보낸다 — escrow 존재가 status 보다 우선.
                    go("escrow");
                  }}
                    style={{ background:C.brandD, color:"#fff", border:"none", borderRadius:R.full,
                      padding:"12px 24px", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                    계약 확인 →
                  </button>
                </div>
              );
              });
            })()}

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
                            onClick={() => setHomeReviewDetail(rv)}
                            style={{ flexShrink:0, width:228, background:C.surface,
                              borderRadius:R.xl, border:`1px solid ${C.bgWarm}`,
                              overflow:"hidden", boxShadow:"0 1px 8px rgba(28,23,18,0.06)",
                              cursor:"pointer" }}>
                            {hasPhoto && (
                              <div style={{ display:"flex", height:116, overflow:"hidden" }}>
                                {showSplit ? (
                                  <>
                                    <div style={{ flex:1, position:"relative", borderRight:"1.5px solid #fff" }}>
                                      <img src={beforeThumb} alt=""
                                        onClick={(e) => { e.stopPropagation(); setHomeReviewViewer({ images:[beforeThumb,afterThumb].filter(Boolean), index:0 }); }}
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
                                        onClick={(e) => { e.stopPropagation(); setHomeReviewViewer({ images:[beforeThumb,afterThumb].filter(Boolean), index:1 }); }}
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
                                      onClick={(e) => { e.stopPropagation(); setHomeReviewViewer({ images:[afterThumb ?? beforeThumb].filter(Boolean), index:0 }); }}
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

            {/* STEP2: 이번 주 인기 콘텐츠 — 조회수+좋아요 기준 상위 3건 */}
            {popularPosts.length > 0 && (
              <div style={{ background:C.ivory, borderRadius:12, padding:S.xl, marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize:16, fontWeight:800, color:"#1E3D2F", marginBottom:S.md, lineHeight:1.8 }}>🔥 이번 주 인기</div>
                {popularPosts.map(post => {
                  const thumb = post.image_urls?.[0] ?? null;
                  return (
                    <div key={post.id}
                      onClick={() => { setLoungePost(post); go("lounge-detail"); try { window.history.pushState({}, "", buildPostPath(post)); } catch {} }}
                      style={{ display:"flex", gap:S.md, alignItems:"center", padding:`${S.sm}px 0`, cursor:"pointer", borderBottom:`1px solid ${C.bgWarm}` }}>
                      {thumb && <img src={thumb} alt="" loading="lazy" style={{ width:56, height:56, borderRadius:R.md, objectFit:"cover", flexShrink:0, border:`1px solid ${C.bgWarm}` }} />}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:C.text1, lineHeight:1.8, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                          {post.is_expert ? "🛡️ " : ""}{post.title ?? post.content?.slice(0,30)}
                        </div>
                        <div style={{ fontSize:13, color:C.text3, lineHeight:1.8 }}>👁 {(post.view_count ?? 0).toLocaleString()} · ❤️ {post.like_count ?? 0}</div>
                      </div>
                      <span style={{ fontSize:13, color:"#1E3D2F", fontWeight:800, flexShrink:0 }}>읽기 →</span>
                    </div>
                  );
                })}
              </div>
            )}

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
              // 완료/정산완료(에스크로 기준)는 active 에서 제외.
              // 마감/완료/만료된 요청은 홈에 노출하지 않음(이력은 마이페이지에서 확인).
              const isSettled = (r) => isRequestSettled(r, myRequestsEscrow[r.id] ?? null);
              // "내 견적 요청" = open(견적 단계)만. 진행중(에스크로/계약)은 상단 진행 배너에서 다룸 → 이중 노출 방지.
              const activeReqs  = myRequests.filter(r => isRequestOpenForQuotes(r, myRequestsEscrow[r.id] ?? null));
              return activeReqs.length > 0 ? (
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
                              ) : (stage?.action === "bids" || r.bidCount > 0) ? (
                                // 결제 대기 단계(final_quote_submitted/escrow_pending, action="bids")는
                                // bids 배열이 비어 bidCount=0 이어도 반드시 BidStatusScreen 으로 진입한다.
                                // (기존 버그: bidCount>0 일 때만 버튼 노출 → "검토 중"에 갇혀 결제 화면 도달 불가)
                                <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.md,
                                  marginBottom:S.md, border:`1px solid ${C.brandM}` }}>
                                  <div style={{ fontSize:13, fontWeight:800, color:C.brand, marginBottom:S.sm }}>
                                    {r.bidCount > 0 ? `🔔 업체 ${r.bidCount}곳이 입찰했어요` : `📋 ${stage?.label ?? "최종 견적서 확인"}`}
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
                                  <button onClick={() => { console.log("[GONGGAN_DIAG][homeCard:nav]", { reqId: r.id, status: r.status, action: stage?.action ?? null, bidCount: r.bidCount ?? 0, to: "bidstatus" }); setBidViewRequestId(r.id); setScreen("bidstatus"); }}
                                    style={{ width:"100%", padding:"11px", background:C.brand, color:"#fff",
                                      border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer",
                                      boxShadow:`0 3px 12px ${C.brand}44` }}>
                                    {stage?.cta ?? "견적 비교하고 업체 선택하기"} →
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
                                ) : (stage?.action === "bids" || r.bidCount > 0) ? (
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

            {/* 탐색 카테고리 칩 — 검색→탐색→신뢰 형성 동선 */}
            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:S.md, scrollbarWidth:"none" }}>
              {[["all","전체"],["review","시공후기"],["recommend","업체추천"],["quote_worry","견적고민"],["room_deco","집꾸미기"],["move_in","이사입주"]].map(([cat,label]) => (
                <button key={cat}
                  onClick={() => { if (cat === "all") { setScreen("home"); } else { setLoungeInitialCategory(cat); setScreen("lounge"); } }}
                  style={{ flexShrink:0, padding:"7px 14px", borderRadius:R.full, cursor:"pointer",
                    border:`1px solid ${C.bgWarm}`, background:C.surface, color:C.text2, fontSize:13, fontWeight:700, fontFamily:"inherit" }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>인근 업체</div>
              <button onClick={() => setScreen("map")} style={{ fontSize:13, background:"none", border:"none", cursor:"pointer", color:C.brand, fontWeight:700 }}>지도로 보기 →</button>
            </div>

            {/* 정렬 옵션 */}
            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:S.md, scrollbarWidth:"none" }}>
              {[["recommend","추천순"],["reviews","후기 많은 순"],["response","응답 빠른 순"],["recent","최근 활동 순"]].map(([key,label]) => {
                const active = companySort === key;
                return (
                  <button key={key} onClick={() => setCompanySort(key)}
                    style={{ flexShrink:0, padding:"6px 12px", borderRadius:R.full, cursor:"pointer", fontFamily:"inherit",
                      border:"none", background: active ? C.brand : C.bgWarm,
                      color: active ? "#fff" : C.text2, fontSize:12, fontWeight:700 }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {sortedCompanies.map(c => <CompanyCard key={c.id} company={c} isLoggedIn={!!user?.id} onClick={() => go("portfolio",c)} saved={savedCompanyIds.includes(c.id)} onToggleSave={user?.id ? toggleSaveCompany : null} />)}

            {/* 라운지 섹션 — 둘러보기 하단 */}
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginTop:S.xl, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.lg }}>라운지</div>
              {localLoungePosts.slice(0,3).length > 0 ? (
                <div style={{ display:"flex", flexDirection:"column", gap:S.sm, marginBottom:S.lg }}>
                  {localLoungePosts.slice(0,3).map(post => (
                    <div key={post.id} onClick={() => { setLoungePost(post); go("lounge-detail"); try { window.history.pushState({}, "", buildPostPath(post)); } catch {} }}
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
                    <TempBadge temp={currentUser?.temp ?? 36.5} lg info />
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

            {siteVisitJobs.length > 0 && (
              <div style={{ marginBottom:S.xl }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>🔨 진행중 작업 ({siteVisitJobs.length})</div>
                {siteVisitJobs.map((job) => (
                  <CompanyActiveJobCard
                    key={job.bid?.id ?? job.request?.id}
                    job={job}
                    onAction={(actionType, j) => {
                      if (actionType === "schedule" || actionType === "checkin" || actionType === "field_estimate") {
                        setSiteVisitJob(j);
                      } else if (actionType === "platform_estimate") {
                        setEstimateJob(j);
                      } else if (actionType === "escrow") {
                        go("escrow");
                      } else if (actionType === "accept" || actionType === "reject") {
                        // 현장견적 요청 수락/거절 → site_visit_respond RPC + 목록 새로고침
                        const svId = j.siteVisit?.id;
                        if (!svId) { showToast("현장견적 요청 정보를 찾을 수 없어요", false); return; }
                        respondSiteVisit(svId, actionType === "accept" ? "accept" : "reject", user?.id ?? null)
                          .then(({ error }) => {
                            if (SHOW_DEBUG_UI) console.log("[GONGGAN_DEBUG][siteVisitRespond]", { svId, action: actionType, error: error?.message ?? null });
                            if (error) { showToast("처리 실패: " + error.message, false); return; }
                            showToast(actionType === "accept" ? "현장견적을 수락했어요" : "현장견적을 거절했어요");
                            setEscrowRefreshTrigger(t => t + 1);
                          })
                          .catch(e => showToast("오류: " + (e?.message ?? String(e)), false));
                      }
                    }}
                  />
                ))}
              </div>
            )}

            <LiveFeed />

            {/* ── 진행중 작업(에스크로 계약) ─────────────────────────────── */}
            {companyJobs.length > 0 && (
              <div style={{ marginBottom:S.xl }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>
                  🏗 내 시공 진행중
                  <span style={{ fontSize:13, fontWeight:600, color:C.brand, marginLeft:6 }}>
                    {companyJobs.length}건
                  </span>
                </div>
                {companyJobs.map(({ bid, request }) => (
                  <div key={bid.id ?? request?.id} style={{
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
                      <div>
                        <div style={{ fontSize:11, color:C.text4, fontWeight:700 }}>계약 금액 (내 입찰가)</div>
                        <div style={{ fontSize:15, fontWeight:900, color:C.brand }}>
                          {bid.price ? `${Math.round(Number(bid.price)).toLocaleString()}만원` : "금액 미정"}
                        </div>
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
                {biddableRequests.length > 0 && (
                  <span style={{ fontSize:13, fontWeight:600, color:C.brand, marginLeft:6 }}>
                    {biddableRequests.length}건
                  </span>
                )}
              </div>
              <button onClick={loadCompanyRequests} style={{ fontSize:13, background:C.brandL, border:`1px solid ${C.brandM}`, color:C.brand, borderRadius:R.full, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🔄 새로고침</button>
            </div>

            {/* 안정적인 div 래퍼 — siteVisitJobs 섹션이 동시에 추가/제거될 때 React 재조정 오류 방지(#210) */}
            <div>
              {biddableRequests.length === 0 ? (
                <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xxl, textAlign:"center", border:`1px solid ${C.bgWarm}`, marginBottom:S.xl }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>📭</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text1, marginBottom:6 }}>아직 새 요청이 없어요 🏠</div>
                  <div style={{ fontSize:13, color:C.text3, lineHeight:1.6 }}>
                    의뢰인이 요청을 등록하면 이곳에 표시됩니다
                    {SHOW_DEBUG_UI && <><br/>{`(db_rows: ${reqDebug?.companyRows ?? "?"}, fetch_err: ${reqDebug?.companyFetchError ?? "none"})`}</>}
                  </div>
                </div>
              ) : (
                biddableRequests.map(r => {
                  const _compId = currentUser?.id;
                  const _ownId  = user?.id;
                  const myBidFromState = submittedBids.find(b =>
                    b.requestId === r.id &&
                    (b.companyId === _compId || b.companyId === _ownId) &&
                    !String(b.id).startsWith("tmp-")
                  ) ?? null;
                  const myBidFromDb = !myBidFromState
                    ? (() => {
                        const rawBids = Array.isArray(r.bidsRaw) ? r.bidsRaw : [];
                        const db = rawBids.find(b => b?.company_id === _compId || b?.company_id === _ownId);
                        if (!db) return null;
                        return { id: db.id, requestId: r.id, companyId: db.company_id, price: db.price ?? 0, status: db.status ?? "pending" };
                      })()
                    : null;
                  const myBid = myBidFromState ?? myBidFromDb;
                  const siteVisitForBid = siteVisitJobs.find(j => j.request?.id === r.id)?.siteVisit ?? null;
                  return (
                    <BidCard
                      key={r.id}
                      r={r}
                      currentUser={currentUser}
                      alreadyBid={!!myBid}
                      myBid={myBid}
                      siteVisit={siteVisitForBid}
                      onBidSubmit={isGuestCompany ? null : data => addBid(r, data)}
                      onRequiresAuth={isGuestCompany ? () => setShowRegisterPrompt(true) : null}
                    />
                  );
                })
              )}
            </div>

            {SHOW_DEBUG_UI && (
              <div style={{ margin:"16px 0", background:"rgba(0,0,0,0.92)", color:"#0f0", borderRadius:8, padding:"8px 12px", fontSize:11, lineHeight:2, fontFamily:"monospace", maxHeight:600, overflowY:"auto" }}>
                [DEV:company] screen:{screen}<br/>
                user.id: {user?.id ?? "null"}<br/>
                currentUser.id: {currentUser?.id ?? "null ⚠️"}<br/>
                selectedBid.id: {selectedBid?.id ?? "null"} | requestId: {selectedBid?.requestId ?? "null"}<br/>
                contractId: {contractId ?? "null"}<br/>
                <span style={{color: reqDebug?.companyFetchError ? "#f66" : "#0f0"}}>fetch_err: {reqDebug?.companyFetchError ?? "none"}</span><br/>
                last_fetch: {lastFetchAt ?? "—"} | db_rows: {reqDebug?.companyRows ?? "?"} | active: {customerRequests.filter(r=>r.isActive).length} | biddable: {biddableRequests.length} | in_progress_excluded: {inProgressRequestIds.size}<br/>
                <span style={{color:"#ff0"}}>── DB open requests (full id) ──</span><br/>
                {(reqDebug?.companyData ?? []).map((r, i) => (
                  <span key={r.id} style={{display:"block", color:"#8ff"}}>
                    [{i}] {r.id} {r.space_type} status:{r.status} exp:{r.expires_at?.slice(0,10) ?? "NULL"}
                  </span>
                ))}
                {(reqDebug?.companyData ?? []).length === 0 && reqDebug != null && <span style={{color:"#f88"}}>⚠️ DB rows: 0 — fetch_err 확인<br/></span>}
                <span style={{color:"#ff0"}}>── displayed biddable (full id) ──</span><br/>
                {biddableRequests.map(r=>(
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
                  <span key={j.bid?.id ?? j.request?.id ?? i} style={{display:"block", color:"#aff"}}>
                    job[{i}] bid:{j.bid?.id?.slice(0,8)} req:{j.request?.id?.slice(0,8)} {j.request?.type} {j.request?.status}
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
            {/* 지역 선택 바 — 저장된 관심지역 칩(최대 2)만 노출. 임시 3번째 칩 없음. */}
            {(() => {
              const activeKey = activeRegion ? regionKey(activeRegion.city, activeRegion.district) : null;
              return (
                <RegionSelectorBar
                  regions={activityRegions}
                  activeKey={activeKey}
                  onSelect={(r) => {
                    // r 없음(+ 지역 / 지역 설정) → 추가 모드로 선택 시트 오픈
                    if (!r) { setEditingRegionIndex(null); openRegionChooser(); return; }
                    // 저장된 칩 탭 → 그 슬롯 교체 모드 + 지도 이동 + 선택 시트 오픈
                    const idx = activityRegions.findIndex(s => regionKey(s.city, s.district) === regionKey(r.city, r.district));
                    if (idx !== -1) { setEditingRegionIndex(idx); setActiveRegion(r); openRegionChooser(); return; }
                    setEditingRegionIndex(null); onPickCurrentRegion(r);
                  }}
                />
              );
            })()}
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
              onClose={() => { setRegionSheetOpen(false); setEditingRegionIndex(null); }}
              selectedRegions={activityRegions}
              maxCount={2}
              title="관심지역 저장"
              subtitle="관심지역은 최대 2곳까지 저장할 수 있어요"
              onSave={(entries) => { setEditingRegionIndex(null); onSaveRegions(entries); }}
            />

            {/* 지역 선택 — 교체 모드면 슬롯 교체, 아니면 현재지역만 변경 */}
            <RegionSelectSheet
              open={regionExploreOpen}
              onClose={() => { setRegionExploreOpen(false); setEditingRegionIndex(null); }}
              title={editingRegionIndex !== null ? "이 칩을 다른 지역으로 교체" : "다른 지역 둘러보기"}
              subtitle={editingRegionIndex !== null
                ? "지역을 선택하면 현재 칩이 해당 지역으로 교체돼요"
                : "지역을 선택하면 지도와 업체 목록이 해당 지역으로 바뀌어요"}
              onPick={handleExplorePick}
            />

            {/* 지역 칩 클릭 시 열리는 선택 시트 — 교체 모드/추가 모드 분기 */}
            {regionChooserOpen && (() => {
              const editing = editingRegionIndex !== null;
              const editLabel = editing ? (activityRegions[editingRegionIndex]?.district || activityRegions[editingRegionIndex]?.city || "이 지역") : "";
              return (
              <div onClick={() => { setRegionChooserOpen(false); setEditingRegionIndex(null); }}
                style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1000, display:"flex", alignItems:"flex-end" }}>
                <div onClick={e => e.stopPropagation()}
                  style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:"20px 20px 36px" }}>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:editing ? 4 : S.lg }}>
                    {editing ? `${editLabel} 교체` : "지역 선택"}
                  </div>
                  {editing && (
                    <div style={{ fontSize:12, color:C.text3, marginBottom:S.lg }}>새 지역을 선택하면 이 칩이 교체돼요</div>
                  )}
                  <button onClick={onExploreRegion}
                    style={{ width:"100%", padding:S.xl, marginBottom:S.sm, background:C.brandL, border:`1px solid ${C.brandM}`, borderRadius:R.lg, fontSize:14, fontWeight:800, color:C.brand, cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                    🔎 {editing ? "다른 지역 선택해 교체하기" : "다른 지역 둘러보기"}
                  </button>
                  <button onClick={onAddRegionByGps} disabled={gpsLoading}
                    style={{ width:"100%", padding:S.xl, marginBottom:S.sm, background:C.bg, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontSize:14, fontWeight:700, color:C.text1, cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                    📍 {gpsLoading ? "현재 위치 확인 중..." : (editing ? "현재 위치로 교체하기" : "현재 위치로 관심지역 추가")}
                  </button>
                  {!editing && (
                    <button onClick={onAddRegionManual}
                      style={{ width:"100%", padding:S.xl, background:C.bg, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontSize:14, fontWeight:700, color:C.text1, cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                      ⭐ 관심지역으로 저장 (최대 2곳)
                    </button>
                  )}
                </div>
              </div>
              );
            })()}

            {/* 현재 위치 지역 저장/교체 확인 */}
            {gpsPendingRegion && (
              <div onClick={() => { setGpsPendingRegion(null); setEditingRegionIndex(null); }}
                style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1001, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
                <div onClick={e => e.stopPropagation()}
                  style={{ background:C.surface, borderRadius:R.xl, width:"100%", maxWidth:360, padding:"24px 22px" }}>
                  <div style={{ fontSize:30, textAlign:"center", marginBottom:10 }}>📍</div>
                  <div style={{ fontSize:13, color:C.text3, textAlign:"center", marginBottom:4 }}>현재 위치</div>
                  <div style={{ fontSize:17, fontWeight:800, color:C.text1, textAlign:"center", marginBottom:S.lg }}>
                    {gpsPendingRegion.rawSido} {gpsPendingRegion.sigungu}
                  </div>
                  <div style={{ fontSize:13, color:C.text2, textAlign:"center", marginBottom:S.xl }}>
                    {editingRegionIndex !== null
                      ? `${activityRegions[editingRegionIndex]?.district || activityRegions[editingRegionIndex]?.city || "현재 칩"}을(를) 이 지역으로 교체할까요?`
                      : "이 지역을 내 활동지역으로 저장할까요?"}
                  </div>
                  <div style={{ display:"flex", gap:S.sm }}>
                    <button onClick={() => { setGpsPendingRegion(null); setEditingRegionIndex(null); }}
                      style={{ flex:0.5, padding:S.lg, background:C.bg, color:C.text2, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>취소</button>
                    <button onClick={confirmSaveGpsRegion}
                      style={{ flex:1, padding:S.lg, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                      {editingRegionIndex !== null ? "이 지역으로 교체하기" : "이 지역 저장하기"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {screen==="portfolio" && selCo && <PortfolioScreen company={selCo} onChat={c => isGuestCompany ? setShowRegisterPrompt(true) : go("chat",c)} onReview={() => go("review",selCo)} onBack={() => setScreen("home")} onEscrow={() => go("escrow")} />}
        {screen==="review" && selCo && <ReviewScreen company={selCo} onBack={() => setScreen("portfolio")} currentUser={currentUser} requestId={bidViewRequestId ?? null} contractId={contractId ?? null} onEarnToken={earnToken} />}
        {screen==="chat" && selCo && <ChatScreen company={selCo} user={user} onBack={() => setScreen(prevScreen==="chatlist"?"chatlist":"portfolio")}
          onQuoteRequest={activeRole === "consumer" ? () => { setScreen("home"); handleOpenNewReq(); } : undefined} />}
        {screen==="lounge-chat" && loungeChat && (
          <ChatScreen
            mode="lounge"
            roomId={loungeChat.roomId}
            partner={loungeChat.partner}
            user={user}
            onBack={() => setScreen("my")}
            onQuoteRequest={activeRole === "consumer" ? () => {
              if (loungeChat.partner?.postTitle) {
                setReqPrefill({ desc: `라운지 글 "${loungeChat.partner.postTitle}" 관련 상담에서 이어진 견적 요청입니다.\n` });
              }
              setScreen("home"); handleOpenNewReq();
            } : undefined}
            onOpenSource={(postId) => { setLoungePost({ id: postId, _deeplink: true }); go("lounge-detail"); }}
            onOpenPortfolio={(ownerId) => {
              const co = companies.find(c => c.ownerId === ownerId || c.id === ownerId);
              if (co) go("portfolio", co);
            }}
          />
        )}
        {screen==="escrow" && <EscrowScreen onBack={() => { setEscrowRefreshTrigger(t => t+1); setScreen(prevScreen||"home"); }} activeRole={activeRole} selectedBid={selectedBid} currentUser={currentUser} contractId={contractId} userId={user?.id ?? null} request={[...myRequests, ...customerRequests].find(r => r.id === bidViewRequestId) ?? null} onReview={(co) => { if (co) setSelCo(co); setScreen("review"); }} />}
        {screen==="dashboard" && <DashboardScreen onBack={() => setScreen("home")} onEscrow={() => go("escrow")} onOpenJob={(bid) => { if (bid) { setSelectedBid(bid); setBidViewRequestId(bid.requestId); } go("escrow"); }} companyJobs={companyJobs} companyJobsDebug={companyJobsDebug} allRequests={customerRequests} currentUser={currentUser} submittedBids={submittedBids} userId={user?.id} />}
        {screen==="bidstatus" && (
          <BidStatusScreen
            onBack={() => setScreen("home")}
            onChat={c => go("chat",c)}
            onEscrow={(bid) => { setSelectedBid(bid); if (bid?.contractId) setContractId(bid.contractId); go("escrow"); }}
            onReview={(co) => { if (co) setSelCo(co); setScreen("review"); }}
            bids={(() => {
              if (!bidViewRequestId) return [];
              // 소비자 세션에서는 submittedBids가 비어 있어도 request.bidsRaw(getUserRequests 반환값)를
              // 초기 bids로 넘겨 BidStatusScreen이 즉시 "이 업체로 선택하기" 버튼을 렌더링하도록 함.
              // getBidsForRequest가 RLS로 차단돼 빈 배열을 반환해도 버튼이 사라지지 않는다.
              const req = [...myRequests, ...customerRequests].find(r => r.id === bidViewRequestId);
              const fromRaw = (req?.bidsRaw ?? []).map(b => normalizeBid({ ...b, request_id: b.request_id ?? bidViewRequestId }));
              const fromSubmitted = submittedBids.filter(b => b.requestId === bidViewRequestId);
              // submittedBids(최신, company 정보 포함)가 있으면 덮어씀
              const byId = Object.fromEntries(fromRaw.map(b => [b.id, b]));
              for (const b of fromSubmitted) { if (b.id) byId[b.id] = b; }
              return Object.values(byId);
            })()}
            submittedBids={submittedBids}
            request={[...myRequests, ...customerRequests].find(r => r.id === bidViewRequestId) ?? null}
            selectedBid={selectedBid}
            setSelectedBid={setSelectedBid}
            setEscrowContracts={setEscrowContracts}
            userId={user?.id}
            onRefresh={() => setEscrowRefreshTrigger(t => t + 1)}
          />
        )}
        {screen==="admin" && <AdminScreen onBack={() => setScreen("my")} onHome={() => setScreen("home")} user={user} />}
        {screen==="operator-board" && isModerator && (
          <OperatorBoardScreen
            user={user}
            onBack={() => setScreen("my")}
            onOpenPost={(p) => { setLoungePost(p); go("lounge-detail"); try { window.history.pushState({}, "", buildPostPath(p)); } catch {} }}
          />
        )}
        {screen==="document-center" && <DocumentCenterScreen company={currentUser} user={user} onBack={() => setScreen("my")} />}

        {screen==="lounge" && (
          <LoungeScreen
            user={user}
            extraPosts={localLoungePosts}
            extraStories={localLoungeStories}
            onPostClick={(post) => { setLoungePost(post); go("lounge-detail"); try { window.history.pushState({}, "", buildPostPath(post)); } catch {} }}
            initialCategory={loungeInitialCategory}
            onWrite={() => requireAuth(() => {
              if (!hasConsented(user?.id, LOUNGE_CONSENT_TYPES)) {
                setConsentGateConfig({ types: LOUNGE_CONSENT_TYPES, title: "라운지 이용 전 약관 동의", onComplete: () => { setConsentGateConfig(null); go("lounge-write"); } });
                return;
              }
              go("lounge-write");
            })}
            onStoryAuthorChat={(story) => requireAuth(async () => {
              // 스토리 작성자 대화 신청 — 기존 라운지 대화 정책 그대로(수락 시 신청자 20토큰 차감).
              if (!story?.user_id || story.user_id === user?.id) return;
              if ((tokenBalance ?? 0) < TOKEN_COSTS.CHAT_REQUEST) {
                showToast(`대화를 신청하려면 ${TOKEN_COSTS.CHAT_REQUEST}토큰이 필요합니다. 토큰 충전 후 다시 시도해주세요.`);
                setTimeout(() => go("token-store"), 1200);
                return;
              }
              await createLoungeChat({ post_id: story.id, requester_id: user.id, post_user_id: story.user_id }).catch(() => {});
              showToast("💬 대화 신청을 보냈어요! 수락 시 20토큰이 차감됩니다.");
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
            onNotifNavigate={(target) => {
              if (!target) return;
              if (target.screen === "lounge-detail" && target.id) {
                setLoungePost({ id: target.id, _deeplink: true }); go("lounge-detail");
              } else if (target.screen) {
                setScreen(target.screen);
              }
            }}
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
            initialPost={loungePost._deeplink ? null : loungePost}
            onOpenPost={(p) => { setLoungePost(p); try { window.history.pushState({}, "", buildPostPath(p)); } catch {} window.scrollTo({ top: 0 }); }}
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
            onNavigate={({ target, companyId }) => {
              // 라운지 → 거래 연결 CTA 라우팅
              if (target === "quote") { if (activeRole === "consumer") { setScreen("home"); handleOpenNewReq(); } else setScreen("home"); return; }
              if (target === "map") { setScreen("home"); setScreen("map"); return; }
              if (target === "chat" && companyId) {
                const co = companies.find(c => c.id === companyId || c.ownerId === companyId);
                if (co) { requireAuth(() => go("chat", co)); return; }
              }
              if ((target === "company" || target === "company_or_quote" || target === "company_or_map") && companyId) {
                const co = companies.find(c => c.id === companyId || c.ownerId === companyId);
                if (co) { go("portfolio", co); return; }
              }
              // 폴백: 견적 요청
              if (activeRole === "consumer") { setScreen("home"); handleOpenNewReq(); } else setScreen("map");
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
                {(() => {
                  const unread = unreadByRoom[`${user?.id}_${c.id}`] ?? 0;
                  return unread > 0 ? (
                    <div style={{ flexShrink:0, minWidth:20, height:20, padding:"0 6px", borderRadius:R.full,
                      background:C.brand, color:"#fff", fontSize:11, fontWeight:800,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {unread > 99 ? "99+" : unread}
                    </div>
                  ) : null;
                })()}
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
            {(() => {
              // 계약 진입 건만 사전 필터 — null-map 백지 방어.
              const progressRows = myRequests
                .map(r => ({ r, escData: myRequestsEscrow[r.id] ?? null }))
                .filter(({ r, escData }) => isRequestInProgress(r, escData) || isRequestSettled(r, escData));
              if (myRequests.length === 0 || progressRows.length === 0) return (
                <div style={{ textAlign:"center", padding:"60px 0" }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>{myRequests.length === 0 ? "📋" : "🏗"}</div>
                  <div style={{ fontSize:14, color:C.text3 }}>
                    {myRequests.length === 0 ? "아직 견적 요청이 없어요" : "현재 진행 중인 시공 현황이 없습니다."}
                  </div>
                  {myRequests.length === 0 && (
                    <button onClick={() => { setScreen("home"); handleOpenNewReq(); }}
                      style={{ marginTop:S.xl, padding:"12px 24px", background:C.brand,
                        color:"#fff", border:"none", borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer" }}>
                      안전하게 견적 시작하기
                    </button>
                  )}
                </div>
              );
              return progressRows.map(({ r, escData }) => {
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
                if (r.status === "in_progress") return "실측 방문 3일 내 · 견적서 72시간(3일) 내 등록";
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
                              💬 상세 견적서는 실측 후 72시간(3일) 내 플랫폼에 등록됩니다
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }); })()}
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
                    ? (() => {
                        // 상호배타 분류: 견적요청(open) / 진행중(에스크로 or 계약상태) / 완료(정산)
                        // 견적요청은 진행중·완료를 제외한 순수 open 만 — 진행중 건이 견적요청에 중복 집계되지 않게 한다.
                        const openCount  = myRequests.filter(r => isRequestOpenForQuotes(r, myRequestsEscrow[r.id] ?? null)).length;
                        const inProgress = myRequests.filter(r => isRequestInProgress(r, myRequestsEscrow[r.id] ?? null)).length;
                        const completed  = myRequests.filter(r => isRequestSettled(r, myRequestsEscrow[r.id] ?? null)).length;
                        try {
                          console.log("[GONGGAN_DEBUG][getUserRequests:classify]", {
                            counts: { 견적요청: openCount, 진행중: inProgress, 완료: completed }, total: myRequests.length,
                            rows: myRequests.map(r => {
                              const ed = myRequestsEscrow[r.id] ?? null;
                              return { id: r.id, status: r.status, selected_company_id: r.selectedCompanyId ?? null, selected_bid_id: r.selectedBidId ?? null,
                                escrow_company_id: ed?.escrow?.company_id ?? null, escrow_tx: ed?.escrow?.transaction_status ?? null,
                                cls: isRequestSettled(r, ed) ? "완료" : isRequestInProgress(r, ed) ? "진행중" : isRequestOpenForQuotes(r, ed) ? "견적요청" : "기타" };
                            }),
                          });
                        } catch {}
                        return [[`${openCount}`,"견적 요청"],[`${inProgress}`,"진행중"],[`${completed}`,"완료"]];
                      })()
                    : [[" 3","낙찰"],["84","후기"],[`${currentUser?.temp ?? 36.5}°`,"공간온도"]]
                  ).map(([v,l],i,arr) => (
                    <div key={l} style={{ flex:1, borderRight:i<arr.length-1?`1px solid ${C.bgWarm}`:"none" }}>
                      <div style={{ fontSize:22, fontWeight:800, color:C.brand }}>{v}</div>
                      <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{l}</div>
                    </div>
                  ))}
                </div>
                {activeRole === "consumer" && customerTrust?.score != null && (
                  <div style={{ background:C.brandL, borderRadius:R.lg, padding:`${S.sm}px ${S.lg}px`, marginBottom:S.lg,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:8, border:`1px solid ${C.brandM}` }}>
                    <span style={{ fontSize:13, fontWeight:700, color:C.brand }}>🤝 신뢰도 지수</span>
                    <span style={{ fontSize:15, fontWeight:900, color:C.brand }}>{customerTrust.score.toFixed(1)}</span>
                    <span style={{ fontSize:11, color:C.text3 }}>업체 평가 {customerTrust.count}건</span>
                  </div>
                )}
                <div style={{ fontSize:11, color:C.text4, marginBottom:S.lg }}>
                  사람과 공간 사이, 신뢰가 쌓이는 기록
                </div>
                <button onClick={onLogout} style={{ background:C.bg, color:C.text2,
                  border:`1px solid ${C.bgWarm}`, borderRadius:R.full,
                  padding:"11px 28px", fontWeight:600, fontSize:14, cursor:"pointer" }}>로그아웃</button>
                {/* 로그아웃은 기기 인증을 유지(재진입 시 계정 선택). 기기 인증 자체를
                    지우려면 아래 "이 기기 인증 삭제"(완전 로그아웃)를 사용한다. */}
                {onForgetDevice && (
                  <div style={{ marginTop:S.lg }}>
                    {!showForgetConfirm ? (
                      <button onClick={() => setShowForgetConfirm(true)}
                        style={{ background:"none", border:"none", color:C.text4, fontSize:12,
                          fontWeight:600, cursor:"pointer", textDecoration:"underline" }}>
                        이 기기 인증 삭제 (완전 로그아웃)
                      </button>
                    ) : (
                      <div style={{ background:C.bg, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, padding:S.lg, maxWidth:300, margin:"0 auto" }}>
                        <div style={{ fontSize:12, color:C.text2, lineHeight:1.6, marginBottom:10 }}>
                          이 기기에 저장된 계정 목록과 전화번호 인증이 삭제됩니다.<br/>
                          다음 로그인 시 전화번호 인증을 다시 진행해야 합니다.
                        </div>
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={() => setShowForgetConfirm(false)}
                            style={{ flex:1, padding:"10px", background:C.surface, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.md, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                            취소
                          </button>
                          <button onClick={() => { setShowForgetConfirm(false); onForgetDevice(); }}
                            style={{ flex:1, padding:"10px", background:C.red, color:"#fff", border:"none", borderRadius:R.md, fontWeight:800, fontSize:13, cursor:"pointer" }}>
                            삭제하고 로그아웃
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 저장한 업체 (위시리스트) — 고객 전용 */}
            {activeRole === "consumer" && (
              <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginTop:S.lg, border:`1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.md, display:"flex", alignItems:"center", gap:6 }}>
                  ♥ 저장한 업체
                  <span style={{ fontSize:13, fontWeight:600, color:C.brand }}>{savedCompanies.length}</span>
                </div>
                {savedCompanies.length === 0 ? (
                  <div style={{ fontSize:13, color:C.text3, lineHeight:1.6, textAlign:"center", padding:"16px 0" }}>
                    관심 있는 업체를 ♥ 로 저장해보세요
                  </div>
                ) : (
                  savedCompanies.map(c => (
                    <CompanyCard key={c.id} company={c} isLoggedIn={!!user?.id}
                      onClick={() => go("portfolio", c)}
                      saved={savedCompanyIds.includes(c.id)}
                      onToggleSave={toggleSaveCompany} />
                  ))
                )}
              </div>
            )}

            {activeRole === "company" && user.isEarlyPartner && user.earlyPartnerBenefitUntil && (
              <div style={{ background: C.brandL, borderRadius: R.xl, padding: S.xl, marginTop: S.lg, border: `1px solid ${C.brandM}` }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginBottom: 4 }}>🏆 초기 파트너 혜택 중</div>
                <div style={{ fontSize: 12, color: C.text3 }}>
                  혜택 만료일: {new Date(user.earlyPartnerBenefitUntil).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
            )}

            {/* 운영자 진입 — operator/admin 만 노출 (일반 사용자 미노출) */}
            {isModerator && (
              <button onClick={() => setScreen("operator-board")}
                style={{ width: "100%", background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.brandM}`, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: S.md, fontFamily: "inherit" }}>
                <span style={{ fontSize: 20 }}>🛡️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>운영자 게시판 관리</div>
                  <div style={{ fontSize: 12, color: C.text3 }}>추천글 등록 · 글/댓글 숨김</div>
                </div>
                <span style={{ fontSize: 16, color: C.text3 }}>›</span>
              </button>
            )}

            {/* 푸시 알림 설정 */}
            <PushNotificationSettings user={user} />

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
                { q: "공사가 중단되면 어떻게 되나요?",
                  a: "지급되지 않은 금액은 분쟁 검토 후 환불 또는 정산 처리됩니다. 채팅·사진·GPS 기록을 기준으로 검토합니다." },
                { q: "공간마켓 보호 범위가 무엇인가요?",
                  a: "공간안전결제로 진행하시면 토스페이먼츠 에스크로 보호, 단계별 정산, 계약서 보관, 분쟁 중재 지원이 모두 적용됩니다. 플랫폼 밖 거래는 보호 범위에 포함되지 않습니다.",
                  extra: <ProtectionNotice variant="full" /> },
                { q: "분쟁이 생기면 어떻게 되나요?",
                  a: "공간마켓이 기록을 토대로 원만한 해결을 도와드립니다. 단, 공간마켓은 법적 판단을 내리는 기관이 아닙니다.",
                  extra: <DisputeNotice variant="full" /> },
                { q: "강제로 환불받을 수 있나요?",
                  a: "공간마켓은 강제 환불을 집행하는 기관이 아닙니다. 양측 합의를 통한 환불 협의를 도와드립니다. 에스크로 정산 보류는 가능합니다." },
                { q: "공사 품질이 마음에 안 들어요.",
                  a: "공간마켓은 공사 품질을 전문적으로 감정하는 기관이 아닙니다. 계약서와 시공 사진 기록을 토대로 업체와 협의를 도와드립니다." },
                { q: "직접 업체와 거래하면 안 되나요?",
                  a: "거래 방식은 전적으로 고객님의 선택입니다. 다만 공간마켓의 보호와 기록은 공간안전결제를 통한 거래에서만 제공됩니다." },
                { q: "고객센터 연락처",
                  a: "문의하기(아래 ‘문의하기’) 또는 이메일 help@gonggan.market 으로 연락주시면 순차적으로 도와드립니다." },
              ].map(({ q, a, extra }) => (
                <details key={q} style={{ borderBottom: `1px solid ${C.bg}`, padding: `${S.sm}px 0` }}>
                  <summary style={{ fontSize: 14, color: C.text2, cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>❔ {q}</span><span style={{ fontSize: 16, color: C.text3 }}>›</span>
                  </summary>
                  <div style={{ fontSize: 14, color: C.text3, lineHeight: 1.7, marginTop: S.sm, paddingLeft: 2 }}>{a}</div>
                  {extra && <div style={{ marginTop: S.sm }}>{extra}</div>}
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

            {/* 사업자 정보 푸터 — 토스 PG 심사용(로그인 후 메인 하단에도 노출) */}
            <AppFooter />

            {activeRole==="company" && (
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>🛡️ 공간뱃지예치보증금 현황</div>
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
              onOpenLoungeChat={(req) => requireAuth(() => {
                // room_id = lounge_{lounge_chat_request_id} — 기존 chats 재사용 (신규 테이블 없음)
                setLoungeChat({
                  roomId: `lounge_${req.requestId}`,
                  partner: {
                    userId:    req.partnerId,
                    nickname:  getAnonymousNickname(req.partnerId, req.postId),
                    postId:    req.postId,
                    postTitle: req.postTitle,
                    requestId: req.requestId,
                  },
                });
                go("lounge-chat");
              })}
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
              <OwnershipHistory
                userId={user?.id}
                myRequests={myRequests}
                myRequestsEscrow={myRequestsEscrow}
                savedCompanies={savedCompanies}
                onOpenContract={(r) => { setBidViewRequestId(r.id); go("escrow"); }}
                onOpenCompany={(co) => go("portfolio", co)}
              />
            )}

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

      {showReq && <RequestModal initialData={reqPrefill} onClose={() => { setShowReq(false); setReqPrefill(null); }} onDone={async (form) => {
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
        setReqDoneNotice(true); // 완료 직후 — 에스크로 안전 보관 안내 카드 노출

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

      {/* 견적 요청 완료 직후 — 에스크로 안전 보관 안내 카드 */}
      {reqDoneNotice && (
        <div onClick={() => setReqDoneNotice(false)}
          style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.6)", zIndex:510,
            display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:C.surface, width:"100%", maxWidth:480,
              borderRadius:"24px 24px 0 0", padding:"22px 24px 36px" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 18px" }} />
            <div style={{ fontSize:34, textAlign:"center", marginBottom:10 }}>🔒</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.text1, textAlign:"center", marginBottom:8 }}>
              안전하게 보호됩니다
            </div>
            <div style={{ fontSize:14, color:C.text2, lineHeight:1.8, textAlign:"center", marginBottom:14 }}>
              업체에게 바로 돈이 지급되지 않습니다.<br/>
              결제금은 공간마켓이 안전하게 보관하며<br/>
              고객 확인 후 단계별로 지급됩니다.
            </div>
            <div style={{ background:C.bg, borderRadius:R.lg, padding:"10px 14px",
              fontSize:12, color:C.text3, lineHeight:1.7, textAlign:"center", marginBottom:16 }}>
              💬 채팅 · 📷 사진 · 📍 GPS 기록이 저장되며<br/>분쟁 발생 시 기록을 기준으로 검토합니다.
            </div>
            <button onClick={() => setReqDoneNotice(false)}
              style={{ width:"100%", padding:"14px", background:C.brand, color:"#fff",
                border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer" }}>
              확인했어요
            </button>
          </div>
        </div>
      )}

      {/* 믿고 맡긴 후기 — 상세(읽기 전용 바텀시트). 카드/제목/본문 클릭 시 진입 */}
      {homeReviewDetail && (() => {
        const rv = homeReviewDetail;
        const imgs = [rv.beforeThumb, rv.afterThumb].filter(Boolean);
        return (
          <div onClick={() => setHomeReviewDetail(null)}
            style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.6)", zIndex:520,
              display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background:C.surface, width:"100%", maxWidth:480, maxHeight:"86vh", overflowY:"auto",
                borderRadius:"24px 24px 0 0", padding:"20px 22px 36px" }}>
              <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 18px" }} />
              <div style={{ display:"flex", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontSize:16, fontWeight:900, color:C.text1 }}>믿고 맡긴 후기</div>
                <button onClick={() => setHomeReviewDetail(null)}
                  style={{ marginLeft:"auto", background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text3 }}>×</button>
              </div>
              {imgs.length > 0 && (
                <div style={{ display:"flex", gap:8, marginBottom:14, overflowX:"auto" }}>
                  {imgs.map((src, i) => (
                    <img key={i} src={src} alt=""
                      onClick={() => setHomeReviewViewer({ images: imgs, index: i })}
                      style={{ width: imgs.length > 1 ? "47%" : "100%", flexShrink:0, height:180, objectFit:"cover",
                        borderRadius:R.lg, border:`1px solid ${C.bgWarm}`, cursor:"pointer" }}
                      onError={e => { e.target.style.display="none"; }} />
                  ))}
                </div>
              )}
              <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:10 }}>
                {[1,2,3,4,5].map(s => (
                  <span key={s} style={{ fontSize:16, color: s <= rv.rating ? C.gold : "#E8E4DC" }}>★</span>
                ))}
                <span style={{ fontSize:12, color:C.text4, marginLeft:4 }}>{rv.rating}.0</span>
              </div>
              <div style={{ fontSize:14, color:C.text1, lineHeight:1.8, marginBottom:16, whiteSpace:"pre-line" }}>
                {rv.content}
              </div>
              <div style={{ borderTop:`1px solid ${C.bg}`, paddingTop:12, fontSize:13, color:C.text3, lineHeight:1.8 }}>
                <div>👤 {rv.user_name} · {rv.space_type}</div>
                <div>🏠 {rv.companyName}</div>
              </div>
            </div>
          </div>
        );
      })()}

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
                {target === "chatlist" && unreadTotal > 0 && (
                  <div style={{ position:"absolute", top:4, right:"50%", marginRight:-22,
                    minWidth:16, height:16, padding:"0 4px", borderRadius:R.full,
                    background:C.red ?? "#D63030", color:"#fff", fontSize:9, fontWeight:800,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {unreadTotal > 99 ? "99+" : unreadTotal}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
