// ── 거래관리 표시 유틸 (admin_project_flow_list 행 기반 파생) ───────────────
// payment_orders / escrow_payouts 는 RLS(auth.uid 기반)로 코드관리자가 직접
// 못 읽으므로, 결제/정산 상태는 escrow 단계값(step1~4 / transaction_status)에서
// 파생한다(1차 무-migration 방침). PG 정밀행은 2차 RPC 연동 예정.

// flow_stage(admin_project_flow_list 계산값) → 한글 단계 라벨
export const FLOW_STAGE_LABEL = {
  REQUESTED:           "견적요청",
  BID_SUBMITTED:       "입찰",
  SITE_VISIT:          "현장실측",
  FINAL_QUOTE:         "최종견적",
  CONTRACTED:          "계약/예치",
  ESCROW_STARTED:      "착공",
  MID_INSPECTION:      "중간점검",
  COMPLETED:           "완료확인",
  SETTLED_OR_REVIEWED: "정산/리뷰",
};

export const flowStageLabel = (s) => FLOW_STAGE_LABEL[s] || s || "—";

// 결제(전액예치) 상태 파생
export function paymentStatus(escrow) {
  if (!escrow) return { label: "미결제", color: "#9AA0A6" };
  if (escrow.step1_deposited_at) return { label: "예치완료", color: "#27AE60" };
  if (["CONTRACTED", "STARTED", "MID_INSPECTION", "COMPLETED", "SETTLED"].includes(escrow.transaction_status))
    return { label: "예치완료", color: "#27AE60" };
  if (escrow.transaction_status === "CANCELLED") return { label: "취소", color: "#9AA0A6" };
  return { label: "결제대기", color: "#E67E22" };
}

// 정산 상태 파생
export function settlementStatus(escrow) {
  if (!escrow) return { label: "—", color: "#9AA0A6" };
  if (escrow.transaction_status === "SETTLED") return { label: "정산완료", color: "#27AE60" };
  if (escrow.transaction_status === "DISPUTE" || escrow.dispute_status != null)
    return { label: "보류", color: "#E74C3C" };
  if (escrow.transaction_status === "COMPLETED") return { label: "정산대기", color: "#E67E22" };
  if (["CONTRACTED", "STARTED", "MID_INSPECTION"].includes(escrow.transaction_status))
    return { label: "진행중", color: "#2980B9" };
  if (escrow.transaction_status === "CANCELLED") return { label: "취소", color: "#9AA0A6" };
  return { label: "—", color: "#9AA0A6" };
}

// 에스크로 거래상태 한글 라벨
export const ESCROW_STATUS_LABEL = {
  REQUESTED: "요청", BIDDING: "입찰중", COMPANY_SELECTED: "업체선정",
  CONTRACTED: "계약", STARTED: "착공", MID_INSPECTION: "중간점검",
  COMPLETED: "완료", SETTLED: "정산완료", DISPUTE: "분쟁", CANCELLED: "취소",
};
export const escrowStatusLabel = (s) => ESCROW_STATUS_LABEL[s] || s || "—";

// 완료(정산/리뷰까지 도달) 여부
export const isTxCompleted = (row) =>
  row.flow_stage === "SETTLED_OR_REVIEWED" ||
  row.status === "completed" ||
  row.escrow?.transaction_status === "SETTLED";

// 거래관리 필터 판정 — all/ongoing/completed/dispute/settle_ready/settled/cancelled
export function txMatchesFilter(row, filter) {
  const esc = row.escrow;
  const st = esc?.transaction_status;
  switch (filter) {
    case "all":          return true;
    case "ongoing":      return !isTxCompleted(row) && st !== "CANCELLED";
    case "completed":    return isTxCompleted(row);
    case "dispute":      return st === "DISPUTE" || esc?.dispute_status != null;
    case "settle_ready": return settlementStatus(esc).label === "정산대기";
    case "settled":      return st === "SETTLED";
    case "cancelled":    return st === "CANCELLED";
    default:             return true;
  }
}

// 거래관리 검색 — 고객명/업체명/전화/request_id/contract_id 매칭(클라이언트)
export function txMatchesSearch(row, q) {
  const s = (q || "").trim().toLowerCase();
  if (!s) return true;
  const fields = [
    row.customer?.name, row.customer?.phone,
    row.company?.name, row.company?.phone,
    row.request_id, row.escrow?.id, row.area,
  ];
  return fields.some(f => f && String(f).toLowerCase().includes(s));
}

export const shortId = (id) => (id ? String(id).slice(0, 8) : "—");

export const fmtDate = (t) =>
  t ? new Date(t).toLocaleDateString("ko-KR", { year: "2-digit", month: "numeric", day: "numeric" }) : "—";
