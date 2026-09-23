// 업체 비교 카드의 «보이는 부분» — 화면과 분리한 순수 로직.
// 왜: 업체를 고르는 순간이 가장 중요한데 카드가 글자와 숫자뿐이었다. 사진을 앞에 세우되,
//     없는 사진을 지어내지 않는다. 업체가 올린 진짜 시공 사진이 있으면 그것, 없으면 자재 이미지를
//     «분위기»라고 밝히고 보여 준다(업체 시공 사진인 척 금지).

// 자재 이미지 — 업체 전문분야에 맞춰 고른다. 방(완성된 공간) 사진이 아니라 자재·도구 배치 컷이다.
export const MOOD_BANDS = {
  home:   "/images/trade/home.webp",    // 주거
  shop:   "/images/trade/shop.webp",    // 카페·식당·상가
  office: "/images/trade/office.webp",  // 오피스
  water:  "/images/trade/water.webp",   // 욕실·주방
  finish: "/images/trade/finish.webp",  // 필름·페인트·도배·바닥
  build:  "/images/trade/build.webp",   // 철거·방수·단열·창호
};

const GROUP_BY_SPECIALTY = {
  "아파트 전체": "home", "아파트 부분": "home", "원룸/오피스텔": "home",
  "카페/식당": "shop", "상가": "shop",
  "오피스": "office",
  "욕실": "water", "주방": "water",
  "바닥/도배": "finish", "인테리어 필름": "finish", "페인트": "finish", "타일": "finish", "줄눈/탄성코트": "finish",
  "철거": "build", "방수/누수": "build", "단열/발코니 확장": "build", "창호/중문": "build",
  "조명/전기": "office", "몰딩/도어": "finish", "붙박이장/가구": "home",
};

export function moodBandFor(company = {}) {
  const hit = (company.specialties ?? []).map(s => GROUP_BY_SPECIALTY[s]).find(Boolean);
  return MOOD_BANDS[hit ?? "home"];
}

// 카드 위쪽에 무엇을 보여 줄지. photos 는 이 업체가 올린 시공 사례 사진(있을 때만).
export function cardVisual(company = {}, photos = []) {
  const real = (Array.isArray(photos) ? photos : []).filter(u => typeof u === "string" && /^https?:\/\//.test(u));
  if (real.length > 0) return { kind: "work", photos: real.slice(0, 3), caption: `시공 사례 ${real.length}장` };
  return { kind: "mood", photos: [moodBandFor(company)], caption: "사례 준비 중 · 분위기 이미지" };
}

// 「왜 이 업체?」 — 지어내지 않는다. 실제 값이 기준을 넘을 때만 한 줄.
export function whyThisCompany(company = {}) {
  const out = [];
  const jobs = Number(company.completedJobs) || 0;
  const re = Number(company.recontractRate) || 0;
  const as = Number(company.asRate) || 0;
  if (jobs >= 10) out.push(`공간마켓 시공 ${jobs}건`);
  if (re >= 30) out.push(`재계약 ${Math.round(re)}%`);
  if (as >= 90) out.push(`A/S 응답 ${Math.round(as)}%`);
  if (company.hasInsurance) out.push("보험 가입");
  if (company.guarantee_badge_visible && company.guarantee_status === "ACTIVE") out.push("공간보증");
  return out.slice(0, 3);
}

// 전문분야 칩 — 요청서에서 고른 공사와 겹치는 것을 앞에 둔다(내 공사를 해 본 업체인지가 먼저).
export function specialtyChips(company = {}, requestText = "", max = 4) {
  const list = company.specialties ?? [];
  const hay = String(requestText ?? "");
  // 「인테리어 필름」은 요청서에 «필름»으로만 적히기도 한다 → 띄어쓰기·/·· 로 쪼갠 조각으로 본다.
  const matched = list.filter(s => s.split(/[\/·\s]+/).some(p => p.length > 1 && hay.includes(p)));
  const rest = list.filter(s => !matched.includes(s));
  return { chips: [...matched, ...rest].slice(0, max), matchedCount: matched.length };
}
