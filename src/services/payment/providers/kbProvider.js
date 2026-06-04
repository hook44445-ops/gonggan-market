// ── KB국민 결제 어댑터 (placeholder) ─────────────────────────────────────────
// 구조만 열어둠 — 실제 연동은 가맹 승인 후 별도 PR. 호출 시 명시적으로 실패.
export const id = "KB";
export const isActive = false;

const notImplemented = () => {
  throw new Error("KB provider is not implemented yet");
};

export const loadSdk = notImplemented;
export const requestPayment = notImplemented;
export const confirmPayment = notImplemented;
