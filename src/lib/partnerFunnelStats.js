// 업체 가입 깔때기 — 순수 함수·이름표만(DB·화면 없음 · node 테스트용). 기록 남기기는 partnerFunnel.js.
// [action, 화면 이름] — 앞 단계(기록)
export const FUNNEL_LOG_STEPS = [
  ["partner_landing_view", "입점 페이지 봄"],
  ["partner_join_click", "입점 버튼 누름"],
  ["partner_onboard_region", "가입 2단계(지역)"],
  ["partner_onboard_specialty", "가입 3단계(공종)"],
];
export const FUNNEL_DOC_CTA = "partner_doc_cta";   // 가입 마친 화면에서 바로 «사업자등록증 올리기»
export const PARTNER_FUNNEL_ACTIONS = [...FUNNEL_LOG_STEPS.map(([a]) => a), FUNNEL_DOC_CTA];


const isTestName = (name) => /테스트|test/i.test(String(name ?? ""));

// { logs:[{action}], companies:[{id, owner_id, name, verified}], bids:[{company_id}] } → 단계 줄
//   rate = 바로 앞 단계 대비 % (앞 단계가 0 이거나 모르면 null) · 값을 모르면(null) count 도 null
export function summarizePartnerFunnel({ logs, companies, bids } = {}) {
  const logCount = (a) => (Array.isArray(logs) ? logs.filter((r) => r?.action === a).length : null);
  const cos = Array.isArray(companies) ? companies.filter((c) => c && !isTestName(c.name)) : null;
  const bidders = new Set((Array.isArray(bids) ? bids : []).map((b) => String(b?.company_id ?? "")));
  const steps = [
    ...FUNNEL_LOG_STEPS.map(([a, label]) => ({ key: a, label, count: logCount(a), source: "log" })),
    { key: "joined", label: "가입 마침(업체 생성)", count: cos ? cos.length : null, source: "db" },
    { key: "verified", label: "사업자 확인됨", count: cos ? cos.filter((c) => c.verified === true).length : null, source: "db" },
    { key: "first_bid", label: "입찰한 업체", count: cos && Array.isArray(bids)
        ? cos.filter((c) => bidders.has(String(c.id)) || bidders.has(String(c.owner_id))).length : null, source: "db" },
  ];
  return steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1].count : null;
    return { ...s, rate: s.count != null && prev ? Math.round((s.count / prev) * 100) : null };
  });
}

// 가장 많이 빠지는 곳(앞 단계 대비 % 가 가장 낮은 줄) — 숫자가 너무 적으면(앞 단계 5 미만) 말하지 않는다
export function weakestStep(rows) {
  let worst = null;
  for (let i = 1; i < (rows ?? []).length; i++) {
    const r = rows[i]; const prev = rows[i - 1];
    if (r.rate == null || prev.count == null || prev.count < 5) continue;
    if (!worst || r.rate < worst.rate) worst = { ...r, from: prev.label };
  }
  return worst;
}
