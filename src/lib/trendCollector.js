// ════════════════════════════════════════════════════════════════════
// Trend Collector (Phase 2) — 등록된 Provider 들을 순회해 이슈를 모은다.
//   enabled=false Provider 는 호출하지 않고 'not_configured' 로 표시만 한다
//   (Phase 3 에서 API 키 연결 후 enabled:true 로 바꾸면 자동으로 수집 대상이 된다).
// ════════════════════════════════════════════════════════════════════

import { TREND_PROVIDERS } from "../constants/trendProviders.js";

async function collectFromProvider(provider) {
  if (!provider.enabled) {
    return { providerId: provider.id, items: [], status: "not_configured" };
  }
  try {
    const items = await provider.collect();
    return { providerId: provider.id, items: Array.isArray(items) ? items : [], status: "ok" };
  } catch (e) {
    return { providerId: provider.id, items: [], status: "error", error: e?.message ?? String(e) };
  }
}

// 등록된 모든 Provider 수집 결과를 합친다. providerResults 는 진단/관리자 표시용.
export async function collectAllTrends() {
  const providerResults = await Promise.all(TREND_PROVIDERS.map(collectFromProvider));
  const items = providerResults.flatMap((r) => r.items);
  return { items, providerResults };
}
