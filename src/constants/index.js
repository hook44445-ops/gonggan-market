export const C = {
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

export const R = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, full:999 };
export const S = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:28 };

export const GRADE = t => {
  if(t>=96) return { label:"최우수",  color:"#C04000", bg:"#FFF0E8", bar:"#D95F00", icon:"🏆" };
  if(t>=90) return { label:"신뢰",    color:"#D95F00", bg:"#FDF3EC", bar:"#E87030", icon:"✅" };
  if(t>=84) return { label:"양호",    color:"#C08000", bg:"#FDF8EC", bar:"#E8A000", icon:"👍" };
  return           { label:"신규",    color:"#8A837A", bg:"#F5F0EB", bar:"#C0B8B0", icon:"🆕" };
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

export const COMPANIES = [
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

export const REQUESTS = [
  { id:1, user:"김**", area:"마포구 합정동", size:"32평", type:"아파트 전체", budget:"2,500~3,000만원", style:"모던 미니멀", desc:"신혼집 전체 리모델링. 주방 확장, 욕실 2개 교체 원합니다.", bids:4, time:"2시간 전", distance:"1.2km", urgent:false },
  { id:2, user:"박**", area:"마포구 망원동", size:"12평", type:"원룸", budget:"500~800만원", style:"북유럽", desc:"원룸 부분 인테리어. 도배, 바닥재, 조명 교체.", bids:2, time:"4시간 전", distance:"0.8km", urgent:false },
  { id:3, user:"이**", area:"서대문구 연남동", size:"8평", type:"카페/식당", budget:"3,000~4,000만원", style:"인더스트리얼", desc:"카페 오픈 준비. 인더스트리얼 콘셉트 전체 시공.", bids:6, time:"1일 전", distance:"2.1km", urgent:true },
];

export const SPACE_TYPES = ["아파트 전체","아파트 부분","원룸/오피스텔","카페/식당","오피스","상가"];
export const STYLES = ["모던 미니멀","북유럽 감성","인더스트리얼","내추럴 우드","럭셔리 클래식"];
export const REVIEW_TAGS = ["에스크로 신뢰","중간보고 충실","마감 깔끔","일정 준수","견적 투명","빠른 AS","하자보수 완료","계약 준수"];
export const REGIONS = ["마포구","서대문구","용산구","은평구","강남구","송파구"];
export const ALL_REGIONS = ["마포구","서대문구","용산구","은평구","강남구","송파구","강동구","강서구","영등포구","동작구","관악구","종로구","중구","성동구","광진구","노원구"];
export const SPECIALTIES = ["아파트 전체","아파트 부분","원룸/오피스텔","카페/식당","오피스","상가","욕실","주방","바닥/도배","조명/전기"];

export const ESCROW_STEPS = [
  { id:1, label:"전액 예치",    sub:"고객이 총 금액을 공간마켓에 예치",      pct:0,  icon:"🔒", done:true  },
  { id:2, label:"선금 지급",    sub:"착공 시작 · 공간마켓→업체 30% 지급",   pct:30, icon:"💰", done:true  },
  { id:3, label:"중간 점검",    sub:"50% 공정 확인 후 업체에 40% 지급",     pct:40, icon:"🔍", done:false, active:true },
  { id:4, label:"완료 확인",    sub:"시공 완료 확인 후 업체에 잔금 30% 지급", pct:30, icon:"✅", done:false },
];

export const MOCK_BIDS = [
  { id:1, company:COMPANIES[0], price:2650, period:35, material:"LX하우시스 바닥재, 대림 욕실", comment:"에스크로 156건 완료. 중간 점검 사진 매번 공유드립니다.", selected:false },
  { id:2, company:COMPANIES[1], price:2480, period:30, material:"동화 바닥재, 아메리칸스탠다드 욕실", comment:"미니멀 감성 전문. 일정 준수 보장합니다.", selected:false },
  { id:3, company:COMPANIES[2], price:2200, period:40, material:"국산 중급 자재", comment:"합리적인 가격으로 최선을 다하겠습니다.", selected:false },
];

export const ACTIVE_JOBS = [
  {
    id:1, client:"김민준", area:"마포구 합정동", type:"아파트 전체 32평",
    total:2650, paid:70, status:"중간점검", statusColor:"#D95F00",
    dDay:12, img: PHOTOS.apt_after1,
  },
  {
    id:2, client:"박서연", area:"마포구 망원동", type:"원룸 부분",
    total:680, paid:30, status:"시공중", statusColor:"#00995C",
    dDay:8, img: PHOTOS.room_after,
  },
];

export const FEED_BASE = [
  { id:1, type:"bid",      co:"홍익시공",    area:"합정동", msg:"32평 아파트 견적 제출",    t:0 },
  { id:2, type:"complete", co:"공간설계소",  area:"연남동", msg:"오피스 시공 완료",          t:3 },
  { id:3, type:"review",   co:"홍익시공",    area:"망원동", msg:"새 후기 ★★★★★ 등록",     t:7 },
  { id:4, type:"bid",      co:"우리집시공단",area:"상수동", msg:"원룸 도배·장판 입찰",      t:12 },
];

export const FEED_META = {
  bid:      { icon:"💬", color:"#D95F00" },
  complete: { icon:"✅", color:"#00995C" },
  review:   { icon:"⭐", color:"#E8A000" },
  new:      { icon:"📋", color:"#D95F00" },
};

export const fmtPhone = v => {
  const n = v.replace(/\D/g,"");
  if(n.length<=3) return n;
  if(n.length<=7) return `${n.slice(0,3)}-${n.slice(3)}`;
  return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7,11)}`;
};
