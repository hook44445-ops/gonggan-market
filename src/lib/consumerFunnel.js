// 고객 견적 깔때기 기록(10-09 일감 3) — 처음 온 사람이 어디서 그만두는지 본다.
// 개인정보 없이 개수만: user_id 는 비우고 metadata 에도 번호·이름을 넣지 않는다. 같은 단계는 이 창에서 한 번.
import { logActivity } from "./supabase";
import { CONSUMER_FUNNEL_ACTIONS } from "./consumerFunnelStats.js";

export { CONSUMER_LOG_STEPS, CONSUMER_FUNNEL_ACTIONS, summarizeConsumerFunnel, consumerFunnelByDay } from "./consumerFunnelStats.js";

export const consumerDedupKey = (action) => `gm_cfunnel_${action}`;

export function trackConsumerFunnel(action) {
  try {
    if (!CONSUMER_FUNNEL_ACTIONS.includes(action)) return;
    try {
      if (sessionStorage.getItem(consumerDedupKey(action))) return;
      sessionStorage.setItem(consumerDedupKey(action), "1");
    } catch { /* 저장소 없음 — 그래도 남긴다 */ }
    Promise.resolve(logActivity({
      userId: null, role: "consumer", action, targetType: null, targetId: null, metadata: { funnel: "consumer" },
    })).catch(() => {});
  } catch { /* 기록 보조 — 흐름을 막지 않는다 */ }
}
