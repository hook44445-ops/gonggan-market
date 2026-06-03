// ─────────────────────────────────────────────────────
// 지역 정책 — 활동지역/영업지역 중심 좌표 및 헬퍼
//
// 데이터 호환: 기존 `region` text 컬럼("서울 강서구" 형식)을 그대로
// 정식 식별자로 사용한다. 신규 jsonb 필드 activity_regions /
// service_regions 는 RegionEntry 객체 배열로 저장한다.
//
//   RegionEntry = { city, district, is_primary, added_at }
//
// 시/도·구/시 목록은 src/constants/index.js 의 CITY_DISTRICTS 를
// 단일 출처로 재사용한다(중복 정의 금지).
// ─────────────────────────────────────────────────────

import { CITY_DISTRICTS } from "./index";

// 서울시청 — 모든 우선순위 실패 시 최종 fallback 중심
export const FALLBACK_CENTER = { lat: 37.5665, lng: 126.9780 };

// 시/도 단위 fallback 중심 (구/시 좌표가 없을 때)
export const CITY_CENTERS = {
  "서울": { lat: 37.5665, lng: 126.9780 },
  "경기": { lat: 37.2750, lng: 127.0095 },
  "인천": { lat: 37.4563, lng: 126.7052 },
};

// 구/시 단위 중심 좌표 — key 는 "시/도 구/시" (기존 region text 와 동일)
export const REGION_CENTERS = {
  // 서울 25구
  "서울 강남구": { lat: 37.5172, lng: 127.0473 },
  "서울 강동구": { lat: 37.5301, lng: 127.1238 },
  "서울 강북구": { lat: 37.6396, lng: 127.0257 },
  "서울 강서구": { lat: 37.5509, lng: 126.8495 },
  "서울 관악구": { lat: 37.4784, lng: 126.9516 },
  "서울 광진구": { lat: 37.5385, lng: 127.0823 },
  "서울 구로구": { lat: 37.4954, lng: 126.8874 },
  "서울 금천구": { lat: 37.4569, lng: 126.8954 },
  "서울 노원구": { lat: 37.6542, lng: 127.0568 },
  "서울 도봉구": { lat: 37.6688, lng: 127.0471 },
  "서울 동대문구": { lat: 37.5744, lng: 127.0396 },
  "서울 동작구": { lat: 37.5124, lng: 126.9393 },
  "서울 마포구": { lat: 37.5663, lng: 126.9019 },
  "서울 서대문구": { lat: 37.5791, lng: 126.9368 },
  "서울 서초구": { lat: 37.4837, lng: 127.0324 },
  "서울 성동구": { lat: 37.5634, lng: 127.0371 },
  "서울 성북구": { lat: 37.5894, lng: 127.0167 },
  "서울 송파구": { lat: 37.5145, lng: 127.1059 },
  "서울 양천구": { lat: 37.5170, lng: 126.8665 },
  "서울 영등포구": { lat: 37.5264, lng: 126.8962 },
  "서울 용산구": { lat: 37.5384, lng: 126.9655 },
  "서울 은평구": { lat: 37.6027, lng: 126.9292 },
  "서울 종로구": { lat: 37.5730, lng: 126.9794 },
  "서울 중구": { lat: 37.5636, lng: 126.9976 },
  "서울 중랑구": { lat: 37.6063, lng: 127.0925 },
  // 경기 주요 시
  "경기 수원시": { lat: 37.2636, lng: 127.0286 },
  "경기 평택시": { lat: 36.9921, lng: 127.1128 },
  "경기 용인시": { lat: 37.2411, lng: 127.1776 },
  "경기 성남시": { lat: 37.4200, lng: 127.1267 },
  "경기 고양시": { lat: 37.6584, lng: 126.8320 },
  "경기 부천시": { lat: 37.5034, lng: 126.7660 },
  "경기 안양시": { lat: 37.3943, lng: 126.9568 },
  "경기 안산시": { lat: 37.3219, lng: 126.8309 },
  "경기 화성시": { lat: 37.1996, lng: 126.8312 },
  "경기 남양주시": { lat: 37.6360, lng: 127.2165 },
  "경기 의정부시": { lat: 37.7380, lng: 127.0337 },
  "경기 광명시": { lat: 37.4786, lng: 126.8646 },
  "경기 시흥시": { lat: 37.3800, lng: 126.8030 },
  "경기 김포시": { lat: 37.6152, lng: 126.7156 },
  "경기 파주시": { lat: 37.7599, lng: 126.7800 },
  "경기 하남시": { lat: 37.5392, lng: 127.2148 },
  "경기 광주시": { lat: 37.4292, lng: 127.2550 },
  "경기 군포시": { lat: 37.3617, lng: 126.9352 },
  "경기 오산시": { lat: 37.1499, lng: 127.0772 },
  "경기 이천시": { lat: 37.2722, lng: 127.4350 },
  "경기 안성시": { lat: 37.0080, lng: 127.2797 },
  "경기 의왕시": { lat: 37.3446, lng: 126.9683 },
  "경기 양평군": { lat: 37.4917, lng: 127.4875 },
  "경기 여주시": { lat: 37.2982, lng: 127.6370 },
  "경기 포천시": { lat: 37.8949, lng: 127.2003 },
  "경기 동두천시": { lat: 37.9036, lng: 127.0606 },
  "경기 과천시": { lat: 37.4292, lng: 126.9877 },
  "경기 구리시": { lat: 37.5943, lng: 127.1296 },
  "경기 가평군": { lat: 37.8315, lng: 127.5095 },
  "경기 연천군": { lat: 38.0966, lng: 127.0747 },
  // 인천
  "인천 중구": { lat: 37.4738, lng: 126.6216 },
  "인천 동구": { lat: 37.4738, lng: 126.6433 },
  "인천 미추홀구": { lat: 37.4636, lng: 126.6505 },
  "인천 연수구": { lat: 37.4101, lng: 126.6782 },
  "인천 남동구": { lat: 37.4474, lng: 126.7314 },
  "인천 부평구": { lat: 37.5074, lng: 126.7220 },
  "인천 계양구": { lat: 37.5373, lng: 126.7376 },
  "인천 서구": { lat: 37.5455, lng: 126.6760 },
  "인천 강화군": { lat: 37.7470, lng: 126.4880 },
  "인천 옹진군": { lat: 37.4467, lng: 126.6370 },
};

// "서울 강서구" 같은 정식 키 생성
export function regionKey(city, district) {
  if (!city) return "";
  return district ? `${city} ${district}` : city;
}

// 저장된 region text("서울 강서구") → { city, district }
export function parseRegionText(text) {
  if (!text || typeof text !== "string") return null;
  const parts = text.trim().split(/\s+/);
  if (!parts.length || !parts[0]) return null;
  if (parts.length === 1) return { city: parts[0], district: "" };
  return { city: parts[0], district: parts.slice(1).join(" ") };
}

// city/district → 중심 좌표 (구/시 → 시/도 → 서울시청 순 fallback)
export function regionCenter(city, district) {
  if (city && district) {
    const c = REGION_CENTERS[regionKey(city, district)];
    if (c) return c;
  }
  if (city && CITY_CENTERS[city]) return CITY_CENTERS[city];
  return FALLBACK_CENTER;
}

// RegionEntry 생성
// 신규 스키마 필드(id/sido/sigungu/label/lat/lng/radiusKm)와
// legacy 호환 필드(city/district/is_primary/added_at)를 함께 담는다.
// → 매칭/지도 코드는 city/district 를, 저장/식별은 id/label 을 사용.
export function makeRegionEntry(city, district, isPrimary = false) {
  const d = district ?? "";
  const label = regionKey(city, d);
  const center = regionCenter(city, d);
  return {
    id: label,                 // 안정적 식별자 (default_*_region_id 매칭용)
    sido: city, sigungu: d, label,
    lat: center.lat, lng: center.lng, radiusKm: 3,
    // ── legacy 호환 ──
    city, district: d, is_primary: !!isPrimary, added_at: new Date().toISOString(),
  };
}

// RegionEntry 정규화 — city/district 가 비어도 sido/sigungu/label 에서 복원.
// (저장 데이터 형태가 섞여 있어도 칩 선택/지도중심/필터가 일관 동작하도록 보장)
export function normalizeRegionEntry(e) {
  if (!e || typeof e !== "object") return e;
  const fromLabel = typeof e.label === "string" ? e.label.trim().split(/\s+/) : [];
  const city = e.city || e.sido || fromLabel[0] || "";
  const district = e.district || e.sigungu || (fromLabel.length > 1 ? fromLabel.slice(1).join(" ") : "");
  return { ...e, city, district };
}

// jsonb activity_regions(없으면 legacy region text) → RegionEntry[]
export function getActivityRegions(user) {
  const arr = Array.isArray(user?.activity_regions) ? user.activity_regions : [];
  if (arr.length) return arr.map(normalizeRegionEntry);
  const parsed = parseRegionText(user?.region);
  return parsed ? [makeRegionEntry(parsed.city, parsed.district, true)] : [];
}

// jsonb service_regions(없으면 legacy region text) → RegionEntry[]
export function getServiceRegions(company) {
  const arr = Array.isArray(company?.service_regions) ? company.service_regions : [];
  if (arr.length) return arr.map(normalizeRegionEntry);
  const parsed = parseRegionText(company?.region);
  return parsed ? [makeRegionEntry(parsed.city, parsed.district, true)] : [];
}

// 기본(primary) 지역 — is_primary 우선, 없으면 첫 번째
export function getPrimaryRegion(regions) {
  if (!Array.isArray(regions) || !regions.length) return null;
  return regions.find(r => r?.is_primary) ?? regions[0];
}

// 기본 지역 식별자 — default_activity_region_id / default_service_region_id 컬럼 값
// (구버전 엔트리에 id 가 없으면 city/district 로 키 생성)
export function getPrimaryRegionId(regions) {
  const p = getPrimaryRegion(regions);
  if (!p) return null;
  return p.id ?? regionKey(p.city, p.district);
}

// 시/도 목록 (UI 탭용)
export const REGION_CITIES = Object.keys(CITY_DISTRICTS);

// 구/시 목록 (UI 리스트용)
export function districtsOf(city) {
  return CITY_DISTRICTS[city] ?? [];
}
