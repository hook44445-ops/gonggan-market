const feeConfig = { customerRate: 0.03, companyRate: 0.04, vatRate: 0.1 };

export const fmtMoney = (amount) => {
  if (amount == null || isNaN(amount)) return "—";
  // 만원 단위, 천 단위 콤마, 소수점 없이 정수만
  return `${Math.round(Number(amount)).toLocaleString()}만원`;
};

// 견적/입찰 최소 금액 — 10만원(=100,000원). 입력값은 만원 단위.
export const MIN_BID_MANWON = 10;
export const isValidBidManwon = (manwon) => {
  const n = Number(manwon);
  return Number.isFinite(n) && n >= MIN_BID_MANWON;
};

// Customer pays bid amount + 3% safety transaction fee (VAT inclusive)
export const calculateCustomerTotal = (bidAmount) => {
  if (!bidAmount || isNaN(bidAmount)) return 0;
  const fee = Math.round(bidAmount * feeConfig.customerRate * (1 + feeConfig.vatRate) * 10) / 10;
  return Math.round((bidAmount + fee) * 10) / 10;
};

// 에스크로는 플랫폼 수익 구조가 아닌 신뢰 인프라입니다.
// 플랫폼은 법적 중재자가 아닌 구조적 신뢰 제공자입니다.
// 신뢰는 아래 구조로 해결됩니다:
// - 단계별 승인 / 업로드 기록 / 에스크로 보관 / 지급 조건 / 진행 기록
export const calculateStagePayments = (bidAmount) => {
  if (!bidAmount || isNaN(bidAmount)) return [];
  const defs = [
    { name: "자재비 선지급", percent: 10, autoRelease: true },
    { name: "착공 확인",    percent: 20, autoRelease: false },
    { name: "중간점검",     percent: 40, autoRelease: false },
    { name: "완료 확인",    percent: 30, autoRelease: false },
  ];
  return defs.map(({ name, percent, autoRelease }) => {
    const amount = Math.round(bidAmount * percent / 100);
    return {
      name,
      percent,
      amount,
      autoRelease,
      companyReceiveAmount: Math.round(amount * (1 - feeConfig.companyRate * (1 + feeConfig.vatRate)) * 10) / 10,
      released: false,
    };
  });
};

// Company receives stage amount minus 4% platform fee (VAT inclusive)
export const calculateCompanyReceive = (stageAmount) => {
  return Math.round(stageAmount * (1 - feeConfig.companyRate * (1 + feeConfig.vatRate)) * 10) / 10;
};

export const calcCustomerFee = (amount) => {
  const rate = feeConfig.customerRate;
  const vat = rate * feeConfig.vatRate;
  return Math.round(amount * (rate + vat) * 10) / 10;
};

export const calcCompanyFee = (amount) => {
  const rate = feeConfig.companyRate;
  const vat = rate * feeConfig.vatRate;
  return Math.round(amount * (rate + vat) * 10) / 10;
};

// Deposit required for a given badge tier, with optional insurance discount (30% → 20%)
export const calculateDeposit = (badge, hasInsurance) => {
  const base = { basic: 150, standard: 300, premium: 600, enterprise: 1500, signature: 3000 };
  const amount = base[badge] ?? base.basic;
  return hasInsurance ? Math.round(amount * 2 / 3) : amount;
};

// ── 공간온도 (Space Temperature) ──────────────────────────────────────────────

export const TEMP_DEFAULT = 36.5;
export const TEMP_MIN     = 0;
export const TEMP_MAX     = 99;

// Deltas for each event type
export const TEMP_DELTAS = {
  review5:      +1.0,  // 5점 리뷰
  review4:      +0.5,  // 4점 리뷰
  review3:       0.0,  // 3점 리뷰
  review2:      -1.0,  // 2점 이하
  photoBonus:   +0.3,  // 사진 포함 리뷰 추가
  jobComplete:  +0.5,  // 공사 완료
  dispute:      -2.0,  // 분쟁 발생
  disputeResolved: +1.0, // 분쟁 해결
};

// Returns the temp delta for a submitted review
export const calcTempDelta = (rating, hasPhoto = false) => {
  let delta = 0;
  if (rating >= 5)      delta = TEMP_DELTAS.review5;
  else if (rating >= 4) delta = TEMP_DELTAS.review4;
  else if (rating >= 3) delta = TEMP_DELTAS.review3;
  else                  delta = TEMP_DELTAS.review2;
  if (hasPhoto) delta += TEMP_DELTAS.photoBonus;
  return Math.round(delta * 10) / 10;
};

// Clamp a temperature value to valid range
export const clampTemp = (t) =>
  Math.round(Math.min(TEMP_MAX, Math.max(TEMP_MIN, t)) * 10) / 10;
