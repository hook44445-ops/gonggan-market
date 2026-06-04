// 수수료 정책 (최종 확정)
//  · 고객: "공간안전결제 에스크로 수수료" 3.7% (VAT 포함, 고정) — 토스페이먼츠 에스크로
//  · 업체: "공간멤버십파트너 수수료" — 가입일(companies.created_at) 기준 단계형
//          0~30일 0% → 31~60일 2.2% → 61일~ 4.4%
const feeConfig = {
  customerRate: 0.037,   // VAT 포함, 고정
  vatRate: 0.1,          // (legacy 계산 호환용)
};

// 고객 에스크로 수수료율 — 폴백 기본값(3.7%).
// ⚠️ 실제 결제 요율의 source of truth 는 DB(payment_fee_rules, migration 031)이며
//    결제 화면은 services/payment 로 규칙에서 요율을 조회한다. 이 상수는 규칙 미조회 시
//    폴백 및 표시용 계산기(EscrowCalculator 등)의 기본값으로만 사용한다.
export const CUSTOMER_ESCROW_RATE = 0.037;

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

// ── 공간멤버십파트너 수수료 (업체) — 가입일 기준 단계형 ───────────────────────
// created_at 으로부터 경과 일수 (UTC 기준, NaN/타임존 안전). fallback: 0일(무료 구간).
export const daysSinceJoin = (createdAt) => {
  if (!createdAt) return 0;
  const joined = new Date(createdAt);
  const t = joined.getTime();
  if (!Number.isFinite(t)) return 0;
  const diffMs = Date.now() - t;
  if (!Number.isFinite(diffMs) || diffMs < 0) return 0;
  return Math.floor(diffMs / 86400000); // ms → day
};

// 경과 일수 → 멤버십 수수료율(%) : 0~30=0, 31~60=2.2, 61~=4.4
export const getMembershipRate = (days) => {
  const d = Number(days);
  if (!Number.isFinite(d) || d <= 30) return 0;
  if (d <= 60) return 2.2;
  return 4.4;
};

// companies.created_at → 멤버십 수수료율(%) (편의 래퍼)
export const getMembershipRateByCreatedAt = (createdAt) =>
  getMembershipRate(daysSinceJoin(createdAt));

// 멤버십 단계 메타 (배너/안내용)
export const MEMBERSHIP_TIERS = [
  { label: "가입 후 1개월",  range: "0~30일",  rate: 0,   note: "🎉 무료" },
  { label: "가입 후 2개월",  range: "31~60일", rate: 2.2, note: "" },
  { label: "가입 후 3개월~", range: "61일~",   rate: 4.4, note: "" },
];

// Customer pays bid amount + 3.7% escrow fee (VAT 포함, 고정)
export const calculateCustomerTotal = (bidAmount) => {
  if (!bidAmount || isNaN(bidAmount)) return 0;
  const fee = Math.round(bidAmount * CUSTOMER_ESCROW_RATE * 10) / 10;
  return Math.round((bidAmount + fee) * 10) / 10;
};

// 에스크로는 플랫폼 수익 구조가 아닌 신뢰 인프라입니다.
// 플랫폼은 법적 중재자가 아닌 구조적 신뢰 제공자입니다.
// 신뢰는 아래 구조로 해결됩니다:
// - 단계별 승인 / 업로드 기록 / 에스크로 보관 / 지급 조건 / 진행 기록
// companyCreatedAt 전달 시 멤버십 수수료(0/2.2/4.4%)로 수령액 계산.
// 미전달(unknown) 시 보수적으로 최고요율(4.4%) 적용 — 과대 표기 방지.
export const calculateStagePayments = (bidAmount, companyCreatedAt = undefined) => {
  if (!bidAmount || isNaN(bidAmount)) return [];
  const rate = (companyCreatedAt === undefined ? 4.4 : getMembershipRateByCreatedAt(companyCreatedAt)) / 100;
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
      companyReceiveAmount: Math.round(amount * (1 - rate) * 10) / 10,
      released: false,
    };
  });
};

// Company receives stage amount minus 공간멤버십파트너 수수료(0/2.2/4.4%).
export const calculateCompanyReceive = (stageAmount, companyCreatedAt = undefined) => {
  const rate = (companyCreatedAt === undefined ? 4.4 : getMembershipRateByCreatedAt(companyCreatedAt)) / 100;
  return Math.round(stageAmount * (1 - rate) * 10) / 10;
};

// 고객 에스크로 수수료(3.7%, VAT 포함, 고정)
export const calcCustomerFee = (amount) => {
  return Math.round(amount * CUSTOMER_ESCROW_RATE * 10) / 10;
};

// 업체 멤버십 수수료(가입일 기준). companyCreatedAt 미전달 시 최고요율(4.4%).
export const calcCompanyFee = (amount, companyCreatedAt = undefined) => {
  const rate = (companyCreatedAt === undefined ? 4.4 : getMembershipRateByCreatedAt(companyCreatedAt)) / 100;
  return Math.round(amount * rate * 10) / 10;
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
