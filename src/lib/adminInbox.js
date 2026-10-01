// 관리자 «오늘 할 일» · «신고» 탭(10-01 대표 «관리자 페이지 보기 쉽고 사용하기 좋게»).
//   · 오늘 할 일: 처리할 것의 숫자를 한 번에(SQL 201 admin_today_counts) — 숫자를 모르면(함수 없음) «열기 ›».
//   · 신고: 라운지 신고(lounge_reports) + 업체가 올린 고객 신고(customer_reports)를 한 목록에.
//     예전 «신고» 탭은 직거래 의심 목록을 그대로 다시 보여 줬고, 고객 신고는 관리자 화면 어디에도 없었다.
// 순수 JS — React·DB 없음.

const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const sum = (...xs) => (xs.every((x) => x == null) ? null : xs.reduce((a, x) => a + (x ?? 0), 0));

// [라벨, 숫자(null=모름), 열 탭, 설명]
export function todayRows(counts = null, { docQueue = null, pendingCompanies = null } = {}) {
  const c = counts ?? {};
  const paySub = num(c.payouts_held) ? `지급 승인된 단계 · 보류 ${num(c.payouts_held)}건` : "고객이 승인한 단계 — 지급 처리";
  return [
    ["서류 확인 대기", num(docQueue), "companies", "업체가 올린 서류 — 오래 기다린 순은 아래"],
    ["업체 가입 심사", num(pendingCompanies), "companies", "승인해야 입찰할 수 있어요"],
    ["분쟁", num(c.disputes), "disputes", "이의 신청 · 조정"],
    ["신고", sum(num(c.lounge_reports), num(c.customer_reports)), "reports", "라운지 신고 · 업체가 올린 고객 신고"],
    ["직거래 의심", num(c.direct_deal), "direct_deal", "대화·계약 밖 거래 신호"],
    ["지급 대기", sum(num(c.payouts_approved), num(c.payouts_held)), "settlements", paySub],
    ["파트너 상담", num(c.partner_leads), "partner_leads", "입점 문의"],
  ];
}

// 처리할 게 있는 줄을 위로(숫자 큰 순) · 모르는 줄은 그 아래 · 0 은 맨 아래 — 원래 순서는 같은 무리 안에서 지킨다
export function sortTodayRows(rows = []) {
  const rank = (n) => (n == null ? 1 : n > 0 ? 0 : 2);
  return rows.map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r[1]) - rank(b.r[1]) || (b.r[1] ?? 0) - (a.r[1] ?? 0) || a.i - b.i)
    .map((x) => x.r);
}

const LOUNGE_TYPE = { post: "글", comment: "댓글", story: "스토리", user: "사용자" };
const LOUNGE_OPEN = new Set(["pending", "reviewing"]);

// 한 목록 — 처리할 것(대기) 먼저 · 최신 순
export function mergeReports(lounge = [], customer = []) {
  const a = (Array.isArray(lounge) ? lounge : []).map((r) => ({
    id: r.id, source: "lounge",
    sourceLabel: "라운지 신고",
    title: `${LOUNGE_TYPE[r.target_type] ?? "라운지"} 신고 · ${r.reason ?? "사유 없음"}`,
    desc: r.description ?? "",
    who: r.reporter_name ?? r.reporter?.name ?? (r.reporter_id ? "회원" : "익명"),
    at: r.created_at ?? null,
    open: LOUNGE_OPEN.has(String(r.status ?? "pending").toLowerCase()),
    raw: r,
  }));
  const b = (Array.isArray(customer) ? customer : []).map((r) => ({
    id: r.id, source: "customer",
    sourceLabel: "고객 신고(업체가 올림)",
    title: `고객 신고 · ${r.report_type ?? "기타"}`,
    desc: r.description ?? "",
    who: r.reporter_id ? "업체" : "알 수 없음",
    at: r.created_at ?? null,
    open: String(r.status ?? "PENDING").toUpperCase() === "PENDING",
    raw: r,
  }));
  const t = (x) => (x.at ? Date.parse(x.at) || 0 : 0);
  return [...a, ...b].sort((x, y) => Number(y.open) - Number(x.open) || t(y) - t(x));
}
