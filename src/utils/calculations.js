export const fmtMoney = (amount) => {
  if (amount == null || isNaN(amount)) return "—";
  const rounded = Math.round(amount * 10) / 10;
  return `${rounded.toLocaleString()}만원`;
};

// Customer pays bid amount + 3% escrow fee
export const calculateCustomerTotal = (bidAmount) => {
  return Math.round(bidAmount * 1.03 * 10) / 10;
};

// Returns 3-stage payment schedule based on bid amount.
// Each stage includes what the company actually receives (after 4% platform fee).
export const calculateStagePayments = (bidAmount) => {
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
