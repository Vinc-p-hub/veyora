// Country, currency & payment-provider REGISTRY — international by design.
// ~185 countries ship in code as data rows; the Super Admin can add or override
// any country, currency or provider set as CountryConfig / CurrencyRate records
// (merged at runtime by RegionContext) without touching this file.

// [symbol, units per 1 USD]
const RAW_CURRENCIES = {
  USD: ["$", 1], EUR: ["€", 0.92], GBP: ["£", 0.79], CHF: ["CHF", 0.88],
  AED: ["د.إ", 3.67], SAR: ["ر.س", 3.75], QAR: ["ر.ق", 3.64], KWD: ["د.ك", 0.31],
  BHD: ["ب.د", 0.377], OMR: ["ر.ع", 0.385], JOD: ["د.أ", 0.71], ILS: ["₪", 3.7],
  LBP: ["ل.ل", 89000], IQD: ["ع.د", 1310], IRR: ["﷼", 42000], SYP: ["£س", 13000],
  YER: ["﷼", 250], EGP: ["ج.م", 48], MAD: ["د.م.", 10], DZD: ["د.ج", 134],
  TND: ["د.ت", 3.1], LYD: ["د.ل", 4.85], SDG: ["ج.س", 600], TRY: ["₺", 34],
  RUB: ["₽", 97], UAH: ["₴", 41], PLN: ["zł", 4], CZK: ["Kč", 24], HUF: ["Ft", 380],
  RON: ["lei", 4.6], BGN: ["лв", 1.8], DKK: ["kr", 6.9], SEK: ["kr", 11],
  NOK: ["kr", 11], ISK: ["kr", 138], CAD: ["C$", 1.36], MXN: ["MX$", 20],
  BRL: ["R$", 5.4], ARS: ["$", 1000], CLP: ["$", 950], COP: ["$", 4200],
  PEN: ["S/", 3.7], UYU: ["$U", 40], BOB: ["Bs", 6.9], PYG: ["₲", 7500],
  GYD: ["G$", 209], SRD: ["$", 35], VES: ["Bs.S", 37], CRC: ["₡", 520],
  GTQ: ["Q", 7.7], HNL: ["L", 25], NIO: ["C$", 36.8], DOP: ["RD$", 60],
  HTG: ["G", 131], JMD: ["J$", 157], BBD: ["Bds$", 2], BSD: ["B$", 1],
  XCD: ["EC$", 2.7], TTD: ["TT$", 6.8], BZD: ["BZ$", 2], PAB: ["B/.", 1],
  CUP: ["$", 24], JPY: ["¥", 155], CNY: ["¥", 7.2], HKD: ["HK$", 7.8],
  TWD: ["NT$", 32.5], KRW: ["₩", 1350], SGD: ["S$", 1.35], MYR: ["RM", 4.7],
  THB: ["฿", 34], IDR: ["Rp", 15800], PHP: ["₱", 58], VND: ["₫", 25000],
  INR: ["₹", 84], PKR: ["₨", 278], BDT: ["৳", 120], LKR: ["Rs", 295],
  NPR: ["Rs", 135], BTN: ["Nu.", 84], AFN: ["؋", 72], KZT: ["₸", 500],
  UZS: ["so'm", 12700], KGS: ["с", 87], TJS: ["SM", 10.7], TMT: ["m", 3.5],
  AZN: ["₼", 1.7], AMD: ["֏", 390], GEL: ["₾", 2.7], MNT: ["₮", 3400],
  KHR: ["៛", 4100], LAK: ["₭", 22000], MMK: ["K", 2100], BND: ["B$", 1.35],
  MOP: ["P", 8], MVR: ["Rf", 15.4], KPW: ["₩", 900],
  NGN: ["₦", 1580], GHS: ["₵", 15], XOF: ["CFA", 605], XAF: ["FCFA", 605],
  GMD: ["D", 71], GNF: ["FG", 8600], SLE: ["Le", 23], LRD: ["L$", 190],
  CVE: ["$", 102], MRU: ["UM", 40], ZMW: ["ZK", 27], MWK: ["MK", 1740],
  MZN: ["MT", 64], BWP: ["P", 13.6], NAD: ["N$", 18], ZAR: ["R", 18],
  SZL: ["E", 18], LSL: ["L", 18], ZWG: ["Z$", 26], ETB: ["Br", 57],
  KES: ["KSh", 129], TZS: ["TSh", 2700], UGX: ["USh", 3800], RWF: ["FRw", 1300],
  BIF: ["FBu", 2900], SOS: ["Sh", 571], DJF: ["Fdj", 178], ERN: ["Nfk", 15],
  SSP: ["SSP", 1300], CDF: ["FC", 2800], AOA: ["Kz", 910], MGA: ["Ar", 4500],
  MUR: ["₨", 46], SCR: ["₨", 14], KMF: ["CF", 451], STN: ["Db", 22.5],
  AUD: ["A$", 1.52], NZD: ["NZ$", 1.65], FJD: ["FJ$", 2.3], PGK: ["K", 3.9],
  WST: ["WS$", 2.7], SBD: ["SI$", 8.4], TOP: ["T$", 2.4], VUV: ["VT", 119],
  BYN: ["Br", 3.2], MDL: ["L", 17.7], MKD: ["ден", 57], RSD: ["дин", 108],
  ALL: ["L", 92], BAM: ["KM", 1.8],
};

// Payment service providers — expanded African / mobile-money coverage.
// The Super Admin assigns providers per country (data), this is the catalog.
export const PAYMENT_PROVIDERS = {
  stripe: { id: "stripe", name: "Stripe", desc: "Visa · Mastercard · Apple Pay · Google Pay", badge: "Global" },
  flutterwave: { id: "flutterwave", name: "Flutterwave", desc: "Cards · Mobile Money · Bank transfer", badge: "Africa" },
  paystack: { id: "paystack", name: "Paystack", desc: "Cards · Bank · USSD", badge: "Africa" },
  payunit: { id: "payunit", name: "PayUnit", desc: "MTN MoMo · Orange Money · Cards", badge: "Central Africa" },
  campay: { id: "campay", name: "Campay", desc: "MTN MoMo · Orange Money wallet", badge: "Central Africa" },
  mpesa: { id: "mpesa", name: "M-Pesa", desc: "Safaricom mobile money", badge: "East Africa" },
  mtn_momo: { id: "mtn_momo", name: "MTN MoMo", desc: "MTN Mobile Money wallet", badge: "Africa" },
  orange_money: { id: "orange_money", name: "Orange Money", desc: "Orange mobile money wallet", badge: "Africa" },
  wave: { id: "wave", name: "Wave", desc: "Mobile money · Senegal & Côte d'Ivoire", badge: "West Africa" },
  paymob: { id: "paymob", name: "Paymob", desc: "Cards · Mobile wallets (Egypt)", badge: "North Africa" },
  korapay: { id: "korapay", name: "Korapay", desc: "Cards · Bank transfers (Nigeria)", badge: "West Africa" },
  onafriq: { id: "onafriq", name: "Onafriq", desc: "Pan-African mobile money network", badge: "Africa" },
  alipay: { id: "alipay", name: "Alipay", desc: "Alipay wallet", badge: "China" },
  crypto: { id: "crypto", name: "Crypto", desc: "USDT · BTC · ETH", badge: "On-chain" },
  nexapay: { id: "nexapay", name: "NexaPay", desc: "Card · Mobile Money — secure hosted checkout", badge: "Global" },
};

// Region defaults: tax rate, shipping (USD) and default provider bundle.
const REGION_DEFAULTS = {
  mena:            { tax: 0.05, shipping: 15, providers: ["stripe", "crypto"] },
  europe:          { tax: 0.21, shipping: 14, providers: ["stripe", "crypto"] },
  asia:            { tax: 0.10, shipping: 20, providers: ["stripe", "crypto"] },
  americas:        { tax: 0.12, shipping: 18, providers: ["stripe", "crypto"] },
  oceania:         { tax: 0.10, shipping: 25, providers: ["stripe", "crypto"] },
  africa_north:    { tax: 0.14, shipping: 25, providers: ["flutterwave", "paymob", "crypto"] },
  africa_west:     { tax: 0.18, shipping: 25, providers: ["flutterwave", "paystack", "wave", "mtn_momo", "orange_money", "crypto"] },
  africa_central:  { tax: 0.19, shipping: 28, providers: ["flutterwave", "payunit", "mtn_momo", "orange_money", "crypto"] },
  africa_east:     { tax: 0.16, shipping: 26, providers: ["flutterwave", "mpesa", "mtn_momo", "crypto"] },
  africa_southern: { tax: 0.15, shipping: 28, providers: ["flutterwave", "paystack", "crypto"] },
};

// "code|name|currency|flag|region[|taxOverride][|providersOverride,comma,separated]"
const RAW_COUNTRIES = [
  "US|United States|USD|🇺🇸|americas|0|stripe,crypto",
  // ── Americas ──────────────────────────────────────────────────────────────
  "AR|Argentina|ARS|🇦🇷|americas", "BS|Bahamas|BSD|🇧🇸|americas", "BB|Barbados|BBD|🇧🇧|americas",
  "BZ|Belize|BZD|🇧🇿|americas", "BO|Bolivia|BOB|🇧🇴|americas", "BR|Brazil|BRL|🇧🇷|americas|0.17",
  "CA|Canada|CAD|🇨🇦|americas|0.13", "CL|Chile|CLP|🇨🇱|americas", "CO|Colombia|COP|🇨🇴|americas",
  "CR|Costa Rica|CRC|🇨🇷|americas", "CU|Cuba|CUP|🇨🇺|americas", "DM|Dominica|XCD|🇩🇲|americas",
  "DO|Dominican Republic|DOP|🇩🇴|americas", "EC|Ecuador|USD|🇪🇨|americas",
  "SV|El Salvador|USD|🇸🇻|americas", "GD|Grenada|XCD|🇬🇩|americas", "GT|Guatemala|GTQ|🇬🇹|americas",
  "GY|Guyana|GYD|🇬🇾|americas", "HT|Haiti|HTG|🇭🇹|americas", "HN|Honduras|HNL|🇭🇳|americas",
  "JM|Jamaica|JMD|🇯🇲|americas", "MX|Mexico|MXN|🇲🇽|americas|0.16", "NI|Nicaragua|NIO|🇳🇮|americas",
  "PA|Panama|PAB|🇵🇦|americas", "PY|Paraguay|PYG|🇵🇾|americas", "PE|Peru|PEN|🇵🇪|americas",
  "SR|Suriname|SRD|🇸🇷|americas", "TT|Trinidad & Tobago|TTD|🇹🇹|americas",
  "UY|Uruguay|UYU|🇺🇾|americas", "VE|Venezuela|VES|🇻🇪|americas",
  // ── Europe ────────────────────────────────────────────────────────────────
  "GB|United Kingdom|GBP|🇬🇧|europe|0.2", "FR|France|EUR|🇫🇷|europe|0.2",
  "DE|Germany|EUR|🇩🇪|europe|0.19", "ES|Spain|EUR|🇪🇸|europe|0.21",
  "PT|Portugal|EUR|🇵🇹|europe|0.23", "IT|Italy|EUR|🇮🇹|europe|0.22",
  "NL|Netherlands|EUR|🇳🇱|europe|0.21", "BE|Belgium|EUR|🇧🇪|europe|0.21",
  "AT|Austria|EUR|🇦🇹|europe|0.2", "IE|Ireland|EUR|🇮🇪|europe|0.23",
  "GR|Greece|EUR|🇬🇷|europe|0.24", "LU|Luxembourg|EUR|🇱🇺|europe|0.17",
  "FI|Finland|EUR|🇫🇮|europe|0.255", "SE|Sweden|SEK|🇸🇪|europe|0.25",
  "DK|Denmark|DKK|🇩🇰|europe|0.25", "NO|Norway|NOK|🇳🇴|europe|0.25",
  "IS|Iceland|ISK|🇮🇸|europe|0.24", "CH|Switzerland|CHF|🇨🇭|europe|0.081",
  "PL|Poland|PLN|🇵🇱|europe|0.23", "CZ|Czechia|CZK|🇨🇿|europe|0.21",
  "HU|Hungary|HUF|🇭🇺|europe|0.27", "RO|Romania|RON|🇷🇴|europe|0.19",
  "BG|Bulgaria|BGN|🇧🇬|europe|0.2", "HR|Croatia|EUR|🇭🇷|europe|0.25",
  "SI|Slovenia|EUR|🇸🇮|europe|0.22", "SK|Slovakia|EUR|🇸🇰|europe|0.2",
  "EE|Estonia|EUR|🇪🇪|europe|0.22", "LV|Latvia|EUR|🇱🇻|europe|0.21",
  "LT|Lithuania|EUR|🇱🇹|europe|0.21", "CY|Cyprus|EUR|🇨🇾|europe|0.19",
  "MT|Malta|EUR|🇲🇹|europe|0.18", "MC|Monaco|EUR|🇲🇨|europe", "AD|Andorra|EUR|🇦🇩|europe",
  "LI|Liechtenstein|CHF|🇱🇮|europe", "SM|San Marino|EUR|🇸🇲|europe", "AL|Albania|ALL|🇦🇱|europe",
  "BA|Bosnia & Herzegovina|BAM|🇧🇦|europe", "ME|Montenegro|EUR|🇲🇪|europe",
  "MK|North Macedonia|MKD|🇲🇰|europe", "RS|Serbia|RSD|🇷🇸|europe", "XK|Kosovo|EUR|🇽🇰|europe",
  "MD|Moldova|MDL|🇲🇩|europe", "UA|Ukraine|UAH|🇺🇦|europe", "BY|Belarus|BYN|🇧🇾|europe",
  "RU|Russia|RUB|🇷🇺|europe",
  // ── Middle East & North Africa ─────────────────────────────────────────────
  "AE|United Arab Emirates|AED|🇦🇪|mena|0.05|stripe,paystack,nexapay,crypto",
  "SA|Saudi Arabia|SAR|🇸🇦|mena|0.15", "QA|Qatar|QAR|🇶🇦|mena", "KW|Kuwait|KWD|🇰🇼|mena",
  "BH|Bahrain|BHD|🇧🇭|mena", "OM|Oman|OMR|🇴🇲|mena", "JO|Jordan|JOD|🇯🇴|mena",
  "LB|Lebanon|LBP|🇱🇧|mena", "IQ|Iraq|IQD|🇮🇶|mena", "YE|Yemen|YER|🇾🇪|mena",
  "PS|Palestine|ILS|🇵🇸|mena", "IL|Israel|ILS|🇮🇱|mena", "TR|Turkey|TRY|🇹🇷|mena|0.2",
  "DZ|Algeria|DZD|🇩🇿|africa_north", "EG|Egypt|EGP|🇪🇬|africa_north|0.14|flutterwave,paymob,crypto",
  "LY|Libya|LYD|🇱🇾|africa_north", "MA|Morocco|MAD|🇲🇦|africa_north",
  "TN|Tunisia|TND|🇹🇳|africa_north", "SD|Sudan|SDG|🇸🇩|africa_north",
  // ── West Africa ───────────────────────────────────────────────────────────
  "NG|Nigeria|NGN|🇳🇬|africa_west|0.075|paystack,payunit,flutterwave,korapay,onafriq,crypto",
  "GH|Ghana|GHS|🇬🇭|africa_west|0.16|flutterwave,paystack,mtn_momo,wave,onafriq,crypto",
  "SN|Senegal|XOF|🇸🇳|africa_west|0.18|payunit,wave,flutterwave,orange_money,onafriq,crypto",
  "CI|Côte d'Ivoire|XOF|🇨🇮|africa_west|0.18|flutterwave,wave,mtn_momo,orange_money,onafriq,crypto",
  "BJ|Benin|XOF|🇧🇯|africa_west", "BF|Burkina Faso|XOF|🇧🇫|africa_west",
  "CV|Cape Verde|CVE|🇨🇻|africa_west", "GM|Gambia|GMD|🇬🇲|africa_west",
  "GN|Guinea|GNF|🇬🇳|africa_west", "GW|Guinea-Bissau|XOF|🇬🇼|africa_west",
  "LR|Liberia|LRD|🇱🇷|africa_west", "ML|Mali|XOF|🇲🇱|africa_west",
  "MR|Mauritania|MRU|🇲🇷|africa_west", "NE|Niger|XOF|🇳🇪|africa_west",
  "SL|Sierra Leone|SLE|🇸🇱|africa_west", "TG|Togo|XOF|🇹🇬|africa_west",
  // ── Central Africa ────────────────────────────────────────────────────────
  "CM|Cameroon|XAF|🇨🇲|africa_central|0.1925|payunit,flutterwave,mtn_momo,orange_money,onafriq,crypto",
  "AO|Angola|AOA|🇦🇴|africa_central", "CF|Central African Republic|XAF|🇨🇫|africa_central",
  "TD|Chad|XAF|🇹🇩|africa_central", "CG|Republic of the Congo|XAF|🇨🇬|africa_central",
  "CD|DR Congo|CDF|🇨🇩|africa_central|0.16|payunit,flutterwave,mtn_momo,onafriq,crypto",
  "GQ|Equatorial Guinea|XAF|🇬🇶|africa_central", "GA|Gabon|XAF|🇬🇦|africa_central",
  "ST|São Tomé & Príncipe|STN|🇸🇹|africa_central",
  // ── East Africa ───────────────────────────────────────────────────────────
  "KE|Kenya|KES|🇰🇪|africa_east|0.16|flutterwave,mpesa,mtn_momo,onafriq,crypto",
  "TZ|Tanzania|TZS|🇹🇿|africa_east|0.18|flutterwave,mpesa,mtn_momo,onafriq,crypto",
  "UG|Uganda|UGX|🇺🇬|africa_east|0.18|flutterwave,mpesa,mtn_momo,onafriq,crypto",
  "RW|Rwanda|RWF|🇷🇼|africa_east|0.18|flutterwave,mpesa,mtn_momo,onafriq,crypto",
  "ET|Ethiopia|ETB|🇪🇹|africa_east|0.15|flutterwave,mtn_momo,onafriq,crypto",
  "BI|Burundi|BIF|🇧🇮|africa_east", "DJ|Djibouti|DJF|🇩🇯|africa_east",
  "ER|Eritrea|ERN|🇪🇷|africa_east", "MG|Madagascar|MGA|🇲🇬|africa_east",
  "MW|Malawi|MWK|🇲🇼|africa_east", "MU|Mauritius|MUR|🇲🇺|africa_east",
  "MZ|Mozambique|MZN|🇲🇿|africa_east", "SC|Seychelles|SCR|🇸🇨|africa_east",
  "SO|Somalia|SOS|🇸🇴|africa_east", "SS|South Sudan|SSP|🇸🇸|africa_east",
  "ZM|Zambia|ZMW|🇿🇲|africa_east|0.16|flutterwave,mpesa,mtn_momo,onafriq,crypto",
  "ZW|Zimbabwe|ZWG|🇿🇼|africa_east", "KM|Comoros|KMF|🇰🇲|africa_east",
  // ── Southern Africa ──────────────────────────────────────────────────────
  "ZA|South Africa|ZAR|🇿🇦|africa_southern|0.15|paystack,stripe,flutterwave,crypto",
  "BW|Botswana|BWP|🇧🇼|africa_southern", "NA|Namibia|NAD|🇳🇦|africa_southern",
  "SZ|Eswatini|SZL|🇸🇿|africa_southern", "LS|Lesotho|LSL|🇱🇸|africa_southern",
  // ── Asia ─────────────────────────────────────────────────────────────────
  "CN|China|CNY|🇨🇳|asia|0.13|alipay,crypto", "JP|Japan|JPY|🇯🇵|asia|0.1",
  "KR|South Korea|KRW|🇰🇷|asia|0.1", "HK|Hong Kong|HKD|🇭🇰|asia",
  "TW|Taiwan|TWD|🇹🇼|asia|0.05", "SG|Singapore|SGD|🇸🇬|asia|0.09",
  "MY|Malaysia|MYR|🇲🇾|asia|0.1", "TH|Thailand|THB|🇹🇭|asia|0.07",
  "VN|Vietnam|VND|🇻🇳|asia|0.1", "ID|Indonesia|IDR|🇮🇩|asia|0.11",
  "PH|Philippines|PHP|🇵🇭|asia|0.12", "IN|India|INR|🇮🇳|asia|0.18|stripe,paystack,flutterwave,onafriq,crypto",
  "PK|Pakistan|PKR|🇵🇰|asia|0.17", "BD|Bangladesh|BDT|🇧🇩|asia|0.15",
  "LK|Sri Lanka|LKR|🇱🇰|asia|0.18", "NP|Nepal|NPR|🇳🇵|asia|0.13",
  "BT|Bhutan|BTN|🇧🇹|asia", "AF|Afghanistan|AFN|🇦🇫|asia",
  "IR|Iran|IRR|🇮🇷|asia", "SY|Syria|SYP|🇸🇾|asia",
  "GE|Georgia|GEL|🇬🇪|asia|0.18", "AM|Armenia|AMD|🇦🇲|asia|0.2",
  "AZ|Azerbaijan|AZN|🇦🇿|asia|0.18", "KZ|Kazakhstan|KZT|🇰🇿|asia|0.12",
  "UZ|Uzbekistan|UZS|🇺🇿|asia|0.12", "KG|Kyrgyzstan|KGS|🇰🇬|asia|0.12",
  "TJ|Tajikistan|TJS|🇹🇯|asia", "TM|Turkmenistan|TMT|🇹🇲|asia",
  "MN|Mongolia|MNT|🇲🇳|asia|0.1", "KH|Cambodia|KHR|🇰🇭|asia",
  "LA|Laos|LAK|🇱🇦|asia", "MM|Myanmar|MMK|🇲🇲|asia", "BN|Brunei|BND|🇧🇳|asia",
  "MO|Macau|MOP|🇲🇴|asia", "MV|Maldives|MVR|🇲🇻|asia", "KP|North Korea|KPW|🇰🇵|asia",
  "TL|Timor-Leste|USD|🇹🇱|asia",
  // ── Oceania ───────────────────────────────────────────────────────────────
  "AU|Australia|AUD|🇦🇺|oceania|0.1", "NZ|New Zealand|NZD|🇳🇿|oceania|0.15",
  "FJ|Fiji|FJD|🇫🇯|oceania", "PG|Papua New Guinea|PGK|🇵🇬|oceania",
  "WS|Samoa|WST|🇼🇸|oceania", "SB|Solomon Islands|SBD|🇸🇧|oceania",
  "TO|Tonga|TOP|🇹🇴|oceania", "VU|Vanuatu|VUV|🇻🇺|oceania",
];

export const CURRENCIES = Object.fromEntries(
  Object.entries(RAW_CURRENCIES).map(([code, [symbol, rate]]) => [code, { code, symbol, rate }])
);

export const COUNTRIES = RAW_COUNTRIES.map((row) => {
  const [code, name, currency, flag, region, tax, providers] = row.split("|");
  const def = REGION_DEFAULTS[region] || REGION_DEFAULTS.europe;
  return {
    code,
    name,
    currency,
    flag,
    shipping: def.shipping,
    taxRate: tax ? parseFloat(tax) : def.tax,
    providers: providers ? providers.split(",") : def.providers,
  };
});

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