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
export const OG_DEFAULT = "/mock-reviews/after-cafe.svg";

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
  if (t === "trend_past" || t === "trend_present" || t === "trend_future") return "TIME_TREND";
  if (/주식|증시|투자|경제|부동산|금리|비즈니스|창업|매출/.test(f)) return "BUSINESS";
  if (/ai|인공지능|테크|기술|앱|스마트|it\b/i.test(f)) return "TECH";
  if (/인테리어|리모델링|욕실|주방|거실|시공|자재|가구/.test(f)) return "INTERIOR";
  if (/생활|살림|청소|정리|건강|수면|반려/.test(f)) return "LIFESTYLE";
  if (/뉴스|사설|헤드라인/.test(f)) return "NEWS";
  return "DEFAULT";
}

// 카테고리 → 기본 이미지(브랜드 자료성). 뉴스/속보/편성은 사건 오인 방지 위해 브랜드 자료 이미지 사용.
const CATEGORY_IMAGE = {
  INTERIOR: "/mock/after-apartment.svg",
  SPACE_MARKET: "/mock/after-kitchen.svg",
  LIFESTYLE: "/mock/after-bath.svg",
  BUSINESS: "/mock/after-office.svg",
  TECH: "/mock/after-office.svg",
  TIME_TREND: "/mock/after-cafe.svg",
  MORNING_BRIEF: BRAND_DEFAULT,
  NEWS: BRAND_DEFAULT,
  BREAKING: BRAND_DEFAULT,
  EDITORIAL: BRAND_DEFAULT,
  QT: BRAND_DEFAULT,
  ASTROLOGY: BRAND_DEFAULT,
  DEFAULT: OG_DEFAULT,
};

const CAT_KO = {
  BREAKING: "속보", NEWS: "뉴스", MORNING_BRIEF: "모닝브리프", QT: "큐티", ASTROLOGY: "운세",
  INTERIOR: "인테리어", SPACE_MARKET: "공간", TIME_TREND: "트렌드", LIFESTYLE: "생활", BUSINESS: "비즈니스", TECH: "테크", EDITORIAL: "칼럼", DEFAULT: "공간라운지",
};

// 대표이미지 선정. 반환 { url, alt, source, category, isBrandDefault }
export function pickRepresentativeImage(content = {}) {
  const category = imageCategoryOf(content);
  // ① 외부 검색 훅 — 현재 미구현(외부 이미지 API 필요). null 이면 카테고리/브랜드 기본으로.
  const external = null;
  const url = external || CATEGORY_IMAGE[category] || OG_DEFAULT;
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
