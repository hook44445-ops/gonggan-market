export const BADGES = {
  basic:      { label: "베이직",       icon: "🥉", maxAmount: 500,   depositBase: 150,  deposit: 150,  maxJob: "500만원",   color: "#A0714F", bg: "#F5EDE6", grad: "linear-gradient(135deg,#A0714F,#7A5230)" },
  standard:   { label: "스탠다드",     icon: "🥈", maxAmount: 1000,  depositBase: 300,  deposit: 300,  maxJob: "1,000만원", color: "#5A6370", bg: "#EFEFF2", grad: "linear-gradient(135deg,#6B7280,#4B5563)" },
  premium:    { label: "프리미엄",     icon: "🥇", maxAmount: 2000,  depositBase: 600,  deposit: 600,  maxJob: "2,000만원", color: "#B8860B", bg: "#FBF5E0", grad: "linear-gradient(135deg,#C8A15A,#A07830)" },
  enterprise: { label: "엔터프라이즈", icon: "💎", maxAmount: 5000,  depositBase: 1500, deposit: 1500, maxJob: "5,000만원", color: "#0090AA", bg: "#E5F6FA", grad: "linear-gradient(135deg,#0097B2,#006E84)" },
  signature:  { label: "시그니처",     icon: "👑", maxAmount: 10000, depositBase: 3000, deposit: 3000, maxJob: "1억원",     color: "#7C3AED", bg: "#F5F0FF", grad: "linear-gradient(135deg,#7C3AED,#5B21B6)" },
};

// Deposit rate drops from 30% → 20% when insurance is submitted
export const DEPOSIT_RATE_BASE      = 30;
export const DEPOSIT_RATE_INSURANCE = 20;
