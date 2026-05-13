import { useState } from "react";
import { C, R, S, COMPANIES, REQUESTS, MOCK_BIDS, GRADE } from "../constants";
import { TempBadge, CertBadge, Divider } from "./common";
import LiveFeed from "./LiveFeed";
import CompanyCard from "./CompanyCard";
import PortfolioScreen from "./PortfolioScreen";
import ReviewScreen from "./ReviewScreen";
import ChatScreen from "./ChatScreen";
import EscrowScreen from "./EscrowScreen";
import DashboardScreen from "./DashboardScreen";
import BidStatusScreen from "./BidStatusScreen";
import AdminScreen from "./AdminScreen";
import BidCard from "./BidCard";
import CompanyDepositCard from "./CompanyDepositCard";
import RequestModal from "./RequestModal";

export default function MainApp({ user, onLogout, onStartOnboarding }) {
  const [mode, setMode] = useState(user.role);
  const [screen, setScreen] = useState("home");
  const [prevScreen, setPrevScreen] = useState("home");
  const [selCo, setSelCo] = useState(null);
  const [toast, setToast] = useState(null);
  const [showReq, setShowReq] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [bidAlert, setBidAlert] = useState(null);
  // bids keyed by requestId → array of bid objects
  const [bids, setBids] = useState({});
  const [bidViewRequestId, setBidViewRequestId] = useState(null);
  const [chatLogs, setChatLogs] = useState(() => {
    const init = {};
    COMPANIES.forEach(c => { init[c.id] = c.chat; });
    return init;
  });
  const updateChat = (companyId, msgs) =>
    setChatLogs(prev => ({ ...prev, [companyId]: msgs }));

  const addBid = (request, bidData) => {
    const companyInfo = { ...COMPANIES[0] };
    const newBid = { id: Date.now(), company: companyInfo, ...bidData, time:"방금" };
    const existing = bids[request.id] || [];
    const updated  = [...existing, newBid];
    setBids(prev => ({ ...prev, [request.id]: updated }));
    setBidAlert({
      count:       updated.length,
      requestType: request.type,
      requestId:   request.id,
      companies:   updated.map(b => b.company),
    });
  };

  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const isGuestCompany = mode==="company" && user.isGuest;
  const go = (s, co=null) => { setPrevScreen(screen); if(co) setSelCo(co); setScreen(s); };

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const FULL = ["chat","portfolio","review","escrow","dashboard","bidstatus","admin"].includes(screen);
  const NO_PAD = ["escrow","dashboard","timeline"].includes(screen);
  const NAV = mode==="consumer"
    ? [["🏠","홈","home"],["🗺","지도","map"],["💬","채팅","chatlist"],["👤","마이","my"]]
    : [["📋","요청","home"],["🗺","지도","map"],["💬","채팅","chatlist"],["👤","내정보","my"]];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo','Pretendard',sans-serif" }}>

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
              <div style={{ background:C.bg, borderRadius:R.full, padding:3, display:"flex" }}>
                {[["consumer","의뢰인"],["company","업체"]].map(([v,l]) => (
                  <button key={v} onClick={() => { setMode(v); setScreen("home"); }}
                    style={{ padding:"5px 13px", borderRadius:R.full, border:"none",
                      background:mode===v?C.brand:"transparent",
                      color:mode===v?"#fff":C.text3, fontWeight:700, fontSize:13, cursor:"pointer" }}>{l}</button>
                ))}
              </div>
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
            <div style={{ background:`linear-gradient(150deg,#FDF0E4 0%,${C.bgWarm} 100%)`,
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
              <button onClick={() => setShowReq(true)}
                style={{ background:C.brand, color:"#fff", border:"none",
                  borderRadius:R.full, padding:"12px 24px", fontWeight:800, fontSize:14, cursor:"pointer",
                  boxShadow:`0 4px 16px ${C.brand}44` }}>
                + 무료 견적 요청하기
              </button>
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

            {myRequests.length > 0 && (
              <div style={{ marginBottom:S.xl }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>
                  📋 내 견적 요청
                  <span style={{ fontSize:13, fontWeight:600, color:C.brand, marginLeft:6 }}>{myRequests.length}건</span>
                </div>
                {myRequests.map(r => {
                  const reqBids  = bids[r.id] || [];
                  const hasBids  = reqBids.length > 0;
                  return (
                    <div key={r.id} style={{ background:C.surface, borderRadius:R.xl,
                      marginBottom:S.md, border:`1.5px solid ${hasBids ? C.brandM : C.bgWarm}`, overflow:"hidden" }}>
                      <div style={{ height:3, background: hasBids ? C.brand : C.bgWarm }} />
                      <div style={{ padding:S.xl }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:S.sm }}>
                          <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{r.type} · {r.size}</div>
                          <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full,
                            padding:"3px 10px", fontSize:11, fontWeight:700 }}>{r.status}</span>
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
                                  <TempBadge temp={b.company.temp} />
                                  <span>{b.company.name}</span>
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
                            <button onClick={() => go("chat", reqBids[0].company)}
                              style={{ flex:1, padding:"10px", background:C.brand,
                                color:"#fff", border:"none", borderRadius:R.lg,
                                fontWeight:700, fontSize:13, cursor:"pointer" }}>
                              💬 업체 채팅
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display:"flex", gap:S.sm, marginBottom:S.xl }}>
              {[["🏘","인근 업체",`${COMPANIES.length}곳`],["⭐","평균 별점","4.8점"],["✅","이번 달 완료","47건"]].map(([icon,label,val]) => (
                <div key={label} style={{ flex:1, background:C.surface, borderRadius:R.lg,
                  padding:`${S.lg}px ${S.sm}px`, textAlign:"center", border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ fontSize:18 }}>{icon}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginTop:S.xs }}>{val}</div>
                  <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>인근 업체</div>
              <button onClick={() => setScreen("map")} style={{ fontSize:13, background:"none", border:"none", cursor:"pointer", color:C.brand, fontWeight:700 }}>지도로 보기 →</button>
            </div>
            {COMPANIES.map(c => <CompanyCard key={c.id} company={c} onClick={() => go("portfolio",c)} />)}
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
                <button onClick={() => go("portfolio",COMPANIES[0])} style={{ background:"rgba(255,255,255,0.18)", color:"#fff", border:"1px solid rgba(255,255,255,0.3)", borderRadius:R.lg, padding:"9px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>포트폴리오</button>
              </div>
            </div>

            <LiveFeed />

            <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>📋 인근 시공 요청</div>
            {[...myRequests, ...REQUESTS].map(r => (
              <BidCard
                key={r.id}
                r={r}
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
                <div key={i} onClick={() => { if(!pin.type){ const c=COMPANIES.find(c=>c.name===pin.name); if(c) go("portfolio",c); }}}
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
            <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>인근 업체 <span style={{ color:C.brand }}>{COMPANIES.length}곳</span></div>
            {COMPANIES.map(c => <CompanyCard key={c.id} company={c} onClick={() => go("portfolio",c)} />)}
          </div>
        )}

        {screen==="portfolio" && selCo && <PortfolioScreen company={selCo} onChat={c => isGuestCompany ? setShowRegisterPrompt(true) : go("chat",c)} onReview={() => go("review",selCo)} onBack={() => setScreen("home")} onEscrow={() => go("escrow")} />}
        {screen==="review" && selCo && <ReviewScreen company={selCo} onBack={() => setScreen("portfolio")} />}
        {screen==="chat" && selCo && <ChatScreen company={selCo} onBack={() => setScreen(prevScreen==="chatlist"?"chatlist":"portfolio")} messages={chatLogs[selCo.id]||[]} onUpdateMessages={msgs => updateChat(selCo.id, msgs)} />}
        {screen==="escrow" && <EscrowScreen onBack={() => setScreen(prevScreen||"home")} mode={mode} />}
        {screen==="dashboard" && <DashboardScreen onBack={() => setScreen("home")} onEscrow={() => go("escrow")} allRequests={[...myRequests, ...REQUESTS]} />}
        {screen==="bidstatus" && (
          <BidStatusScreen
            onBack={() => setScreen("home")}
            onChat={c => go("chat",c)}
            bids={bidViewRequestId ? (bids[bidViewRequestId] || []) : []}
            request={[...myRequests, ...REQUESTS].find(r => r.id === bidViewRequestId) ?? null}
          />
        )}
        {screen==="admin" && <AdminScreen onBack={() => setScreen("my")} />}

        {screen==="chatlist" && (
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:S.xl }}>채팅</div>
            {COMPANIES.map(c => (
              <div key={c.id} onClick={() => isGuestCompany ? setShowRegisterPrompt(true) : go("chat",c)}
                style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm, display:"flex", gap:S.lg, alignItems:"center", cursor:"pointer", border:`1px solid ${C.bgWarm}` }}>
                <div style={{ width:48, height:48, borderRadius:R.full, flexShrink:0, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:C.brand, position:"relative" }}>
                  {c.name[0]}
                  {c.online && <div style={{ position:"absolute", bottom:0, right:0, width:12, height:12, borderRadius:"50%", background:C.green, border:"2px solid #fff" }} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{c.name}</div>
                    <TempBadge temp={c.temp} />
                  </div>
                  <div style={{ fontSize:13, color:C.text3, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                    {(chatLogs[c.id]||[]).length > 0
                      ? chatLogs[c.id][chatLogs[c.id].length-1].text
                      : "채팅을 시작해보세요"}
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
                    { label:"견적 요청 완료",    sub:"인근 업체에 공개됨",           done:true,  time:r.time },
                    { label:`업체 ${Math.floor(Math.random()*4)+1}곳 입찰`, sub:"업체 프로필 확인 후 선택", done:true, time:"방금", bidStep:true },
                    { label:"업체 선택",          sub:"계약 및 에스크로 예치",        done:false, active:true },
                    { label:"시공 진행",           sub:"중간 점검 사진 공유",          done:false },
                    { label:"시공 완료",           sub:"잔금 지급 및 후기 작성",       done:false },
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
                          <button onClick={() => setScreen("bidstatus")}
                            style={{ marginTop:S.sm, padding:"8px 16px", background:C.brand, color:"#fff", border:"none", borderRadius:R.full, fontWeight:700, fontSize:12, cursor:"pointer", boxShadow:`0 3px 10px ${C.brand}44` }}>
                            🔔 입찰 현황 비교하기 →
                          </button>
                        )}
                        {step.active && (
                          <button onClick={() => setScreen("bidstatus")}
                            style={{ marginTop:S.sm, padding:"8px 16px", background:C.brand, color:"#fff", border:"none", borderRadius:R.full, fontWeight:700, fontSize:12, cursor:"pointer" }}>
                            업체 선택하기 →
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
                fontSize:28, fontWeight:900, color:C.brand, margin:"0 auto 14px" }}>{user.name[0]}</div>
              <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>{user.name}</div>
              <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>📍 {user.region} · {user.role==="consumer"?"의뢰인":"검증 업체"}</div>
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

            {user.role==="company" && (
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>🏦 보증금 현황</div>
                <CompanyDepositCard
                  badge="standard"
                  hasInsurance={false}
                  onUpgrade={(next) => showToast(`${next.label} 업그레이드 신청이 접수됐어요!`)}
                />
              </div>
            )}

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
                ) : myRequests.map(r => (
                  <div key={r.id} onClick={() => setScreen("timeline")}
                    style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm, border:`1px solid ${C.bgWarm}`, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>{r.type} · {r.size}</div>
                      <div style={{ fontSize:12, color:C.text3, marginTop:3 }}>📍 {r.area} · {r.time}</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                      <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{r.status}</span>
                      <span style={{ fontSize:11, color:C.brand, fontWeight:700 }}>진행 현황 →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showRegisterPrompt && (
        <div style={{ position:"fixed", inset:0, background:"rgba(28,23,18,0.6)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}>
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

      {showReq && <RequestModal onClose={() => setShowReq(false)} onDone={(form) => {
        const newReq = {
          id: Date.now(),
          type: form.type, size: form.size, budget: form.budget,
          style: form.style, desc: form.desc,
          area: `${user.region}`, user: user.name,
          bids: 0, time: "방금", status: "입찰중"
        };
        setMyRequests(prev => [newReq, ...prev]);
        setShowReq(false);
        showToast("✅ 인근 업체들에게 전달됐어요!");
        // Simulate incoming bids from nearby companies after 3 s
        setTimeout(() => {
          const mockCos   = COMPANIES.slice(0, Math.floor(Math.random()*2)+1);
          const mockBids  = mockCos.map((c, i) => ({
            id:       newReq.id + i + 1,
            company:  c,
            price:    2400 + Math.floor(Math.random() * 600),
            period:   25   + Math.floor(Math.random() * 15),
            material: "LX하우시스 바닥재, 대림 욕실",
            comment:  c.desc,
            time:     "방금",
          }));
          setBids(prev => ({ ...prev, [newReq.id]: mockBids }));
          setBidAlert({
            count:       mockBids.length,
            requestType: form.type,
            requestId:   newReq.id,
            companies:   mockCos,
          });
        }, 3000);
      }} />}

      {bidAlert && (
        <div style={{ position:"fixed", inset:0, background:"rgba(28,23,18,0.6)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:400 }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"24px 24px 40px" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
            <div style={{ textAlign:"center", marginBottom:S.xxl }}>
              <div style={{ fontSize:48, marginBottom:10 }}>🔔</div>
              <div style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:8 }}>업체 {bidAlert.count}곳이 입찰했어요!</div>
              <div style={{ fontSize:14, color:C.text3, lineHeight:1.7 }}>{bidAlert.requestType} 견적을 확인한 업체들이<br/>금액과 기간을 제출했어요</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:S.sm, marginBottom:S.xl }}>
              {(bidAlert.companies || COMPANIES.slice(0, bidAlert.count)).map((c, i) => (
                <div key={c.id ?? i} style={{ background:C.surface2, borderRadius:R.lg, padding:`${S.sm}px ${S.lg}px`, display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ display:"flex", gap:S.sm, alignItems:"center" }}>
                    <div style={{ width:32, height:32, borderRadius:R.sm, background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:C.brand }}>{c.name[0]}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{c.name}</div>
                      <div style={{ fontSize:11, color:C.text3 }}>{c.distance || "인근"} · 견적 제출</div>
                    </div>
                  </div>
                  <TempBadge temp={c.temp} />
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
