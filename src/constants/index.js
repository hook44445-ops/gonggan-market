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
};

export const R = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, full:999 };
export const S = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:28 };

export const GRADE = t => {
  if(t>=96) return { label:"최우수", color:"#1D3D2F", bg:"#E8F0EC", bar:"#2E5F4B", icon:"🏆" };
  if(t>=90) return { label:"신뢰",   color:"#2E5F4B", bg:"#EAF2EE", bar:"#3A7A5C", icon:"✅" };
  if(t>=84) return { label:"양호",   color:"#B08040", bg:"#FBF5E8", bar:"#C8A15A", icon:"👍" };
  return           { label:"신규",   color:"#7A8A7E", bg:"#F0EDE8", bar:"#B0BAB4", icon:"🆕" };
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
export const REVIEW_TAGS = ["에스크로 신뢰","중간보고 충실","마감 깔끔","일정 준수","견적 투명","빠른 AS","하자보수 완료","계약 준수"];
export const REGIONS = ["마포구","서대문구","용산구","은평구","강남구","송파구"];
export const ALL_REGIONS = ["마포구","서대문구","용산구","은평구","강남구","송파구","강동구","강서구","영등포구","동작구","관악구","종로구","중구","성동구","광진구","노원구"];
export const SPECIALTIES = ["아파트 전체","아파트 부분","원룸/오피스텔","카페/식당","오피스","상가","욕실","주방","바닥/도배","조명/전기"];

export const CITY_DISTRICTS = {
  "서울": ["강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구","노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구","성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구"],
  "경기": ["수원시","성남시","의정부시","안양시","부천시","광명시","평택시","안산시","고양시","구리시","남양주시","오산시","화성시","용인시","파주시","이천시","양주시","광주시","하남시","김포시"],
  "인천": ["중구","동구","미추홀구","연수구","남동구","부평구","계양구","서구"],
  "부산": ["중구","서구","동구","영도구","부산진구","동래구","남구","북구","해운대구","사하구","금정구","강서구","연제구","수영구","사상구"],
  "대구": ["중구","동구","서구","남구","북구","수성구","달서구"],
  "대전": ["동구","중구","서구","유성구","대덕구"],
  "광주": ["동구","서구","남구","북구","광산구"],
  "울산": ["중구","남구","동구","북구","울주군"],
};

export const ESCROW_STEPS = [
  { id:1, label:"전액 예치",    sub:"고객이 총 금액을 공간마켓에 예치",      pct:0,  icon:"🔒", done:true  },
  { id:2, label:"선금 지급",    sub:"착공 시작 · 공간마켓→업체 30% 지급",   pct:30, icon:"💰", done:true  },
  { id:3, label:"중간 점검",    sub:"50% 공정 확인 후 업체에 40% 지급",     pct:40, icon:"🔍", done:false, active:true },
  { id:4, label:"완료 확인",    sub:"시공 완료 확인 후 업체에 잔금 30% 지급", pct:30, icon:"✅", done:false },
];

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
