import {
  regionKey,
  getActivityRegions,
  getServiceRegions,
  parseRegionText,
} from "../constants/regions";

// ─────────────────────────────────────────────────────
// 업체-고객 지역 매칭
//   고객 activity_regions 와 업체 service_regions 가 1곳 이상
//   겹치면 매칭 가능. 기존 region text 는 fallback 으로 함께 고려.
// ─────────────────────────────────────────────────────

// RegionEntry → 비교 키 "시/도 구/시"
export function entryKey(r) {
  if (!r) return null;
  if (r.city) return regionKey(r.city, r.district ?? "");
  return null;
}

// RegionEntry[] → 키 Set (구/시 키 + 시/도 키 둘 다 포함 → 시 단위 매칭 허용)
function keySet(regions) {
  const set = new Set();
  (Array.isArray(regions) ? regions : []).forEach((r) => {
    const k = entryKey(r);
    if (k) set.add(k);
    if (r?.city) set.add(r.city); // 시/도 단위 폭넓은 매칭
  });
  return set;
}

// 두 지역 집합이 1곳 이상 겹치는가
export function isRegionMatch(customerRegions, companyRegions) {
  const cust = keySet(customerRegions);
  if (!cust.size) return false;
  const comp = keySet(companyRegions);
  for (const k of comp) if (cust.has(k)) return true;
  return false;
}

// 업체 목록 필터링
//   - 고객 활동지역 기준 매칭 우선 (매칭 결과가 있으면 그것만)
//   - 매칭 0건이거나 활동지역 없으면 견적 시공 지역 기준
//   - 둘 다 없으면 전체 노출 (안전한 기본값)
export function filterCompaniesByRegion(companies, user, quoteRegion) {
  const list = Array.isArray(companies) ? companies : [];
  const customerRegions = getActivityRegions(user);

  if (customerRegions.length) {
    const matched = list.filter((c) =>
      isRegionMatch(customerRegions, getServiceRegions(c))
    );
    if (matched.length) return matched;
  }

  if (quoteRegion?.city) {
    const qKey = regionKey(quoteRegion.city, quoteRegion.district ?? "");
    const matched = list.filter((c) => {
      const comp = keySet(getServiceRegions(c));
      return comp.has(qKey) || comp.has(quoteRegion.city);
    });
    if (matched.length) return matched;
  }

  return list; // 전체 노출
}

// 편의: region text("서울 강서구") 로 바로 필터
export function filterCompaniesByRegionText(companies, regionText) {
  const parsed = parseRegionText(regionText);
  return filterCompaniesByRegion(companies, null, parsed ?? undefined);
}
