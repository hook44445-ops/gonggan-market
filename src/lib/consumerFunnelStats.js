// 고객 견적 깔때기(10-09 일감 3) — 순수 함수·이름표만(DB·화면 없음 · node 테스트용). 기록 남기기는 consumerFunnel.js.
// 앞 5단계는 기록(activity_logs · 개인정보 없이 개수만), 마지막 «요청 발송»은 실제 요청 표(requests)에서 센다.
export const CONSUMER_LOG_STEPS = [
  ["consumer_landing_view", "첫 화면 방문"],
  ["consumer_quote_cta", "견적 단추 누름"],
  ["consumer_draft_start", "요청서 쓰기 시작"],
  ["consumer_auth_start", "번호 인증 시작"],
  ["consumer_auth_done", "번호 인증 완료"],
];
export const CONSUMER_FUNNEL_ACTIONS = CONSUMER_LOG_STEPS.map(([a]) => a);

// 한국 날짜(YYYY-MM-DD) — 관리자는 한국에서 본다
export function kstDay(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t + 9 * 3600000).toISOString().slice(0, 10);
}

// { logs:[{action, created_at}], requests:[{created_at}] } → 단계 줄(합계 · 앞 단계 대비 %)
//   값을 모르면(null) count 도 null
export function summarizeConsumerFunnel({ logs, requests } = {}) {
  const logCount = (a) => (Array.isArray(logs) ? logs.filter((r) => r?.action === a).length : null);
  const steps = [
    ...CONSUMER_LOG_STEPS.map(([a, label]) => ({ key: a, label, count: logCount(a), source: "log" })),
    { key: "request_sent", label: "견적 요청 발송", count: Array.isArray(requests) ? requests.length : null, source: "db" },
  ];
  return steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1].count : null;
    return { ...s, rate: s.count != null && prev ? Math.round((s.count / prev) * 100) : null };
  });
}

// 날짜별 표 — 최근 날짜가 위. [{ day, counts:{key:n} }]
export function consumerFunnelByDay({ logs, requests } = {}, days = 7, now = Date.now()) {
  const keys = [...CONSUMER_FUNNEL_ACTIONS, "request_sent"];
  const out = [];
  for (let i = 0; i < days; i++) {
    const day = kstDay(new Date(now - i * 86400000).toISOString());
    out.push({ day, counts: Object.fromEntries(keys.map((k) => [k, 0])) });
  }
  const at = Object.fromEntries(out.map((r) => [r.day, r]));
  for (const r of Array.isArray(logs) ? logs : []) {
    const row = at[kstDay(r?.created_at)];
    if (row && r.action in row.counts) row.counts[r.action] += 1;
  }
  for (const r of Array.isArray(requests) ? requests : []) {
    const row = at[kstDay(r?.created_at)];
    if (row) row.counts.request_sent += 1;
  }
  return out;
}
