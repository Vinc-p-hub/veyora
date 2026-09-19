// Country & currency REGISTRY — international by design.
// Defaults below ship in code; the Super Admin can add or override any country or
// currency as DATA (CurrencyRate / CountryConfig entities) without touching this file.
// The RegionContext merges those records into this registry at runtime.

export const CURRENCIES = {
  USD: { code: "USD", symbol: "$", rate: 1 },
  EUR: { code: "EUR", symbol: "€", rate: 0.92 },
  GBP: { code: "GBP", symbol: "£", rate: 0.79 },
  AED: { code: "AED", symbol: "د.إ", rate: 3.67 },
  SAR: { code: "SAR", symbol: "ر.س", rate: 3.75 },
  CAD: { code: "CAD", symbol: "C$", rate: 1.36 },
  AUD: { code: "AUD", symbol: "A$", rate: 1.52 },
  CHF: { code: "CHF", symbol: "CHF", rate: 0.88 },
  JPY: { code: "JPY", symbol: "¥", rate: 155 },
  CNY: { code: "CNY", symbol: "¥", rate: 7.2 },
  INR: { code: "INR", symbol: "₹", rate: 84 },
  NGN: { code: "NGN", symbol: "₦", rate: 1580 },
  XOF: { code: "XOF", symbol: "CFA", rate: 605 },
  XAF: { code: "XAF", symbol: "FCFA", rate: 605 },
  ZAR: { code: "ZAR", symbol: "R", rate: 18 },
  BRL: { code: "BRL", symbol: "R$", rate: 5.4 },
  MXN: { code: "MXN", symbol: "MX$", rate: 20 },
};

export const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD", flag: "🇺🇸", shipping: 0, taxRate: 0.0, providers: ["stripe", "crypto"] },
  { code: "AE", name: "United Arab Emirates", currency: "AED", flag: "🇦🇪", shipping: 15, taxRate: 0.05, providers: ["stripe", "paystack", "crypto"] },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", flag: "🇸🇦", shipping: 15, taxRate: 0.15, providers: ["stripe", "crypto"] },
  { code: "GB", name: "United Kingdom", currency: "GBP", flag: "🇬🇧", shipping: 12, taxRate: 0.2, providers: ["stripe", "crypto"] },
  { code: "FR", name: "France", currency: "EUR", flag: "🇫🇷", shipping: 14, taxRate: 0.2, providers: ["stripe", "crypto"] },
  { code: "DE", name: "Germany", currency: "EUR", flag: "🇩🇪", shipping: 14, taxRate: 0.19, providers: ["stripe", "crypto"] },
  { code: "ES", name: "Spain", currency: "EUR", flag: "🇪🇸", shipping: 14, taxRate: 0.21, providers: ["stripe", "crypto"] },
  { code: "PT", name: "Portugal", currency: "EUR", flag: "🇵🇹", shipping: 14, taxRate: 0.23, providers: ["stripe", "crypto"] },
  { code: "IT", name: "Italy", currency: "EUR", flag: "🇮🇹", shipping: 14, taxRate: 0.22, providers: ["stripe", "crypto"] },
  { code: "CA", name: "Canada", currency: "CAD", flag: "🇨🇦", shipping: 12, taxRate: 0.13, providers: ["stripe", "crypto"] },
  { code: "AU", name: "Australia", currency: "AUD", flag: "🇦🇺", shipping: 18, taxRate: 0.1, providers: ["stripe", "crypto"] },
  { code: "CH", name: "Switzerland", currency: "CHF", flag: "🇨🇭", shipping: 16, taxRate: 0.081, providers: ["stripe", "crypto"] },
  { code: "JP", name: "Japan", currency: "JPY", flag: "🇯🇵", shipping: 20, taxRate: 0.1, providers: ["stripe", "crypto"] },
  { code: "CN", name: "China", currency: "CNY", flag: "🇨🇳", shipping: 18, taxRate: 0.13, providers: ["alipay", "crypto"] },
  { code: "IN", name: "India", currency: "INR", flag: "🇮🇳", shipping: 18, taxRate: 0.18, providers: ["stripe", "paystack", "crypto"] },
  { code: "NG", name: "Nigeria", currency: "NGN", flag: "🇳🇬", shipping: 25, taxRate: 0.075, providers: ["paystack", "payunit", "crypto"] },
  { code: "SN", name: "Senegal", currency: "XOF", flag: "🇸🇳", shipping: 30, taxRate: 0.18, providers: ["payunit", "crypto"] },
  { code: "ZA", name: "South Africa", currency: "ZAR", flag: "🇿🇦", shipping: 28, taxRate: 0.15, providers: ["paystack", "stripe", "crypto"] },
  { code: "BR", name: "Brazil", currency: "BRL", flag: "🇧🇷", shipping: 25, taxRate: 0.17, providers: ["stripe", "crypto"] },
  { code: "MX", name: "Mexico", currency: "MXN", flag: "🇲🇽", shipping: 22, taxRate: 0.16, providers: ["stripe", "crypto"] },
];

export const PAYMENT_PROVIDERS = {
  stripe: { id: "stripe", name: "Stripe", desc: "Card / Apple Pay / Google Pay", badge: "Global" },
  paystack: { id: "paystack", name: "Paystack", desc: "Card / Bank / USSD", badge: "Africa" },
  payunit: { id: "payunit", name: "PayUnit", desc: "Mobile Money / Card", badge: "Central Africa" },
  alipay: { id: "alipay", name: "Alipay", desc: "Alipay wallet", badge: "China" },
  crypto: { id: "crypto", name: "Crypto", desc: "USDT / BTC / ETH", badge: "On-chain" },
};

export const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
];

// --- registry: runtime overrides managed by the Super Admin (data, not code) ---

export function registerCurrency(code, data) {
  if (!code || typeof data.rate !== "number") return;
  CURRENCIES[code.toUpperCase()] = {
    code: code.toUpperCase(),
    symbol: data.symbol || CURRENCIES[code.toUpperCase()]?.symbol || "$",
    rate: data.rate,
  };
}

export function registerCountry(cfg) {
  if (!cfg || !cfg.code) return;
  const code = String(cfg.code).toUpperCase();
  // Mutate the exported array in place (its binding is a const) so every
  // consumer holding a reference to COUNTRIES sees the override immediately.
  const entry = {
    code,
    name: cfg.name || code,
    currency: (cfg.currency || "USD").toUpperCase(),
    flag: cfg.flag || "🌍",
    shipping: typeof cfg.shipping === "number" ? cfg.shipping : 0,
    taxRate: typeof cfg.taxRate === "number" ? cfg.taxRate : 0,
    providers: Array.isArray(cfg.providers) && cfg.providers.length ? cfg.providers : ["stripe", "crypto"],
  };
  const idx = COUNTRIES.findIndex((c) => c.code === code);
  if (idx >= 0) COUNTRIES[idx] = entry;
  else COUNTRIES.push(entry);
}

export function getCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
}

export function getCurrency(code) {
  return CURRENCIES[code] || CURRENCIES.USD;
}

export function listCountries() {
  return COUNTRIES;
}
export function listCurrencies() {
  return CURRENCIES;
}