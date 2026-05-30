export const C = {
  brand:    "#2E5F4B",
  brandL:   "#EAF2EE",
  brandM:   "#B5D4C5",
  brandD:   "#1D3D2F",

  navy:     "#1F2A24",
  navyM:    "#2E5F4B",
  navyL:    "#EAF2EE",

  bg:       "#F5F1EA",
  bgWarm:   "#E8E0D4",
  surface:  "#FFFFFF",
  surface2: "#F8F5F0",

  text1:    "#1F2A24",
  text2:    "#3A4A3E",
  text3:    "#7A8A7E",
  text4:    "#B0BAB4",

  green:    "#2E5F4B",
  greenL:   "#EAF2EE",
  red:      "#D63030",
  gold:     "#C8A15A",

  trust:    "#1F2A24",
  trustL:   "#EAF2EE",
  trustM:   "#B5D4C5",

  // ── 공간사이 아이덴티티 확장 톤 (자연·감사·생기) ──
  ivory:    "#FBF7EF",   // 따뜻한 웜화이트 (surface 대체용 부드러운 면)
  sand:     "#F2EBDA",   // 샌드 베이지 — 섹션 배경
  pink:     "#DFABC6",   // 라이트 핑크 — 은은한 생기 포인트 (badge/divider/accent 전용)
  pinkL:    "#FBEEF3",   // 라이트 핑크 배경
  pinkD:    "#6B3355",   // 라이트 핑크 위 텍스트
  leaf:     "#6B8E5A",   // 올리브 잎 톤 (보타니컬 장식)
  sun:      "#F6DDAA",   // 포근 옐로우 — 따뜻한 강조
};

export const R = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, pill:28, full:999 };
export const S = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:28 };

// 카드 깊이/레이어 — 숨쉬는 느낌의 부드러운 그림자
export const SHADOW = {
  soft:  "0 2px 10px rgba(28,23,18,0.05)",
  card:  "0 4px 16px rgba(28,23,18,0.07)",
  lift:  "0 8px 28px rgba(28,23,18,0.10)",
  brand: "0 6px 20px rgba(46,95,75,0.18)",
};

export const GRADE = t => {
  if(t>=96) return { label:"최우수", color:"#1D3D2F", bg:"#E8F0EC", bar:"#2E5F4B", icon:"🏆" };
  if(t>=90) return { label:"신뢰",   color:"#2E5F4B", bg:"#EAF2EE", bar:"#3A7A5C", icon:"✅" };
  if(t>=84) return { label:"양호",   color:"#B08040", bg:"#FBF5E8", bar:"#C8A15A", icon:"👍" };
  return           { label:"신규",   color:"#6B3355", bg:"#FBEEF3", bar:"#DFABC6", icon:"🌱" };
};

export const PHOTOS = {
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

export const SPACE_TYPES = ["아파트 전체","아파트 부분","원룸/오피스텔","카페/식당","오피스","상가"];
export const STYLES = ["모던 미니멀","북유럽 감성","인더스트리얼","내추럴 우드","럭셔리 클래식"];
export const REVIEW_TAGS = ["시간 준수","소통 만족","마감 만족","친절함","가격 만족","재이용 의사"];
export const REGIONS = ["서울", "경기", "인천"];
export const SPECIALTIES = ["아파트 전체","아파트 부분","원룸/오피스텔","카페/식당","오피스","상가","욕실","주방","바닥/도배","조명/전기"];

export const CITY_DISTRICTS = {
  "서울": [
    "강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구",
    "노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구",
    "성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구",
  ],
  "경기": [
    "수원시","평택시","용인시","성남시","고양시","부천시","안양시","안산시",
    "화성시","남양주시","의정부시","광명시","시흥시","김포시","파주시","하남시",
    "광주시","군포시","오산시","이천시","안성시","의왕시","양평군","여주시",
    "포천시","동두천시","과천시","구리시","가평군","연천군",
  ],
  "인천": [
    "중구","동구","미추홀구","연수구","남동구","부평구","계양구","서구",
    "강화군","옹진군",
  ],
};

// 서울·경기·인천 전체 구/시 평면 목록 (시/도 prefix 포함)
export const ALL_REGIONS = Object.entries(CITY_DISTRICTS).flatMap(
  ([city, districts]) => districts.map(d => `${city} ${d}`)
);

export const CUSTOMER_GRADES = [
  { id:"새집",      icon:"🏠", label:"새집",      minJobs:0, benefits:["견적 요청 무제한","업체 채팅 가능","리뷰 작성 가능"] },
  { id:"우리집",    icon:"🏡", label:"우리집",    minJobs:1, benefits:["우선 알림 서비스","리뷰 가중치 +10%","재계약 업체 즐겨찾기"] },
  { id:"드림하우스",icon:"🏰", label:"드림하우스",minJobs:3, benefits:["전담 매니저 배정","긴급 요청 우선 처리","인증 리뷰어 배지"] },
  { id:"홈마스터",  icon:"👑", label:"홈마스터",  minJobs:5, benefits:["VIP 상단 노출","플랫폼 수수료 무료","전용 고객 채널"] },
];

export const calcCustomerGrade = (completedJobs = 0) => {
  if (completedJobs >= 5) return CUSTOMER_GRADES[3];
  if (completedJobs >= 3) return CUSTOMER_GRADES[2];
  if (completedJobs >= 1) return CUSTOMER_GRADES[1];
  return CUSTOMER_GRADES[0];
};

export const ESCROW_STEPS = [
  { id:1, label:"전액 예치",    sub:"고객이 총 금액을 공간마켓에 예치",                pct:0,  icon:"🔒", done:true  },
  { id:2, label:"자재비 선지급", sub:"계약 완료 즉시 자동 지급 (고객 확인 없음)",       pct:10, icon:"💰", done:true  },
  { id:3, label:"착공 확인",    sub:"고객 착공 확인 후 업체에 20% 지급",              pct:20, icon:"🏗", done:false, active:false },
  { id:4, label:"중간점검",     sub:"고객 중간점검 확인 후 업체에 40% 지급",           pct:40, icon:"🔍", done:false },
  { id:5, label:"완료 확인",    sub:"고객 완료 확인 후 업체에 잔금 30% 지급",         pct:30, icon:"✅", done:false },
];

export const FEE_CONFIG = {
  customerRate: 0.03,
  companyRate:  0.04,
  vatRate:      0.1,
};

export const FEED_BASE = [
  { id:1, type:"bid",      co:"홍익시공",    area:"합정동", msg:"32평 아파트 견적 제출",    t:0 },
  { id:2, type:"complete", co:"공간설계소",  area:"연남동", msg:"오피스 시공 완료",          t:3 },
  { id:3, type:"review",   co:"홍익시공",    area:"망원동", msg:"새 후기 ★★★★★ 등록",     t:7 },
  { id:4, type:"bid",      co:"우리집시공단",area:"상수동", msg:"원룸 도배·장판 입찰",      t:12 },
];

export const FEED_META = {
  bid:      { icon:"💬", color:"#2E5F4B" },
  complete: { icon:"✅", color:"#2E5F4B" },
  review:   { icon:"⭐", color:"#C8A15A" },
  new:      { icon:"📋", color:"#2E5F4B" },
};

export const fmtPhone = v => {
  const n = v.replace(/\D/g,"");
  if(n.length<=3) return n;
  if(n.length<=7) return `${n.slice(0,3)}-${n.slice(3)}`;
  return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7,11)}`;
};

// ── STEP 19: Transaction Status Machine ──────────────────────────────────────
export const TRANSACTION_STATUS = {
  REQUESTED:        "REQUESTED",
  BIDDING:          "BIDDING",
  COMPANY_SELECTED: "COMPANY_SELECTED",
  CONTRACTED:       "CONTRACTED",
  STARTED:          "STARTED",
  MID_INSPECTION:   "MID_INSPECTION",
  COMPLETED:        "COMPLETED",
  SETTLED:          "SETTLED",
  DISPUTE:          "DISPUTE",
  CANCELLED:        "CANCELLED",
};

export const TRANSACTION_STATUS_META = {
  REQUESTED:        { label: "견적 요청",   color: "#7A8A7E", bg: "#F0EDE8", icon: "📋" },
  BIDDING:          { label: "입찰 중",     color: "#B08040", bg: "#FBF5E8", icon: "💬" },
  COMPANY_SELECTED: { label: "업체 선택",   color: "#2E5F4B", bg: "#EAF2EE", icon: "✅" },
  CONTRACTED:       { label: "계약 체결",   color: "#1D3D2F", bg: "#E8F0EC", icon: "📝" },
  STARTED:          { label: "공사 시작",   color: "#1D3D2F", bg: "#E8F0EC", icon: "🏗" },
  MID_INSPECTION:   { label: "중간 점검",   color: "#B08040", bg: "#FBF5E8", icon: "🔍" },
  COMPLETED:        { label: "공사 완료",   color: "#2E5F4B", bg: "#EAF2EE", icon: "🎉" },
  SETTLED:          { label: "정산 완료",   color: "#1D3D2F", bg: "#E8F0EC", icon: "💰" },
  DISPUTE:          { label: "분쟁 중",     color: "#D63030", bg: "#FEF0F0", icon: "⚠️" },
  CANCELLED:        { label: "취소",        color: "#B0BAB4", bg: "#F5F1EA", icon: "✖" },
};

// 특정 transaction_status 에서 허용/차단되는 액션
export const TRANSACTION_GUARDS = {
  canWriteReview:    (s) => s === "COMPLETED" || s === "SETTLED",
  canModifyContract: (s) => !["COMPLETED","SETTLED","CANCELLED"].includes(s),
  canBid:            (s) => s === "BIDDING",
  canDispute:        (s) => ["STARTED","MID_INSPECTION","COMPLETED"].includes(s),
  canSettle:         (s) => s === "COMPLETED",
};

// ── STEP 22: Company Status ───────────────────────────────────────────────────
export const COMPANY_STATUS = {
  PENDING:          "PENDING",
  ACTIVE:           "ACTIVE",
  PAUSED:           "PAUSED",
  SUSPENDED:        "SUSPENDED",
  BLACKLISTED:      "BLACKLISTED",
  TEMP_RESTRICTED:  "TEMP_RESTRICTED",
};

export const COMPANY_STATUS_META = {
  PENDING:         { label: "심사 중",    color: "#B08040", bg: "#FBF5E8", canBid: false },
  ACTIVE:          { label: "정상",       color: "#2E5F4B", bg: "#EAF2EE", canBid: true  },
  PAUSED:          { label: "일시 정지",  color: "#7A8A7E", bg: "#F0EDE8", canBid: false },
  SUSPENDED:       { label: "운영 제재",  color: "#D63030", bg: "#FEF0F0", canBid: false },
  BLACKLISTED:     { label: "블랙리스트", color: "#1F2A24", bg: "#E8E0D4", canBid: false },
  TEMP_RESTRICTED: { label: "활동 제한",  color: "#D63030", bg: "#FFF3F0", canBid: false },
};

// ── STEP R: Notification Priority ────────────────────────────────────────────
export const NOTIFICATION_PRIORITY = {
  LOW:      "LOW",
  NORMAL:   "NORMAL",
  HIGH:     "HIGH",
  CRITICAL: "CRITICAL",
};

// ── STEP 25: Dispute Status ───────────────────────────────────────────────────
export const DISPUTE_STATUS = {
  DISPUTE_OPEN:     "DISPUTE_OPEN",
  UNDER_REVIEW:     "UNDER_REVIEW",
  WAITING_CUSTOMER: "WAITING_CUSTOMER",
  WAITING_COMPANY:  "WAITING_COMPANY",
  RESOLVED:         "RESOLVED",
  REFUNDED:         "REFUNDED",
  PARTIAL_REFUND:   "PARTIAL_REFUND",
};

export const DISPUTE_STATUS_META = {
  DISPUTE_OPEN:     { label: "분쟁 접수",     color: "#D63030", bg: "#FEF0F0", icon: "🚨" },
  UNDER_REVIEW:     { label: "검토 중",       color: "#B08040", bg: "#FBF5E8", icon: "🔍" },
  WAITING_CUSTOMER: { label: "고객 답변 대기", color: "#7A8A7E", bg: "#F0EDE8", icon: "⏳" },
  WAITING_COMPANY:  { label: "업체 답변 대기", color: "#7A8A7E", bg: "#F0EDE8", icon: "⏳" },
  RESOLVED:         { label: "분쟁 해결",     color: "#2E5F4B", bg: "#EAF2EE", icon: "✅" },
  REFUNDED:         { label: "전액 환불",     color: "#1D3D2F", bg: "#E8F0EC", icon: "💰" },
  PARTIAL_REFUND:   { label: "부분 환불",     color: "#1D3D2F", bg: "#E8F0EC", icon: "💸" },
};

// ── STEP 20: Activity Log Actions ─────────────────────────────────────────────
export const ACTIVITY_ACTIONS = {
  BID_SUBMITTED:         "BID_SUBMITTED",
  COMPANY_SELECTED:      "COMPANY_SELECTED",
  CONTRACT_CREATED:      "CONTRACT_CREATED",
  STEP_APPROVED:         "STEP_APPROVED",
  PHOTO_UPLOADED:        "PHOTO_UPLOADED",
  CHANGE_ORDER_REQUESTED:"CHANGE_ORDER_REQUESTED",
  CHANGE_ORDER_APPROVED: "CHANGE_ORDER_APPROVED",
  CHANGE_ORDER_REJECTED: "CHANGE_ORDER_REJECTED",
  SETTLEMENT_REQUESTED:  "SETTLEMENT_REQUESTED",
  SETTLEMENT_COMPLETED:  "SETTLEMENT_COMPLETED",
  DISPUTE_FILED:         "DISPUTE_FILED",
  DISPUTE_UPDATED:       "DISPUTE_UPDATED",
  DISPUTE_RESOLVED:      "DISPUTE_RESOLVED",
  ADMIN_STATUS_CHANGED:  "ADMIN_STATUS_CHANGED",
  REVIEW_WRITTEN:        "REVIEW_WRITTEN",
  NOTE_ADDED:            "NOTE_ADDED",
};

// ── STEP 21: Notification Types ───────────────────────────────────────────────
export const NOTIFICATION_TYPES = {
  BID_SUBMITTED:         "BID_SUBMITTED",
  COMPANY_SELECTED:      "COMPANY_SELECTED",
  STEP_APPROVAL_REQUEST: "STEP_APPROVAL_REQUEST",
  CHANGE_ORDER_REQUEST:  "CHANGE_ORDER_REQUEST",
  CHANGE_ORDER_RESULT:   "CHANGE_ORDER_RESULT",
  SETTLEMENT_COMPLETE:   "SETTLEMENT_COMPLETE",
  DISPUTE_FILED:         "DISPUTE_FILED",
  DISPUTE_UPDATED:       "DISPUTE_UPDATED",
  ADMIN_ACTION:          "ADMIN_ACTION",
  NEW_NOTE:              "NEW_NOTE",
};
