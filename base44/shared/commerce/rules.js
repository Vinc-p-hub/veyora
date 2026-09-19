// Central PRICING & BUSINESS RULES engine — every financial calculation in VEYRO
// derives from this module, driven by the Super Admin's PricingConfig record.
// The frontend only ever mirrors the *display* subset (publicDisplayConfig).

export const DEFAULT_PRICING_CONFIG = {
  margin_percent: 30,
  payment_fee_percent: 0,
  financing_fee_percent: 0,
  shipping_fee_default: 0,
  partner_commission_percent: 10,
  first_installment_percent: 15,
  default_plan_id: "plan_5",
  rounding: "cent", // cent | integer | ten
  installment_plans: [
    { id: "pay_now", label: "Pay in full", installments: 0, down_percent: 100 },
    { id: "plan_2", label: "2 payments", installments: 2, down_percent: 50 },
    { id: "plan_3", label: "3 payments", installments: 3, down_percent: 33 },
    { id: "plan_5", label: "5 payments", installments: 5, down_percent: 15 },
    { id: "plan_6", label: "6 payments", installments: 6, down_percent: 15 },
  ],
  category_rules: {}, // { "Laptops": { margin_percent: 25 } }
  country_rules: {}, // { "AE": { margin_percent: 32, shipping_fee: 15, tax_rate: 0.05 } }
  supplier_rules: {}, // { "<source_id>": { margin_percent: 35 } }
};

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

// Merge a stored/partial config over the defaults so every consumer always
// sees a complete config even when the record predates a new field.
export function mergeConfig(partial) {
  const p = partial || {};
  const out = { ...DEFAULT_PRICING_CONFIG };
  for (const key of ["margin_percent", "payment_fee_percent", "financing_fee_percent",
    "shipping_fee_default", "partner_commission_percent", "first_installment_percent"]) {
    if (isNum(p[key])) out[key] = p[key];
  }
  if (typeof p.default_plan_id === "string" && p.default_plan_id) out.default_plan_id = p.default_plan_id;
  if (["cent", "integer", "ten"].includes(p.rounding)) out.rounding = p.rounding;
  if (Array.isArray(p.installment_plans) && p.installment_plans.length) {
    out.installment_plans = p.installment_plans
      .filter((pl) => pl && typeof pl.id === "string" && pl.id && Number.isInteger(pl.installments) && pl.installments >= 0 && pl.installments <= 24)
      .map((pl) => ({
        id: pl.id,
        label: String(pl.label || pl.id),
        installments: pl.installments,
        down_percent: isNum(pl.down_percent) ? pl.down_percent : DEFAULT_PRICING_CONFIG.first_installment_percent,
      }));
  }
  for (const key of ["category_rules", "country_rules", "supplier_rules"]) {
    if (p[key] && typeof p[key] === "object" && !Array.isArray(p[key])) out[key] = p[key];
  }
  return out;
}

export function applyRounding(value, mode) {
  const n = Number(value) || 0;
  if (mode === "integer") return Math.round(n);
  if (mode === "ten") return Math.round(n / 10) * 10;
  return Math.round(n * 100) / 100; // cent (default)
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Effective rules for one computation. Precedence: supplier > country > category > global.
export function resolveRules(config, { category, country_code, source_id } = {}) {
  const cfg = mergeConfig(config);
  const cat = category && cfg.category_rules[category] ? cfg.category_rules[category] : {};
  const ctry = country_code && cfg.country_rules[country_code] ? cfg.country_rules[country_code] : {};
  const sup = source_id && cfg.supplier_rules[source_id] ? cfg.supplier_rules[source_id] : {};
  const pick = (...vals) => vals.find((v) => isNum(v));
  return {
    margin_percent: pick(sup.margin_percent, ctry.margin_percent, cat.margin_percent, cfg.margin_percent),
    payment_fee_percent: pick(ctry.payment_fee_percent, cfg.payment_fee_percent),
    financing_fee_percent: pick(ctry.financing_fee_percent, cfg.financing_fee_percent),
    shipping_fee: pick(ctry.shipping_fee, cfg.shipping_fee_default),
    tax_rate: isNum(ctry.tax_rate) ? ctry.tax_rate : 0,
    partner_commission_percent: pick(sup.partner_commission_percent, cfg.partner_commission_percent),
    rounding: cfg.rounding,
  };
}

// Supplier price → margin → fees → customer price → VEYRO net margin.
// `installments=true` applies the financing fee (a plan-specific cost).
export function computePriceChain(supplierPrice, rules, { installments = false } = {}) {
  const base = Math.max(0, Number(supplierPrice) || 0);
  const margin_amount = (base * rules.margin_percent) / 100;
  const payment_fee = (base * rules.payment_fee_percent) / 100;
  const financing_fee = installments ? (base * rules.financing_fee_percent) / 100 : 0;
  const customer_price = applyRounding(base + margin_amount + payment_fee + financing_fee, rules.rounding);
  const partner_commission = (base * rules.partner_commission_percent) / 100;
  return {
    supplier_price: round2(base),
    margin_percent: rules.margin_percent,
    margin_amount: round2(margin_amount),
    payment_fee: round2(payment_fee),
    financing_fee: round2(financing_fee),
    customer_price,
    partner_commission: round2(partner_commission),
    veyro_margin: round2(customer_price - base - partner_commission),
    financing_fee_applied: installments,
  };
}

export function getPlanOptions(config) {
  return mergeConfig(config).installment_plans;
}

// First payment today + N equal payments, total ALWAYS exact and visible.
// The first payment absorbs the rounding remainder so total == customer price.
export function computePlanFromConfig(totalAmount, config, planId) {
  const cfg = mergeConfig(config);
  const plans = cfg.installment_plans;
  const plan = plans.find((p) => p.id === planId) || plans.find((p) => p.id === cfg.default_plan_id) || plans[0];
  const total = applyRounding(totalAmount, cfg.rounding);
  if (!plan || !plan.installments) {
    return { plan_id: plan ? plan.id : "pay_now", label: plan ? plan.label : "Pay in full", count: 0, first_payment: total, next_count: 0, next_amount: 0, total };
  }
  const firstRaw = (total * (isNum(plan.down_percent) ? plan.down_percent : cfg.first_installment_percent)) / 100;
  let next = applyRounding((total - applyRounding(firstRaw, cfg.rounding)) / plan.installments, cfg.rounding);
  if (next <= 0) next = applyRounding(total / (plan.installments + 1), cfg.rounding);
  const first = round2(total - next * plan.installments);
  const grandTotal = round2(first + next * plan.installments);
  return {
    plan_id: plan.id, label: plan.label,
    count: plan.installments, first_payment: first, next_count: plan.installments, next_amount: next,
    total: grandTotal,
    // legacy aliases (checkout, order records, older UI surfaces)
    downPayment: first, installmentCount: plan.installments, installmentAmount: next, totalPaid: grandTotal,
  };
}

// Display-only subset safe to expose to the storefront (no margins, no supplier data).
export function publicDisplayConfig(config) {
  const cfg = mergeConfig(config);
  return {
    installment_plans: cfg.installment_plans,
    default_plan_id: cfg.default_plan_id,
    first_installment_percent: cfg.first_installment_percent,
    financing_fee_percent: cfg.financing_fee_percent,
    rounding: cfg.rounding,
  };
}