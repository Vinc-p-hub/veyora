// URL & data normalization for the crawler pipeline.
// Pure functions — shared by backend functions and automated tests.

const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "mc_cid", "mc_eid", "ref", "ref_src", "igshid", "spm", "_gl",
];

export function canonicalizeUrl(rawUrl, baseUrl) {
  try {
    const u = new URL(rawUrl, baseUrl || undefined);
    TRACKING_PARAMS.forEach((p) => u.searchParams.delete(p));
    u.hash = "";
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch (_e) {
    return null;
  }
}

export function slugify(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeTitle(raw) {
  return (raw || "").toString().replace(/\s+/g, " ").trim();
}

export function normalizePrice(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function normalizeCurrency(raw) {
  const c = (raw || "").toString().trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

export function normalizeStock(raw) {
  const s = (raw || "").toString().toLowerCase();
  if (!s) return "UNKNOWN";
  if (s.includes("in stock") || s.includes("in_stock") || s.includes("instock") || s === "true") return "IN_STOCK";
  if (s.includes("out") || s === "false") return "OUT_OF_STOCK";
  if (s.includes("preorder") || s.includes("pre-order") || s.includes("presale")) return "PREORDER";
  if (s.includes("low") || s.includes("limited")) return "LOW_STOCK";
  return "UNKNOWN";
}

// Merchant feeds are messy: the brand field is sometimes the store's own name,
// a truncated string ("SON"), or a placeholder ("Unknown"). A brand is only
// kept when it is a real name; known aliases are spelled correctly and, when
// the source carries none, the product line itself identifies the maker
// (an "iPhone" is an Apple product — factual, never invented).
const PLACEHOLDER_BRANDS = new Set([
  "unknown", "n/a", "na", "none", "null", "unbranded", "generic", "other",
  "-", "—", "no brand", "غير محدد", "غير مصنف", "بدون ماركة", "الماركة", "ماركة",
]);

const BRAND_ALIASES = {
  "son": "Sony", "sony": "Sony", "sony corporation": "Sony",
  "hp": "HP", "hewlett-packard": "HP", "hewlett packard": "HP",
  "apple": "Apple", "apple inc": "Apple", "apple inc.": "Apple",
  "samsung": "Samsung", "samsung electronics": "Samsung",
  "lg": "LG", "lg electronics": "LG",
  "asus": "ASUS", "asustek": "ASUS", "msi": "MSI", "micro-star international": "MSI",
  "lenovo": "Lenovo", "dell": "Dell", "dell inc.": "Dell", "acer": "Acer",
  "nvidia": "NVIDIA", "amd": "AMD", "intel": "Intel", "gigabyte": "Gigabyte",
  "canon": "Canon", "nikon": "Nikon", "bose": "Bose", "jbl": "JBL",
  "sennheiser": "Sennheiser", "razer": "Razer", "logitech": "Logitech",
  "corsair": "Corsair", "kingston": "Kingston", "sandisk": "SanDisk",
  "seagate": "Seagate", "wd": "Western Digital", "western digital": "Western Digital",
  "tp-link": "TP-Link", "tplink": "TP-Link", "netgear": "Netgear", "anker": "Anker",
  "xiaomi": "Xiaomi", "huawei": "Huawei", "google": "Google", "microsoft": "Microsoft",
  "oneplus": "OnePlus", "nothing": "Nothing", "garmin": "Garmin", "gopro": "GoPro",
  "dyson": "Dyson", "nintendo": "Nintendo", "sonos": "Sonos", "philips": "Philips",
  "panasonic": "Panasonic", "toshiba": "Toshiba", "sharp": "Sharp",
  "epson": "Epson", "brother": "Brother", "realme": "Realme", "oppo": "OPPO",
  "vivo": "Vivo", "honor": "Honor", "tecno": "Tecno", "infinix": "Infinix",
};

// Unambiguous product lines → maker.
const BRAND_FROM_TITLE = [
  [/\b(iphone|ipad|ipod|macbook|imac|mac mini|mac studio|airpods|earpods|apple watch|apple tv|homepod)\b/i, "Apple"],
  [/\b(galaxy|odyssey)\b/i, "Samsung"],
  [/\b(pixel|nest|chromecast)\b/i, "Google"],
  [/\b(surface|xbox)\b/i, "Microsoft"],
  [/\b(playstation|bravia|xperia|walkman|wh-1000|wf-1000)\b/i, "Sony"],
  [/\b(thinkpad|ideapad|legion|yoga)\b/i, "Lenovo"],
  [/\b(predator|aspire|nitro)\b/i, "Acer"],
  [/\b(vivobook|zenbook|rog|tuf gaming)\b/i, "ASUS"],
  [/\b(pavilion|envy|omen|probook|elitebook)\b/i, "HP"],
  [/\b(inspiron|latitude|xps|alienware|vostro)\b/i, "Dell"],
];

function cleanBrand(raw) {
  const b = normalizeTitle(raw);
  if (!b || b.length > 40) return null;
  if (PLACEHOLDER_BRANDS.has(b.toLowerCase())) return null;
  // A brand is a name — never a breadcrumb or a sentence fragment.
  if (/[>/|]/.test(b)) return null;
  return BRAND_ALIASES[b.toLowerCase()] || b;
}

function brandFromTitle(title) {
  const t = normalizeTitle(title);
  if (!t) return null;
  for (const [re, brand] of BRAND_FROM_TITLE) if (re.test(t)) return brand;
  // A leading single word is only trusted when it really is a known brand.
  const m = t.match(/^([A-Z][A-Za-z&.\-]{1,20})(?:\s|$)/);
  return m ? BRAND_ALIASES[m[1].toLowerCase()] || null : null;
}

export function normalizeBrand(raw, title) {
  return cleanBrand(raw) || brandFromTitle(title);
}

// New taxonomy first (most specific wins); legacy values remain valid for old records.
// Any brand or product type outside these keywords still passes through (category is
// optional for publication) — discovery is never blocked by classification.
const CATEGORY_KEYWORDS = [
  ["Computer Components", ["gpu", "rtx", "gtx", "radeon", "graphics card", "cpu cooler", "processor", "motherboard", "nvme", "ssd", "ram module", "power supply", "psu", "pc case", "aio cooler", "imac", "mac mini", "mac studio", "desktop", "workstation", "pc parts", "pc components", "hard drive", "hdd", "كرت شاشة", "مذربورد", "لوحة أم", "مزودات الطاقة", "الصناديق", "مكونات الكمبيوتر", "قطع الكمبيوتر", "مكتبي", "كمبيوتر"]],
  ["Networking", ["router", "mesh wifi", "wifi 6", "wifi 7", "access point", "network switch", "modem", "range extender", "ethernet switch", "deco", "orbi", "networking", "شبكات"]],
  ["Headphones & Earbuds", ["headphone", "headset", "earbud", "earphone", "airpods", "wh-1000", "wf-1000", "سماعات", "سماعة"]],
  ["Smartwatches", ["smartwatch", "smart watch", "apple watch", "galaxy watch", "fitness tracker", "amazfit", "fenix", "forerunner", "ساعات", "ساعة ذكية"]],
  ["Tablets", ["ipad", "tablet", "galaxy tab", "fire hd", "tab s", "tab pro", "تابلت", "لوحي"]],
  ["Laptops", ["macbook", "laptop", "notebook", "thinkpad", "chromebook", "ideapad", "xps", "zenbook", "vivobook", "yoga book", "legion", "swift go", "gram ", "لابتوب", "لاب توب", "حاسوب محمول"]],
  ["Smartphones", ["iphone", "smartphone", "galaxy s", "galaxy z", "pixel", "oneplus", "redmi", "xiaomi", "nothing phone", "phone", "هواتف", "هاتف", "جوال", "موبايل"]],
  ["TVs & Monitors", ["television", " tv", "tv ", "smart tv", "monitor", "oled", "qled", "projector", "bravia", "nec display", "شاشات", "شاشة", "تلفزيون"]],
  ["Gaming", ["playstation", "ps5", "ps4", "xbox", "nintendo", "console", "steam deck", "gaming", "switch lite", "dualsense", "ألعاب", "العاب"]],
  // Short model codes ("r5", "r6", "z6", "z8") are deliberately absent: as bare
  // substrings they matched inside part numbers (…GX90R61025 → "Cameras").
  ["Cameras", ["camera", "lens", "dslr", "mirrorless", "gopro", "camcorder", "alpha 7", "كاميرا", "كاميرات"]],
  ["Audio", ["speaker", "soundbar", "amplifier", "receiver", "turntable", "hi-fi", "hifi", "subwoofer", "sonos", "gherkin", "صوتيات"]],
  ["Smart Home", ["smart home", "thermostat", "alexa", "google home", "doorbell", "vacuum", "nest", "hue", "echo", "roborock", "المنزل الذكي"]],
  ["Accessories", ["cable", "charger", "case", "keyboard", "mouse", "power bank", "adapter", "dock", "stylus", "stand", "memory card", "webcam", "toner", "ink cartridge", "printer", "إكسسوارات", "اكسسوارات", "ملحقات", "حبر", "خرطوشة", "طابعة"]],
];

export function inferCategory(text) {
  const t = (text || "").toLowerCase();
  for (const [cat, words] of CATEGORY_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return cat;
  }
  return null;
}

export const TAXONOMY = CATEGORY_KEYWORDS.map(([cat]) => cat);

// Legacy VEYRO values map onto the current taxonomy.
const LEGACY_CATEGORY_MAP = {
  phones: "Smartphones",
  computers: "Computer Components",
  tv: "TVs & Monitors",
  wearables: "Smartwatches",
};

// Merchants hand over free-form breadcrumbs ("PC Components > Motherboards > ASUS",
// "الكمبيوتر المكتبي > اتش بي > …", "Laptops & Accessories") that are not part of the
// VEYRO taxonomy and made products unreachable from category browsing. The product
// itself decides the taxonomy first; the source category is only a hint.
export function canonicalCategory(rawCategory, title = "", brand = "") {
  const raw = normalizeTitle(rawCategory);
  const rawLower = raw.toLowerCase();
  if (LEGACY_CATEGORY_MAP[rawLower]) return LEGACY_CATEGORY_MAP[rawLower];
  const fromProduct = inferCategory(`${title} ${brand}`);
  if (fromProduct) return fromProduct;
  const exact = TAXONOMY.find((c) => c.toLowerCase() === rawLower);
  if (exact) return exact;
  return inferCategory(raw);
}

// Variant extraction — real attributes parsed from the crawled title/data
// (storage, RAM, color, availability date). Nothing is invented: a field is
// only set when the source data actually carries it.
const COLOR_WORDS = [
  "black", "white", "blue", "navy", "silver", "gold", "graphite", "titanium",
  "burgundy", "maroon", "green", "purple", "pink", "red", "grey", "gray",
  "starlight", "midnight", "desert", "natural", "cosmic", "arctic", "lavender",
  "sage", "teal", "orange", "yellow", "bronze", "copper", "beige", "cream",
  "mint", "rose gold",
];

export function extractVariantInfo(raw) {
  const text = `${raw.title || ""} ${raw.name || ""}`.toLowerCase();
  const info = {};

  if (raw.color) info.color = String(raw.color);

  let ramIndex = -1;
  const ram = text.match(/(\d{1,3})\s?(tb|gb)\s?(?:ram|memory|unified|lpddr\w*)/);
  if (ram) {
    info.ram = `${ram[1]}${ram[2].toUpperCase()}`;
    ramIndex = ram.index;
  }

  // Storage: only when unambiguous (a single capacity, or the capacity that
  // follows the RAM figure) — never guess between "8GB 256GB".
  const units = [...text.matchAll(/(\d{1,4})\s?(tb|gb)(?!\s?(?:ram|memory|unified|lpddr))/g)];
  const afterRam = ram ? units.find((m) => m.index > ramIndex) : null;
  if (afterRam) info.storage = `${afterRam[1]}${afterRam[2].toUpperCase()}`;
  else if (!ram && units.length === 1) info.storage = `${units[0][1]}${units[0][2].toUpperCase()}`;

  if (!info.color) {
    const color = COLOR_WORDS.find((c) => text.includes(c));
    if (color) info.color = color.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  const available = raw.available_date || raw.release_date || raw.availability_date;
  if (available) info.available_date = String(available);

  if (Array.isArray(raw.variant_sample) && raw.variant_sample.length) {
    info.variants_count = raw.variant_sample.length;
  }

  const entries = Object.entries(info).filter(([, v]) => v !== undefined && v !== "");
  return entries.length ? Object.fromEntries(entries) : null;
}