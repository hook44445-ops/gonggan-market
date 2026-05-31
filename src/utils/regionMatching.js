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

  // ── 진단: 업체 영업지역 세트가 모두 비었는지(=company-region-empty) 판단 ──
  const companiesWithRegion = list.filter((c) => getServiceRegions(c).length > 0).length;

  // fallback 원인 분류 — tier-4 로 떨어지는 실제 이유
  const computeFallbackReason = () => {
    if (!list.length) return "fetch-missing";          // 업체 fetch 자체가 비어있음
    if (!customerRegions.length && !userRegionText) return "customer-region-empty";
    if (companiesWithRegion === 0 && !list.some((c) => c.region)) return "company-region-empty";
    return "no-intersection";                          // 양쪽 다 있으나 겹치는 구/시 없음
  };

  // 진단 로그 — tier 1/2/3/4 중 어디로 떨어지는지
  const log = (tier, isFallback, reason) => {
    // eslint-disable-next-line no-console
    console.log("[RegionMatch]", {
      customer_regions: customerRegions.map((r) => entryKey(r) || r?.city).filter(Boolean),
      company_regions_count: companiesWithRegion,
      company_total: list.length,
      intersection: localMatches.map((c) => c.id),
      matched: tier === "exact" || tier === "legacy" ? localMatches.length
        : tier === "city" ? "(city-expanded)" : tier === "all" ? list.length : 0,
      tier,
      isFallback,
      fallback_reason: reason,
    });
  };

  if (localMatches.length > 0) {
    const tier = exactIds.size > 0 ? "exact" : "legacy";
    const reason = tier === "legacy" ? "legacy-region-used" : null;
    log(tier, false, reason);
    return { matched: localMatches, localMatches, tier, isFallback: false, fallbackReason: reason };
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
      const reason = computeFallbackReason();
      log("city", true, reason);
      return { matched: cityMatch, localMatches: [], tier: "city", isFallback: true, fallbackReason: reason };
    }
  }

  // Tier 4: all companies (최후 fallback)
  const reason = computeFallbackReason();
  log("all", true, reason);
  return { matched: list, localMatches: [], tier: "all", isFallback: true, fallbackReason: reason };
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
