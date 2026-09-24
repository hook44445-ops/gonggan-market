export const BADGES = {
  basic:      { label: "베이직",       icon: "🥉", maxAmount: 500,   depositBase: 50, deposit: 50,  maxJob: "500만원",   color: "#A0714F", bg: "#F5EDE6", grad: "linear-gradient(135deg,#A0714F,#7A5230)" },
  standard:   { label: "스탠다드",     icon: "🥈", maxAmount: 1000,  depositBase: 100, deposit: 100,  maxJob: "1,000만원", color: "#5A6370", bg: "#EFEFF2", grad: "linear-gradient(135deg,#6B7280,#4B5563)" },
  premium:    { label: "프리미엄",     icon: "🥇", maxAmount: 2000,  depositBase: 200, deposit: 200,  maxJob: "2,000만원", color: "#B8860B", bg: "#FBF5E0", grad: "linear-gradient(135deg,#C8A15A,#A07830)" },
  enterprise: { label: "마스터",       icon: "💎", maxAmount: 5000,  depositBase: 500, deposit: 500, maxJob: "5,000만원", color: "#0090AA", bg: "#E5F6FA", grad: "linear-gradient(135deg,#0097B2,#006E84)" },
  signature:  { label: "시그니처",     icon: "👑", maxAmount: 10000, depositBase: 1000, deposit: 1000, maxJob: "1억원",     color: "#7C3AED", bg: "#F5F0FF", grad: "linear-gradient(135deg,#7C3AED,#5B21B6)" },
};

// ── 공간보증 보증금 정책 (단일 소스) ────────────────────────────────────────────
// 보증금 = 공사 금액의 10%(시공보험 있음) / 20%(없음) — 대표 확정 2026-09-24.
//   10% 는 «가장 큰 공사의 계약금»과 같다 — 업체가 계약금만 받고 사라져도 돌려줄 수 있다.
//   보험이 없으면 누수·화재 같은 공사 사고를 막아 줄 장치가 없어 두 배를 건다.
//   (보험 없는 길의 수주 한도는 1,000만원까지 — lib/partnerTier.js)
//   예전엔 비율이 세 벌 섞여 있었다(등급표 30%, BADGE_TIERS 30→20%). 이 둘은 지웠다.
// 표시/상태/관리값 전용 — 실제 입·출금 처리 없음.
export const DEPOSIT_RATE_INSURED   = 0.10;
export const DEPOSIT_RATE_UNINSURED = 0.20;

// 보증예치 비율(%) — 보험 가입 여부 기준.
export const depositRatePct = (hasInsurance) => (hasInsurance ? 10 : 20);

// 필요 보증금(만원) — 등급 수주한도 × 비율. badge 미지정 시 basic.
export const requiredDeposit = (badge, hasInsurance) => {
  const b = BADGES[badge] ?? BADGES.basic;
  return Math.round(b.maxAmount * (hasInsurance ? DEPOSIT_RATE_INSURED : DEPOSIT_RATE_UNINSURED));
};

// 등급 순서(승급 단계용).
export const BADGE_ORDER = ["basic", "standard", "premium", "enterprise", "signature"];
