// ════════════════════════════════════════════════════════════════════
// 공간라운지 Approval Image — 대표이미지 자동 선정 (Phase 48)
//
//   빈 image_urls 를 금지한다. 본문/유형을 분석해 이미지 카테고리를 정하고 대표이미지를 고른다.
//   우선순위(§11): ① 외부 이미지 검색(미구현 훅) → ② 카테고리 기본이미지 → ③ 브랜드 기본이미지.
//   ALT/출처를 함께 만든다. OG 는 기존 loungeSeo.buildPostMeta 가 image_urls[0] 로 처리한다.
//   ⚠️ 순수 함수 · 기존 정적 에셋만 사용 · 외부 API/DB 없음. Regression Zero.
//   ⚠️ 사건 오인 이미지 금지: 실제 사건 사진을 합성/오인하지 않고, 뉴스/속보는 브랜드 자료 이미지를 쓴다.
// ════════════════════════════════════════════════════════════════════

import { classifyContentType } from "./contentTypes.js";

export const BRAND_DEFAULT = "/images/landing-hero-interior.jpg";
// 공유 미리보기에 쓰일 수 있어 SVG 는 쓰지 않는다 — 카카오톡·페이스북이 SVG 미리보기를 못 띄운다(09-26).
export const OG_DEFAULT = "/og-space-v2.png";

// §12 이미지 카테고리.
export const IMAGE_CATEGORIES = ["NEWS", "BREAKING", "MORNING_BRIEF", "EDITORIAL", "QT", "ASTROLOGY", "INTERIOR", "SPACE_MARKET", "TIME_TREND", "LIFESTYLE", "BUSINESS", "TECH", "DEFAULT"];

// 콘텐츠 유형/본문 → 이미지 카테고리.
export function imageCategoryOf({ title = "", content = "", content_type = null } = {}) {
  const t = content_type || classifyContentType(title);
  const f = `${title}\n${content}`;
  if (t === "breaking") return "BREAKING";
  if (t === "morning_brief") return "MORNING_BRIEF";
  if (t === "qt") return "QT";
  if (t === "astrology") return "ASTROLOGY";
  if (t === "space_market") return "SPACE_MARKET";
  /* ⚠️ trend_* 는 classifyContentType 의 **기본값에 가깝다**(대부분의 제목이 여기로 떨어진다).
     그래서 그림을 고를 때는 먼저 «무슨 이야기인가»를 본다 — 바닥재 글에 카페 사진이 붙던 이유가 이것이었다.
     본문 주제가 잡히면 그쪽을 쓰고, 아무것도 안 잡힐 때만 TIME_TREND 로 남긴다(2026-09-23). */
  const isTrend = t === "trend_past" || t === "trend_present" || t === "trend_future";
  if (/인테리어|리모델링|욕실|주방|거실|시공|자재|가구|바닥재|마루|장판|도배|타일|조명|수납/.test(f)) return "INTERIOR";
  if (/견적|계약|하자|공정|입주|이사|평형|공사/.test(f)) return "SPACE_MARKET";
  if (/주식|증시|투자|경제|부동산|금리|비즈니스|창업|매출|광고비|사장님|업체 운영/.test(f)) return "BUSINESS";
  if (isTrend) return "TIME_TREND";
  if (/ai|인공지능|테크|기술|앱|스마트|it\b/i.test(f)) return "TECH";
  if (/인테리어|리모델링|욕실|주방|거실|시공|자재|가구/.test(f)) return "INTERIOR";
  if (/생활|살림|청소|정리|건강|수면|반려/.test(f)) return "LIFESTYLE";
  if (/뉴스|사설|헤드라인/.test(f)) return "NEWS";
  return "DEFAULT";
}

// 카테고리 → 기본 이미지 **후보들**. 뉴스/속보/편성은 사건 오인 방지 위해 브랜드 자료 이미지 사용.
//
// ⚠️ 2026-09-23: 예전에는 카테고리마다 파일이 «하나»였다. 그래서 인테리어 글은 매번 같은 그림이
//    붙었다(대표 실측: 「사진도 맨날 같은 사진이 올라옴」). 이제 후보를 여러 장 두고 제목 해시로 고른다 —
//    같은 글은 늘 같은 그림(안정), 다른 글은 다른 그림(다양). 전부 저장소에 실제로 있는 파일만 쓴다.
const CATEGORY_IMAGES = {
  INTERIOR: [
    "/images/living.webp", "/images/sample/living-after.webp", "/images/style-minimal.webp",
    "/images/style-nordic.webp", "/images/style-wood.webp", "/images/gonggan-case1.webp",
  ],
  SPACE_MARKET: [
    "/images/kitchen.webp", "/images/sample/kitchen-after.webp", "/images/gonggan-case2.webp",
    "/images/gonggan-case3.webp",
  ],
  LIFESTYLE: [
    "/images/sample/bath-after.webp", "/images/living.webp", "/images/style-classic.webp",
  ],
  BUSINESS: [
    "/images/space-office.webp", "/images/style/office-minimal.webp", "/images/style/office-nordic.webp",
    "/images/space-officetel.webp",
  ],
  TECH: [
    "/images/style/office-industrial.webp", "/images/space-office.webp",
  ],
  TIME_TREND: [
    "/images/cafe.webp", "/images/style/cafe-nordic.webp", "/images/style/cafe-wood.webp",
    "/images/space-shop.webp",
  ],
  MORNING_BRIEF: [BRAND_DEFAULT],
  NEWS: [BRAND_DEFAULT],
  BREAKING: [BRAND_DEFAULT],
  EDITORIAL: [BRAND_DEFAULT],
  QT: [BRAND_DEFAULT],
  ASTROLOGY: [BRAND_DEFAULT],
  DEFAULT: ["/images/gonggan-hero.webp", "/images/sample/cover.webp", OG_DEFAULT],
};


// ── 라운지 카테고리 사진(09-26 · 힉스필드로 새로 만든 고화질 41장) ─────────────────────
//   대표 「사진 품질이 떨어지면」. 글의 라운지 카테고리(연애·건강·주식…)가 있으면 그 카테고리 사진을 먼저 쓴다.
//   예전엔 제목 단어로만 골라 연애·건강 글에 기본 그림이 붙었다. 사람 얼굴·글자·로고 없는 사진만.
export const LOUNGE_CATEGORY_IMAGES = {
  daily: ["/images/lounge/daily-1.webp", "/images/lounge/daily-2.webp"],
  dating: ["/images/lounge/dating-1.webp", "/images/lounge/dating-2.webp"],
  exercise: ["/images/lounge/exercise-1.webp", "/images/lounge/exercise-2.webp"],
  free: ["/images/lounge/free-1.webp"],
  health: ["/images/lounge/health-1.webp", "/images/lounge/health-2.webp"],
  humor: ["/images/lounge/humor-1.webp"],
  interior: ["/images/lounge/interior-1.webp", "/images/lounge/interior-2.webp", "/images/lounge/interior-3.webp", "/images/lounge/interior-4.webp"],
  jobs: ["/images/lounge/jobs-1.webp", "/images/lounge/jobs-2.webp"],
  local: ["/images/lounge/local-1.webp", "/images/lounge/local-2.webp"],
  marriage: ["/images/lounge/marriage-1.webp", "/images/lounge/marriage-2.webp"],
  move_in: ["/images/lounge/move_in-1.webp", "/images/lounge/move_in-2.webp"],
  pet: ["/images/lounge/pet-1.webp", "/images/lounge/pet-2.webp"],
  quote_worry: ["/images/lounge/quote_worry-1.webp", "/images/lounge/quote_worry-2.webp"],
  realestate: ["/images/lounge/realestate-1.webp", "/images/lounge/realestate-2.webp"],
  restaurant: ["/images/lounge/restaurant-1.webp", "/images/lounge/restaurant-2.webp"],
  review: ["/images/lounge/review-1.webp", "/images/lounge/review-2.webp"],
  room_deco: ["/images/lounge/room_deco-1.webp", "/images/lounge/room_deco-2.webp", "/images/lounge/room_deco-3.webp"],
  "staff-talk": ["/images/lounge/staff-talk-1.webp", "/images/lounge/staff-talk-2.webp"],
  stock: ["/images/lounge/stock-1.webp", "/images/lounge/stock-2.webp"],
  travel: ["/images/lounge/travel-1.webp", "/images/lounge/travel-2.webp"],
};
const L = LOUNGE_CATEGORY_IMAGES;

/* 같은 글은 같은 그림, 다른 글은 다른 그림 — 제목+본문 앞머리로 안정 해시. */
function pickFrom(list, key) {
  if (!Array.isArray(list) || list.length === 0) return OG_DEFAULT;
  let h = 2166136261;
  const s = String(key ?? "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return list[Math.abs(h) % list.length];
}

/* 예전 이름 호환 — 카테고리별 «대표 한 장»이 필요한 곳을 위해 남겨 둔다. */
// 새 사진을 기존 풀에도 섞는다(뉴스·큐티·운세처럼 사건 오인 방지 브랜드 칸은 그대로)
for (const [k, add] of Object.entries({
  INTERIOR: [...L.interior, ...L.room_deco], SPACE_MARKET: [...L.quote_worry, ...L.review, ...L.move_in],
  LIFESTYLE: [...L.daily, ...L.health], BUSINESS: [...L.realestate, ...L.stock, ...L["staff-talk"]],
  TECH: [...L.jobs], TIME_TREND: [...L.local, ...L.free], DEFAULT: [...L.free, ...L.local],
})) CATEGORY_IMAGES[k] = [...add, ...CATEGORY_IMAGES[k]];

export const CATEGORY_IMAGE = Object.fromEntries(
  Object.entries(CATEGORY_IMAGES).map(([k, v]) => [k, v[0]]),
);

const CAT_KO = {
  BREAKING: "속보", NEWS: "뉴스", MORNING_BRIEF: "모닝브리프", QT: "큐티", ASTROLOGY: "운세",
  INTERIOR: "인테리어", SPACE_MARKET: "공간", TIME_TREND: "트렌드", LIFESTYLE: "생활", BUSINESS: "비즈니스", TECH: "테크", EDITORIAL: "칼럼", DEFAULT: "공간라운지",
};

// 대표이미지 선정. 반환 { url, alt, source, category, isBrandDefault }
export function pickRepresentativeImage(content = {}) {
  const category = imageCategoryOf(content);
  // ① 외부 검색 훅 — 현재 미구현(외부 이미지 API 필요). null 이면 카테고리/브랜드 기본으로.
  const external = null;
  const key = `${String(content.title ?? "")}|${String(content.content ?? "").slice(0, 60)}`;
  // 라운지 카테고리가 있고 브랜드 칸(뉴스·큐티 등)이 아니면 그 카테고리 사진이 먼저
  const loungeList = !["MORNING_BRIEF", "NEWS", "BREAKING", "EDITORIAL", "QT", "ASTROLOGY"].includes(category) ? L[content.category] : null;
  const url = external || (loungeList ? pickFrom(loungeList, key) : null) || pickFrom(CATEGORY_IMAGES[category], key) || OG_DEFAULT;
  const brandCats = new Set(["MORNING_BRIEF", "NEWS", "BREAKING", "EDITORIAL", "QT", "ASTROLOGY"]);
  const source = external ? "external_search" : brandCats.has(category) ? "brand_default" : "category_default";
  const title = String(content.title ?? "").trim();
  const alt = `${title || CAT_KO[category] || "공간라운지"} · ${CAT_KO[category] || "공간라운지"} 대표 이미지`.slice(0, 120);
  return { url, alt, source, category, isBrandDefault: source === "brand_default" };
}

// image_urls 배열 보장(빈 배열 금지). 기존 이미지가 있으면 유지.
export function ensureImageUrls(content = {}) {
  const cur = Array.isArray(content.image_urls) ? content.image_urls.filter(Boolean) : [];
  if (cur.length > 0) return cur;
  return [pickRepresentativeImage(content).url];
}
