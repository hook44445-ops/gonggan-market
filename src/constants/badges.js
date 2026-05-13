export const BADGES = {
  basic:      { label: "Basic",      maxAmount: 500,   depositBase: 150,  color: "#8A837A", bg: "#F5F0EB" },
  standard:   { label: "Standard",   maxAmount: 1000,  depositBase: 300,  color: "#D95F00", bg: "#FDF3EC" },
  premium:    { label: "Premium",    maxAmount: 2000,  depositBase: 600,  color: "#E8A000", bg: "#FDF8EC" },
  enterprise: { label: "Enterprise", maxAmount: 5000,  depositBase: 1500, color: "#1A2744", bg: "#EEF1F8" },
  signature:  { label: "Signature",  maxAmount: 10000, depositBase: 3000, color: "#6B21A8", bg: "#F5F0FF" },
};

// Deposit rate drops from 30% → 20% when insurance is submitted
export const DEPOSIT_RATE_BASE      = 30;
export const DEPOSIT_RATE_INSURANCE = 20;
