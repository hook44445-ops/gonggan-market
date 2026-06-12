export const BADGES = {
  basic:      { label: "베이직",       icon: "🥉", maxAmount: 500,   depositBase: 150,  deposit: 150,  maxJob: "500만원",   color: "#A0714F", bg: "#F5EDE6", grad: "linear-gradient(135deg,#A0714F,#7A5230)" },
  standard:   { label: "스탠다드",     icon: "🥈", maxAmount: 1000,  depositBase: 300,  deposit: 300,  maxJob: "1,000만원", color: "#5A6370", bg: "#EFEFF2", grad: "linear-gradient(135deg,#6B7280,#4B5563)" },
  premium:    { label: "프리미엄",     icon: "🥇", maxAmount: 2000,  depositBase: 600,  deposit: 600,  maxJob: "2,000만원", color: "#B8860B", bg: "#FBF5E0", grad: "linear-gradient(135deg,#C8A15A,#A07830)" },
  enterprise: { label: "마스터",       icon: "💎", maxAmount: 5000,  depositBase: 1500, deposit: 1500, maxJob: "5,000만원", color: "#0090AA", bg: "#E5F6FA", grad: "linear-gradient(135deg,#0097B2,#006E84)" },
  signature:  { label: "시그니처",     icon: "👑", maxAmount: 10000, depositBase: 3000, deposit: 3000, maxJob: "1억원",     color: "#7C3AED", bg: "#F5F0FF", grad: "linear-gradient(135deg,#7C3AED,#5B21B6)" },
};

// ── 공간뱃지예치보증금 정책 (단일 소스) ───────────────────────────────────────────────
// 수주 한도(BADGES.maxAmount, 만원) 대비:
//   · 시공보험 가입 업체  → 10%
//   · 시공보험 미가입 업체 → 20%
// 표시/상태/관리값 전용 — 실제 입·출금 처리 없음.
export const DEPOSIT_RATE_INSURED   = 0.10;
export const DEPOSIT_RATE_UNINSURED = 0.20;

// 보증예치 비율(%) — 보험 가입 여부 기준.
export const depositRatePct = (hasInsurance) => (hasInsurance ? 10 : 20);

// 필요 공간뱃지예치보증금(만원) — 등급 수주한도 × 비율. badge 미지정 시 basic.
export const requiredDeposit = (badge, hasInsurance) => {
  const b = BADGES[badge] ?? BADGES.basic;
  const rate = hasInsurance ? DEPOSIT_RATE_INSURED : DEPOSIT_RATE_UNINSURED;
  return Math.round(b.maxAmount * rate);
};

// 등급 순서(승급 단계용).
export const BADGE_ORDER = ["basic", "standard", "premium", "enterprise", "signature"];

export const BADGE_TIERS = {
  BASIC:      { label: "Basic",      maxProject: 5000000,   deposit: 1500000  },
  STANDARD:   { label: "Standard",   maxProject: 10000000,  deposit: 3000000  },
  PREMIUM:    { label: "Premium",    maxProject: 20000000,  deposit: 6000000  },
  ENTERPRISE: { label: "Enterprise", maxProject: 50000000,  deposit: 15000000 },
  SIGNATURE:  { label: "Signature",  maxProject: 100000000, deposit: 30000000 },
};

// Deposit rate drops from 30% → 20% when insurance is submitted
export const DEPOSIT_RATE_BASE      = 30;
export const DEPOSIT_RATE_INSURANCE = 20;
