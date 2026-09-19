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

export function normalizeBrand(raw, title) {
  const b = normalizeTitle(raw);
  if (b) return b;
  const m = (title || "").match(/^([A-Z][A-Za-z&.\- ]{1,20})\s/);
  return m ? m[1].trim() : null;
}

// New taxonomy first (most specific wins); legacy values remain valid for old records.
// Any brand or product type outside these keywords still passes through (category is
// optional for publication) — discovery is never blocked by classification.
const CATEGORY_KEYWORDS = [
  ["Computer Components", ["gpu", "rtx", "gtx", "radeon", "graphics card", "cpu cooler", "processor", "motherboard", "nvme", "ssd", "ram module", "power supply", "psu", "pc case", "aio cooler", "imac", "mac mini", "mac studio", "desktop", "workstation"]],
  ["Networking", ["router", "mesh wifi", "wifi 6", "wifi 7", "access point", "network switch", "modem", "range extender", "ethernet switch", "deco", "orbi"]],
  ["Headphones & Earbuds", ["headphone", "headset", "earbud", "earphone", "airpods", "wh-1000", "wf-1000"]],
  ["Smartwatches", ["smartwatch", "smart watch", "apple watch", "galaxy watch", "fitness tracker", "amazfit", "fenix", "forerunner"]],
  ["Tablets", ["ipad", "tablet", "galaxy tab", "fire hd", "tab s", "tab pro"]],
  ["Laptops", ["macbook", "laptop", "notebook", "thinkpad", "chromebook", "ideapad", "xps", "zenbook", "vivobook", "yoga book", "legion", "swift go", "gram "]],
  ["Smartphones", ["iphone", "smartphone", "galaxy s", "galaxy z", "pixel", "oneplus", "redmi", "xiaomi", "nothing phone", "phone"]],
  ["TVs & Monitors", ["television", " tv", "tv ", "smart tv", "monitor", "oled", "qled", "projector", "bravia", "nec display"]],
  ["Gaming", ["playstation", "ps5", "ps4", "xbox", "nintendo", "console", "steam deck", "gaming", "switch lite", "dualsense"]],
  ["Cameras", ["camera", "lens", "dslr", "mirrorless", "gopro", "camcorder", "eos", "alpha 7", "z6", "z8", "r5", "r6"]],
  ["Audio", ["speaker", "soundbar", "amplifier", "receiver", "turntable", "hi-fi", "hifi", "subwoofer", "sonos", "gherkin"]],
  ["Smart Home", ["smart home", "thermostat", "alexa", "google home", "doorbell", "vacuum", "nest", "hue", "echo", "roborock"]],
  ["Accessories", ["cable", "charger", "case", "keyboard", "mouse", "power bank", "adapter", "dock", "stylus", "stand", "memory card", "webcam"]],
];

export function inferCategory(text) {
  const t = (text || "").toLowerCase();
  for (const [cat, words] of CATEGORY_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return cat;
  }
  return null;
}