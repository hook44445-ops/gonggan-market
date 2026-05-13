export const BADGES = {
  basic:      { label: "Basic",      maxAmount: 500,   depositBase: 150,  color: "#7A8A7E", bg: "#F0EDE8" },
  standard:   { label: "Standard",   maxAmount: 1000,  depositBase: 300,  color: "#2E5F4B", bg: "#EAF2EE" },
  premium:    { label: "Premium",    maxAmount: 2000,  depositBase: 600,  color: "#C8A15A", bg: "#FBF5E8" },
  enterprise: { label: "Enterprise", maxAmount: 5000,  depositBase: 1500, color: "#1F2A24", bg: "#EAF2EE" },
  signature:  { label: "Signature",  maxAmount: 10000, depositBase: 3000, color: "#6B21A8", bg: "#F5F0FF" },
};

// Deposit rate drops from 30% → 20% when insurance is submitted
export const DEPOSIT_RATE_BASE      = 30;
export const DEPOSIT_RATE_INSURANCE = 20;
