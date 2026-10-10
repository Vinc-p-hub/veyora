// Server-side commerce engine: currencies, countries, margins, installments, offer selection.
// This is the authoritative pricing module — the frontend mirrors it for display only.

export const MARGIN_RATE = 0.3;
export const FINANCE_FEE_RATE = 0.1;

export const CURRENCIES = {
  USD: { code: "USD", symbol: "$", rate: 1 },
  EUR: { code: "EUR", symbol: "€", rate: 0.92 },
  AED: { code: "AED", symbol: "د.إ", rate: 3.67 },
  GBP: { code: "GBP", symbol: "£", rate: 0.79 },
  NGN: { code: "NGN", symbol: "₦", rate: 1580 },
  XOF: { code: "XOF", symbol: "CFA", rate: 605 },
  XAF: { code: "XAF", symbol: "FCFA", rate: 605 },
  CAD: { code: "CAD", symbol: "C$", rate: 1.36 },
  AUD: { code: "AUD", symbol: "A$", rate: 1.52 },
  // Global crawler network — supplier currencies of the newly integrated
  // sources (units per 1 USD). Kept in one place so the whole pipeline
  // (ingestion → USD base → customer currency) converts consistently.
  QAR: { code: "QAR", symbol: "QR", rate: 3.64 },
  SAR: { code: "SAR", symbol: "SR", rate: 3.75 },
  ZAR: { code: "ZAR", symbol: "R", rate: 18.3 },
  DKK: { code: "DKK", symbol: "kr", rate: 6.9 },
  SEK: { code: "SEK", symbol: "kr", rate: 10.6 },
  NOK: { code: "NOK", symbol: "kr", rate: 10.8 },
  PLN: { code: "PLN", symbol: "zł", rate: 4.05 },
  CHF: { code: "CHF", symbol: "CHF", rate: 0.88 },
  RON: { code: "RON", symbol: "lei", rate: 4.6 },
  SGD: { code: "SGD", symbol: "S$", rate: 1.34 },
  TWD: { code: "TWD", symbol: "NT$", rate: 32.3 },
  JPY: { code: "JPY", symbol: "¥", rate: 152 },
  TRY: { code: "TRY", symbol: "₺", rate: 34 },
  INR: { code: "INR", symbol: "₹", rate: 84 },
  BRL: { code: "BRL", symbol: "R$", rate: 5.5 },
  MXN: { code: "MXN", symbol: "MX$", rate: 18.5 },
  HKD: { code: "HKD", symbol: "HK$", rate: 7.8 },
  NZD: { code: "NZD", symbol: "NZ$", rate: 1.64 },
};
export const SUPPORTED_CURRENCIES = Object.keys(CURRENCIES);

export const COUNTRIES = [
  { code: "US", currency: "USD", taxRate: 0, shipping: 0 },
  { code: "AE", currency: "AED", taxRate: 0.05, shipping: 15 },
  { code: "GB", currency: "GBP", taxRate: 0.2, shipping: 12 },
  { code: "FR", currency: "EUR", taxRate: 0.2, shipping: 14 },
  { code: "NG", currency: "NGN", taxRate: 0.075, shipping: 25 },
  { code: "CA", currency: "CAD", taxRate: 0.13, shipping: 12 },
  { code: "AU", currency: "AUD", taxRate: 0.1, shipping: 18 },
  { code: "SN", currency: "XOF", taxRate: 0.18, shipping: 30 },
];

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function getCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
}

export function convertPrice(usdAmount, currencyCode) {
  const c = CURRENCIES[currencyCode] || CURRENCIES.USD;
  return round2(usdAmount * c.rate);
}

export function computeCustomerPrice(sourcePrice, marginRate = MARGIN_RATE) {
  return round2(sourcePrice * (1 + marginRate));
}

export function buildInstallmentPlan(customerPrice, installmentCount = 5, downPercent = 0.15) {
  const downPayment = round2(customerPrice * downPercent);
  const remaining = round2(customerPrice - downPayment);
  const installmentAmount = installmentCount > 0 ? round2(remaining / installmentCount) : 0;
  const totalPaid = round2(downPayment + installmentAmount * installmentCount);
  return { downPayment, remaining, installmentCount, installmentAmount, totalPaid };
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

// OfferSelectionService — best eligible offer, not blindly the cheapest.
export function selectBestOffer(offers, countryCode) {
  const eligible = (offers || []).filter(
    (o) =>
      (!o.countries || o.countries.length === 0 || o.countries.includes(countryCode)) &&
      o.stock_status !== "OUT_OF_STOCK" &&
      o.source_price > 0
  );
  if (!eligible.length) return null;
  const scored = eligible.map((o) => ({
    offer: o,
    cost:
      o.source_price +
      (o.shipping_cost || 0) +
      (100 - (o.supplier_score || 80)) * 0.3 +
      (o.delivery_days || 7) * 0.2 -
      (o.stock_status === "IN_STOCK" ? 2 : 0),
  }));
  scored.sort((a, b) => a.cost - b.cost);
  return scored[0].offer;
}