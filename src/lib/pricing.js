// Pricing & Installment display helpers — the financial core of VEYRO.
// The SERVER is the authority for every order price (checkoutRevalidate +
// pricingEngine). This module only mirrors the display subset of the rules
// (publicDisplayConfig) so cards and product pages can show the exact same
// plan structure the server will charge. Legacy exports below are kept for
// older display surfaces; new code uses buildPlanFromConfig.

export const MARGIN_RATE = 0.3;
export const FINANCE_FEE_RATE = 0.1;

// Mirror of the server's DEFAULT_PRICING_CONFIG display subset — used until
// the live config loads (PricingContext), and as a safe fallback.
export const DEFAULT_DISPLAY_CONFIG = {
  default_plan_id: "plan_5",
  first_installment_percent: 15,
  financing_fee_percent: 0,
  rounding: "cent",
  installment_plans: [
    { id: "pay_now", label: "Pay in full", installments: 0, down_percent: 100 },
    { id: "plan_2", label: "2 payments", installments: 2, down_percent: 50 },
    { id: "plan_3", label: "3 payments", installments: 3, down_percent: 33 },
    { id: "plan_5", label: "5 payments", installments: 5, down_percent: 15 },
    { id: "plan_6", label: "6 payments", installments: 6, down_percent: 15 },
  ],
};

export function applyRoundingLocal(value, mode) {
  const n = Number(value) || 0;
  if (mode === "integer") return Math.round(n);
  if (mode === "ten") return Math.round(n / 10) * 10;
  return Math.round(n * 100) / 100;
}

export function getPlanOptionsFromConfig(config) {
  const plans = (config && Array.isArray(config.installment_plans) && config.installment_plans.length)
    ? config.installment_plans
    : DEFAULT_DISPLAY_CONFIG.installment_plans;
  return plans.filter((p) => p && p.id && Number.isInteger(p.installments) && p.installments >= 0 && p.installments <= 24);
}

// First payment today + N equal payments — exact mirror of the server formula.
// The first payment absorbs the rounding remainder so the total always matches.
export function buildPlanFromConfig(totalAmount, planId, config) {
  const cfg = config || DEFAULT_DISPLAY_CONFIG;
  const plans = getPlanOptionsFromConfig(cfg);
  const plan = plans.find((p) => p.id === planId) ||
    plans.find((p) => p.id === cfg.default_plan_id) || plans[0];
  const total = applyRoundingLocal(totalAmount, cfg.rounding);
  if (!plan || !plan.installments) {
    return { plan_id: plan ? plan.id : "pay_now", label: plan ? plan.label : "Pay in full", count: 0, first_payment: total, next_count: 0, next_amount: 0, total };
  }
  const downPercent = typeof plan.down_percent === "number" ? plan.down_percent : (cfg.first_installment_percent || 15);
  let next = applyRoundingLocal((total - applyRoundingLocal((total * downPercent) / 100, cfg.rounding)) / plan.installments, cfg.rounding);
  if (next <= 0) next = applyRoundingLocal(total / (plan.installments + 1), cfg.rounding);
  const first = Math.round((total - next * plan.installments) * 100) / 100;
  return {
    plan_id: plan.id, label: plan.label,
    count: plan.installments, first_payment: first, next_count: plan.installments, next_amount: next,
    total: Math.round((first + next * plan.installments) * 100) / 100,
  };
}

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

// Legacy display helpers (used by the financing calculator and older surfaces).
export function computeCustomerPrice(sourcePrice) {
  return Math.round(sourcePrice * (1 + MARGIN_RATE) * 100) / 100;
}

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