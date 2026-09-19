// Country & currency engine — drives catalog, checkout, payment providers.
// Not hardcoded into business logic; admin-configurable in a full build.

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
};

export const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD", flag: "🇺🇸", shipping: 0, taxRate: 0.0, providers: ["stripe", "crypto"] },
  { code: "AE", name: "United Arab Emirates", currency: "AED", flag: "🇦🇪", shipping: 15, taxRate: 0.05, providers: ["stripe", "paystack", "crypto"] },
  { code: "GB", name: "United Kingdom", currency: "GBP", flag: "🇬🇧", shipping: 12, taxRate: 0.2, providers: ["stripe", "crypto"] },
  { code: "FR", name: "France", currency: "EUR", flag: "🇫🇷", shipping: 14, taxRate: 0.2, providers: ["stripe", "crypto"] },
  { code: "NG", name: "Nigeria", currency: "NGN", flag: "🇳🇬", shipping: 25, taxRate: 0.075, providers: ["paystack", "payunit", "crypto"] },
  { code: "CA", name: "Canada", currency: "CAD", flag: "🇨🇦", shipping: 12, taxRate: 0.13, providers: ["stripe", "crypto"] },
  { code: "AU", name: "Australia", currency: "AUD", flag: "🇦🇺", shipping: 18, taxRate: 0.1, providers: ["stripe", "crypto"] },
  { code: "SN", name: "Senegal", currency: "XOF", flag: "🇸🇳", shipping: 30, taxRate: 0.18, providers: ["payunit", "crypto"] },
];

export const PAYMENT_PROVIDERS = {
  stripe: { id: "stripe", name: "Stripe", desc: "Card / Apple Pay / Google Pay", badge: "Global" },
  paystack: { id: "paystack", name: "Paystack", desc: "Card / Bank / USSD", badge: "Africa" },
  payunit: { id: "payunit", name: "PayUnit", desc: "Mobile Money / Card", badge: "Central Africa" },
  crypto: { id: "crypto", name: "Crypto", desc: "USDT / BTC / ETH", badge: "On-chain" },
};

export const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
];

export function getCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
}
export function getCurrency(code) {
  return CURRENCIES[code] || CURRENCIES.USD;
}