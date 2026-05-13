import { useState, useRef, useEffect } from "react";

const C = {
  brand:    "#D95F00",
  brandL:   "#FDF3EC",
  brandM:   "#F5D5B8",
  brandD:   "#A84800",

  navy:     "#1A2744",
  navyM:    "#2D3F6B",
  navyL:    "#EEF1F8",

  bg:       "#F7F2EC",
  bgWarm:   "#EDE7DF",
  surface:  "#FFFFFF",
  surface2: "#FAF7F3",

  text1:    "#1C1712",
  text2:    "#4A4540",
  text3:    "#8A837A",
  text4:    "#C0B8B0",

  green:    "#00995C",
  greenL:   "#E6F7F0",
  red:      "#D63030",
  gold:     "#E8A000",

  trust:    "#1A2744",
  trustL:   "#EEF1F8",
  trustM:   "#C8D0E8",
};

const R = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, full:999 };
const S = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:28 };

const GRADE = t => {
  if(t>=96) return { label:"최우수",  color:"#C04000", bg:"#FFF0E8", bar:"#D95F00", icon:"🏆" };
  if(t>=90) return { label:"신뢰",    color:"#D95F00", bg:"#FDF3EC", bar:"#E87030", icon:"✅" };
  if(t>=84) return { label:"양호",    color:"#C08000", bg:"#FDF8EC", bar:"#E8A000", icon:"👍" };
  return           { label:"신규",    color:"#8A837A", bg:"#F5F0EB", bar:"#C0B8B0", icon:"🆕" };
};

const PHOTOS = {
  apt_before:   "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=700&q=85",
  apt_after1:   "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=700&q=85",
  apt_after2:   "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=700&q=85",
  kitchen_b:    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=700&q=85",
  kitchen_a:    "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=700&q=85",
  cafe_before:  "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=700&q=85",
  cafe_after:   "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=700&q=85",
  office_b:     "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=700&q=85",
  office_a:     "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=700&q=85",
  room_before:  "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=700&q=85",
  room_after:   "https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=700&q=85",
  living_b:     "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=700&q=85",
  living_a:     "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=700&q=85",
};

const COMPANIES = [
  {
    id:1, name:"홍익시공", temp:97, reviews:84, years:12,
    distance:"0.6km", region:"마포구", verified:true, online:true,
    responseTime:"5분 내 응답", lastActive:"방금", todayBids:3,
    completedJobs:156, recontractRate:68, asRate:98,
    insurance:true, bizCert:true, platformCert:true, badge:"premium",
    specialties:["아파트 전체","주방 리모델링","욕실 시공"],
    desc:"12년 검증된 시공 이력. 에스크로 정산 156건 완료. 하자보수 AS 98% 처리.",
    rating:4.9,
    portfolio:[
      { id:1, title:"마포구 32평 아파트 전체 리모델링",
        type:"아파트 전체", budget:"2,650만원", period:"35일",
        before: PHOTOS.apt_before, after: PHOTOS.apt_after1,
        tags:["모던","주방확장","욕실2개"], escrow:true,
        desc:"노후 아파트를 모던 스타일로 전면 개조. 주방 벽 철거 후 오픈형 확장, 욕실 2개 전체 교체." },
      { id:2, title:"합정동 카페 인더스트리얼 시공",
        type:"카페/식당", budget:"3,200만원", period:"28일",
        before: PHOTOS.cafe_before, after: PHOTOS.cafe_after,
        tags:["인더스트리얼","카페","상업공간"], escrow:true,
        desc:"소규모 카페 오픈 인테리어. 노출 콘크리트 + 철재 구조물. 시공 후 오픈 2주 만에 만석." },
      { id:3, title:"연남동 거실·주방 부분 리모델링",
        type:"아파트 부분", budget:"1,280만원", period:"18일",
        before: PHOTOS.living_b, after: PHOTOS.living_a,
        tags:["내추럴","거실","부분공사"], escrow:false,
        desc:"거실 바닥 전체 교체 + 주방 상판·도어 교체. 구조 변경 없는 합리적 리모델링." },
    ],
    chat:[{ from:"company", text:"안녕하세요! 견적 문의 주셔서 감사합니다. 현장 방문 실측 후 정확한 견적 드릴게요.", time:"10:23" }],
    reviewList:[
      { id:1, user:"김민준", region:"마포구", rating:5, date:"2025.03.12", amount:"2,650만원", type:"아파트 전체 32평",
        content:"에스크로 정산이라 처음부터 끝까지 불안하지 않았어요. 중간 점검 사진도 매번 카톡으로 보내줘서 진행 상황을 알 수 있었고, 마감 퀄리티도 기대 이상이었습니다. 재계약 의향 100%.",
        tags:["에스크로 신뢰","중간보고 충실","마감 깔끔"], reply:"감사합니다! 새집에서 행복하세요 😊" },
      { id:2, user:"박서연", region:"망원동", rating:5, date:"2025.02.28", amount:"680만원", type:"원룸 부분",
        content:"견적서에 자재 브랜드, 수량까지 다 명시되어 있어서 믿음이 갔어요. 계약서 그대로 진행되고 추가 비용 없이 마무리됐습니다.",
        tags:["견적 투명","계약 준수","추가비용 없음"], reply:null },
      { id:3, user:"이준호", region:"연남동", rating:4, date:"2025.01.15", amount:"3,200만원", type:"카페 전체",
        content:"시공 중 조명 위치 하나가 도면이랑 달랐는데 바로 다음날 수정해줬어요. 오픈 후 하자 발생했을 때도 AS 빠르게 처리해줬습니다.",
        tags:["빠른 AS","하자보수 완료","소통 원활"], reply:"카페 번창하세요 🎉" },
    ]
  },
  {
    id:2, name:"공간설계소", temp:91, reviews:52, years:7,
    distance:"1.4km", region:"서대문구", verified:true, online:false,
    responseTime:"30분 내 응답", lastActive:"28분 전", todayBids:1,
    completedJobs:89, recontractRate:54, asRate:94,
    insurance:true, bizCert:true, platformCert:false, badge:"standard",
    specialties:["미니멀 인테리어","오피스","상업공간"],
    desc:"공간 구조 설계부터 시공까지 일괄 진행. 오피스·상업공간 전문.",
    rating:4.7,
    portfolio:[
      { id:1, title:"홍대 스타트업 오피스 리뉴얼",
        type:"오피스", budget:"1,800만원", period:"20일",
        before: PHOTOS.office_b, after: PHOTOS.office_a,
        tags:["미니멀","오피스","화이트톤"], escrow:true,
        desc:"30평 스타트업 사무실. 집중 업무 공간과 협업 공간을 효율적으로 분리." },
    ],
    chat:[{ from:"company", text:"어떤 공간 작업 생각하고 계세요?", time:"14:10" }],
    reviewList:[
      { id:1, user:"최수진", region:"합정동", rating:5, date:"2025.02.10", amount:"1,800만원", type:"오피스",
        content:"미니멀 감성 완벽하게 구현해줬어요. 공간 활용도도 훨씬 좋아졌고 직원들 만족도 높습니다.",
        tags:["공간 활용","마감 깔끔","일정 준수"], reply:null },
    ]
  },
  {
    id:3, name:"우리집시공단", temp:86, reviews:31, years:5,
    distance:"1.9km", region:"마포구", verified:false, online:true,
    responseTime:"1시간 내 응답", lastActive:"방금", todayBids:2,
    completedJobs:44, recontractRate:38, asRate:88,
    insurance:false, bizCert:true, platformCert:false, badge:null,
    specialties:["부분 인테리어","도배","바닥재"],
    desc:"합리적 가격의 부분 인테리어 전문. 도배·장판·조명 당일 시공 가능.",
    rating:4.4,
    portfolio:[
      { id:1, title:"원룸 도배·장판 전체 교체",
        type:"원룸", budget:"520만원", period:"10일",
        before: PHOTOS.room_before, after: PHOTOS.room_after,
        tags:["부분공사","도배","장판"], escrow:false,
        desc:"12평 원룸 도배 + 장판 전체 교체. 기존 짐 이동 없이 진행 가능." },
    ],
    chat:[], reviewList:[]
  },
];

const REQUESTS = [
  { id:1, user:"김**", area:"마포구 합정동", size:"32평", type:"아파트 전체", budget:"2,500~3,000만원", style:"모던 미니멀", desc:"신혼집 전체 리모델링. 주방 확장, 욕실 2개 교체 원합니다.", bids:4, time:"2시간 전", distance:"1.2km", urgent:false },
  { id:2, user:"박**", area:"마포구 망원동", size:"12평", type:"원룸", budget:"500~800만원", style:"북유럽", desc:"원룸 부분 인테리어. 도배, 바닥재, 조명 교체.", bids:2, time:"4시간 전", distance:"0.8km", urgent:false },
  { id:3, user:"이**", area:"서대문구 연남동", size:"8평", type:"카페/식당", budget:"3,000~4,000만원", style:"인더스트리얼", desc:"카페 오픈 준비. 인더스트리얼 콘셉트 전체 시공.", bids:6, time:"1일 전", distance:"2.1km", urgent:true },
];

const SPACE_TYPES = ["아파트 전체","아파트 부분","원룸/오피스텔","카페/식당","오피스","상가"];
const STYLES = ["모던 미니멀","북유럽 감성","인더스트리얼","내추럴 우드","럭셔리 클래식"];
const REVIEW_TAGS = ["에스크로 신뢰","중간보고 충실","마감 깔끔","일정 준수","견적 투명","빠른 AS","하자보수 완료","계약 준수"];
const REGIONS = ["마포구","서대문구","용산구","은평구","강남구","송파구"];

/* ── 공통 컴포넌트 ────────────────────────── */
const TempBadge = ({ temp, lg }) => {
  const g = GRADE(temp);
  return (
    <span style={{ background:g.bg, color:g.color, borderRadius:R.full,
      padding:lg?"5px 13px":"2px 10px", fontWeight:800, fontSize:lg?14:11,
      display:"inline-flex", alignItems:"center", gap:4 }}>
      {g.icon} {temp}° <span style={{ opacity:0.85, fontWeight:600 }}>{g.label}</span>
    </span>
  );
};

// 에스크로/검증 전용 — 네이비 유지
const CertBadge = ({ type }) => {
  const M = {
    platform: { t:"공간마켓 인증", c:C.navy,  bg:C.navyL,  i:"🛡" },
    insurance:{ t:"시공보험 가입", c:C.green, bg:C.greenL, i:"🔒" },
    biz:      { t:"사업자 등록",   c:C.text3, bg:C.bgWarm, i:"📋" },
  };
  const b = M[type];
  return (
    <span style={{ background:b.bg, color:b.c, borderRadius:R.full,
      padding:"2px 9px", fontSize:11, fontWeight:700,
      display:"inline-flex", alignItems:"center", gap:3 }}>
      {b.i} {b.t}
    </span>
  );
};

const Stars = ({ rating, size=14 }) => (
  <span style={{ color:C.gold, fontSize:size, letterSpacing:-1 }}>
    {"★".repeat(Math.floor(rating))}{"☆".repeat(5-Math.floor(rating))}
  </span>
);

const Divider = () => <div style={{ height:1, background:C.bgWarm }} />;
const fmtPhone = v => {
  const n = v.replace(/\D/g,"");
  if(n.length<=3) return n;
  if(n.length<=7) return `${n.slice(0,3)}-${n.slice(3)}`;
  return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7,11)}`;
};

/* ── 실시간 피드 ──────────────────────────── */
const FEED_BASE = [
  { id:1, type:"bid",      co:"홍익시공",    area:"합정동", msg:"32평 아파트 견적 제출",    t:0 },
  { id:2, type:"complete", co:"공간설계소",  area:"연남동", msg:"오피스 시공 완료",          t:3 },
  { id:3, type:"review",   co:"홍익시공",    area:"망원동", msg:"새 후기 ★★★★★ 등록",     t:7 },
  { id:4, type:"bid",      co:"우리집시공단",area:"상수동", msg:"원룸 도배·장판 입찰",      t:12 },
];
const FEED_META = {
  bid:      { icon:"💬", color:C.brand },
  complete: { icon:"✅", color:C.green },
  review:   { icon:"⭐", color:C.gold },
  new:      { icon:"📋", color:C.brand },
};

function LiveFeed() {
  const [feed, setFeed] = useState(FEED_BASE);
  const [newId, setNewId] = useState(null);

  useEffect(() => {
    const pool = [
      { type:"bid",      co:"홍익시공",    area:"합정동", msg:"새 입찰 제출" },
      { type:"complete", co:"공간설계소",  area:"연남동", msg:"시공 완료" },
      { type:"review",   co:"우리집시공단",area:"망원동", msg:"후기 등록 ★★★★" },
    ];
    const t = setInterval(() => {
      const item = { ...pool[Math.floor(Math.random()*pool.length)], id:Date.now(), t:0 };
      setNewId(item.id);
      setFeed(f => [item, ...f.slice(0,4)].map(x => ({ ...x, t: x.id===item.id?0:x.t+7 })));
      setTimeout(() => setNewId(null), 1800);
    }, 7000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
      marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.text2 }}>동네 시공 현황</div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:C.green,
            animation:"gPulse 2s infinite" }} />
          <span style={{ fontSize:11, color:C.green, fontWeight:700 }}>LIVE</span>
        </div>
      </div>
      {feed.slice(0,4).map(item => {
        const m = FEED_META[item.type];
        return (
          <div key={item.id} style={{ display:"flex", alignItems:"center", gap:S.sm,
            padding:`${S.xs}px ${S.sm}px`, borderRadius:R.md,
            background: item.id===newId ? `${m.color}10` : "transparent",
            transition:"background 0.6s",
            animation: item.id===newId ? "slideIn 0.35s ease" : "none",
            marginBottom:2 }}>
            <div style={{ width:28, height:28, borderRadius:R.sm, flexShrink:0,
              background:`${m.color}15`, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:13 }}>{m.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.text1,
                overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                <span style={{ color:m.color }}>{item.co}</span> · {item.area}
              </div>
              <div style={{ fontSize:11, color:C.text3 }}>{item.msg}</div>
            </div>
            <div style={{ fontSize:10, color:C.text4, flexShrink:0 }}>
              {item.t===0?"방금":`${item.t}분 전`}
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes gPulse{0%,100%{box-shadow:0 0 0 0 ${C.green}44}50%{box-shadow:0 0 0 5px ${C.green}00}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
      `}</style>
    </div>
  );
}

/* ── 업체 카드 ────────────────────────────── */
function CompanyCard({ company, onClick }) {
  const g = GRADE(company.temp);
  return (
    <div onClick={onClick} style={{ background:C.surface, borderRadius:R.xl,
      marginBottom:S.sm, cursor:"pointer",
      border:`1px solid ${C.bgWarm}`,
      boxShadow:"0 1px 6px rgba(28,23,18,0.05)", overflow:"hidden" }}>

      <div style={{ height:3, background:`linear-gradient(90deg,${g.bar},${g.bar}44)` }} />

      <div style={{ padding:S.xl }}>
        <div style={{ display:"flex", gap:S.md, alignItems:"flex-start" }}>
          <div style={{ width:48, height:48, borderRadius:R.lg, flexShrink:0,
            background:C.brandL,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:20, fontWeight:900, color:C.brand, position:"relative" }}>
            {company.name[0]}
            {company.online && <div style={{ position:"absolute", bottom:-1, right:-1,
              width:12, height:12, borderRadius:"50%", background:C.green, border:"2.5px solid #fff" }} />}
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
              <span style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{company.name}</span>
              <TempBadge temp={company.temp} />
            </div>

            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:7 }}>
              {company.badge && (
                <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full,
                  padding:"2px 10px", fontSize:11, fontWeight:800,
                  display:"inline-flex", alignItems:"center", gap:3 }}>
                  {company.badge==="premium"?"🥇":company.badge==="standard"?"🥈":company.badge==="enterprise"?"💎":"🥉"}
                  공간보증 {company.badge==="premium"?"프리미엄":company.badge==="standard"?"스탠다드":company.badge==="enterprise"?"엔터프라이즈":"베이직"}
                </span>
              )}
              {!company.badge && (
                <span style={{ background:C.surface2, color:C.text3, borderRadius:R.full,
                  padding:"2px 10px", fontSize:11, fontWeight:600 }}>직거래</span>
              )}
              {company.insurance && <CertBadge type="insurance" />}
              {company.bizCert && <CertBadge type="biz" />}
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:7 }}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:4,
                background:company.online?C.greenL:C.bgWarm,
                color:company.online?C.green:C.text3,
                borderRadius:R.full, padding:"2px 9px", fontSize:11, fontWeight:700 }}>
                <span style={{ width:5, height:5, borderRadius:"50%",
                  background:company.online?C.green:C.text4, display:"inline-block" }} />
                {company.online?`활동중 · ${company.lastActive}`:company.responseTime}
              </span>
              {company.todayBids > 0 && (
                <span style={{ background:C.brandL, color:C.brand,
                  borderRadius:R.full, padding:"2px 9px", fontSize:11, fontWeight:700 }}>
                  오늘 {company.todayBids}건 입찰
                </span>
              )}
            </div>

            <div style={{ display:"flex", gap:S.lg, fontSize:12, color:C.text3 }}>
              <span>⭐ {company.rating}({company.reviews})</span>
              <span>✅ {company.completedJobs}건 완료</span>
              <span>🔄 재계약 {company.recontractRate}%</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop:S.md, background:C.surface2, borderRadius:R.md,
          padding:`${S.sm}px ${S.md}px`, fontSize:13, color:C.text2, lineHeight:1.5 }}>
          📍 {company.distance} · {company.desc}
        </div>
      </div>
    </div>
  );
}

/* ── 포트폴리오 카드 ────────────────────────── */
function PortfolioCard({ work, onExpand }) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);

  return (
    <div onClick={() => onExpand(work)}
      style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
        border:`1px solid ${C.bgWarm}`, cursor:"pointer",
        boxShadow:"0 2px 10px rgba(28,23,18,0.07)", marginBottom:S.md }}>

      <div style={{ position:"relative", height:210, background:C.bgWarm }}>
        {!err ? (
          <img src={work.after} alt={work.title}
            onLoad={() => setLoaded(true)}
            onError={() => setErr(true)}
            style={{ width:"100%", height:"100%", objectFit:"cover",
              opacity:loaded?1:0, transition:"opacity 0.4s" }} />
        ) : (
          <div style={{ width:"100%", height:"100%",
            background:`linear-gradient(135deg,${C.bgWarm},${C.brandL})`,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:8 }}>🏠</div>
              <div style={{ fontSize:13, color:C.text3 }}>시공 완료 사진</div>
            </div>
          </div>
        )}

        <div style={{ position:"absolute", inset:0,
          background:"linear-gradient(to bottom, transparent 45%, rgba(28,23,18,0.72))" }} />

        <div style={{ position:"absolute", top:S.md, right:S.md,
          background:C.brand, color:"#fff", borderRadius:R.full,
          padding:"3px 10px", fontSize:10, fontWeight:800, letterSpacing:"0.5px" }}>
          AFTER
        </div>

        {/* 에스크로 완료 — 네이비 보조 사용 */}
        {work.escrow && (
          <div style={{ position:"absolute", top:S.md, left:S.md,
            background:C.navy, color:"#fff", borderRadius:R.full,
            padding:"3px 10px", fontSize:10, fontWeight:700,
            display:"flex", alignItems:"center", gap:4 }}>
            🛡 에스크로 완료
          </div>
        )}

        <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:S.lg }}>
          <div style={{ fontSize:15, fontWeight:800, color:"#fff", marginBottom:6,
            textShadow:"0 1px 4px rgba(0,0,0,0.4)" }}>
            {work.title}
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {work.tags.map(t => (
              <span key={t} style={{ background:"rgba(255,255,255,0.18)",
                color:"#fff", borderRadius:R.full, padding:"2px 9px",
                fontSize:11, fontWeight:600, backdropFilter:"blur(6px)" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding:S.lg, display:"flex", gap:S.md, alignItems:"center" }}>
        <div style={{ width:70, height:54, borderRadius:R.sm, overflow:"hidden",
          flexShrink:0, position:"relative", border:`1px solid ${C.bgWarm}` }}>
          <img src={work.before} alt="before"
            style={{ width:"100%", height:"100%", objectFit:"cover",
              filter:"grayscale(50%) brightness(0.88)" }}
            onError={e => { e.target.style.background=C.bgWarm; }} />
          <div style={{ position:"absolute", inset:0, display:"flex",
            alignItems:"center", justifyContent:"center",
            background:"rgba(28,23,18,0.28)" }}>
            <span style={{ fontSize:9, color:"#fff", fontWeight:800, letterSpacing:"0.5px" }}>BEFORE</span>
          </div>
        </div>

        <div style={{ flex:1 }}>
          <div style={{ display:"flex", gap:S.md, marginBottom:4 }}>
            <span style={{ fontSize:13, color:C.text2, fontWeight:600 }}>💰 {work.budget}</span>
            <span style={{ fontSize:13, color:C.text2 }}>📅 {work.period}</span>
          </div>
          <span style={{ background:C.bgWarm, color:C.text3, borderRadius:R.full,
            padding:"2px 9px", fontSize:11, fontWeight:600 }}>{work.type}</span>
        </div>

        <div style={{ background:C.brandL, color:C.brand, borderRadius:R.full,
          padding:"5px 10px", fontSize:12, fontWeight:700 }}>
          전후 비교 →
        </div>
      </div>
    </div>
  );
}

/* ── 포트폴리오 전후 비교 모달 ────────────── */
function PhotoModal({ work, onClose }) {
  const [view, setView] = useState("after");

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(28,23,18,0.9)",
      zIndex:300, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:S.xl }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
          width:"100%", maxWidth:440 }}>

        <div style={{ display:"flex", background:C.bg }}>
          {[["after","AFTER"],["before","BEFORE"],["compare","비교"]].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ flex:1, padding:"12px 0", border:"none",
                background:view===v?C.surface:"transparent",
                color:view===v?C.brand:C.text3,
                fontWeight:view===v?800:500, fontSize:13, cursor:"pointer",
                borderBottom:view===v?`2px solid ${C.brand}`:"2px solid transparent" }}>{l}</button>
          ))}
        </div>

        {view !== "compare" ? (
          <div style={{ height:280, position:"relative" }}>
            <img src={view==="after"?work.after:work.before} alt={view}
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={e => { e.target.style.background=C.bgWarm; }} />
            <div style={{ position:"absolute", top:S.md, right:S.md,
              background:view==="after"?C.brand:C.text2, color:"#fff",
              borderRadius:R.full, padding:"3px 12px", fontSize:11, fontWeight:800 }}>
              {view==="after"?"AFTER ✨":"BEFORE"}
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", height:280 }}>
            <div style={{ flex:1, position:"relative" }}>
              <img src={work.before} alt="before"
                style={{ width:"100%", height:"100%", objectFit:"cover", filter:"grayscale(30%)" }}
                onError={e => { e.target.style.background=C.bgWarm; }} />
              <div style={{ position:"absolute", bottom:S.sm, left:S.sm,
                background:"rgba(28,23,18,0.7)", color:"#fff",
                borderRadius:R.full, padding:"2px 8px", fontSize:10, fontWeight:800 }}>BEFORE</div>
            </div>
            <div style={{ width:2, background:C.brand }} />
            <div style={{ flex:1, position:"relative" }}>
              <img src={work.after} alt="after"
                style={{ width:"100%", height:"100%", objectFit:"cover" }}
                onError={e => { e.target.style.background=C.bgWarm; }} />
              <div style={{ position:"absolute", bottom:S.sm, right:S.sm,
                background:C.brand, color:"#fff",
                borderRadius:R.full, padding:"2px 8px", fontSize:10, fontWeight:800 }}>AFTER</div>
            </div>
          </div>
        )}

        <div style={{ padding:S.xl }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.sm }}>{work.title}</div>
          <div style={{ fontSize:13, color:C.text2, lineHeight:1.6, marginBottom:S.lg }}>{work.desc}</div>
          <div style={{ display:"flex", gap:S.xl, marginBottom:S.lg }}>
            {[["💰",work.budget],["📅",work.period],["🏠",work.type]].map(([i,v]) => (
              <div key={v} style={{ textAlign:"center" }}>
                <div style={{ fontSize:12, color:C.text3 }}>{i}</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
          {work.escrow && (
            <div style={{ background:C.navyL, borderRadius:R.md,
              padding:"10px 14px", display:"flex", gap:S.sm, alignItems:"center" }}>
              <span style={{ fontSize:16 }}>🛡</span>
              <span style={{ fontSize:12, color:C.navy, fontWeight:700 }}>에스크로 안전거래 완료 시공</span>
            </div>
          )}
          <button onClick={onClose}
            style={{ width:"100%", marginTop:S.lg, padding:"13px", background:C.bg,
              color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
              fontWeight:700, fontSize:14, cursor:"pointer" }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ── 포트폴리오 상세 화면 ─────────────────── */
function PortfolioScreen({ company, onChat, onReview, onBack, onEscrow }) {
  const g = GRADE(company.temp);
  const [photoWork, setPhotoWork] = useState(null);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack} style={{ background:"none", border:"none",
          fontSize:22, cursor:"pointer", color:C.text1, padding:0, lineHeight:1 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{company.name}</div>
        <TempBadge temp={company.temp} />
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 100px` }}>

        <div style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
          marginBottom:S.lg, border:`1px solid ${C.bgWarm}`,
          boxShadow:"0 2px 12px rgba(28,23,18,0.07)" }}>
          <div style={{ height:4, background:`linear-gradient(90deg,${g.bar},${g.bar}33)` }} />
          <div style={{ padding:S.xl }}>
            <div style={{ display:"flex", gap:S.lg, alignItems:"flex-start", marginBottom:S.lg }}>
              <div style={{ width:64, height:64, borderRadius:R.lg, flexShrink:0,
                background:C.brandL,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:26, fontWeight:900, color:C.brand }}>{company.name[0]}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:8 }}>{company.name}</div>
                <TempBadge temp={company.temp} lg />
              </div>
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:S.lg }}>
              {company.platformCert && <CertBadge type="platform" />}
              {company.insurance && <CertBadge type="insurance" />}
              {company.bizCert && <CertBadge type="biz" />}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:S.sm, marginBottom:S.lg }}>
              {[["✅","완료 건수",`${company.completedJobs}건`],
                ["🔄","재계약률",`${company.recontractRate}%`],
                ["🛠","AS 처리율",`${company.asRate}%`]].map(([icon,label,val]) => (
                <div key={label} style={{ background:C.surface2, borderRadius:R.lg,
                  padding:`${S.md}px ${S.sm}px`, textAlign:"center",
                  border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ fontSize:11, color:C.text3, marginBottom:3 }}>{icon} {label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ background:company.online?C.greenL:C.bgWarm, borderRadius:R.lg,
              padding:`${S.sm}px ${S.lg}px`, marginBottom:S.lg,
              display:"flex", alignItems:"center", gap:S.sm }}>
              <div style={{ width:8, height:8, borderRadius:"50%",
                background:company.online?C.green:C.text4,
                boxShadow:company.online?`0 0 0 3px ${C.green}33`:"none" }} />
              <span style={{ fontSize:13, fontWeight:700, color:company.online?C.green:C.text3 }}>
                {company.online?`지금 활동중 · ${company.lastActive}` : `마지막 활동: ${company.lastActive}`}
              </span>
              <span style={{ fontSize:12, color:C.text3, marginLeft:"auto" }}>{company.responseTime}</span>
            </div>

            {/* 에스크로 배너 — 네이비 보조 사용 (상세 화면에만 유지) */}
            <div style={{ background:C.navyL, borderRadius:R.lg,
              padding:`${S.md}px ${S.lg}px`, border:`1px solid ${C.trustM}`,
              display:"flex", gap:S.md, alignItems:"center" }}>
              <div style={{ fontSize:24, flexShrink:0 }}>🛡</div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:2 }}>
                  에스크로 안전 정산
                </div>
                <div style={{ fontSize:12, color:C.text3, lineHeight:1.5 }}>
                  선금 30% → 중간 점검 후 40% → 완료 확인 후 30%
                </div>
              </div>
            </div>
          </div>
        </div>

        <button onClick={onReview} style={{ width:"100%", background:C.surface,
          border:`1px solid ${C.bgWarm}`, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.lg, cursor:"pointer",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          boxShadow:"0 1px 6px rgba(28,23,18,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg, background:"#FFF8E8",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>⭐</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:15, fontWeight:700, color:C.text1 }}>
                시공 후기 {company.reviewList.length}개
              </div>
              <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>
                {company.reviewList.length > 0
                  ? `평균 ${(company.reviewList.reduce((s,r) => s+r.rating,0)/company.reviewList.length).toFixed(1)}점 · 탭해서 보기`
                  : "첫 후기를 남겨주세요"}
              </div>
            </div>
          </div>
          <span style={{ color:C.text4, fontSize:20 }}>›</span>
        </button>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>
            시공 포트폴리오
            <span style={{ fontSize:13, fontWeight:500, color:C.text3, marginLeft:6 }}>
              {company.portfolio.length}건
            </span>
          </div>
        </div>
        {company.portfolio.map(work => (
          <PortfolioCard key={work.id} work={work} onExpand={setPhotoWork} />
        ))}

        <button onClick={() => onChat(company)}
          style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff",
            border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
            cursor:"pointer", marginTop:S.sm,
            boxShadow:`0 6px 20px ${C.brand}44` }}>
          💬 {company.name} 견적 문의하기
        </button>
        <button onClick={() => onEscrow && onEscrow()}
          style={{ width:"100%", padding:S.lg, background:C.navyL, color:C.navy,
            border:`1px solid ${C.trustM}`, borderRadius:R.lg, fontWeight:700, fontSize:14,
            cursor:"pointer", marginTop:S.sm }}>
          🛡 에스크로 정산 현황 보기
        </button>
      </div>

      {photoWork && <PhotoModal work={photoWork} onClose={() => setPhotoWork(null)} />}
    </div>
  );
}

/* ── 후기 화면 ────────────────────────────── */
function ReviewScreen({ company, onBack }) {
  const [reviews, setReviews] = useState(company.reviewList);
  const [showModal, setShowModal] = useState(false);
  const [newId, setNewId] = useState(null);
  const avg = reviews.length > 0
    ? (reviews.reduce((s,r) => s+r.rating, 0)/reviews.length).toFixed(1) : "0.0";

  const handleSubmit = data => {
    const now = new Date();
    const nr = { id:Date.now(), user:"나", region:"마포구", rating:data.rating,
      date:`${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")}`,
      amount:"진행중", type:"시공 완료", content:data.content, tags:data.tags, reply:null };
    setReviews(r => [nr,...r]);
    setNewId(nr.id);
    setTimeout(() => setNewId(null), 3000);
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>시공 후기</div>
          <div style={{ fontSize:12, color:C.text3 }}>{company.name} · {reviews.length}개</div>
        </div>
      </div>
      <div style={{ padding:`${S.xl}px ${S.xl}px 100px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.xxl, alignItems:"center", marginBottom:S.xl }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:52, fontWeight:900, color:C.text1, lineHeight:1 }}>{avg}</div>
              <Stars rating={Math.round(parseFloat(avg))} size={18} />
              <div style={{ fontSize:12, color:C.text3, marginTop:6 }}>{reviews.length}개</div>
            </div>
            <div style={{ flex:1 }}>
              {[5,4,3,2,1].map(star => {
                const cnt = reviews.filter(r => r.rating===star).length;
                const pct = reviews.length > 0 ? (cnt/reviews.length)*100 : 0;
                return (
                  <div key={star} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:11, color:C.text3, width:16, textAlign:"right" }}>{star}</span>
                    <div style={{ flex:1, height:6, background:C.bgWarm, borderRadius:R.full, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:C.gold, borderRadius:R.full }} />
                    </div>
                    <span style={{ fontSize:11, color:C.text3, width:20 }}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <Divider />
          <div style={{ marginTop:S.lg, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.text2 }}>🌡 공간온도</div>
            <TempBadge temp={company.temp} lg />
          </div>
        </div>

        {reviews.map(rv => (
          <div key={rv.id} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.md,
            border:`1.5px solid ${rv.id===newId?C.brand:C.bgWarm}`,
            animation:rv.id===newId?"fadeUp 0.4s ease":"none" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.md }}>
              <div style={{ display:"flex", gap:S.md, alignItems:"center" }}>
                <div style={{ width:40, height:40, borderRadius:"50%",
                  background:`hsl(${rv.id*55},40%,88%)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:15, fontWeight:900, color:C.text2 }}>{rv.user[0]}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>{rv.user}</div>
                  <div style={{ fontSize:12, color:C.text3 }}>📍 {rv.region} · {rv.date}</div>
                </div>
              </div>
              <Stars rating={rv.rating} size={13} />
            </div>
            <div style={{ background:C.surface2, borderRadius:R.md, padding:"8px 12px", marginBottom:S.md, display:"flex", gap:S.lg }}>
              <span style={{ fontSize:12, color:C.text3 }}>🏠 {rv.type}</span>
              <span style={{ fontSize:12, color:C.text3 }}>💰 {rv.amount}</span>
            </div>
            {rv.tags?.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:S.md }}>
                {rv.tags.map(t => (
                  <span key={t} style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>✓ {t}</span>
                ))}
              </div>
            )}
            <div style={{ fontSize:14, color:C.text2, lineHeight:1.7 }}>{rv.content}</div>
            {rv.reply && (
              <div style={{ background:C.surface2, borderRadius:R.md, padding:S.md, marginTop:S.md, borderLeft:`3px solid ${C.brand}` }}>
                <div style={{ fontSize:11, fontWeight:800, color:C.brand, marginBottom:4 }}>🏠 업체 답글</div>
                <div style={{ fontSize:13, color:C.text2, lineHeight:1.6 }}>{rv.reply}</div>
              </div>
            )}
          </div>
        ))}

        {reviews.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📝</div>
            <div style={{ fontSize:13, color:C.text3 }}>아직 후기가 없어요</div>
          </div>
        )}
      </div>

      <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)",
        width:"calc(100% - 40px)", maxWidth:440, zIndex:10 }}>
        <button onClick={() => setShowModal(true)}
          style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff",
            border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15,
            cursor:"pointer", boxShadow:`0 8px 24px ${C.brand}44` }}>
          ✏️ 시공 후기 작성하기
        </button>
      </div>

      {showModal && <ReviewModal onClose={() => setShowModal(false)} onSubmit={handleSubmit} />}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ── 후기 작성 모달 ───────────────────────── */
function ReviewModal({ onClose, onSubmit }) {
  const [step, setStep] = useState(1);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const LABELS = ["","별로예요","아쉬워요","보통이에요","좋았어요","최고예요!"];
  const toggle = t => setTags(p => p.includes(t) ? p.filter(x=>x!==t) : [...p,t]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(28,23,18,0.55)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }}>
      <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480, padding:"20px 24px 40px", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, borderRadius:R.full, background:C.bgWarm, margin:"0 auto 20px" }} />

        {step===1 && <>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ fontSize:40, marginBottom:10 }}>⭐</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:4 }}>시공은 어떠셨나요?</div>
            <div style={{ fontSize:13, color:C.text3 }}>솔직한 후기가 다른 분들께 큰 도움이 됩니다</div>
          </div>
          <div style={{ textAlign:"center", marginBottom:24 }}>
            <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:12 }}>
              {[1,2,3,4,5].map(s => (
                <span key={s} onClick={() => setRating(s)}
                  onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
                  style={{ fontSize:46, cursor:"pointer",
                    color:s<=(hover||rating)?C.gold:"#E8E4DC",
                    transition:"all 0.1s",
                    transform:s<=(hover||rating)?"scale(1.15)":"scale(1)",
                    display:"inline-block" }}>★</span>
              ))}
            </div>
            {(hover||rating) > 0 && <div style={{ fontWeight:800, fontSize:15, color:C.gold }}>{LABELS[hover||rating]}</div>}
          </div>
          <button onClick={() => rating>0&&setStep(2)}
            style={{ width:"100%", padding:S.xl, background:rating>0?C.brand:"#E8E4DC",
              color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
              cursor:rating>0?"pointer":"not-allowed" }}>다음</button>
        </>}

        {step===2 && <>
          <div style={{ display:"flex", alignItems:"center", gap:S.md, marginBottom:S.xl }}>
            <button onClick={() => setStep(1)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.text3 }}>←</button>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>상세 후기 작성</div>
              <Stars rating={rating} size={13} />
            </div>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>어떤 점이 좋았나요?</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.xl }}>
            {REVIEW_TAGS.map(t => (
              <button key={t} onClick={() => toggle(t)}
                style={{ padding:"8px 14px", borderRadius:R.full, fontSize:13, fontWeight:600,
                  border:`1.5px solid ${tags.includes(t)?C.brand:C.bgWarm}`,
                  background:tags.includes(t)?C.brandL:C.surface,
                  color:tags.includes(t)?C.brand:C.text2, cursor:"pointer" }}>
                {tags.includes(t)?"✓ ":""}{t}
              </button>
            ))}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>후기 내용</div>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="시공 과정, 결과물, 업체 태도 등 솔직한 후기를 남겨주세요." rows={5}
            style={{ width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`,
              borderRadius:R.lg, fontSize:14, outline:"none", resize:"none",
              boxSizing:"border-box", lineHeight:1.7, fontFamily:"inherit", color:C.text1,
              background:C.surface }} />
          <div style={{ textAlign:"right", fontSize:12, color:content.length<20?C.red:C.text4, marginBottom:S.lg }}>
            {content.length}자 {content.length<20?"(최소 20자)":""}
          </div>
          <button onClick={() => content.length>=20&&setStep(3)}
            style={{ width:"100%", padding:S.xl, background:content.length>=20?C.brand:"#E8E4DC",
              color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
              cursor:content.length>=20?"pointer":"not-allowed" }}>후기 등록하기</button>
        </>}

        {step===3 && (
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            <div style={{ fontSize:64, marginBottom:16 }}>🎉</div>
            <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:8 }}>후기 등록 완료!</div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:20, lineHeight:1.7 }}>소중한 후기 감사합니다.</div>
            <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xxl, display:"inline-block" }}>
              <div style={{ fontSize:13, color:C.brand, fontWeight:700 }}>🌡 공간온도 +0.3° 상승!</div>
            </div>
            <br/>
            <button onClick={() => { onSubmit({ rating, content, tags }); onClose(); }}
              style={{ padding:"14px 40px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>확인</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 채팅 ─────────────────────────────────── */
function ChatScreen({ company, onBack, messages, onUpdateMessages }) {
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const REPLIES = [
    "현장 방문 실측 후 정확한 견적 드릴게요. 에스크로 안전거래로 진행됩니다 🛡",
    "해당 범위 많이 해본 작업이에요. 중간 점검 사진은 매번 공유해드립니다.",
    "무료 실측 상담 가능합니다. 편하신 날짜 알려주세요 📅",
    "계약서에 자재 브랜드·수량 전부 명시하고 추가 비용 없이 진행합니다.",
  ];
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, typing]);
  const send = () => {
    if(!input.trim()) return;
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}`;
    const userMsg = { from:"user", text:input, time };
    const updated = [...messages, userMsg];
    onUpdateMessages(updated);
    setInput(""); setTyping(true);
    setTimeout(() => {
      const reply = { from:"company", text:REPLIES[Math.floor(Math.random()*REPLIES.length)], time };
      onUpdateMessages([...updated, reply]);
      setTyping(false);
    }, 1200);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.bgWarm}`, padding:"12px 16px",
        display:"flex", alignItems:"center", gap:S.md, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div style={{ width:40, height:40, borderRadius:R.full, flexShrink:0,
          background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, fontWeight:900, color:C.brand, position:"relative" }}>
          {company.name[0]}
          {company.online && <div style={{ position:"absolute", bottom:0, right:0, width:10, height:10, borderRadius:"50%", background:C.green, border:"2px solid #fff" }} />}
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{company.name}</div>
          <div style={{ fontSize:11, color:company.online?C.green:C.text3, fontWeight:600 }}>
            {company.online?`활동중 · ${company.lastActive}`:company.responseTime}
          </div>
        </div>
        <div style={{ marginLeft:"auto" }}><TempBadge temp={company.temp} /></div>
      </div>

      {/* 채팅 에스크로 배너 — 네이비 보조 */}
      <div style={{ background:C.navyL, padding:"8px 16px", borderBottom:`1px solid ${C.trustM}`,
        display:"flex", gap:S.sm, alignItems:"center" }}>
        <span>🛡</span>
        <span style={{ fontSize:12, color:C.navy, fontWeight:600 }}>에스크로 안전 정산이 적용되는 채팅입니다</span>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:S.xl, background:C.bg }}>
        {messages.length===0 && <div style={{ textAlign:"center", fontSize:13, color:C.text3, marginTop:60 }}>첫 메시지를 보내보세요!</div>}
        {messages.map((msg,i) => (
          <div key={i} style={{ display:"flex", justifyContent:msg.from==="user"?"flex-end":"flex-start",
            marginBottom:S.md, alignItems:"flex-end", gap:6 }}>
            {msg.from==="company" && (
              <div style={{ width:32, height:32, borderRadius:R.full, background:C.brandL,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:900, color:C.brand, flexShrink:0 }}>{company.name[0]}</div>
            )}
            <div>
              <div style={{ background:msg.from==="user"?C.brand:C.surface,
                color:msg.from==="user"?"#fff":C.text1,
                borderRadius:msg.from==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                padding:"11px 15px", maxWidth:240, fontSize:14, lineHeight:1.6,
                boxShadow:"0 1px 4px rgba(28,23,18,0.08)" }}>{msg.text}</div>
              <div style={{ fontSize:10, color:C.text4, marginTop:3, textAlign:msg.from==="user"?"right":"left" }}>{msg.time}</div>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:S.md }}>
            <div style={{ width:32, height:32, borderRadius:R.full, background:C.brandL,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, fontWeight:900, color:C.brand }}>{company.name[0]}</div>
            <div style={{ background:C.surface, borderRadius:"18px 18px 18px 4px",
              padding:"12px 16px", boxShadow:"0 1px 4px rgba(28,23,18,0.08)" }}>
              <div style={{ display:"flex", gap:5 }}>
                {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.bgWarm, animation:`bounce 1.2s ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ background:C.surface, borderTop:`1px solid ${C.bgWarm}`,
        padding:`${S.sm}px ${S.lg}px ${S.lg}px`, display:"flex", gap:S.sm, alignItems:"flex-end" }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==="Enter"&&send()} placeholder="메시지를 입력하세요"
          style={{ flex:1, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.full,
            padding:"11px 18px", fontSize:14, outline:"none", fontFamily:"inherit",
            background:C.bg, color:C.text1 }} />
        <button onClick={send}
          style={{ width:44, height:44, borderRadius:R.full,
            background:input.trim()?C.brand:"#E8E4DC", border:"none",
            cursor:input.trim()?"pointer":"default",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>➤</button>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

/* ── 견적 요청 모달 ───────────────────────── */
function RequestModal({ onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ type:"", size:"", budget:"", style:"", desc:"" });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const iS = { width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box",
    marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(28,23,18,0.55)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }}>
      <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480, padding:"20px 24px 40px" }}>
        <div style={{ width:36, height:4, borderRadius:R.full, background:C.bgWarm, margin:"0 auto 20px" }} />
        <div style={{ display:"flex", gap:6, marginBottom:S.xxl }}>
          {[1,2,3].map(s => <div key={s} style={{ flex:1, height:4, borderRadius:R.full, background:step>=s?C.brand:C.bgWarm, transition:"background 0.3s" }} />)}
        </div>

        {step===1 && <>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:4 }}>어떤 공간인가요?</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>시공할 공간을 선택해주세요</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.xl }}>
            {SPACE_TYPES.map(t => (
              <button key={t} onClick={() => set("type",t)}
                style={{ padding:"10px 16px", borderRadius:R.full, fontSize:14, fontWeight:600,
                  border:`1.5px solid ${form.type===t?C.brand:C.bgWarm}`,
                  background:form.type===t?C.brandL:C.surface,
                  color:form.type===t?C.brand:C.text2, cursor:"pointer" }}>{t}</button>
            ))}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>평수</div>
          <input placeholder="예: 32평" value={form.size} onChange={e => set("size",e.target.value)} style={iS} />
          <button onClick={() => form.type&&form.size&&setStep(2)}
            style={{ width:"100%", padding:S.xl, background:form.type&&form.size?C.brand:"#E8E4DC",
              color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
              cursor:form.type&&form.size?"pointer":"not-allowed" }}>다음 →</button>
        </>}

        {step===2 && <>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:4 }}>예산과 스타일</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>원하는 범위를 알려주세요</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>희망 예산</div>
          <input placeholder="예: 2,500~3,000만원" value={form.budget} onChange={e => set("budget",e.target.value)} style={iS} />
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>선호 스타일</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.md }}>
            {STYLES.map(s => (
              <button key={s} onClick={() => set("style",s)}
                style={{ padding:"10px 16px", borderRadius:R.full, fontSize:14, fontWeight:600,
                  border:`1.5px solid ${form.style===s?C.brand:C.bgWarm}`,
                  background:form.style===s?C.brandL:C.surface,
                  color:form.style===s?C.brand:C.text2, cursor:"pointer" }}>{s}</button>
            ))}
            <button onClick={() => set("style","기타")}
              style={{ padding:"10px 16px", borderRadius:R.full, fontSize:14, fontWeight:600,
                border:`1.5px solid ${form.style==="기타"||(!STYLES.includes(form.style)&&form.style)?C.brand:C.bgWarm}`,
                background:form.style==="기타"||(!STYLES.includes(form.style)&&form.style)?C.brandL:C.surface,
                color:form.style==="기타"||(!STYLES.includes(form.style)&&form.style)?C.brand:C.text2,
                cursor:"pointer" }}>✏️ 기타</button>
          </div>
          {(form.style==="기타" || (!STYLES.includes(form.style) && form.style)) && (
            <input
              placeholder="예: 빈티지, 한옥 모던, 컬러풀 팝아트..."
              value={STYLES.includes(form.style)||form.style==="기타" ? "" : form.style}
              onChange={e => set("style", e.target.value)}
              autoFocus
              style={{ ...iS, marginBottom:S.xl }}
            />
          )}
          {!(form.style==="기타" || (!STYLES.includes(form.style) && form.style)) && (
            <div style={{ marginBottom:S.xl }} />
          )}
          <div style={{ display:"flex", gap:S.sm }}>
            <button onClick={() => setStep(1)} style={{ flex:0.5, padding:S.xl, background:C.bg, color:C.text2, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>← 이전</button>
            <button onClick={() => form.budget&&setStep(3)} style={{ flex:1, padding:S.xl, background:form.budget?C.brand:"#E8E4DC", color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:form.budget?"pointer":"not-allowed" }}>다음 →</button>
          </div>
        </>}

        {step===3 && <>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:4 }}>요청 내용</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>업체에게 전달할 내용을 입력해주세요</div>
          <textarea placeholder="예) 주방 확장, 욕실 2개 교체, 바닥재 전체 교체 원합니다." value={form.desc}
            onChange={e => set("desc",e.target.value)} rows={4}
            style={{ ...iS, resize:"none", lineHeight:1.7, marginBottom:S.sm }} />
          {/* 에스크로 안내 — 네이비 보조 */}
          <div style={{ background:C.navyL, borderRadius:R.md, padding:"10px 14px",
            marginBottom:S.xl, fontSize:13, color:C.navy, fontWeight:600,
            display:"flex", gap:8, alignItems:"center" }}>
            <span>🛡</span>
            <span>인근 검증 업체에게만 공개 · 에스크로 안전 정산 적용</span>
          </div>
          <div style={{ display:"flex", gap:S.sm }}>
            <button onClick={() => setStep(2)} style={{ flex:0.5, padding:S.xl, background:C.bg, color:C.text2, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>← 이전</button>
            <button onClick={() => form.desc&&onDone(form)} style={{ flex:1, padding:S.xl, background:form.desc?C.brand:"#E8E4DC", color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:form.desc?"pointer":"not-allowed" }}>🚀 견적 요청하기</button>
          </div>
        </>}
      </div>
    </div>
  );
}

const ALL_REGIONS = ["마포구","서대문구","용산구","은평구","강남구","송파구","강동구","강서구","영등포구","동작구","관악구","종로구","중구","성동구","광진구","노원구"];
const SPECIALTIES = ["아파트 전체","아파트 부분","원룸/오피스텔","카페/식당","오피스","상가","욕실","주방","바닥/도배","조명/전기"];

function CompanyOnboarding({ phone, onDone }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name:"", bizName:"", bizNumber:"", bizVerified:false,
    mainRegion:"", subRegions:[],
    specialties:[], portfolioDesc:"",
    hasBizDoc:false, hasInsurance:false,
    bizDocFile:null, insuranceFile:null,
    badge:"standard",
    agreeTerms:false, agreeEscrow:false, agreeAs:false, agreeDeposit:false,
  });
  const [submitted, setSubmitted] = useState(null);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const toggleArr = (k,v) => setForm(f => ({
    ...f, [k]: f[k].includes(v) ? f[k].filter(x=>x!==v) : [...f[k],v]
  }));
  const iS = { width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box",
    marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface };

  const STEPS = ["기본정보","활동지역","전문분야","서류제출","계약동의"];

  const BADGE_INFO = {
    basic:      { icon:"🥉", label:"베이직",       range:"~500만원",   dep20:100, dep30:150 },
    standard:   { icon:"🥈", label:"스탠다드",     range:"~2,000만원", dep20:400, dep30:600 },
    premium:    { icon:"🥇", label:"프리미엄",     range:"~5,000만원", dep20:1000, dep30:1500 },
    enterprise: { icon:"💎", label:"엔터프라이즈", range:"~1억원",     dep20:2000, dep30:3000 },
  };
  const badge = BADGE_INFO[form.badge] || BADGE_INFO.standard;
  const depositAmt = form.hasInsurance ? badge.dep20 : badge.dep30;

  /* ── 보증금 결제 화면 */
  if(submitted === "payment") return (
    <div style={{ width:"100%", maxWidth:390 }}>
      <div style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:4 }}>보증금 결제</div>
      <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
        공간보증 배지 활성화를 위한 보증금을 납부해주세요
      </div>

      {/* 배지 + 금액 요약 */}
      <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
        marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
        <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.lg }}>
          <div style={{ width:52, height:52, borderRadius:R.lg, background:C.brandL,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>
            {badge.icon}
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{badge.label} 배지</div>
            <div style={{ fontSize:12, color:C.text3 }}>공사 규모 {badge.range}</div>
          </div>
        </div>
        <Divider />
        <div style={{ marginTop:S.md }}>
          {[
            ["보증금 비율", form.hasInsurance?"20% (보험 할인)":"30%"],
            ["납부 금액", `${depositAmt.toLocaleString()}만원`],
            ["환급 조건", "탈퇴 시 30일 내 전액 환급"],
            ["먹튀 발생 시", "고객 즉시 배상 후 법적 대응"],
          ].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between",
              padding:`${S.sm}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize:13, color:C.text3 }}>{k}</span>
              <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 결제 수단 */}
      <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
        marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
        <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.md }}>결제 수단</div>
        {[["💳","신용/체크카드"],["📱","카카오페이"],["🏦","계좌이체"]].map(([icon,label]) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:S.md,
            padding:`${S.md}px 0`, borderBottom:`1px solid ${C.bgWarm}`, cursor:"pointer" }}>
            <span style={{ fontSize:20 }}>{icon}</span>
            <span style={{ fontSize:14, fontWeight:600, color:C.text1 }}>{label}</span>
            <span style={{ marginLeft:"auto", color:C.text4 }}>›</span>
          </div>
        ))}
      </div>

      <div style={{ background:C.navyL, borderRadius:R.lg, padding:S.md,
        marginBottom:S.xl, fontSize:12, color:C.navy, lineHeight:1.7,
        display:"flex", gap:S.sm }}>
        <span>🛡</span>
        <span>보증금은 공간마켓 신탁 계좌에 안전하게 보관되며 업무에 사용되지 않습니다</span>
      </div>

      <button onClick={() => setSubmitted("done")}
        style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff",
          border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer",
          boxShadow:`0 6px 20px ${C.brand}44` }}>
        💳 {depositAmt.toLocaleString()}만원 보증금 납부하기
      </button>
    </div>
  );

  /* ── 최종 완료 화면 */
  if(submitted === "done") return (
    <div style={{ width:"100%", maxWidth:390, textAlign:"center", padding:"40px 0" }}>
      <div style={{ fontSize:64, marginBottom:16 }}>🎉</div>
      <div style={{ fontSize:22, fontWeight:900, color:C.text1, marginBottom:8 }}>신청 완료!</div>
      <div style={{ fontSize:14, color:C.text3, lineHeight:1.8, marginBottom:S.xxl }}>
        보증금 납부 완료.<br/>서류 검토 후 1~2일 내<br/>🛡 공간마켓 인증 배지가 부여됩니다
      </div>
      <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
        marginBottom:S.lg, border:`1px solid ${C.bgWarm}`, textAlign:"left" }}>
        {[["배지 등급", `${badge.icon} ${badge.label}`],
          ["공사 규모", badge.range],
          ["보증금 납부", `${depositAmt.toLocaleString()}만원 ✅`],
          ["보험 가입", form.hasInsurance?"✅ 가입":"미가입"],
          ["심사 기간","1~2일"]].map(([k,v]) => (
          <div key={k} style={{ display:"flex", justifyContent:"space-between",
            padding:`${S.sm}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
            <span style={{ fontSize:13, color:C.text3 }}>{k}</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ background:C.navyL, borderRadius:R.xl, padding:S.xl,
        marginBottom:S.xxl, border:`1px solid ${C.trustM}` }}>
        <div style={{ fontSize:13, color:C.navy, fontWeight:700, lineHeight:1.8 }}>
          승인 후 받는 혜택<br/>
          ✅ {badge.icon} {badge.label} 배지 부여<br/>
          ✅ 에스크로 안전 정산 적용<br/>
          ✅ 상단 노출 우선순위<br/>
          ✅ 착공 확인 즉시 선금 30% 지급
        </div>
      </div>
      <button onClick={() => onDone({ name:form.name, role:"company", region:form.mainRegion, phone })}
        style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff",
          border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer",
          boxShadow:`0 6px 20px ${C.brand}44` }}>
        공간마켓 시작하기 🚀
      </button>
    </div>
  );

  return (
    <div style={{ width:"100%", maxWidth:390 }}>
      {/* 진행 바 */}
      <div style={{ display:"flex", gap:4, marginBottom:S.xxl }}>
        {STEPS.map((s,i) => (
          <div key={s} style={{ flex:1 }}>
            <div style={{ height:4, borderRadius:R.full,
              background: step>i+1?C.green : step===i+1?C.brand : C.bgWarm,
              transition:"background 0.3s" }} />
            <div style={{ fontSize:9, color:step===i+1?C.brand:C.text4,
              fontWeight:step===i+1?800:500, marginTop:3, textAlign:"center" }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Step 1 — 기본정보 */}
      {step===1 && <>
        <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>업체 기본 정보</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>대표자 정보를 입력해주세요</div>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>대표자명</div>
        <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="홍길동" style={iS} />
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>업체명</div>
        <input value={form.bizName} onChange={e=>set("bizName",e.target.value)} placeholder="예: 홍익시공" style={iS} />
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>사업자등록번호</div>
        <div style={{ display:"flex", gap:8, marginBottom:S.xl }}>
          <input value={form.bizNumber}
            onChange={e => { const n=e.target.value.replace(/\D/g,""); const f=n.length<=3?n:n.length<=5?`${n.slice(0,3)}-${n.slice(3)}`:`${n.slice(0,3)}-${n.slice(3,5)}-${n.slice(5,10)}`; set("bizNumber",f); set("bizVerified",false); }}
            placeholder="000-00-00000" maxLength={12} style={{ ...iS, flex:1, marginBottom:0 }} />
          <button onClick={() => { if(form.bizNumber.replace(/-/g,"").length===10) set("bizVerified",true); }}
            style={{ padding:"14px", borderRadius:R.md, border:"none",
              background:form.bizVerified?C.greenL:C.brand,
              color:form.bizVerified?C.green:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>
            {form.bizVerified?"✓ 인증":"사업자 확인"}
          </button>
        </div>
        <button onClick={() => form.name&&form.bizName&&form.bizVerified&&setStep(2)}
          style={{ width:"100%", padding:S.xl,
            background:form.name&&form.bizName&&form.bizVerified?C.brand:"#E8E4DC",
            color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>
          다음 →
        </button>
      </>}

      {/* Step 2 — 활동지역 */}
      {step===2 && <>
        <button onClick={() => setStep(1)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:20, fontWeight:600 }}>← 뒤로</button>
        <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>활동 지역 설정</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>주활동 구역과 이동 가능 지역을 선택해주세요</div>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>주활동 구 (1개)</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.xl }}>
          {ALL_REGIONS.map(r => (
            <button key={r} onClick={() => set("mainRegion",r)}
              style={{ padding:"8px 14px", borderRadius:R.full, fontSize:13, fontWeight:600,
                border:`1.5px solid ${form.mainRegion===r?C.brand:C.bgWarm}`,
                background:form.mainRegion===r?C.brandL:C.surface,
                color:form.mainRegion===r?C.brand:C.text2, cursor:"pointer" }}>{r}</button>
          ))}
        </div>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>
          이동 가능 구 (복수 선택)
          <span style={{ fontSize:11, color:C.text3, fontWeight:500, marginLeft:6 }}>선택 안 해도 됩니다</span>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.xl }}>
          {ALL_REGIONS.filter(r=>r!==form.mainRegion).map(r => (
            <button key={r} onClick={() => toggleArr("subRegions",r)}
              style={{ padding:"8px 14px", borderRadius:R.full, fontSize:13, fontWeight:600,
                border:`1.5px solid ${form.subRegions.includes(r)?C.brand:C.bgWarm}`,
                background:form.subRegions.includes(r)?C.brandL:C.surface,
                color:form.subRegions.includes(r)?C.brand:C.text2, cursor:"pointer" }}>{r}</button>
          ))}
        </div>
        <button onClick={() => form.mainRegion&&setStep(3)}
          style={{ width:"100%", padding:S.xl, background:form.mainRegion?C.brand:"#E8E4DC",
            color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>
          다음 →
        </button>
      </>}

      {/* Step 3 — 전문분야 */}
      {step===3 && <>
        <button onClick={() => setStep(2)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:20, fontWeight:600 }}>← 뒤로</button>
        <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>전문 분야</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>주력 시공 분야를 선택해주세요 (복수 선택)</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.xl }}>
          {SPECIALTIES.map(s => (
            <button key={s} onClick={() => toggleArr("specialties",s)}
              style={{ padding:"10px 16px", borderRadius:R.full, fontSize:14, fontWeight:600,
                border:`1.5px solid ${form.specialties.includes(s)?C.brand:C.bgWarm}`,
                background:form.specialties.includes(s)?C.brandL:C.surface,
                color:form.specialties.includes(s)?C.brand:C.text2, cursor:"pointer" }}>{s}</button>
          ))}
        </div>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>업체 소개 (선택)</div>
        <textarea value={form.portfolioDesc} onChange={e=>set("portfolioDesc",e.target.value)}
          placeholder="예: 12년 경력, 아파트 전체 리모델링 전문. 에스크로 정산 156건 완료."
          rows={4} style={{ ...iS, resize:"none", lineHeight:1.7, marginBottom:S.xl }} />
        <button onClick={() => form.specialties.length>0&&setStep(4)}
          style={{ width:"100%", padding:S.xl, background:form.specialties.length>0?C.brand:"#E8E4DC",
            color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>
          다음 →
        </button>
      </>}

      {/* Step 4 — 서류제출 */}
      {step===4 && <>
        <button onClick={() => setStep(3)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:20, fontWeight:600 }}>← 뒤로</button>
        <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>서류 제출</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>인증 심사에 필요한 서류를 업로드해주세요</div>

        {/* 사업자등록증 */}
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.md, border:`1.5px solid ${form.hasBizDoc?C.green:C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom: form.hasBizDoc?0:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg,
              background:form.hasBizDoc?C.greenL:C.surface2,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📋</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>사업자등록증</div>
              <div style={{ fontSize:12, color:C.text3 }}>
                {form.bizDocFile ? `✅ ${form.bizDocFile}` : "필수 · 파일명 입력"}
              </div>
            </div>
            {form.hasBizDoc && (
              <span style={{ fontSize:18, color:C.green }}>✓</span>
            )}
          </div>
          {!form.hasBizDoc && (
            <div style={{ display:"flex", gap:8 }}>
              <input placeholder="예: 사업자등록증.pdf"
                onKeyDown={e => { if(e.key==="Enter"&&e.target.value) { set("bizDocFile",e.target.value); set("hasBizDoc",true); }}}
                style={{ flex:1, padding:"10px 14px", border:`1.5px solid ${C.bgWarm}`,
                  borderRadius:R.md, fontSize:13, outline:"none", fontFamily:"inherit", color:C.text1 }} />
              <button onMouseDown={e => { const inp = e.target.previousSibling; if(inp&&inp.value){ set("bizDocFile",inp.value); set("hasBizDoc",true); }}}
                style={{ padding:"10px 16px", background:C.brand, color:"#fff",
                  border:"none", borderRadius:R.md, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                확인
              </button>
            </div>
          )}
        </div>

        {/* 시공보험 */}
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.md, border:`1.5px solid ${form.hasInsurance?C.green:C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg,
              background:form.hasInsurance?C.greenL:C.surface2,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔒</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>시공보험 증서</div>
              <div style={{ fontSize:12, color:C.text3 }}>
                {form.insuranceFile ? `✅ ${form.insuranceFile}` : "선택 · 보증금 10% 절감"}
              </div>
            </div>
            {form.hasInsurance && <span style={{ fontSize:18, color:C.green }}>✓</span>}
          </div>
          {!form.hasInsurance && (
            <div style={{ display:"flex", gap:8, marginBottom:S.md }}>
              <input placeholder="예: 시공보험증서.pdf"
                onKeyDown={e => { if(e.key==="Enter"&&e.target.value){ set("insuranceFile",e.target.value); set("hasInsurance",true); }}}
                style={{ flex:1, padding:"10px 14px", border:`1.5px solid ${C.bgWarm}`,
                  borderRadius:R.md, fontSize:13, outline:"none", fontFamily:"inherit", color:C.text1 }} />
              <button onMouseDown={e => { const inp = e.target.previousSibling; if(inp&&inp.value){ set("insuranceFile",inp.value); set("hasInsurance",true); }}}
                style={{ padding:"10px 16px", background:C.brand, color:"#fff",
                  border:"none", borderRadius:R.md, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                확인
              </button>
            </div>
          )}
          {/* 보증금 비교 */}
          <div style={{ background:form.hasInsurance?C.greenL:C.brandL, borderRadius:R.lg,
            padding:S.md, border:`1px solid ${form.hasInsurance?C.green+"44":C.brandM}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:12, color:C.text3 }}>보험 미가입 시 보증금</span>
              <span style={{ fontSize:12, fontWeight:700,
                color:form.hasInsurance?C.text4:C.red,
                textDecoration:form.hasInsurance?"line-through":"none" }}>공사금액의 30%</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:C.text3 }}>보험 가입 시 보증금</span>
              <span style={{ fontSize:12, fontWeight:800,
                color:form.hasInsurance?C.green:C.text3 }}>공사금액의 20% ✓</span>
            </div>
          </div>
        </div>

        <div style={{ background:C.navyL, borderRadius:R.lg, padding:S.lg,
          border:`1px solid ${C.trustM}`, marginBottom:S.xl, fontSize:13, color:C.navy, lineHeight:1.7 }}>
          🛡 제출 서류는 인증 목적으로만 사용되며<br/>공간마켓 보안 서버에 안전하게 보관됩니다
        </div>

        <button onClick={() => form.hasBizDoc&&setStep(5)}
          style={{ width:"100%", padding:S.xl, background:form.hasBizDoc?C.brand:"#E8E4DC",
            color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>
          다음 →
        </button>
      </>}

      {/* Step 5 — 배지 등급 선택 + 계약동의 */}
      {step===5 && <>
        <button onClick={() => setStep(4)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:20, fontWeight:600 }}>← 뒤로</button>
        <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>공간보증 배지 선택</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
          수주할 공사 규모에 맞게 선택해주세요
        </div>

        {/* 배지 등급 선택 */}
        {[
          { key:"basic",      icon:"🥉", label:"베이직",       range:"~500만원",   dep20:100, dep30:150 },
          { key:"standard",   icon:"🥈", label:"스탠다드",     range:"~2,000만원", dep20:400, dep30:600 },
          { key:"premium",    icon:"🥇", label:"프리미엄",     range:"~5,000만원", dep20:1000, dep30:1500 },
          { key:"enterprise", icon:"💎", label:"엔터프라이즈", range:"~1억원",     dep20:2000, dep30:3000 },
        ].map(b => {
          const dep = form.hasInsurance ? b.dep20 : b.dep30;
          const selected = form.badge === b.key;
          return (
            <div key={b.key} onClick={() => set("badge", b.key)}
              style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm,
                border:`1.5px solid ${selected?C.brand:C.bgWarm}`, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:S.md, alignItems:"center" }}>
                  <div style={{ width:40, height:40, borderRadius:R.lg,
                    background:selected?C.brandL:C.surface2,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{b.icon}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>{b.label}</div>
                    <div style={{ fontSize:12, color:C.text3 }}>공사 규모 {b.range}</div>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:15, fontWeight:900, color:selected?C.brand:C.text1 }}>
                    {dep.toLocaleString()}만원
                  </div>
                  <div style={{ fontSize:10, color:C.text3 }}>
                    보증금 {form.hasInsurance?"20%":"30%"}
                  </div>
                </div>
              </div>
              {selected && form.hasInsurance && (
                <div style={{ marginTop:S.sm, background:C.greenL, borderRadius:R.sm,
                  padding:"4px 10px", fontSize:11, color:C.green, fontWeight:700 }}>
                  🔒 보험 가입 할인 적용 · {(b.dep30-b.dep20).toLocaleString()}만원 절감
                </div>
              )}
            </div>
          );
        })}

        <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.md,
          marginBottom:S.xl, marginTop:S.md }}>
          <div style={{ fontSize:12, color:C.text3, lineHeight:1.8 }}>
            • 배지 없이도 2,000만원 이하 직거래 가능<br/>
            • 보증금은 탈퇴 시 30일 내 환급<br/>
            • 먹튀 발생 시 보증금으로 고객 즉시 배상
          </div>
        </div>

        {/* 계약 동의 */}
        <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.md }}>계약 동의</div>
        {[
          { key:"agreeTerms",  title:"이용약관 동의", sub:"업체 파트너 이용약관 (필수)" },
          { key:"agreeEscrow", title:"에스크로 정산 동의", sub:"단계별 안전 정산 방식 동의 (필수)" },
          { key:"agreeAs",     title:"하자보수 AS 의무 동의", sub:"완료 후 1년간 무상 AS 제공 (필수)" },
          { key:"agreeDeposit",title:"보증금 납부 동의", sub:`선택 배지 보증금 납부 및 환급 조건 동의 (필수)` },
        ].map(item => (
          <div key={item.key} onClick={() => set(item.key, !form[item.key])}
            style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm,
              border:`1.5px solid ${form[item.key]?C.brand:C.bgWarm}`, cursor:"pointer",
              display:"flex", gap:S.md, alignItems:"flex-start" }}>
            <div style={{ width:24, height:24, borderRadius:6, flexShrink:0, marginTop:1,
              background:form[item.key]?C.brand:C.surface,
              border:`2px solid ${form[item.key]?C.brand:C.bgWarm}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#fff", fontSize:14, fontWeight:900 }}>
              {form[item.key]?"✓":""}
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:C.text1 }}>{item.title}</div>
              <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>{item.sub}</div>
            </div>
          </div>
        ))}

        <button
          onClick={() => { if(form.agreeTerms&&form.agreeEscrow&&form.agreeAs&&form.agreeDeposit) setSubmitted("payment"); }}
          style={{ width:"100%", padding:S.xl, marginTop:S.md,
            background:form.agreeTerms&&form.agreeEscrow&&form.agreeAs&&form.agreeDeposit?C.brand:"#E8E4DC",
            color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer",
            boxShadow:form.agreeTerms&&form.agreeEscrow&&form.agreeAs&&form.agreeDeposit?`0 6px 20px ${C.brand}44`:"none" }}>
          🚀 업체 파트너 신청 완료
        </button>
      </>}
    </div>
  );
}
function LoginScreen({ onLogin, startAtOnboarding }) {
  const [step, setStep] = useState(startAtOnboarding ? 3 : 1);
  const [role, setRole] = useState(startAtOnboarding ? "company" : null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ name:"", region:"마포구", bizNumber:"", bizName:"", bizVerified:false });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const iS = { width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box",
    marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface };

  const sendCode = () => {
    if(phone.replace(/-/g,"").length<10) return setMsg("올바른 전화번호를 입력해주세요");
    setLoading(true);
    setTimeout(() => { setCodeSent(true); setMsg("✅ 인증번호 발송! (데모: 000000)"); setLoading(false); }, 800);
  };
  const verifyCode = () => {
    if(code.length<4) return setMsg("인증번호를 입력해주세요");
    setLoading(true);
    setTimeout(() => { setStep(4); setMsg(""); setLoading(false); }, 600);
  };
  const verifyBiz = () => {
    if(form.bizNumber.replace(/-/g,"").length!==10) return setMsg("사업자번호 10자리 입력");
    setLoading(true);
    setTimeout(() => { set("bizVerified",true); setMsg("✅ 사업자 인증 완료!"); setLoading(false); }, 800);
  };
  const save = () => {
    if(!form.name) return setMsg("이름을 입력해주세요");
    if(role==="company"&&!form.bizVerified) return setMsg("사업자번호 인증이 필요합니다");
    onLogin({ name:form.name, role, region:form.region, phone });
  };

  return (
    <div style={{ minHeight:"100vh",
      background: step===1 ? C.bg : C.bg,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"24px 20px", fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>

      {/* Step 1 — 온보딩: 웜베이지 배경에 오렌지 포인트 */}
      {step===1 && (
        <div style={{ width:"100%", maxWidth:390 }}>
          {/* 로고 — 오렌지 중심 */}
          <div style={{ textAlign:"center", marginBottom:36 }}>
            <div style={{ width:68, height:68, borderRadius:R.xl, margin:"0 auto 14px",
              background:`linear-gradient(135deg,${C.brand},${C.brandD})`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:32,
              boxShadow:`0 8px 24px ${C.brand}44` }}>🏠</div>
            <div style={{ fontSize:28, fontWeight:900, color:C.text1, letterSpacing:"-0.5px" }}>공간마켓</div>
            <div style={{ fontSize:14, color:C.text3, marginTop:6 }}>
              우리 동네 믿을 수 있는 시공 업체
            </div>
          </div>

          {/* 간단한 특징 3가지 — 가볍게 */}
          <div style={{ display:"flex", gap:S.sm, marginBottom:S.xxl }}>
            {[["🔍","간편 견적"],["🏆","검증 업체"],["🛡","안전 정산"]].map(([icon,label]) => (
              <div key={label} style={{ flex:1, background:C.surface, borderRadius:R.lg,
                padding:`${S.lg}px ${S.sm}px`, textAlign:"center",
                border:`1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize:22, marginBottom:5 }}>{icon}</div>
                <div style={{ fontSize:12, color:C.text2, fontWeight:700 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button onClick={() => { setRole("consumer"); setStep(2); }}
              style={{ background:C.surface, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.xl,
                padding:"18px 20px", display:"flex", alignItems:"center", gap:14,
                cursor:"pointer", boxShadow:"0 2px 12px rgba(28,23,18,0.08)", textAlign:"left" }}>
              <div style={{ width:48, height:48, borderRadius:R.lg, flexShrink:0,
                background:C.brandL, border:`1.5px solid ${C.brandM}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🏡</div>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:2 }}>견적 받기</div>
                <div style={{ fontSize:13, color:C.text3 }}>시공 업체 찾고 있어요</div>
              </div>
              <div style={{ marginLeft:"auto", color:C.brand, fontSize:20 }}>›</div>
            </button>

            {/* 업체 — 둘러보기 먼저 */}
            <button onClick={() => onLogin({ name:"둘러보기", role:"company", region:"마포구", phone:"", isGuest:true })}
              style={{ background:C.surface, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.xl,
                padding:"18px 20px", display:"flex", alignItems:"center", gap:14,
                cursor:"pointer", boxShadow:"0 2px 12px rgba(28,23,18,0.08)", textAlign:"left" }}>
              <div style={{ width:48, height:48, borderRadius:R.lg, flexShrink:0,
                background:C.surface2, border:`1.5px solid ${C.bgWarm}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🔨</div>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:2 }}>업체로 둘러보기</div>
                <div style={{ fontSize:13, color:C.text3 }}>일감 먼저 확인해보세요</div>
              </div>
              <div style={{ marginLeft:"auto", color:C.brand, fontSize:20 }}>›</div>
            </button>
          </div>
        </div>
      )}

      {step===2 && (
        <div style={{ width:"100%", maxWidth:390 }}>
          <button onClick={() => setStep(1)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:24, fontWeight:600 }}>← 뒤로</button>
          <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>{role==="consumer"?"견적 의뢰인":"업체"} 로그인</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xxl }}>원하는 방식으로 시작하세요</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button onClick={() => setStep(3)} style={{ background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, padding:"16px 20px", fontWeight:800, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}>
              <span style={{ fontSize:22 }}>📱</span>
              <div style={{ textAlign:"left" }}>
                <div>전화번호로 시작</div>
                <div style={{ fontSize:12, opacity:0.8, fontWeight:500, marginTop:1 }}>문자 인증 · 가장 빠른 방법</div>
              </div>
            </button>
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0" }}>
              <div style={{ flex:1, height:1, background:C.bgWarm }} />
              <div style={{ fontSize:12, color:C.text4 }}>소셜 계정</div>
              <div style={{ flex:1, height:1, background:C.bgWarm }} />
            </div>
            {[{ bg:"#FEE500",color:"#191919",icon:"💬",t:"카카오로 시작하기" },
              { bg:"#03C75A",color:"#fff",   icon:"N", t:"네이버로 시작하기" }].map(b => (
              <button key={b.t} onClick={() => setStep(3)} style={{ background:b.bg, color:b.color, border:"none", borderRadius:R.lg, padding:"15px 20px", fontWeight:800, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}>
                <span style={{ fontSize:b.icon==="N"?15:22, background:b.icon==="N"?b.color:"transparent", color:b.icon==="N"?b.bg:"inherit", borderRadius:4, padding:b.icon==="N"?"1px 5px":"0", fontWeight:900 }}>{b.icon}</span>
                {b.t}
              </button>
            ))}
          </div>
        </div>
      )}

      {step===3 && (
        <div style={{ width:"100%", maxWidth:390 }}>
          <button onClick={() => { setStep(2); setCodeSent(false); setCode(""); setMsg(""); }} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:24, fontWeight:600 }}>← 뒤로</button>
          <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>전화번호 인증</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xxl }}>가입된 계정이 없으면 자동으로 가입됩니다</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>전화번호</div>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <input value={phone} onChange={e => setPhone(fmtPhone(e.target.value))} placeholder="010-0000-0000" maxLength={13} style={{ ...iS, flex:1, marginBottom:0 }} />
            <button onClick={sendCode} disabled={loading} style={{ padding:"14px 16px", background:C.brand, color:"#fff", border:"none", borderRadius:R.md, fontWeight:800, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>{codeSent?"재발송":"인증받기"}</button>
          </div>
          {codeSent && <>
            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>인증번호</div>
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000" maxLength={6} style={{ ...iS, flex:1, marginBottom:0, letterSpacing:8, fontSize:22, fontWeight:800, textAlign:"center" }} />
              <button onClick={verifyCode} disabled={loading} style={{ padding:"14px 16px", background:C.brand, color:"#fff", border:"none", borderRadius:R.md, fontWeight:800, fontSize:13, cursor:"pointer" }}>확인</button>
            </div>
          </>}
          {msg && <div style={{ padding:"12px 16px", borderRadius:R.md, marginBottom:14, background:msg.startsWith("✅")?"#E6F7F0":"#FFF0F0", color:msg.startsWith("✅")?C.green:C.red, fontSize:13, fontWeight:600 }}>{msg}</div>}
          {!codeSent && <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, fontSize:13, color:C.text2, lineHeight:1.8 }}>
            📱 입력한 번호로 인증문자가 발송됩니다<br/>🔒 번호는 인증 외 목적으로 사용되지 않습니다
          </div>}
        </div>
      )}

      {step===4 && role==="company" && (
        <CompanyOnboarding phone={phone} onDone={u => onLogin(u)} />
      )}

      {step===4 && role==="consumer" && (
        <div style={{ width:"100%", maxWidth:390 }}>
          <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>👋 반갑습니다!</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xxl }}>기본 정보만 입력해주세요</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>이름</div>
          <input value={form.name} onChange={e => set("name",e.target.value)} placeholder="홍길동" style={iS} />
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>활동 지역</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.xl }}>
            {REGIONS.map(r => (
              <button key={r} onClick={() => set("region",r)} style={{ padding:"8px 16px", borderRadius:R.full, fontSize:14, fontWeight:600, border:`1.5px solid ${form.region===r?C.brand:C.bgWarm}`, background:form.region===r?C.brandL:C.surface, color:form.region===r?C.brand:C.text2, cursor:"pointer" }}>{r}</button>
            ))}
          </div>
          {msg && <div style={{ padding:"12px 16px", borderRadius:R.md, marginBottom:14, background:msg.startsWith("✅")?"#E6F7F0":"#FFF0F0", color:msg.startsWith("✅")?C.green:C.red, fontSize:13, fontWeight:600 }}>{msg}</div>}
          <button onClick={save} style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand}44` }}>공간마켓 시작하기 🚀</button>
        </div>
      )}
    </div>
  );
}

const ESCROW_STEPS = [
  { id:1, label:"전액 예치",    sub:"고객이 총 금액을 공간마켓에 예치",      pct:0,  icon:"🔒", done:true  },
  { id:2, label:"선금 지급",    sub:"착공 시작 · 공간마켓→업체 30% 지급",   pct:30, icon:"💰", done:true  },
  { id:3, label:"중간 점검",    sub:"50% 공정 확인 후 업체에 40% 지급",     pct:40, icon:"🔍", done:false, active:true },
  { id:4, label:"완료 확인",    sub:"시공 완료 확인 후 업체에 잔금 30% 지급", pct:30, icon:"✅", done:false },
];

function EscrowScreen({ onBack, mode }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const total = 2650;
  const isConsumer = mode === "consumer";

  const paid = ESCROW_STEPS.filter(s=>s.done).reduce((a,s)=>a+s.pct,0);
  const progress = paid;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      {/* 헤더 */}
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>에스크로 안전 정산</div>
          <div style={{ fontSize:12, color:C.text3 }}>홍익시공 · 마포구 32평</div>
        </div>
        <div style={{ marginLeft:"auto", background:C.navyL, borderRadius:R.full, padding:"4px 12px", fontSize:12, fontWeight:700, color:C.navy }}>🛡 보호중</div>
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>

        {/* 역할 안내 배너 */}
        <div style={{ background: isConsumer ? C.brandL : C.surface2,
          border: `1px solid ${isConsumer ? C.brandM : C.bgWarm}`,
          borderRadius:R.lg, padding:`${S.sm}px ${S.lg}px`,
          marginBottom:S.lg, display:"flex", alignItems:"center", gap:S.sm }}>
          <span style={{ fontSize:16 }}>{isConsumer ? "👤" : "🏗"}</span>
          <span style={{ fontSize:13, fontWeight:700, color: isConsumer ? C.brand : C.text2 }}>
            {isConsumer
              ? "고객님이 각 단계를 승인하면 업체에 지급됩니다"
              : "고객 승인 후 단계별로 입금됩니다 (조회 전용)"}
          </span>
        </div>

        {/* 총 금액 카드 */}
        <div style={{ background:`linear-gradient(135deg,${C.navy},${C.navyM})`,
          borderRadius:R.xl, padding:S.xxl, marginBottom:S.xl, color:"#fff" }}>
          <div style={{ fontSize:12, opacity:0.7, marginBottom:6 }}>총 계약 금액 (공간마켓 보관중)</div>
          <div style={{ fontSize:32, fontWeight:900, marginBottom:4 }}>{total.toLocaleString()}만원</div>
          <div style={{ fontSize:13, opacity:0.75, marginBottom:S.xl }}>고객 예치 완료 · 단계별로 업체에 지급됩니다</div>
          <div style={{ background:"rgba(255,255,255,0.15)", borderRadius:R.full, height:8, marginBottom:6 }}>
            <div style={{ width:`${progress}%`, height:"100%", background:C.brand,
              borderRadius:R.full, transition:"width 0.6s ease",
              boxShadow:`0 0 8px ${C.brand}88` }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, opacity:0.7 }}>
            <span>업체 지급 완료 {progress}%</span>
            <span>보관 중 {Math.round(total*(100-progress)/100).toLocaleString()}만원</span>
          </div>
        </div>

        {/* 단계별 타임라인 */}
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.xl }}>정산 단계</div>
          {ESCROW_STEPS.map((s, i) => (
            <div key={s.id} style={{ display:"flex", gap:S.md, marginBottom: i<ESCROW_STEPS.length-1?S.xl:0 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                <div style={{ width:40, height:40, borderRadius:R.full,
                  background: s.done ? C.green : s.active ? C.brand : C.bgWarm,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
                  boxShadow: s.active ? `0 0 0 4px ${C.brand}33` : "none",
                  border: s.active ? `2px solid ${C.brand}` : "none" }}>
                  {s.done ? "✓" : s.icon}
                </div>
                {i < ESCROW_STEPS.length-1 && (
                  <div style={{ width:2, flex:1, minHeight:20, marginTop:4,
                    background: s.done ? C.green : C.bgWarm }} />
                )}
              </div>
              <div style={{ flex:1, paddingTop:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <div style={{ fontSize:14, fontWeight:800,
                    color: s.done ? C.green : s.active ? C.brand : C.text3 }}>{s.label}</div>
                  {s.pct > 0 && (
                    <div style={{ fontSize:13, fontWeight:700,
                      color: s.done ? C.green : s.active ? C.brand : C.text4 }}>
                      {Math.round(total*s.pct/100).toLocaleString()}만원
                      {/* 업체 입장: 지급 상태 표시 */}
                      {!isConsumer && (
                        <span style={{ fontSize:11, marginLeft:4,
                          color: s.done ? C.green : s.active ? C.brand : C.text4 }}>
                          {s.done ? " ✓입금" : s.active ? " ⏳대기" : " 미지급"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontSize:12, color:C.text3, lineHeight:1.5, marginBottom: s.active?S.md:0 }}>{s.sub}</div>

                {/* ── 고객용: 승인 버튼 */}
                {s.active && isConsumer && !confirmed && (
                  <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, border:`1px solid ${C.brandM}` }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.brand, marginBottom:S.sm }}>
                      📸 중간 점검 사진을 확인하고 승인해주세요
                    </div>
                    <div style={{ display:"flex", gap:S.sm, marginBottom:S.md }}>
                      {[PHOTOS.apt_after1, PHOTOS.apt_after2].map((p,pi) => (
                        <div key={pi} style={{ flex:1, height:80, borderRadius:R.md, overflow:"hidden",
                          border:`1px solid ${C.brandM}` }}>
                          <img src={p} style={{ width:"100%", height:"100%", objectFit:"cover" }}
                            onError={e=>e.target.style.background=C.bgWarm} />
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:11, color:C.text3, marginBottom:S.sm }}>
                      ⏰ 72시간 내 미확인 시 자동 승인됩니다
                    </div>
                    <div style={{ display:"flex", gap:S.sm }}>
                      <button style={{ flex:1, padding:"10px", background:C.surface,
                        color:C.red, border:`1px solid ${C.red}33`, borderRadius:R.lg,
                        fontWeight:700, fontSize:13, cursor:"pointer" }}>
                        ⚠️ 이의 신청
                      </button>
                      <button onClick={() => setShowConfirm(true)}
                        style={{ flex:2, padding:"10px", background:C.brand, color:"#fff",
                          border:"none", borderRadius:R.lg, fontWeight:800, fontSize:13, cursor:"pointer",
                          boxShadow:`0 4px 14px ${C.brand}44` }}>
                        ✅ 확인 · 중도금 승인
                      </button>
                    </div>
                  </div>
                )}

                {/* ── 업체용: 사진 업로드 */}
                {s.active && !isConsumer && !confirmed && (
                  <div style={{
                    background:C.surface2,
                    borderRadius:R.lg,
                    padding:S.lg,
                    border:`1px solid ${C.bgWarm}`
                  }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:S.sm }}>
                      📸 중간 점검 사진 업로드
                    </div>
                    <div style={{ fontSize:12, color:C.text3, lineHeight:1.6, marginBottom:S.md }}>
                      고객이 사진을 확인하면 중도금 40% 지급 승인이 진행됩니다.
                    </div>
                    <button style={{ width:'100%', padding:'12px', background:C.brand, color:'#fff', border:'none', borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:'pointer' }}>
                      사진 업로드하기
                    </button>
                  </div>
                )}

                {/* 승인 완료 */}
                {s.active && confirmed && (
                  <div style={{ background:C.greenL, borderRadius:R.lg, padding:S.md, display:'flex', alignItems:'center', gap:S.sm }}>
                    <span style={{ fontSize:16 }}>✅</span>
                    <span style={{ fontSize:13, color:C.green, fontWeight:700 }}>
                      {isConsumer ? '승인 완료 · 중도금 지급됨' : '중도금 입금 완료'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 하자보수 보증 */}
        <div style={{ background:C.navyL, borderRadius:R.xl, padding:S.xl, border:`1px solid ${C.trustM}`, display:'flex', gap:S.md, alignItems:'flex-start', marginBottom:S.lg }}>
          <div style={{ fontSize:24, flexShrink:0 }}>🛡</div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:C.navy, marginBottom:4 }}>하자보수 보증 안내</div>
            <div style={{ fontSize:12, color:C.text3, lineHeight:1.7 }}>완료 확인 후 <b style={{color:C.navy}}>1년간 무상 AS</b> 보장</div>
          </div>
        </div>

        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:S.md }}>🏦 예치금 보관 안내</div>
          {[['보관','공간마켓 법인 신탁 계좌'],['환급','탈퇴 7일 내 전액'],['분쟁','중재 후 판정 지급'],['향후','은행 신탁 연계 예정']].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize:12, color:C.text3 }}>{k}</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.text1 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 승인 모달 — 고객 전용 */}
      {showConfirm && isConsumer && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,23,18,0.6)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:300 }}>
          <div style={{ background:C.surface, borderRadius:'24px 24px 0 0', width:'100%', maxWidth:480, padding:'24px 24px 40px' }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:'0 auto 20px' }} />
            <div style={{ textAlign:'center', marginBottom:S.xxl }}>
              <div style={{ fontSize:44, marginBottom:10 }}>💸</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:6 }}>업체에게 중도금을 지급할까요?</div>
              <div style={{ fontSize:13, color:C.text3, lineHeight:1.6 }}>공간마켓이 보관 중인 금액에서<br/><b style={{color:C.text1}}>{Math.round(total*0.4).toLocaleString()}만원</b>을 업체에 지급합니다</div>
            </div>
            <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl }}>
              {[['선금 (30%)', Math.round(total*0.3).toLocaleString()+'만원', true],['중도금 (40%)', Math.round(total*0.4).toLocaleString()+'만원', false],['잔금 (30%)', Math.round(total*0.3).toLocaleString()+'만원', false]].map(([l,v,isPaid],i) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:`${S.sm}px 0`, borderBottom:i<2?`1px solid ${C.bgWarm}`:'none' }}>
                  <span style={{ fontSize:13, color:isPaid?C.text3:C.text2, fontWeight:600 }}>{l}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:isPaid?C.text4:C.text1, textDecoration:isPaid?'line-through':'none' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:S.sm }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:'pointer' }}>취소</button>
              <button onClick={() => { setShowConfirm(false); setConfirmed(true); }} style={{ flex:2, padding:S.xl, background:C.brand, color:'#fff', border:'none', borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:`0 4px 16px ${C.brand}44` }}>✅ 승인하고 지급</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function BidCard({ r }) {
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [bidForm, setBidForm] = useState({ price:"", period:"", material:"", comment:"" });
  const setBF = (k,v) => setBidForm(f=>({...f,[k]:v}));
  const iS = { width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box",
    marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface };

  return (
    <div>
      <div style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
        marginBottom:S.md, border:`1px solid ${submitted?C.green:C.bgWarm}` }}>
        {submitted && <div style={{ height:3, background:C.green }} />}
        <div style={{ padding:S.xl }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:S.sm }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{r.type} · {r.size}</div>
            <div style={{ display:"flex", gap:6 }}>
              {r.urgent && <span style={{ background:"#FFF0F0", color:C.red, borderRadius:R.full, padding:"2px 8px", fontSize:11, fontWeight:700 }}>급구</span>}
              {submitted
                ? <span style={{ background:C.greenL, color:C.green, borderRadius:R.full, padding:"2px 10px", fontSize:11, fontWeight:700 }}>✓ 입찰완료</span>
                : <span style={{ fontSize:11, color:C.text3 }}>{r.time}</span>}
            </div>
          </div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:6 }}>📍 {r.area} · {r.distance||"인근"}</div>
          <div style={{ fontSize:13, color:C.text2, marginBottom:S.lg, lineHeight:1.5 }}>{r.desc}</div>
          {submitted ? (
            <div style={{ background:C.greenL, borderRadius:R.lg, padding:S.md,
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.green }}>입찰 금액: {bidForm.price}만원</div>
                <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>예상 {bidForm.period}일 · 의뢰인 확인 대기중</div>
              </div>
              <span style={{ fontSize:20 }}>✅</span>
            </div>
          ) : (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:12, color:C.text3 }}>💰 {r.budget}</div>
                <div style={{ fontSize:11, color:C.text4, marginTop:2 }}>경쟁 입찰 {r.bids}개</div>
              </div>
              <button onClick={() => setShowForm(true)}
                style={{ background:C.brand, color:"#fff", border:"none",
                  borderRadius:R.full, padding:"10px 20px", fontWeight:800, fontSize:13, cursor:"pointer",
                  boxShadow:`0 3px 12px ${C.brand}44` }}>
                견적 제출하기
              </button>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(28,23,18,0.6)",
          display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
            width:"100%", maxWidth:480, padding:"24px 24px 40px", maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 16px" }} />
            <div style={{ fontSize:17, fontWeight:800, color:C.text1, marginBottom:4 }}>견적 입찰 작성</div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>{r.type} · {r.size} · {r.area}</div>

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>견적 금액 (만원)</div>
            <input value={bidForm.price} onChange={e=>setBF("price",e.target.value)}
              placeholder="예: 2800" type="number" style={iS} />

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>예상 시공 기간 (일)</div>
            <input value={bidForm.period} onChange={e=>setBF("period",e.target.value)}
              placeholder="예: 30" type="number" style={iS} />

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>주요 자재 설명</div>
            <input value={bidForm.material} onChange={e=>setBF("material",e.target.value)}
              placeholder="예: LX하우시스 바닥재, 대림 욕실" style={iS} />

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>의뢰인에게 한마디</div>
            <textarea value={bidForm.comment} onChange={e=>setBF("comment",e.target.value)}
              placeholder="예: 12년 경력, 에스크로 156건 완료. 중간 점검 사진 매번 공유해드립니다."
              rows={3} style={{ ...iS, resize:"none", lineHeight:1.7 }} />

            <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.md,
              marginBottom:S.xl, display:"flex", gap:S.md, alignItems:"center" }}>
              <TempBadge temp={97} lg />
              <div style={{ fontSize:12, color:C.text2 }}>재계약률 68% · AS 98% · 완료 156건</div>
            </div>

            {/* 수수료 안내 — 업체용 */}
            <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.md,
              marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:12, color:C.text3, lineHeight:1.8 }}>
                💡 낙찰 시 플랫폼 수수료 안내<br/>
                • 직거래 낙찰 → 견적금액의 <b style={{color:C.text2}}>5%</b><br/>
                • 에스크로 낙찰 → 견적금액의 <b style={{color:C.text2}}>4%</b><br/>
                <span style={{color:C.text4}}>* 고객 부담 없음. 업체 수령액에서 자동 차감</span>
              </div>
            </div>

            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2,
                  border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                취소
              </button>
              <button onClick={() => { if(bidForm.price&&bidForm.period){ setShowForm(false); setSubmitted(true); }}}
                style={{ flex:2, padding:S.xl,
                  background:bidForm.price&&bidForm.period?C.brand:"#E8E4DC",
                  color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer",
                  boxShadow:bidForm.price&&bidForm.period?`0 4px 16px ${C.brand}44`:"none" }}>
                🚀 입찰 제출하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 의뢰인 입찰 현황 카드 */
const MOCK_BIDS = [
  { id:1, company:COMPANIES[0], price:2650, period:35, material:"LX하우시스 바닥재, 대림 욕실", comment:"에스크로 156건 완료. 중간 점검 사진 매번 공유드립니다.", selected:false },
  { id:2, company:COMPANIES[1], price:2480, period:30, material:"동화 바닥재, 아메리칸스탠다드 욕실", comment:"미니멀 감성 전문. 일정 준수 보장합니다.", selected:false },
  { id:3, company:COMPANIES[2], price:2200, period:40, material:"국산 중급 자재", comment:"합리적인 가격으로 최선을 다하겠습니다.", selected:false },
];

function BidStatusScreen({ onBack, onChat }) {
  const [bids] = useState(MOCK_BIDS);
  const [step, setStep] = useState('list');
  const [selBid, setSelBid] = useState(null);
  const H = ({ title, sub }) => (
    <div style={{ background:C.surface, padding:'14px 20px', borderBottom:`1px solid ${C.bgWarm}`, display:'flex', alignItems:'center', gap:S.md }}>
      <button onClick={() => step==='list'?onBack():setStep('list')} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:C.text1, padding:0 }}>←</button>
      <div><div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{title}</div>{sub&&<div style={{ fontSize:12, color:C.text3 }}>{sub}</div>}</div>
    </div>
  );
  if(step==='confirm'&&selBid) return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <H title='예약 확인' />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ display:'flex', gap:S.md, alignItems:'center', marginBottom:S.lg }}>
            <div style={{ width:48, height:48, borderRadius:R.lg, background:C.brandL, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, color:C.brand }}>{selBid.company.name[0]}</div>
            <div style={{ flex:1 }}><div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{selBid.company.name}</div><TempBadge temp={selBid.company.temp} /></div>
            <div style={{ textAlign:'right' }}><div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{selBid.price.toLocaleString()}만원</div><div style={{ fontSize:12, color:C.text3 }}>{selBid.period}일</div></div>
          </div>
          <div style={{ fontSize:13, color:C.text2 }}>{selBid.material}</div>
        </div>
        <div style={{ background:C.navyL, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`1px solid ${C.trustM}` }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.navy, marginBottom:S.md }}>🛡 에스크로 안전 정산</div>
          {[['착공 확인','선금 30%',Math.round(selBid.price*0.3)],['중간점검','중도금 40%',Math.round(selBid.price*0.4)],['완료 확인','잔금 30%',Math.round(selBid.price*0.3)]].map(([when,label,amt]) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.trustM}` }}>
              <div><div style={{ fontSize:12, fontWeight:700, color:C.navy }}>{label}</div><div style={{ fontSize:11, color:C.text3 }}>{when}</div></div>
              <div style={{ fontSize:13, fontWeight:800, color:C.brand }}>{amt.toLocaleString()}만원</div>
            </div>
          ))}
        </div>
        <button onClick={() => setStep('reserved')} style={{ width:'100%', padding:S.xxl, background:C.brand, color:'#fff', border:'none', borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:'pointer', boxShadow:`0 6px 20px ${C.brand}44` }}>예약 확정하기 ✅</button>
      </div>
    </div>
  );
  if(step==='reserved'&&selBid) return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <H title='결제 방식 선택' />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ display:'flex', gap:S.md, alignItems:'center', marginBottom:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg, background:C.brandL, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:C.brand }}>{selBid.company.name[0]}</div>
            <div><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{selBid.company.name}</div><div style={{ fontSize:13, color:C.text3 }}>{selBid.price.toLocaleString()}만원 · {selBid.period}일</div></div>
          </div>
          <div style={{ background:C.brandL, borderRadius:R.lg, padding:`${S.sm}px ${S.md}px`, fontSize:13, color:C.brand, fontWeight:700, textAlign:'center' }}>🎉 예약 확정 완료 · 결제 방식 선택</div>
        </div>
        <div onClick={() => setStep('done_direct')} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.md, border:`1.5px solid ${C.bgWarm}`, cursor:'pointer' }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:4 }}>직거래</div>
          <div style={{ fontSize:12, color:C.text3, marginBottom:S.sm }}>업체와 직접 결제 · 공간마켓 보호 없음</div>
          <div style={{ background:'#FFF8E8', borderRadius:R.sm, padding:'6px 10px', fontSize:11, color:'#C08000' }}>⚠️ 분쟁 발생 시 공간마켓 개입 없음</div>
        </div>
        <div onClick={() => setStep('payment')} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`2px solid ${C.brand}`, cursor:'pointer' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>에스크로 안전 거래</div>
            <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:'3px 10px', fontSize:11, fontWeight:700 }}>🛡 추천</span>
          </div>
          <div style={{ fontSize:12, color:C.text3 }}>공간마켓 보관 · 단계별 지급 · 분쟁 중재</div>
        </div>
        <button onClick={() => onChat(selBid.company)} style={{ width:'100%', padding:S.lg, background:'none', color:C.text3, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:600, fontSize:14, cursor:'pointer' }}>💬 먼저 업체와 상담하기</button>
      </div>
    </div>
  );
  if(step==='payment'&&selBid) return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <H title='에스크로 전액 예치' />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize:13, color:C.text3, marginBottom:4 }}>예치 금액</div>
          <div style={{ fontSize:32, fontWeight:900, color:C.text1, marginBottom:S.md }}>{selBid.price.toLocaleString()}만원</div>
          {[['착공','선금 30%',Math.round(selBid.price*0.3)],['중간점검','중도금 40%',Math.round(selBid.price*0.4)],['완료','잔금 30%',Math.round(selBid.price*0.3)]].map(([w,l,a]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
              <div><div style={{ fontSize:12, fontWeight:700, color:C.text2 }}>{l}</div><div style={{ fontSize:11, color:C.text3 }}>{w}</div></div>
              <div style={{ fontSize:13, fontWeight:800, color:C.brand }}>{a.toLocaleString()}만원</div>
            </div>
          ))}
        </div>
        {[['💳','신용/체크카드'],['📱','카카오페이'],['🏦','계좌이체']].map(([i,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:S.md, padding:`${S.md}px 0`, borderBottom:`1px solid ${C.bgWarm}`, cursor:'pointer' }}>
            <span style={{ fontSize:20 }}>{i}</span><span style={{ fontSize:14, fontWeight:600, color:C.text1 }}>{l}</span><span style={{ marginLeft:'auto', color:C.text4 }}>›</span>
          </div>
        ))}
        <div style={{ background:C.navyL, borderRadius:R.lg, padding:S.md, margin:`${S.xl}px 0`, fontSize:12, color:C.navy, display:'flex', gap:S.sm }}>
          <span>🛡</span><span>예치금은 공간마켓이 보관하며 단계별 확인 후 업체에 지급됩니다</span>
        </div>
        <button onClick={() => setStep('done')} style={{ width:'100%', padding:S.xxl, background:C.brand, color:'#fff', border:'none', borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:'pointer', boxShadow:`0 6px 20px ${C.brand}44` }}>🔒 {selBid.price.toLocaleString()}만원 에스크로 예치하기</button>
      </div>
    </div>
  );
  if((step==='done'||step==='done_direct')&&selBid) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:S.xxl }}>
      <div style={{ width:'100%', maxWidth:390, textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:22, fontWeight:900, color:C.text1, marginBottom:8 }}>예약 완료!</div>
        <div style={{ fontSize:14, color:C.text3, lineHeight:1.8, marginBottom:S.xxl }}>{step==='done'?'에스크로 예치 완료. 착공 확인 후 업체에 지급됩니다.':'직거래로 예약됐어요. 업체와 채팅으로 결제 조율하세요.'}</div>
        <button onClick={() => onChat(selBid.company)} style={{ width:'100%', padding:S.xxl, background:C.brand, color:'#fff', border:'none', borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:'pointer', boxShadow:`0 6px 20px ${C.brand}44`, marginBottom:S.sm }}>💬 {selBid.company.name}와 채팅하기</button>
        <button onClick={onBack} style={{ width:'100%', padding:S.lg, background:'none', color:C.text3, border:'none', fontWeight:600, fontSize:14, cursor:'pointer' }}>홈으로</button>
      </div>
    </div>
  );
  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <H title='입찰 현황' sub={`업체 ${bids.length}곳이 입찰했어요`} />
      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>
        <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl, border:`1px solid ${C.brandM}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.brand }}>💡 업체 금액은 선택 전까지 서로 모릅니다</div>
        </div>
        {bids.map(bid => (
          <div key={bid.id} style={{ background:C.surface, borderRadius:R.xl, marginBottom:S.md, border:`1px solid ${C.bgWarm}`, overflow:'hidden' }}>
            <div style={{ padding:S.xl }}>
              <div style={{ display:'flex', gap:S.md, alignItems:'flex-start', marginBottom:S.lg }}>
                <div style={{ width:44, height:44, borderRadius:R.lg, background:C.brandL, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:C.brand }}>{bid.company.name[0]}</div>
                <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{bid.company.name}</div><TempBadge temp={bid.company.temp} /></div>
                <div style={{ textAlign:'right' }}><div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{bid.price.toLocaleString()}만원</div><div style={{ fontSize:11, color:C.text3 }}>{bid.period}일</div></div>
              </div>
              <div style={{ fontSize:13, color:C.text2, marginBottom:S.md, fontStyle:'italic' }}>{bid.comment}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:S.sm }}>
                <button onClick={() => onChat(bid.company)} style={{ width:'100%', padding:'11px', background:C.surface, color:C.text2, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:'pointer' }}>💬 상담하기</button>
                <button onClick={() => { setSelBid(bid); setStep('confirm'); }} style={{ width:'100%', padding:'11px', background:C.brand, color:'#fff', border:'none', borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:`0 3px 12px ${C.brand}44` }}>✅ 이 업체로 선택하기</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardScreen({ onBack, onEscrow, allRequests }) {
  const [tab, setTab] = useState("active"); // active | bids | stats
  const thisMonthRevenue = 2190;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px 0", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:S.md, marginBottom:14 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
          <div style={{ fontSize:17, fontWeight:800, color:C.text1 }}>업체 대시보드</div>
          <div style={{ marginLeft:"auto" }}>
            <TempBadge temp={97} />
          </div>
        </div>
        <div style={{ display:"flex" }}>
          {[["active","진행중"],["bids","입찰"],["stats","통계"]].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ flex:1, padding:"10px 0", border:"none", background:"transparent",
                fontWeight:tab===v?800:500, fontSize:14,
                color:tab===v?C.brand:C.text3,
                borderBottom:`2.5px solid ${tab===v?C.brand:"transparent"}`,
                cursor:"pointer" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>

        {/* ── 진행중 탭 */}
        {tab==="active" && (
          <div>
            {/* 이번달 수익 요약 */}
            <div style={{ background:`linear-gradient(135deg,${C.brand},${C.brandD})`,
              borderRadius:R.xl, padding:S.xxl, marginBottom:S.xl, color:"#fff" }}>
              <div style={{ fontSize:12, opacity:0.75, marginBottom:4 }}>이번 달 정산 수익</div>
              <div style={{ fontSize:30, fontWeight:900, marginBottom:4 }}>{thisMonthRevenue.toLocaleString()}만원</div>
              <div style={{ fontSize:13, opacity:0.75 }}>진행중 {ACTIVE_JOBS.length}건 · 완료 대기 {Math.round(ACTIVE_JOBS.reduce((a,j)=>a+j.total*(100-j.paid)/100,0)).toLocaleString()}만원</div>
            </div>

            {ACTIVE_JOBS.map(job => (
              <div key={job.id} onClick={() => onEscrow()}
                style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
                  marginBottom:S.md, border:`1px solid ${C.bgWarm}`,
                  boxShadow:"0 2px 8px rgba(28,23,18,0.06)", cursor:"pointer" }}>
                {/* 상태 컬러 바 */}
                <div style={{ height:3, background:job.statusColor }} />
                <div style={{ padding:S.xl }}>
                  <div style={{ display:"flex", gap:S.md, alignItems:"flex-start" }}>
                    <div style={{ width:56, height:56, borderRadius:R.md, overflow:"hidden", flexShrink:0 }}>
                      <img src={job.img} style={{ width:"100%", height:"100%", objectFit:"cover" }}
                        onError={e=>e.target.style.background=C.bgWarm} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:3 }}>
                        <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{job.client}</div>
                        <span style={{ background:`${job.statusColor}18`, color:job.statusColor,
                          borderRadius:R.full, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                          {job.status}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:C.text3, marginBottom:S.sm }}>📍 {job.area} · {job.type}</div>
                      {/* 에스크로 진행 바 */}
                      <div style={{ marginBottom:6 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.text3, marginBottom:4 }}>
                          <span>에스크로 {job.paid}% 지급됨</span>
                          <span>D-{job.dDay}</span>
                        </div>
                        <div style={{ background:C.bgWarm, borderRadius:R.full, height:5, overflow:"hidden" }}>
                          <div style={{ width:`${job.paid}%`, height:"100%",
                            background:job.statusColor, borderRadius:R.full }} />
                        </div>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{job.total.toLocaleString()}만원</div>
                        <div style={{ fontSize:12, color:C.brand, fontWeight:700 }}>에스크로 상세 →</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 입찰 탭 */}
        {tab==="bids" && (
          <div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
              오늘 새로운 견적 요청 <b style={{color:C.brand}}>{allRequests.length}건</b>
            </div>
            {allRequests.map(r => <BidCard key={r.id} r={r} />)}
          </div>
        )}

        {/* ── 통계 탭 */}
        {tab==="stats" && (
          <div>
            {/* 공간온도 상세 */}
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.xl }}>
                <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>🌡 공간온도</div>
                <TempBadge temp={97} lg />
              </div>
              {[["완료 건수","156건","✅"],["재계약률","68%","🔄"],["AS 처리율","98%","🛠"],["평균 별점","4.9점","⭐"]].map(([label,val,icon]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:`${S.sm}px 0`,
                  borderBottom:`1px solid ${C.bgWarm}` }}>
                  <span style={{ fontSize:13, color:C.text3 }}>{icon} {label}</span>
                  <span style={{ fontSize:14, fontWeight:800, color:C.text1 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* 월별 수익 바차트 */}
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.xl }}>월별 정산 수익</div>
              {[["1월",1200],["2월",980],["3월",1650],["4월",2190],["5월",0]].map(([month,val]) => {
                const max = 2190;
                return (
                  <div key={month} style={{ display:"flex", alignItems:"center", gap:S.md, marginBottom:S.md }}>
                    <div style={{ fontSize:12, color:C.text3, width:24, flexShrink:0 }}>{month}</div>
                    <div style={{ flex:1, background:C.bgWarm, borderRadius:R.full, height:10, overflow:"hidden" }}>
                      <div style={{ width:`${val/max*100}%`, height:"100%",
                        background: val===max ? C.brand : C.brandM,
                        borderRadius:R.full, transition:"width 0.5s ease" }} />
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:val===max?C.brand:C.text2, width:52, textAlign:"right" }}>
                      {val>0?`${val}만`:"—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function MainApp({ user, onLogout, onStartOnboarding }) {
  const [mode, setMode] = useState(user.role);
  const [screen, setScreen] = useState("home");
  const [prevScreen, setPrevScreen] = useState("home");
  const [selCo, setSelCo] = useState(null);
  const [toast, setToast] = useState(null);
  const [showReq, setShowReq] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [bidAlert, setBidAlert] = useState(null); // 입찰 알림 { count, requestType }
  // 업체별 채팅 영속 저장 { [companyId]: [...messages] }
  const [chatLogs, setChatLogs] = useState(() => {
    const init = {};
    COMPANIES.forEach(c => { init[c.id] = c.chat; });
    return init;
  });
  const updateChat = (companyId, msgs) =>
    setChatLogs(prev => ({ ...prev, [companyId]: msgs }));

  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const isGuestCompany = mode==="company" && user.isGuest;
  const go = (s, co=null) => { setPrevScreen(screen); if(co) setSelCo(co); setScreen(s); };

  const FULL = ["chat","portfolio","review","escrow","dashboard","bidstatus","admin"].includes(screen);
  const NO_PAD = ["escrow","dashboard","timeline"].includes(screen);
  const NAV = mode==="consumer"
    ? [["🏠","홈","home"],["🗺","지도","map"],["💬","채팅","chatlist"],["👤","마이","my"]]
    : [["📋","요청","home"],["🗺","지도","map"],["💬","채팅","chatlist"],["👤","내정보","my"]];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo','Pretendard',sans-serif" }}>

      {/* 헤더 — 오렌지 로고, 깔끔하게 */}
      {(screen==="home"||screen==="map") && (
        <div style={{ background:C.surface, padding:"14px 20px 0", borderBottom:`1px solid ${C.bgWarm}`, position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {/* 로고 — 오렌지 중심으로 */}
              <div style={{ width:30, height:30, borderRadius:R.md, background:C.brand,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:15, boxShadow:`0 2px 8px ${C.brand}44` }}>🏠</div>
              <div style={{ fontSize:20, fontWeight:900, color:C.text1, letterSpacing:"-0.5px" }}>공간마켓</div>
            </div>
            <div style={{ display:"flex", gap:S.sm, alignItems:"center" }}>
              {/* 모드 토글 — 오렌지 중심 */}
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

        {/* 의뢰인 홈 — 가볍고 친근하게 */}
        {screen==="home" && mode==="consumer" && (
          <div>
            {/* 히어로 — 베이지 배경 + 오렌지 강조: 웜베이지 온기 살리기 */}
            <div style={{ background:`linear-gradient(150deg,#FDF0E4 0%,${C.bgWarm} 100%)`,
              borderRadius:R.xl, padding:S.xxl, marginBottom:S.lg,
              border:`1.5px solid ${C.brandM}`,
              position:"relative", overflow:"hidden" }}>
              {/* 오른쪽 오렌지 장식 원 */}
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

            {/* 실시간 피드 */}
            <LiveFeed />

            {/* 서비스 설명 3단계 */}
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:S.lg, textAlign:"center" }}>
                공간마켓은 이렇게 작동해요
              </div>
              {[
                { step:"1", icon:"📋", title:"견적 요청",
                  sub:"공사 내용 입력하면\n인근 검증 업체에 자동 전달" },
                { step:"2", icon:"💰", title:"입찰 비교",
                  sub:"업체들이 금액·기간 제출\n공간온도 보고 비교 선택" },
                { step:"3", icon:"🛡", title:"에스크로 정산",
                  sub:"고객 돈은 공간마켓 보관\n단계 확인 후 업체에 지급" },
              ].map((item, i, arr) => (
                <div key={item.step} style={{ display:"flex", gap:S.md, alignItems:"flex-start",
                  marginBottom: i < arr.length-1 ? S.lg : 0 }}>
                  {/* 스텝 라인 */}
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                    <div style={{ width:36, height:36, borderRadius:R.full,
                      background:C.brandL, border:`1.5px solid ${C.brandM}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:16 }}>{item.icon}</div>
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
                    <div style={{ fontSize:12, color:C.text3, lineHeight:1.7,
                      whiteSpace:"pre-line" }}>{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 내 견적 요청 목록 */}
            {myRequests.length > 0 && (
              <div style={{ marginBottom:S.xl }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>
                  📋 내 견적 요청
                  <span style={{ fontSize:13, fontWeight:600, color:C.brand, marginLeft:6 }}>{myRequests.length}건</span>
                </div>
                {myRequests.map(r => {
                  const bidCount = Math.floor(Math.random()*4)+1;
                  return (
                  <div key={r.id} style={{ background:C.surface, borderRadius:R.xl,
                    marginBottom:S.md, border:`1.5px solid ${C.brandM}`,
                    overflow:"hidden" }}>
                    {/* 상태 바 */}
                    <div style={{ height:3, background:C.brand }} />
                    <div style={{ padding:S.xl }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:S.sm }}>
                        <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{r.type} · {r.size}</div>
                        <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full,
                          padding:"3px 10px", fontSize:11, fontWeight:700 }}>{r.status}</span>
                      </div>
                      <div style={{ fontSize:13, color:C.text3, marginBottom:S.sm }}>
                        📍 {r.area} · {r.style} · {r.time}
                      </div>

                      {/* 입찰 업체 미리보기 */}
                      <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.md,
                        marginBottom:S.md, border:`1px solid ${C.brandM}` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.sm }}>
                          <span style={{ fontSize:13, fontWeight:800, color:C.brand }}>
                            🔔 업체 {bidCount}곳이 입찰했어요
                          </span>
                        </div>
                        <div style={{ display:"flex", gap:6, marginBottom:S.md }}>
                          {COMPANIES.slice(0,bidCount).map(c => (
                            <div key={c.id}
                              style={{ background:C.surface, borderRadius:R.md, padding:"6px 10px",
                                fontSize:12, fontWeight:700, color:C.text1,
                                border:`1px solid ${C.bgWarm}`, display:"flex", alignItems:"center", gap:4 }}>
                              <TempBadge temp={c.temp} />
                              <span>{c.name}</span>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => setScreen("bidstatus")}
                          style={{ width:"100%", padding:"11px", background:C.brand, color:"#fff",
                            border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer",
                            boxShadow:`0 3px 12px ${C.brand}44` }}>
                          💰 견적 비교하고 업체 선택하기 →
                        </button>
                      </div>

                      <div style={{ display:"flex", gap:S.sm }}>
                        <button onClick={() => setScreen("timeline")}
                          style={{ flex:1, padding:"10px", background:C.surface2,
                            color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
                            fontWeight:700, fontSize:13, cursor:"pointer" }}>
                          📊 진행 현황
                        </button>
                        <button onClick={() => go("chat", COMPANIES[0])}
                          style={{ flex:1, padding:"10px", background:C.brand,
                            color:"#fff", border:"none", borderRadius:R.lg,
                            fontWeight:700, fontSize:13, cursor:"pointer" }}>
                          💬 업체 채팅
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {/* 동네 현황 — 친근한 카드 3개 */}
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

            {/* 검증 업체 목록 */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>인근 업체</div>
              <button onClick={() => setScreen("map")} style={{ fontSize:13, background:"none", border:"none", cursor:"pointer", color:C.brand, fontWeight:700 }}>지도로 보기 →</button>
            </div>
            {COMPANIES.map(c => <CompanyCard key={c.id} company={c} onClick={() => go("portfolio",c)} />)}
          </div>
        )}

        {/* 업체 홈 — 오렌지 중심 */}
        {screen==="home" && mode==="company" && (
          <div>
            {/* 게스트 안내 배너 */}
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
                <div style={{ width:8, height:8, borderRadius:"50%", background:C.green, boxShadow:`0 0 0 3px rgba(255,255,255,0.3)` }} />
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
              <div key={r.id} style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm, border:`1px solid ${C.bgWarm}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:S.sm }}>
                  <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{r.type} · {r.size}</div>
                  <div style={{ display:"flex", gap:6 }}>
                    {r.urgent && <span style={{ background:"#FFF0F0", color:C.red, borderRadius:R.full, padding:"2px 8px", fontSize:11, fontWeight:700 }}>급구</span>}
                    <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>입찰중</span>
                  </div>
                </div>
                <div style={{ fontSize:13, color:C.text3, marginBottom:S.sm }}>📍 {r.area} · {r.style}</div>
                <div style={{ fontSize:14, color:C.text2, marginBottom:S.lg, lineHeight:1.5 }}>{r.desc}</div>
                <Divider />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:S.md }}>
                  <div style={{ fontSize:12, color:C.text3 }}>💰 {r.budget} · 입찰 {r.bids}개</div>
                  <button onClick={() => isGuestCompany ? setShowRegisterPrompt(true) : go("chat",COMPANIES[0])} style={{ background:C.brand, color:"#fff", border:"none", borderRadius:R.full, padding:"8px 18px", fontWeight:700, fontSize:13, cursor:"pointer" }}>{isGuestCompany?"🔒 입찰하기":"견적 입찰하기"}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 지도 */}
        {screen==="map" && (
          <div>
            <div style={{ position:"relative", background:"linear-gradient(145deg,#E4EBE0,#D4E2CC,#DCE8D0)",
              borderRadius:R.xl, height:250, overflow:"hidden", marginBottom:S.xl, border:`1px solid #C4D8BC` }}>
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
        {screen==="bidstatus" && <BidStatusScreen onBack={() => setScreen("home")} onChat={c => go("chat",c)} />}
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
                    color:"#fff", border:"none", borderRadius:R.full,
                    fontWeight:800, fontSize:14, cursor:"pointer" }}>
                  + 견적 요청하기
                </button>
              </div>
            ) : myRequests.map(r => (
              <div key={r.id} style={{ background:C.surface, borderRadius:R.xl,
                marginBottom:S.lg, border:`1px solid ${C.bgWarm}`,
                overflow:"hidden" }}>
                <div style={{ height:3, background:C.brand }} />
                <div style={{ padding:S.xl }}>
                  <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:4 }}>{r.type} · {r.size}</div>
                  <div style={{ fontSize:12, color:C.text3, marginBottom:S.xl }}>📍 {r.area} · 💰 {r.budget}</div>

                  {/* 진행 타임라인 */}
                  {[
                    { label:"견적 요청 완료",    sub:"인근 업체에 공개됨",           done:true,  time:r.time },
                    { label:`업체 ${Math.floor(Math.random()*4)+1}곳 입찰`, sub:"업체 프로필 확인 후 선택",  done:true,  time:"방금", bidStep:true },
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
                          boxShadow: step.active?`0 0 0 4px ${C.brand}22`:"none",
                          fontWeight:900 }}>
                          {step.done?"✓":i+1}
                        </div>
                        {i<arr.length-1 && <div style={{ width:2, flex:1, minHeight:16, marginTop:4,
                          background:step.done?C.green:C.bgWarm }} />}
                      </div>
                      <div style={{ flex:1, paddingTop:6 }}>
                        <div style={{ fontSize:14, fontWeight:700,
                          color:step.done?C.green:step.active?C.brand:C.text3 }}>{step.label}</div>
                        <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>{step.sub}</div>
                        {step.time && <div style={{ fontSize:11, color:C.text4, marginTop:2 }}>{step.time}</div>}
                        {/* 업체 입찰 단계 — 입찰현황 버튼 */}
                        {step.bidStep && (
                          <button onClick={() => setScreen("bidstatus")}
                            style={{ marginTop:S.sm, padding:"8px 16px", background:C.brand,
                              color:"#fff", border:"none", borderRadius:R.full,
                              fontWeight:700, fontSize:12, cursor:"pointer",
                              boxShadow:`0 3px 10px ${C.brand}44` }}>
                            🔔 입찰 현황 비교하기 →
                          </button>
                        )}
                        {step.active && (
                          <button onClick={() => setScreen("bidstatus")}
                            style={{ marginTop:S.sm, padding:"8px 16px", background:C.brand,
                              color:"#fff", border:"none", borderRadius:R.full,
                              fontWeight:700, fontSize:12, cursor:"pointer" }}>
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
            {/* 프로필 카드 */}
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

            {/* 업체 전용 — 보증금 현황 */}
            {user.role==="company" && (
              <div>
                {/* 보증금 현황 카드 */}
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>
                  🏦 보증금 현황
                </div>
                <div style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
                  marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ background:`linear-gradient(135deg,${C.navy},${C.navyM})`,
                    padding:S.xxl, color:"#fff" }}>
                    <div style={{ fontSize:12, opacity:0.7, marginBottom:4 }}>납부한 보증금</div>
                    <div style={{ fontSize:32, fontWeight:900, marginBottom:4 }}>600만원</div>
                    <div style={{ display:"flex", gap:6 }}>
                      <span style={{ background:"rgba(255,255,255,0.15)", borderRadius:R.full,
                        padding:"3px 10px", fontSize:11, fontWeight:700 }}>🥈 스탠다드</span>
                      <span style={{ background:"rgba(255,255,255,0.15)", borderRadius:R.full,
                        padding:"3px 10px", fontSize:11, fontWeight:700 }}>공사 ~2,000만원</span>
                    </div>
                  </div>
                  <div style={{ padding:S.xl }}>
                    {[["보관 방식","공간마켓 법인 신탁 계좌"],
                      ["납부일","2026.05.13"],
                      ["보증금 비율","20% (시공보험 할인 적용)"],
                      ["환급 조건","탈퇴 신청 7일 내 전액 환급"],
                      ["현재 상태","✅ 정상 보관 중"]].map(([k,v]) => (
                      <div key={k} style={{ display:"flex", justifyContent:"space-between",
                        padding:`${S.sm}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
                        <span style={{ fontSize:13, color:C.text3 }}>{k}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 등급 업그레이드 안내 */}
                <div style={{ background:C.brandL, borderRadius:R.xl, padding:S.xl,
                  marginBottom:S.lg, border:`1px solid ${C.brandM}` }}>
                  <div style={{ fontSize:14, fontWeight:800, color:C.brand, marginBottom:S.sm }}>
                    🥇 프리미엄으로 업그레이드
                  </div>
                  <div style={{ fontSize:13, color:C.text2, lineHeight:1.7, marginBottom:S.md }}>
                    추가 보증금 400만원으로<br/>
                    5,000만원 규모 공사까지 수주 가능
                  </div>
                  <button style={{ width:"100%", padding:"11px", background:C.brand, color:"#fff",
                    border:"none", borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                    업그레이드 신청하기
                  </button>
                </div>

                {/* 보증금 안심 안내 */}
                <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
                  border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:S.md }}>
                    🛡 보증금이 안전한 이유
                  </div>
                  {["법인 전용 신탁 계좌 분리 보관",
                    "회사 운영비와 절대 혼용 없음",
                    "탈퇴 시 7일 내 전액 환급 약정",
                    "환급 보증 약정서 발급",
                    "향후 은행 신탁 기관 연계 예정"].map(t => (
                    <div key={t} style={{ display:"flex", gap:S.sm, alignItems:"center",
                      padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
                      <span style={{ color:C.green, fontWeight:900, fontSize:14 }}>✓</span>
                      <span style={{ fontSize:13, color:C.text2 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 소비자 전용 — 내 견적 이력 */}
            {user.role==="consumer" && (
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:S.md }}>
                  내 견적 이력
                </div>
                {myRequests.length === 0 ? (
                  <div style={{ background:C.surface, borderRadius:R.xl, padding:"40px 20px",
                    textAlign:"center", border:`1px solid ${C.bgWarm}` }}>
                    <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                    <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>아직 견적 요청이 없어요</div>
                    <button onClick={() => { setScreen("home"); setShowReq(true); }}
                      style={{ padding:"12px 24px", background:C.brand, color:"#fff",
                        border:"none", borderRadius:R.full, fontWeight:800, fontSize:14, cursor:"pointer" }}>
                      + 첫 견적 요청하기
                    </button>
                  </div>
                ) : myRequests.map(r => (
                  <div key={r.id} onClick={() => setScreen("timeline")}
                    style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
                      marginBottom:S.sm, border:`1px solid ${C.bgWarm}`, cursor:"pointer",
                      display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>{r.type} · {r.size}</div>
                      <div style={{ fontSize:12, color:C.text3, marginTop:3 }}>📍 {r.area} · {r.time}</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                      <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full,
                        padding:"3px 10px", fontSize:11, fontWeight:700 }}>{r.status}</span>
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
        <div style={{ position:"fixed", inset:0, background:"rgba(28,23,18,0.6)",
          display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
            width:"100%", maxWidth:480, padding:"24px 24px 40px" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
            <div style={{ textAlign:"center", marginBottom:S.xxl }}>
              <div style={{ fontSize:44, marginBottom:10 }}>🔨</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:8 }}>업체 등록이 필요해요</div>
              <div style={{ fontSize:13, color:C.text3, lineHeight:1.7 }}>
                입찰하려면 업체 등록이 필요합니다.<br/>
                사업자 인증 후 🛡 인증 배지가 부여돼요.
              </div>
            </div>
            <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl }}>
              {["견적 입찰 가능","채팅 상담 가능","🛡 공간마켓 인증 배지","상단 노출 우선순위"].map(t => (
                <div key={t} style={{ fontSize:13, color:C.brand, fontWeight:600, marginBottom:4 }}>✓ {t}</div>
              ))}
            </div>
            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setShowRegisterPrompt(false)}
                style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2,
                  border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                나중에
              </button>
              <button onClick={() => { setShowRegisterPrompt(false); onStartOnboarding(); }}
                style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff",
                  border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer",
                  boxShadow:`0 4px 16px ${C.brand}44` }}>
                🚀 업체 등록하기
              </button>
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
        setTimeout(() => {
          const bidCount = Math.floor(Math.random()*3)+2;
          setBidAlert({ count: bidCount, requestType: form.type });
        }, 3000);
      }} />}

      {/* 자동 입찰 알림 팝업 */}
      {bidAlert && (
        <div style={{ position:"fixed", inset:0, background:"rgba(28,23,18,0.6)",
          display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:400 }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
            width:"100%", maxWidth:480, padding:"24px 24px 40px" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
            <div style={{ textAlign:"center", marginBottom:S.xxl }}>
              <div style={{ fontSize:48, marginBottom:10 }}>🔔</div>
              <div style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:8 }}>
                업체 {bidAlert.count}곳이 입찰했어요!
              </div>
              <div style={{ fontSize:14, color:C.text3, lineHeight:1.7 }}>
                {bidAlert.requestType} 견적을 확인한 업체들이<br/>금액과 기간을 제출했어요
              </div>
            </div>

            {/* 입찰 업체 미리보기 */}
            <div style={{ display:"flex", flexDirection:"column", gap:S.sm, marginBottom:S.xl }}>
              {COMPANIES.slice(0, bidAlert.count).map((c,i) => (
                <div key={c.id} style={{ background:C.surface2, borderRadius:R.lg,
                  padding:`${S.sm}px ${S.lg}px`, display:"flex",
                  justifyContent:"space-between", alignItems:"center",
                  border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ display:"flex", gap:S.sm, alignItems:"center" }}>
                    <div style={{ width:32, height:32, borderRadius:R.sm, background:C.brandL,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:14, fontWeight:900, color:C.brand }}>{c.name[0]}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{c.name}</div>
                      <div style={{ fontSize:11, color:C.text3 }}>{c.distance} · 견적 제출</div>
                    </div>
                  </div>
                  <TempBadge temp={c.temp} />
                </div>
              ))}
            </div>

            {/* 에스크로 안내 */}
            <div style={{ background:C.navyL, borderRadius:R.lg, padding:S.md,
              marginBottom:S.xl, display:"flex", gap:S.sm, alignItems:"center",
              border:`1px solid ${C.trustM}` }}>
              <span style={{ fontSize:16 }}>🛡</span>
              <span style={{ fontSize:12, color:C.navy, fontWeight:600 }}>
                선택한 업체와 에스크로 안전 정산으로 진행됩니다
              </span>
            </div>

            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setBidAlert(null)}
                style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2,
                  border:`1px solid ${C.bgWarm}`, borderRadius:R.lg,
                  fontWeight:700, fontSize:15, cursor:"pointer" }}>
                나중에
              </button>
              <button onClick={() => { setBidAlert(null); setScreen("bidstatus"); }}
                style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff",
                  border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer",
                  boxShadow:`0 4px 16px ${C.brand}44` }}>
                💰 견적 비교하기
              </button>
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

export default function App() {
  const [user, setUser] = useState(null);
  const [goOnboarding, setGoOnboarding] = useState(false);
  return user
    ? <MainApp user={user} onLogout={() => { setUser(null); setGoOnboarding(false); }} onStartOnboarding={() => { setUser(null); setGoOnboarding(true); }} />
    : <LoginScreen onLogin={u => { setUser(u); setGoOnboarding(false); }} startAtOnboarding={goOnboarding} />;
}
