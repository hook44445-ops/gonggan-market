// [정책] 현장견적 카운트다운: 72h
// 변경일: 2026.06
// 이유: 공간마켓은 즉시예약형(Airbnb)이 아니라 현장견적·시공 일정 조율형 플랫폼이다.
//       고객·업체 간 전화/채팅/일정조율/현장방문/가족 의사결정/이동시간이 필요하므로
//       24h/48h 는 현실성이 낮다. 카운트다운 기준을 72h(3일)로 통일한다.
//
// 권장 구조: 48h 경과 → 경고 알림 발송 / 72h 경과 → 매칭 자동 취소.
// 모든 72h 계산은 이 상수만 사용한다(하드코딩 금지).

export const SITE_VISIT_ESTIMATE_HOURS = 72;
export const SITE_VISIT_ESTIMATE_MS = SITE_VISIT_ESTIMATE_HOURS * 60 * 60 * 1000;

// 경고 알림 기준 (취소 전 사전 경고)
export const SITE_VISIT_WARN_HOURS = 48;
export const SITE_VISIT_WARN_MS = SITE_VISIT_WARN_HOURS * 60 * 60 * 1000;

// 남은 시간 표시 — 24h 이상이면 "N일 H시간 남음", 미만이면 "H시간 M분 남음".
// 반환: { text, overdue } | null
export function formatDueRemaining(dueAt, { prefix = "" } = {}) {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms <= 0) return { text: prefix ? `${prefix} 기한 초과` : "기한 초과", overdue: true };
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  let body;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    body = `${d}일 ${rh}시간 남음`;
  } else {
    body = `${h}시간 ${m}분 남음`;
  }
  return { text: prefix ? `${prefix} ${body}` : body, overdue: false };
}
