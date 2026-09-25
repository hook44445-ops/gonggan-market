// 고객 번복(선택 뒤 취소)의 공간온도 — 업체가 들인 수고만큼만(대표 09-25 「시장논리에 맞게」).
// ⚠ 서버 트리거(migration 128 trg_request_customer_reversal)와 같은 규칙. 숫자를 바꾸면 두 곳을 같이.
//   고르기 전 취소        → 영향 없음(비교는 고객의 권리)
//   고른 뒤 · 최종 견적 전 → −0.5(업체가 연락·현장방문을 준비)
//   최종 견적 받은 뒤      → −1.0(현장방문·견적서까지 끝냄)
//   고른 뒤 72시간이 지나도 업체가 최종 견적을 안 줬거나, 사업자 확인이 안 된 업체 → 영향 없음(업체 쪽이 멈춤)
//   결제한 뒤             → 취소 버튼 없음(이의 신청·분쟁 절차)
export const MAX_BIDS_PER_REQUEST = 5;       // 서버 128 과 같다 — 보통 3~5곳을 비교한다
export const STALL_HOURS = 72;

const QUOTED = ["final_quote_submitted", "escrow_pending"];

export function reversalEffect({ status, selected = false, selectedAt = null, companyVerified = true, paid = false, now = Date.now() } = {}) {
  if (paid) return { canCancel: false, delta: 0, why: "paid" };
  if (!selected) return { canCancel: true, delta: 0, why: "before_select" };
  const hours = selectedAt ? (now - new Date(selectedAt).getTime()) / 36e5 : 0;
  const stalled = hours >= STALL_HOURS && !QUOTED.includes(status);
  if (stalled || (hours >= STALL_HOURS && companyVerified === false)) return { canCancel: true, delta: 0, why: "company_stalled" };
  if (QUOTED.includes(status)) return { canCancel: true, delta: -1.0, why: "after_quote" };
  return { canCancel: true, delta: -0.5, why: "after_select" };
}

export function reversalMessage(e) {
  if (!e?.canCancel) return "결제한 뒤에는 여기서 취소할 수 없어요. 공사 화면의 「이의 신청」으로 알려 주세요.";
  if (e.why === "before_select") return "이 견적 요청을 취소할까요? 업체들에게 더 이상 보이지 않아요.";
  if (e.why === "company_stalled") return "업체가 72시간 넘게 최종 견적을 주지 않았어요. 지금 취소해도 공간온도에는 영향이 없어요. 취소할까요?";
  return `업체가 ${e.why === "after_quote" ? "현장방문과 최종 견적까지 준비했어요" : "이미 연락·현장방문을 준비하고 있어요"}. 지금 취소하면 내 공간온도가 ${Math.abs(e.delta)}° 내려가요. 취소할까요?`;
}
