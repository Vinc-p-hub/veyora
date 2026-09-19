// Pricing & Installment Engine — the financial core of VEYRO.
// Source price → customer price (margin) → installment plan. Never hide the total.

export const MARGIN_RATE = 0.3; // 30% VEYRO margin
export const FINANCE_FEE_RATE = 0.1; // 10% financing cost spread across installments

// Convert a USD customer price to the active currency.
export function convertPrice(usdAmount, currency) {
  const rate = currency ? currency.rate : 1;
  return Math.round(usdAmount * rate * 100) / 100;
}

export function formatPrice(usdAmount, currency) {
  const value = convertPrice(usdAmount, currency);
  const sym = currency?.symbol || "$";
  return `${sym}${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Derive customer price from source price using margin.
export function computeCustomerPrice(sourcePrice) {
  return Math.round(sourcePrice * (1 + MARGIN_RATE) * 100) / 100;
}

// Installment plan: down payment today + N equal monthly payments.
// Total paid always equals customer price (no hidden cost beyond stated financing).
export function buildInstallmentPlan(customerPrice, installmentCount = 5, downPercent = 0.15) {
  const downPayment = Math.round(customerPrice * downPercent * 100) / 100;
  const remaining = Math.round((customerPrice - downPayment) * 100) / 100;
  const perInstallment =
    installmentCount > 0 ? Math.round((remaining / installmentCount) * 100) / 100 : 0;
  const totalPaid = Math.round((downPayment + perInstallment * installmentCount) * 100) / 100;
  return {
    downPayment,
    remaining,
    installmentCount,
    installmentAmount: perInstallment,
    totalPaid,
  };
}

export const PLAN_OPTIONS = [
  { id: "pay_now", label: "Pay in full", installments: 0, downPercent: 1 },
  { id: "plan_2", label: "2 payments", installments: 2, downPercent: 0.5 },
  { id: "plan_3", label: "3 payments", installments: 3, downPercent: 0.33 },
  { id: "plan_5", label: "5 payments", installments: 5, downPercent: 0.15 },
];

export function getPlanForOption(customerPrice, optionId) {
  const opt = PLAN_OPTIONS.find((o) => o.id === optionId) || PLAN_OPTIONS[3];
  return buildInstallmentPlan(customerPrice, opt.installments, opt.downPercent);
}