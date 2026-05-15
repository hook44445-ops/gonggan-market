export const fmtMoney = (amount) => {
  if (amount == null || isNaN(amount)) return "—";
  const rounded = Math.round(amount * 10) / 10;
  return `${rounded.toLocaleString()}만원`;
};

// Customer pays bid amount + 3% escrow fee
export const calculateCustomerTotal = (bidAmount) => {
  if (!bidAmount || isNaN(bidAmount)) return 0;
  return Math.round(bidAmount * 1.03 * 10) / 10;
};

// Returns 3-stage payment schedule based on bid amount.
// Each stage includes what the company actually receives (after 4% platform fee).
export const calculateStagePayments = (bidAmount) => {
  if (!bidAmount || isNaN(bidAmount)) return [];
  const defs = [
    { name: "착공",    percent: 30 },
    { name: "중간점검", percent: 40 },
    { name: "완료",    percent: 30 },
  ];
  return defs.map(({ name, percent }) => {
    const amount = Math.round(bidAmount * percent / 100);
    return {
      name,
      percent,
      amount,
      companyReceiveAmount: Math.round(amount * 0.96 * 10) / 10,
      released: false,
    };
  });
};

// Company receives stage amount minus 4% platform fee
export const calculateCompanyReceive = (stageAmount) => {
  return Math.round(stageAmount * 0.96 * 10) / 10;
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
