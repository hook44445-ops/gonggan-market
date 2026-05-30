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

// RegionEntry[] → 키 Set (구/시 키 + 시/도 키 둘 다 포함)
function keySet(regions) {
  const set = new Set();
  (Array.isArray(regions) ? regions : []).forEach((r) => {
    const k = entryKey(r);
    if (k) set.add(k);
    if (r?.city) set.add(r.city);
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

// ─────────────────────────────────────────────────────
// 단계별 매칭 — 초기 런칭 fallback UX 전용
//
// tier 우선순위:
//   'exact'  : activity_regions ∩ service_regions 구/시 일치
//   'legacy' : 기존 region text 문자열 일치
//   'city'   : 동일 시/도(구 불일치) — fallback 노출
//   'all'    : 전체 ACTIVE 업체 — fallback 노출
//
// isFallback=true 이면 지도 화면에서 안내 문구/배지 표시.
// localMatches: tier 'city'/'all' 이더라도 exact+legacy 매칭분만 (toggle용)
// ─────────────────────────────────────────────────────
export function getMatchedCompaniesWithTier(companies, user, activeFilter = null) {
  const list = Array.isArray(companies) ? companies : [];

  // 고객 지역 세트
  const customerRegions = activeFilter
    ? [{ city: activeFilter.city, district: activeFilter.district ?? "" }]
    : getActivityRegions(user);

  const userRegionText = activeFilter
    ? regionKey(activeFilter.city, activeFilter.district ?? "")
    : user?.region;

  const primaryCity = customerRegions[0]?.city || userRegionText?.split(" ")[0];

  // Tier 1: exact district match
  const exactIds = new Set();
  if (customerRegions.length) {
    list.forEach((c) => {
      if (isRegionMatch(customerRegions, getServiceRegions(c))) exactIds.add(c.id);
    });
  }

  // Tier 2: legacy region text match
  const legacyIds = new Set();
  if (userRegionText) {
    list.forEach((c) => {
      if (exactIds.has(c.id) || !c.region) return;
      const cr = c.region.trim();
      const ur = userRegionText.trim();
      if (cr === ur || cr.startsWith(ur + " ") || ur.startsWith(cr + " ")) legacyIds.add(c.id);
    });
  }

  const localMatches = list.filter((c) => exactIds.has(c.id) || legacyIds.has(c.id));

  if (localMatches.length > 0) {
    return {
      matched: localMatches,
      localMatches,
      tier: exactIds.size > 0 ? "exact" : "legacy",
      isFallback: false,
    };
  }

  // Tier 3: same city expansion (초기 런칭 fallback)
  if (primaryCity) {
    const cityMatch = list.filter((c) => {
      const cRegs = getServiceRegions(c);
      if (cRegs.some((r) => r.city === primaryCity)) return true;
      if (c.region && c.region.startsWith(primaryCity)) return true;
      return false;
    });
    if (cityMatch.length > 0) {
      return { matched: cityMatch, localMatches: [], tier: "city", isFallback: true };
    }
  }

  // Tier 4: all companies (최후 fallback)
  return { matched: list, localMatches: [], tier: "all", isFallback: true };
}

// 하위 호환 래퍼 — 기존 호출부 호환 유지
export function filterCompaniesByRegion(companies, user, quoteRegion) {
  if (quoteRegion?.city) {
    return getMatchedCompaniesWithTier(companies, user, quoteRegion).matched;
  }
  return getMatchedCompaniesWithTier(companies, user).matched;
}

export function filterCompaniesByRegionText(companies, regionText) {
  const parsed = parseRegionText(regionText);
  return filterCompaniesByRegion(companies, null, parsed ?? undefined);
}
