// 관리자 «성장 지표»(150 admin_growth_stats) → 화면 칸. 숫자가 null 이면(해당 SQL 전) «—».
// 순수 함수 — 화면(AdminGrowthPanel)과 테스트가 같이 쓴다.

const n = (v) => (v == null ? null : Number(v));
const pct = (a, b) => (a == null || !b ? null : Math.round((a / b) * 100));

export function growthCards(s = {}) {
  return [
    { key: "users",     label: "새 가입 · 7일",   value: n(s.users_7d),        sub: s.users_30d != null ? `30일 ${s.users_30d} · 전체 ${s.users_total ?? "—"}` : null },
    { key: "visitors",  label: "방문자 · 7일",    value: n(s.visitors_7d),     sub: s.visitors_today != null ? `오늘 ${s.visitors_today} · 30일 ${s.visitors_30d ?? "—"}` : null },
    { key: "requests",  label: "견적 요청 · 7일", value: n(s.requests_7d),     sub: s.requests_30d != null ? `30일 ${s.requests_30d}` : null },
    { key: "referred",  label: "초대로 가입 · 7일", value: n(s.referred_7d),   sub: s.referred_total != null ? `전체 ${s.referred_total} · 가입의 ${pct(n(s.referred_total), n(s.users_total)) ?? "—"}%` : "SQL 146 전" },
    { key: "testers",   label: "테스터 신청",      value: n(s.testers_total),   sub: s.testers_total != null ? `Play 추가 대기 ${s.testers_waiting ?? 0}` : "SQL 147 전", href: "/testers" },
    { key: "companies", label: "새 업체 · 7일",   value: n(s.companies_7d),    sub: s.companies_total != null ? `전체 ${s.companies_total} · 사례 있는 곳 ${s.companies_with_works ?? "—"}` : null },
    { key: "slug",      label: "짧은 주소 쓰는 업체", value: n(s.companies_with_slug), sub: s.companies_with_slug == null ? "SQL 149 전" : null },
    { key: "tokens",    label: "초대 보상 토큰 · 30일", value: n(s.referral_tokens_30d), sub: s.referral_tokens_30d == null ? "SQL 148 전" : null },
  ];
}

export const fmtCount = (v) => (v == null ? "—" : Number(v).toLocaleString("ko-KR"));
