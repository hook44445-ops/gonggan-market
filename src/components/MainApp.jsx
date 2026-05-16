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
import BidCard from "./BidCard";
import CompanyDepositCard from "./CompanyDepositCard";
import RequestModal from "./RequestModal";
import LoungeMyPageSection from "./lounge/LoungeMyPageSection";
import { useSpaceToken } from "../hooks/useSpaceToken";
import { useSpaceTemperature } from "../hooks/useSpaceTemperature";
import { MOCK_LOUNGE_POSTS } from "../constants/lounge";
import {
  supabase,
  getRequests,
  getUserRequests,
  createRequest,
  closeRequest,
  createBid,
  getBidsForRequest,
  getCompanyByOwnerId,
} from "../lib/supabase";
import { useCompanyList } from "../hooks/useCompanyList";

// ── normalizers: DB row → local shape ─────────────────────────────────────────

const normalizeCompany = (row) => ({
  id:            row.id,
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
  const expiresAt  = new Date(createdAt.getTime() + REQUEST_TTL_MS);
  const msLeft     = expiresAt.getTime() - Date.now();
  const daysLeft   = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const status     = row.status ?? "open";
  const isExpiredByTime = daysLeft <= 0;
  const isActive   = status === "open" && !isExpiredByTime;
  const isClosed   = status === "closed" || status === "cancelled" ||
                     (status === "open" && isExpiredByTime);
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.space_type ?? "",
    size: row.size ?? "",
    budget: [row.budget_min, row.budget_max].filter(Boolean).map(n => `${n}만원`).join("~") || "협의",
    style: row.style ?? "",
    desc: row.desc ?? "",
    area: row.area ?? "",
    user: "의뢰인",
    bids: 0,
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

export default function MainApp({ user, onLogout, onLogin, onStartOnboarding }) {
  const mode = user.role === "company" ? "company" : user.role === "admin" ? "admin" : "consumer";
  const [screen, setScreen] = useState(() => {
    if (user.role === "admin") return "admin";
    if (user.role === "company") return "dashboard";
    return "home";
  });
  const [prevScreen, setPrevScreen] = useState("home");
  const [selCo, setSelCo] = useState(null);
  const [toast, setToast] = useState(null);
  const [showReq, setShowReq] = useState(false);
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

  // ── 라운지 상태 ──────────────────────────────────────────────────────────────
  const [loungePost, setLoungePost] = useState(null); // 현재 상세 조회 중인 게시글
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
    const { error } = await closeRequest(requestId);
    if (error) return;
  };

  // Load requests on mount
  // Consumer: server-side filter by userId; Company/Admin: load all open requests for bidding
  useEffect(() => {
    const applyExpiry = (rows) => {
      const normalized = rows.map(normalizeRequest);
      normalized
        .filter(r => r.status === "open" && r.isExpiredByTime)
        .forEach(r => closeRequest(r.id));
      return normalized.map(r =>
        r.status === "open" && r.isExpiredByTime
          ? { ...r, status: "closed", isActive: false, isClosed: true }
          : r
      );
    };

    if (user.role === "consumer" && user.id) {
      // Consumers only see their own requests (server-side filter)
      getUserRequests(user.id).then(({ data, error }) => {
        if (error) return;
        if (data) {
          const withExpiry = applyExpiry(data);
          const activeOwn = withExpiry.filter(r => r.isActive)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (activeOwn.length > 1) {
            activeOwn.slice(1).forEach(r => closeRequest(r.id));
            const keepId = activeOwn[0].id;
            setMyRequests(withExpiry.map(r =>
              r.isActive && r.id !== keepId
                ? { ...r, status: "closed", isActive: false, isClosed: true }
                : r
            ));
          } else {
            setMyRequests(withExpiry);
          }
        }
      });
    } else {
      // Company / Admin: fetch all open requests for the bidding list
      getRequests().then(({ data, error }) => {
        if (error) return;
        if (data) {
          const withExpiry = applyExpiry(data);
          setCustomerRequests(withExpiry);
        }
      });
    }
  }, []);

  // Load company profile from Supabase for authenticated company users
  useEffect(() => {
    if (user?.role !== "company" || !user?.id) return;
    getCompanyByOwnerId(user.id).then(({ data }) => {
      if (data) setCurrentUser(normalizeCompany(data));
    });
  }, [user?.id, user?.role]);

  // Load bids + subscribe to realtime when viewing a request's bid status
  useEffect(() => {
    if (!bidViewRequestId) return;

    getBidsForRequest(bidViewRequestId).then(({ data, error }) => {
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

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
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
    const actor = currentUser ?? { id: user.id ?? null, name: user.name ?? "업체", temp: 70 };
    const optimistic = {
      id: `tmp-${Date.now()}`,
      requestId: request.id,
      companyId: actor.id ?? null,
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

    // INSERT to Supabase (only when actor has a real UUID)
    if (actor.id && typeof actor.id === "string" && actor.id.includes("-")) {
      const { data, error } = await createBid({
        request_id: request.id,
        company_id: actor.id,
        price: bidData.price,
        period_days: bidData.period,
        material_note: bidData.material,
        comment: bidData.comment,
      });
      if (error) {
        showToast(`입찰 저장 실패: ${error.message}`);
      } else if (data) {
        // Replace optimistic entry with real DB row (no company join data here yet)
        setSubmittedBids(prev =>
          prev.map(b => b.id === optimistic.id ? { ...normalizeBid(data), company: actor } : b)
        );
      }
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
    if (s === "admin" && user.role !== "admin") return;
    if (s === "dashboard" && user.role !== "company") return;
    setPrevScreen(screen);
    if (co) setSelCo(co);
    setScreen(s);
  };

  useEffect(() => {
    if (screen === "admin" && user.role !== "admin") setScreen("home");
    if (screen === "dashboard" && user.role !== "company") setScreen("home");
  }, [screen, user.role]);

  const FULL = ["chat","portfolio","review","escrow","dashboard","bidstatus","admin","lounge-write","lounge-detail","lounge-story","token-store","token-history"].includes(screen);
  const NO_PAD = ["escrow","dashboard","timeline","lounge","lounge-write","lounge-detail","lounge-story","token-store","token-history"].includes(screen);
  const NAV = mode === "admin"
    ? [["📋","관리","admin"],["👤","마이","my"]]
    : mode === "consumer"
    ? [["🏠","홈","home"],["💬","라운지","lounge"],["❤️","관심","my"],["🗨","대화","chatlist"],["👤","마이","my"]]
    : [["📋","요청","home"],["💬","라운지","lounge"],["❤️","관심","my"],["🗨","대화","chatlist"],["👤","내정보","my"]];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

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
                인근 시공 업체에게<br/>바로 견적 받아보세요 🏠
              </div>
              <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl, lineHeight:1.6 }}>
                평균 2~3곳에서 30분 내 연락이 옵니다
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
                  <button onClick={() => setShowReq(true)}
                    style={{ background:C.brand, color:"#fff", border:"none",
                      borderRadius:R.full, padding:"12px 24px", fontWeight:800, fontSize:14, cursor:"pointer",
                      boxShadow:`0 4px 16px ${C.brand}44` }}>
                    + 무료 견적 요청하기
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
                        const hasBids = reqBids.length > 0;
                        const urgentDays = r.daysLeft <= 1;
                        const warningDays = r.daysLeft <= 3;
                        return (
                          <div key={r.id} style={{ background:C.surface, borderRadius:R.xl,
                            marginBottom:S.md, border:`1.5px solid ${hasBids ? C.brandM : C.bgWarm}`, overflow:"hidden" }}>
                            <div style={{ height:3, background: hasBids ? C.brand : C.bgWarm }} />
                            <div style={{ padding:S.xl }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.sm }}>
                                <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{r.type} · {r.size}</div>
                                <div style={{ display:"flex", gap:5, flexWrap:"wrap", justifyContent:"flex-end" }}>
                                  {r.isActive && (
                                    <span style={{
                                      background: urgentDays ? "#FFF0F0" : warningDays ? "#FFF7E6" : C.brandL,
                                      color: urgentDays ? C.red : warningDays ? "#C07000" : C.brand,
                                      borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700,
                                    }}>
                                      마감 {r.daysLeft}일 전
                                    </span>
                                  )}
                                  <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                                    입찰중
                                  </span>
                                </div>
                              </div>
                              <div style={{ fontSize:13, color:C.text3, marginBottom:S.sm }}>
                                📍 {r.area} · {r.style} · {r.time}
                              </div>

                              {hasBids ? (
                                <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.md,
                                  marginBottom:S.md, border:`1px solid ${C.brandM}` }}>
                                  <div style={{ fontSize:13, fontWeight:800, color:C.brand, marginBottom:S.sm }}>
                                    🔔 업체 {reqBids.length}곳이 입찰했어요
                                  </div>
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
                                    <div style={{ fontSize:13, fontWeight:700, color:C.text2 }}>입찰 대기 중</div>
                                    <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>
                                      인근 업체들이 견적을 검토하고 있어요
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div style={{ display:"flex", gap:S.sm }}>
                                <button onClick={() => setScreen("timeline")}
                                  style={{ flex:1, padding:"10px", background:C.surface2,
                                    color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
                                    fontWeight:700, fontSize:13, cursor:"pointer" }}>
                                  📊 진행 현황
                                </button>
                                {hasBids && (
                                  <button onClick={() => reqBids[0]?.company && go("chat", reqBids[0].company)}
                                    style={{ flex:1, padding:"10px", background:C.brand,
                                      color:"#fff", border:"none", borderRadius:R.lg,
                                      fontWeight:700, fontSize:13, cursor:"pointer" }}>
                                    💬 업체 채팅
                                  </button>
                                )}
                                <button onClick={() => setShowCloseConfirm(r.id)}
                                  style={{ flex:1, padding:"10px", background:C.surface,
                                    color:C.text3, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
                                    fontWeight:700, fontSize:13, cursor:"pointer" }}>
                                  견적 마감
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
                          marginBottom:S.sm, border:`1px solid ${C.bgWarm}`, overflow:"hidden", opacity:0.65 }}>
                          <div style={{ padding:`${S.lg}px ${S.xl}px`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <div>
                              <div style={{ fontSize:14, fontWeight:700, color:C.text2 }}>{r.type} · {r.size}</div>
                              <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>📍 {r.area} · {r.time}</div>
                            </div>
                            <span style={{ background:C.bg, color:C.text4, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700, flexShrink:0 }}>
                              {r.isExpiredByTime ? "기간만료" : "마감됨"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : null;
            })()}

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
            {companies.map(c => <CompanyCard key={c.id} company={c} onClick={() => go("portfolio",c)} />)}

            {/* 라운지 섹션 — 둘러보기 하단 */}
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginTop:S.xl, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.lg }}>라운지</div>
              <div style={{ display:"flex", flexDirection:"column", gap:S.sm, marginBottom:S.lg }}>
                {MOCK_LOUNGE_POSTS.slice(0,3).map(post => (
                  <div key={post.id} onClick={() => { setLoungePost(post); go("lounge-detail"); }}
                    style={{ background:C.bg, borderRadius:R.lg, padding:`${S.md}px ${S.lg}px`, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${C.bgWarm}` }}>
                    <div style={{ flex:1, minWidth:0, marginRight:S.md }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                        {post.title ?? post.content.slice(0,30)}
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:C.text3, flexShrink:0 }}>❤️ {post.like_count}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setScreen("lounge")}
                style={{ width:"100%", padding:"13px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:`0 4px 14px ${C.brand}44` }}>
                라운지 들어가기 →
              </button>
            </div>
          </div>
        )}

        {/* 업체 홈 */}
        {screen==="home" && mode==="company" && user.role==="consumer" && (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🔨</div>
            <div style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:8 }}>업체 로그인이 필요합니다</div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xxl, lineHeight:1.7 }}>
              업체 서비스를 이용하려면<br/>업체 계정으로 로그인해 주세요
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, maxWidth:280, margin:"0 auto" }}>
              <button onClick={onLogout}
                style={{ padding:"16px", background:C.brand, color:"#fff", border:"none",
                  borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer",
                  boxShadow:`0 4px 16px ${C.brand}44` }}>
                업체 로그인
              </button>
              <button onClick={() => { onStartOnboarding(); }}
                style={{ padding:"16px", background:C.surface, color:C.brand,
                  border:`2px solid ${C.brandM}`, borderRadius:R.lg,
                  fontWeight:800, fontSize:15, cursor:"pointer" }}>
                업체 회원가입
              </button>
            </div>
          </div>
        )}

        {screen==="home" && mode==="company" && user.role!=="consumer" && (
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

            <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>📋 인근 시공 요청</div>
            {customerRequests.filter(r => r.isActive !== false || r.status === undefined).map(r => (
              <BidCard
                key={r.id}
                r={r}
                currentUser={currentUser}
                onBidSubmit={isGuestCompany ? null : data => addBid(r, data)}
                onRequiresAuth={isGuestCompany ? () => setShowRegisterPrompt(true) : null}
              />
            ))}
          </div>
        )}


        {/* 지도 */}
        {screen==="map" && (
          <div>
            <div style={{ position:"relative", background:"linear-gradient(145deg,#E4EBE0,#D4E2CC,#DCE8D0)",
              borderRadius:R.xl, height:250, overflow:"hidden", marginBottom:S.xl, border:"1px solid #C4D8BC" }}>
              {[...Array(7)].map((_,i) => <div key={i} style={{ position:"absolute", left:`${i*18}%`, top:0, bottom:0, borderLeft:"1px solid rgba(0,0,0,0.04)" }} />)}
              {[...Array(6)].map((_,i) => <div key={i} style={{ position:"absolute", top:`${i*20}%`, left:0, right:0, borderTop:"1px solid rgba(0,0,0,0.04)" }} />)}
              <div style={{ position:"absolute", left:"44%", top:0, bottom:0, width:4, background:"rgba(255,255,255,0.65)" }} />
              <div style={{ position:"absolute", top:"48%", left:0, right:0, height:4, background:"rgba(255,255,255,0.65)" }} />
              {[{ x:28,y:40,name:"홍익시공",   temp:97,online:true },
                { x:57,y:28,name:"공간설계소", temp:91,online:false },
                { x:71,y:57,name:"우리집시공단",temp:86,online:true },
                { x:42,y:54,type:"req" }, { x:64,y:68,type:"req" }].map((pin,i) => (
                <div key={i} onClick={() => { if(!pin.type){ const c=companies.find(c=>c.name===pin.name); if(c) go("portfolio",c); }}}
                  style={{ position:"absolute", left:`${pin.x}%`, top:`${pin.y}%`, transform:"translate(-50%,-100%)", cursor:!pin.type?"pointer":"default", zIndex:10 }}>
                  <div style={{ background:pin.type?C.red:GRADE(pin.temp||80).bar, color:"#fff",
                    borderRadius:pin.type?R.sm:R.full, padding:"5px 10px", fontSize:11, fontWeight:800,
                    boxShadow:"0 3px 10px rgba(0,0,0,0.2)", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 }}>
                    {pin.type ? "📋 요청" : <>
                      {pin.online && <div style={{ width:5, height:5, borderRadius:"50%", background:C.green }} />}
                      🏠 {pin.name?.slice(0,4)}
                    </>}
                  </div>
                  <div style={{ width:2, height:8, background:pin.type?C.red:GRADE(pin.temp||80).bar, margin:"0 auto" }} />
                </div>
              ))}
              <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)" }}>
                <div style={{ width:14, height:14, borderRadius:"50%", background:C.brand, border:"3px solid #fff", boxShadow:`0 0 0 8px ${C.brand}22` }} />
              </div>
              <div style={{ position:"absolute", bottom:10, right:12, background:"rgba(255,255,255,0.92)", borderRadius:R.full, padding:"4px 12px", fontSize:11, color:C.text2, fontWeight:600 }}>📍 {user.region} · 반경 3km</div>
            </div>
            <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>인근 업체 <span style={{ color:C.brand }}>{companies.length}곳</span></div>
            {companies.map(c => <CompanyCard key={c.id} company={c} onClick={() => go("portfolio",c)} />)}
          </div>
        )}

        {screen==="portfolio" && selCo && <PortfolioScreen company={selCo} onChat={c => isGuestCompany ? setShowRegisterPrompt(true) : go("chat",c)} onReview={() => go("review",selCo)} onBack={() => setScreen("home")} onEscrow={() => go("escrow")} />}
        {screen==="review" && selCo && <ReviewScreen company={selCo} onBack={() => setScreen("portfolio")} currentUser={currentUser} />}
        {screen==="chat" && selCo && <ChatScreen company={selCo} user={user} onBack={() => setScreen(prevScreen==="chatlist"?"chatlist":"portfolio")} />}
        {screen==="escrow" && <EscrowScreen onBack={() => setScreen(prevScreen||"home")} mode={mode} selectedBid={selectedBid} currentUser={currentUser} contractId={contractId} userId={user?.id ?? null} />}
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
        {screen==="admin" && <AdminScreen onBack={() => setScreen("my")} user={user} />}

        {screen==="lounge" && (
          <LoungeScreen
            user={user}
            onPostClick={(post) => { setLoungePost(post); go("lounge-detail"); }}
            onWrite={() => go("lounge-write")}
            onStoryUpload={() => go("lounge-story")}
          />
        )}

        {screen==="lounge-write" && (
          <LoungeWriteScreen
            user={user}
            onBack={() => setScreen("lounge")}
            onPublish={(post) => { showToast("✅ 글이 등록됐어요!"); earnToken("first_post"); setScreen("lounge"); }}
          />
        )}

        {screen==="lounge-detail" && loungePost && (
          <LoungePostDetailScreen
            postId={loungePost.id}
            user={user}
            tokenBalance={tokenBalance}
            onBack={() => setScreen("lounge")}
            onSpendToken={(action, amount, desc) => spendToken(action, amount, desc)}
            onTokenStore={() => go("token-store")}
          />
        )}

        {screen==="lounge-story" && (
          <LoungeStoryUploadScreen
            user={user}
            onBack={() => setScreen("lounge")}
            onPublish={() => { showToast("📸 스토리가 공유됐어요! (24시간)"); setScreen("lounge"); }}
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
                <button onClick={() => { setScreen("home"); setShowReq(true); }}
                  style={{ marginTop:S.xl, padding:"12px 24px", background:C.brand,
                    color:"#fff", border:"none", borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer" }}>
                  + 견적 요청하기
                </button>
              </div>
            ) : myRequests.map(r => (
              <div key={r.id} style={{ background:C.surface, borderRadius:R.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}`, overflow:"hidden" }}>
                <div style={{ height:3, background:C.brand }} />
                <div style={{ padding:S.xl }}>
                  <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:4 }}>{r.type} · {r.size}</div>
                  <div style={{ fontSize:12, color:C.text3, marginBottom:S.xl }}>📍 {r.area} · 💰 {r.budget}</div>
                  {[
                    { label:"견적 요청",    sub:"요청 등록 완료",             done:true,  time:r.time },
                    { label:"업체 선택",   sub:"입찰 비교 후 계약",            done:false, active:true, bidStep:true },
                    { label:"공사 진행",   sub:"착공 ~ 중간점검",              done:false },
                    { label:"완료 및 정산", sub:"완료 확인 + 잔금 지급",        done:false },
                  ].map((step, i, arr) => (
                    <div key={step.label} style={{ display:"flex", gap:S.md, marginBottom: i<arr.length-1?S.lg:0 }}>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                        <div style={{ width:32, height:32, borderRadius:R.full,
                          background: step.done?C.green : step.active?C.brand : C.bgWarm,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:14, color: step.done||step.active?"#fff":C.text4,
                          boxShadow: step.active?`0 0 0 4px ${C.brand}22`:"none", fontWeight:900 }}>
                          {step.done?"✓":i+1}
                        </div>
                        {i<arr.length-1 && <div style={{ width:2, flex:1, minHeight:16, marginTop:4, background:step.done?C.green:C.bgWarm }} />}
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
              <div style={{ fontSize:13, color:C.text3, marginBottom:S.md }}>📍 {user.region} · {user.role==="consumer"?"의뢰인":"검증 업체"}</div>
              {user.role === "consumer" && (() => {
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
                {(user.role==="consumer"
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

            {user.role === "company" && user.isEarlyPartner && user.earlyPartnerBenefitUntil && (
              <div style={{ background: C.brandL, borderRadius: R.xl, padding: S.xl, marginTop: S.lg, border: `1px solid ${C.brandM}` }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginBottom: 4 }}>🏆 초기 파트너 혜택 중</div>
                <div style={{ fontSize: 12, color: C.text3 }}>
                  혜택 만료일: {new Date(user.earlyPartnerBenefitUntil).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: S.xxl }}>
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

            {user.role==="company" && (
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>🏦 보증금 현황</div>
                <CompanyDepositCard
                  badge={currentUser?.badge ?? user.badge ?? "standard"}
                  hasInsurance={currentUser?.hasInsurance ?? user.insurance ?? false}
                  onUpgrade={(next) => showToast(`${next.label} 업그레이드 신청이 접수됐어요!`)}
                />
              </div>
            )}

            {user.role==="consumer" && (() => {
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
                if (target === "token-store")   { go("token-store"); }
                else if (target === "token-history") { go("token-history"); }
                else { showToast("준비 중인 기능이에요"); }
              }}
            />

            {user.role==="consumer" && (
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>내 견적 이력</div>
                {myRequests.length === 0 ? (
                  <div style={{ background:C.surface, borderRadius:R.xl, padding:"40px 20px", textAlign:"center", border:`1px solid ${C.bgWarm}` }}>
                    <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                    <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>아직 견적 요청이 없어요</div>
                    <button onClick={() => { setScreen("home"); setShowReq(true); }}
                      style={{ padding:"12px 24px", background:C.brand, color:"#fff", border:"none", borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer" }}>
                      + 첫 견적 요청하기
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
                  onLogin({ ...user, role: "admin" });
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

      {showReq && <RequestModal onClose={() => setShowReq(false)} onDone={async (form) => {
        // Optimistic local entry (shown immediately)
        const _now = Date.now();
        const optimistic = {
          id: `tmp-${_now}`,
          user_id: user.id ?? null,
          type: form.type, size: form.size, budget: form.budget,
          style: form.style, desc: form.desc,
          area: user.region ?? "", user: user.name,
          bids: 0, time: "방금", status: "open",
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
            user_id: user.id,
            area: user.region ?? "",
            space_type: form.type,
            size: form.size,
            style: form.style,
            description: form.desc,
            budget_min: 0,
            budget_max: 0,
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
