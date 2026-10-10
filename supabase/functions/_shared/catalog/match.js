// Product deduplication / matching engine.
// Signals: GTIN, MPN, SKU, canonical URL, slug, brand + title similarity.
// Never merges unrelated products — uncertain matches go to MANUAL_REVIEW.

import { slugify } from "./normalize.js";

function tokenSet(s) {
  return new Set(slugify(s).split("-").filter((t) => t.length > 1));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function matchProduct(raw, candidates) {
  let best = { confidence: 0, product: null, reason: null };
  for (const c of candidates) {
    let conf = 0;
    let reason = null;
    if (raw.gtin && c.gtin && String(raw.gtin) === String(c.gtin)) {
      conf = 1; reason = "gtin";
    } else if (raw.mpn && raw.brand && c.mpn && String(raw.mpn) === String(c.mpn) &&
      String(raw.brand).toLowerCase() === String(c.brand || "").toLowerCase()) {
      conf = 0.95; reason = "mpn+brand";
    } else if (raw.sku && raw.brand && c.sku && String(raw.sku) === String(c.sku) &&
      String(raw.brand).toLowerCase() === String(c.brand || "").toLowerCase()) {
      conf = 0.9; reason = "sku+brand";
    }
    if (conf === 0 && raw.canonical_url && c.canonical_url === raw.canonical_url) {
      conf = 0.98; reason = "canonical_url";
    }
    if (conf === 0 && raw.slug && c.slug === raw.slug) {
      conf = 0.9; reason = "slug";
    }
    if (conf === 0 && raw.title && c.name) {
      const brandMatch = raw.brand && c.brand &&
        String(raw.brand).toLowerCase() === String(c.brand).toLowerCase();
      const t = jaccard(tokenSet(raw.title), tokenSet(c.name + " " + (c.brand || "")));
      if (t > 0.45) {
        conf = Math.min(0.85, t + (brandMatch ? 0.2 : 0));
        reason = "title";
      }
    }
    if (conf > best.confidence) best = { confidence: conf, product: c, reason };
    if (best.confidence >= 1) break;
  }
  const decision =
    best.confidence >= 0.9 ? "AUTO_MATCH" :
    best.confidence >= 0.6 ? "MANUAL_REVIEW" : "NEW";
  return { ...best, decision };
}