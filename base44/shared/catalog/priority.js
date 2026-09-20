// NEW ARRIVALS & flagship priority targeting.
// VEYRO actively prioritizes smartphones and laptops from major premium brands
// — and any freshly discovered product — across discovery, queue processing
// and price/stock refreshes. Pure functions, shared backend-wide.
import { inferCategory } from "./normalize.js";

// Brand keywords used on the crawled title/name (word tokens, not substrings,
// so "sharp" never matches "hp").
const BRAND_TOKENS = [
  "apple", "iphone", "macbook", "imac", "ipad", "samsung", "galaxy", "google",
  "pixel", "xiaomi", "redmi", "poco", "oneplus", "huawei", "honor", "oppo",
  "vivo", "nothing", "motorola", "sony", "vaio", "lenovo", "thinkpad",
  "ideapad", "dell", "xps", "inspiron", "hp", "asus", "zenbook", "vivobook",
  "rog", "acer", "predator", "msi", "razer", "lg", "microsoft", "surface",
  "alienware", "framework", "tcl", "tecno", "infinix",
  // Extra phone/computer brand coverage — flagships discovered anywhere get
  // the same accent as the flagship list.
  "realme", "zte", "nubia", "nokia", "fairphone", "gigabyte", "omen",
  "victus", "pavilion", "elitebook", "spectre", "zenfone", "legion",
  "yoga", "thinkbook", "matebook", "mac", "notebook", "laptop", "gaming",
  // Priority consumer-electronics brands (global catalog network).
  "bose", "sennheiser", "jbl", "anker", "logitech", "dyson", "garmin",
  "gopro", "dji", "canon", "nikon", "fujifilm", "panasonic", "nintendo",
  "playstation", "xbox", "sony", "playstation5", "airpods", "watch",
];

// The brands whose new releases must reach the catalog first.
export const PRIORITY_BRANDS = new Set([
  "apple", "samsung", "google", "xiaomi", "oneplus", "huawei", "honor",
  "oppo", "vivo", "nothing", "motorola", "sony", "lenovo", "dell", "hp",
  "asus", "acer", "msi", "razer", "lg", "microsoft", "alienware", "tcl",
  "tecno", "infinix", "vaio", "framework",
  "realme", "zte", "nubia", "nokia", "gigabyte",
  "bose", "sennheiser", "jbl", "anker", "logitech", "dyson", "garmin",
  "gopro", "dji", "canon", "nikon", "nintendo",
]);

// Flagship device / computer categories + the VEYRO priority categories
// (smartphones, laptops, tablets, gaming, audio, cameras, smartwatches).
export const PRIORITY_CATEGORIES = new Set([
  "Smartphones", "Laptops", "Phones", "Computers", "Tablets",
  "Computer Components",
  "Gaming", "Audio", "Cameras", "Smartwatches", "Headphones & Earbuds",
]);

// A product counts as a "new arrival" during this window after discovery.
export const NEW_ARRIVAL_DAYS = 30;

function tokens(text) {
  return (text || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function isPriorityBrand(brand, title = "") {
  const b = (brand || "").toString().toLowerCase().trim();
  if (PRIORITY_BRANDS.has(b)) return true;
  const ts = tokens(title);
  return BRAND_TOKENS.some((w) => ts.includes(w));
}

export function isPriorityCategory(category) {
  return PRIORITY_CATEGORIES.has(category);
}

// Queue priority for a discovered product (lower = processed first).
// Flagship phones/laptops from major brands jump ahead of everything else.
export function discoveryPriority({ title, brand, category } = {}, fallback = 5) {
  const t = title || "";
  const pBrand = isPriorityBrand(brand, t);
  const cat = category || inferCategory(`${t} ${brand || ""}`) || "";
  const pCat = isPriorityCategory(cat);
  if (pBrand && pCat) return 1; // absolute priority: new iPhone/Galaxy/Pixel/MacBook…
  if (pBrand) return 2; // other products from priority brands
  if (pCat) return 3; // any smartphone / laptop / computer
  return fallback;
}

export function isNewArrival(product, nowMs = Date.now()) {
  const ref = product.first_seen_at || product.created_date;
  if (!ref) return false;
  return nowMs - new Date(ref).getTime() < NEW_ARRIVAL_DAYS * 86400000;
}