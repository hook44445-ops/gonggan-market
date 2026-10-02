// 업체 가입 깔때기(10-02 · 대표 «업체 10곳»이 가장 큰 병목) — 어디서 많이 그만두는지 본다.
//
// 왜: 입점 페이지의 «입점» 클릭은 GA(gtag)로만 보냈는데 GA 가 설치돼 있지 않아 어디에도 남지 않았다.
//     가입 3단계(업체 → 지역 → 공종)는 마지막 «가입 마치기» 전엔 서버에 아무것도 저장되지 않아 중간 이탈이 안 보였다.
// 어떻게: 앞 단계는 activity_logs(누구나 쓰기 · 읽기는 관리자 — 180)에 남기고(같은 단계는 이 창에서 한 번),
//        뒤 단계(가입 마침 · 사업자 확인 · 첫 입찰)는 실제 표(companies · bids)에서 센다 — 기록보다 사실이 정확하다.
// 순수 함수(summarizePartnerFunnel · weakestStep)는 partnerFunnelStats.js — 테스트로 묶는다.
import { logActivity } from "./supabase";
import { getCurrentUserId } from "./session";
import { PARTNER_FUNNEL_ACTIONS } from "./partnerFunnelStats.js";

export { FUNNEL_LOG_STEPS, FUNNEL_DOC_CTA, PARTNER_FUNNEL_ACTIONS, summarizePartnerFunnel, weakestStep } from "./partnerFunnelStats.js";

export const funnelDedupKey = (action) => `gm_funnel_${action}`;

export function trackPartnerFunnel(action, meta = {}) {
  try {
    if (!PARTNER_FUNNEL_ACTIONS.includes(action)) return;
    try {
      if (sessionStorage.getItem(funnelDedupKey(action))) return;
      sessionStorage.setItem(funnelDedupKey(action), "1");
    } catch { /* 저장소 없음 — 그래도 남긴다 */ }
    Promise.resolve(logActivity({
      userId: getCurrentUserId() ?? null, role: "company", action,
      targetType: null, targetId: null, metadata: { funnel: "partner", ...meta },
    })).catch(() => {});
  } catch { /* 기록 보조 — 가입 흐름을 막지 않는다 */ }
}
