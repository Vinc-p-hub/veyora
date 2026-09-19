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

const CATEGORY_KEYWORDS = [
  ["Phones", ["iphone", "smartphone", "galaxy s", "pixel", "phone"]],
  ["Computers", ["macbook", "laptop", "notebook", "computer", "imac", "thinkpad", "chromebook"]],
  ["Gaming", ["playstation", "xbox", "console", "gaming", "nintendo", "steam deck"]],
  ["Audio", ["headphone", "earbud", "speaker", "soundbar", "airpods", "wh-1000"]],
  ["Cameras", ["camera", "lens", "dslr", "mirrorless", "gopro"]],
  ["TV", ["tv", "television", "projector", "oled"]],
  ["Smart Home", ["smart home", "thermostat", "alexa", "google home", "doorbell", "vacuum"]],
  ["Wearables", ["watch", "fitness band", "smartwatch", "galaxy watch"]],
  ["Accessories", ["cable", "charger", "case", "keyboard", "mouse", "power bank", "adapter"]],
];

export function inferCategory(text) {
  const t = (text || "").toLowerCase();
  for (const [cat, words] of CATEGORY_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return cat;
  }
  return null;
}