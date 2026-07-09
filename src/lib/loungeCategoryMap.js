// ════════════════════════════════════════════════════════════════════
// 공간라운지 Editorial → Lounge Category 매핑 + 규칙 분류 (Phase 19.5)
//
//   Editorial Engine 은 편집 카테고리(경제/주식/AI/공간/창업/라이프/문화/여행/건강/신앙)로
//   분류하지만, lounge_posts.category 는 라운지 카테고리 "id"(realestate/stock/interior…)여야
//   저장·필터·표시가 정상 동작한다. 저장 직전 반드시 라운지 id 로 보정한다(‘자유’ 남발 금지).
//
//   순수 함수 · DB/RLS/Migration 무관.
// ════════════════════════════════════════════════════════════════════

// 편집 카테고리 → 라운지 카테고리 id(폴백). 라운지에 없는 개념(AI/문화/신앙)은 가장 가까운 id.
const ED_TO_LOUNGE = {
  경제: "realestate", 주식: "stock", AI: "free", 공간: "interior", 창업: "startup",
  라이프: "daily", 문화: "free", 여행: "travel", 건강: "health", 신앙: "free",
};

// 1차 규칙(제목/본문 키워드) — 편집 카테고리보다 우선. 가장 먼저 매칭되는 라운지 id 를 쓴다.
const RULE = [
  { id: "realestate", kw: ["전세", "월세", "청약", "아파트", "부동산", "매매", "분양", "금리", "환율", "물가", "gdp", "소비", "고용", "집값", "대출", "재건축"] },
  { id: "stock",      kw: ["주식", "실적", "배당", "etf", "코스피", "코스닥", "나스닥", "엔비디아", "증시", "상장", "테슬라", "삼성전자"] },
  { id: "startup",    kw: ["창업", "자영업", "프랜차이즈", "상가", "매장", "스타트업", "폐업", "사업자"] },
  { id: "interior",   kw: ["리모델링", "도배", "장판", "욕실", "주방", "시공", "인테리어", "방수", "셀프시공", "타일", "몰딩"] },
  { id: "travel",     kw: ["여행", "숙소", "호텔", "펜션", "캠핑", "제주", "해외여행", "국내여행", "여행지"] },
  { id: "restaurant", kw: ["맛집", "식당", "메뉴", "미쉐린", "노포"] },
  { id: "health",     kw: ["건강", "운동", "수면", "다이어트", "식단", "면역", "스트레스", "혈압"] },
  { id: "pet",        kw: ["반려동물", "반려견", "반려묘", "강아지", "고양이", "펫"] },
  { id: "marriage",   kw: ["결혼", "신혼", "혼수", "웨딩", "예식"] },
  { id: "dating",     kw: ["연애", "데이트", "소개팅", "썸", "mbti"] },
  { id: "daily",      kw: ["폭염", "폭우", "한파", "미세먼지", "기후", "장마", "환절기", "생활"] },
];

const norm = (s) => String(s ?? "").toLowerCase();

// 저장 직전 카테고리 보정. editorialCat: 편집 카테고리(한글). 반환: 라운지 카테고리 id.
export function resolveLoungeCategory(editorialCat, title = "", body = "") {
  const hay = norm(`${title} ${String(body).slice(0, 500)}`);
  for (const r of RULE) {
    if (r.kw.some((k) => hay.includes(norm(k)))) return r.id;
  }
  return ED_TO_LOUNGE[editorialCat] || "daily"; // 최후 폴백도 '자유' 대신 '생활'
}
