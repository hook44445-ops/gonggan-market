// 계약은 사업자부터 — A안 (대표 확정 2026-09-24)
//
//   입찰·상담은 누구나 한다. 하지만 돈이 오가는 계약(결제)은 사업자등록을 관리자가 확인한 업체와만 맺는다.
//   사업자등록증은 홈택스에서 당일 발급된다 — 선택된 업체에 안내하고, 확인될 때까지 결제를 열지 않는다.
//   그래서 «서류 없는 업체는 완료 뒤 100%»(A3 1STEP) 예외는 새 계약에서 생기지 않는다.
//
//   지키는 곳은 셋이다(한 곳만 막으면 돈은 나갔는데 계약이 안 되는 일이 생긴다):
//     1) 결제 화면 — 결제 버튼 대신 「사업자 확인 대기」
//     2) 결제 승인 서버(api/confirm-payment) — 승인 전에 막는다 → 토스가 매입하지 않는다(돈이 안 나감)
//     3) 알림(SQL 116) — 선택 순간 업체·관리자에게, 확인되면 의뢰인에게
//
// (확장자까지 적는다 — node --test 와 api/ 서버리스가 이 파일을 그대로 불러온다)

// 선택 뒤 이 시간이 지나도 확인이 안 되면 의뢰인이 다른 업체를 골라도 공간온도가 깎이지 않는다(SQL 116과 같은 숫자).
export const BIZ_GRACE_HOURS = 72;

// 업체 행 → 계약해도 되나. 사업자 확인은 companies.verified 하나로 본다(한도 계산 limitStateOf 와 같은 칸).
export function contractGate(company) {
  if (!company) return { ok: false, code: "COMPANY_UNKNOWN" };
  return company.verified === true ? { ok: true, code: null } : { ok: false, code: "BIZ_REQUIRED" };
}

// 선택 시각 → 기한 상태. 시각을 모르면 null(기한을 지어내지 않는다).
export function bizGrace(selectedAt, now = new Date(), hours = BIZ_GRACE_HOURS) {
  const t = selectedAt ? new Date(selectedAt).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  const deadline = t + hours * 3600 * 1000;
  const leftMs = deadline - new Date(now).getTime();
  return {
    deadline: new Date(deadline),
    hoursLeft: Math.max(0, Math.ceil(leftMs / 3600000)),
    expired: leftMs <= 0,
  };
}

export const BIZ_REQUIRED_MESSAGE =
  "이 업체는 아직 사업자등록 확인 전이라 결제할 수 없어요. 확인되면 알림으로 알려 드릴게요.";
